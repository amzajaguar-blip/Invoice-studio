import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  AccessibilityInfo, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Purchases, { PurchasesPackage, PurchasesOffering } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Timeout sul solo caricamento delle offering RevenueCat.
 *
 * NON copre purchasePackage(): da quando si apre la sheet di Google Play il
 * tempo lo detta l'utente — aggiunta di un metodo di pagamento, conferma SCA/3DS
 * della banca. Un timeout su quella fase mostrava "errore" su un acquisto ancora
 * in corso, e colpiva molto più spesso il piano annuale (39,99 €, quasi sempre
 * soggetto a verifica) che il mensile (4,99 €, addebito immediato).
 */
const OFFERINGS_TIMEOUT_MS = 15_000;
/** Duration of the success animation before auto-navigating back. Max 500ms. */
const SUCCESS_ANIM_DURATION_MS = 400;
const SUCCESS_DISPLAY_MS = 500;

// IDs MUST match the RevenueCat / Google Play Console products exactly.
// Configured on Play Console + RevenueCat as base plans:
//   monthly → "vela.premium.monthly"
//   yearly  → "vela_premium_yearly"  (base plan "vela-premium-yearly-base")
// Match uses startsWith() to be robust against qualified base plan identifiers
// (e.g. "vela_premium_yearly:vela-premium-yearly-base").
const PRODUCT_IDS = {
  monthly: 'vela.premium.monthly',
  yearly: 'vela_premium_yearly',
} as const;

/**
 * Restituisce le info sul trial SOLO se RevenueCat / Google Play lo hanno
 * configurato per il prodotto. Su Google Play il trial gratuito è esposto
 * come introPrice con prezzo 0; se non c'è (o è solo uno sconto), non lo
 * mostriamo. Ritorna { hasTrial:false } quando l'offering non è disponibile.
 *
 * Sicurezza eligibilità: se l'utente ha già usato il trial, Google Play non
 * restituisce introPrice nell'offering — quindi hasTrial sarà false
 * automaticamente. Nessun check aggiuntivo lato app necessario.
 *
 * Piano annuale: nessuna offerta trial configurata in baseline — introPrice
 * sarà null → hasTrial = false. Questa funzione è sicura per entrambi i piani.
 */
function trialFor(offering: PurchasesOffering | null, productId: string, t: (key: string) => string): { hasTrial: boolean; text: string } {
  const pkg = offering?.availablePackages?.find((p) => p.product.identifier?.startsWith(productId));
  const intro = pkg?.product?.introPrice;
  if (!intro || Number(intro.price) !== 0) return { hasTrial: false, text: "" };

  const units = intro.periodNumberOfUnits ?? 0;
  const unit = String(intro.periodUnit ?? "").toUpperCase();
  const label =
    unit === "DAY" ? t(units === 1 ? "modal.pro_upgrade.trial.day.singular" : "modal.pro_upgrade.trial.day.plural") :
    unit === "WEEK" ? t(units === 1 ? "modal.pro_upgrade.trial.week.singular" : "modal.pro_upgrade.trial.week.plural") :
    unit === "MONTH" ? t(units === 1 ? "modal.pro_upgrade.trial.month.singular" : "modal.pro_upgrade.trial.month.plural") :
    unit === "YEAR" ? t(units === 1 ? "modal.pro_upgrade.trial.year.singular" : "modal.pro_upgrade.trial.year.plural") : t("modal.pro_upgrade.trial.fallback");
  return { hasTrial: true, text: t("modal.pro_upgrade.trial.template").replace("{n}", String(units)).replace("{label}", label) };
}

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [purchaseState, setPurchaseState] = useState<"idle" | "loading" | "restoring" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True mentre un acquisto è in volo — blocca il rientro da "Riprova". */
  const purchaseInFlight = useRef(false);
  // Offering RC caricata all'avvio: usata per mostrare il trial SOLO se
  // configurato su RevenueCat / Google Play (introPrice con prezzo 0).
  const [rcOffering, setRcOffering] = useState<PurchasesOffering | null>(null);

  // Req 18.4: success animation refs
  const successScaleAnim = useRef(new Animated.Value(0.8)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Carica le offering RC all'avvio per mostrare il trial solo se configurato
  // su RevenueCat / Google Play (altrimenti introPrice è null e non si vede).
  useEffect(() => {
    let active = true;
    Purchases.getOfferings()
      .then((o) => { if (active) setRcOffering(o.current ?? null); })
      .catch(() => { if (active) setRcOffering(null); });
    return () => { active = false; };
  }, []);

  // Req 18.4: Trigger success animation when purchaseState becomes 'success'
  useEffect(() => {
    if (purchaseState !== "success") return;

    if (reduceMotion) {
      // Skip animation, just display the success card briefly then navigate
      const t = setTimeout(() => router.replace("/(app)/(tabs)" as any), SUCCESS_DISPLAY_MS);
      return () => clearTimeout(t);
    }

    // Reset animation values
    successScaleAnim.setValue(0.8);
    successOpacityAnim.setValue(0);

    let navTimer: ReturnType<typeof setTimeout> | null = null;

    Animated.parallel([
      Animated.timing(successScaleAnim, {
        toValue: 1,
        duration: SUCCESS_ANIM_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacityAnim, {
        toValue: 1,
        duration: SUCCESS_ANIM_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After animation completes, brief pause then navigate
      navTimer = setTimeout(() => router.replace("/(app)/(tabs)" as any), 200);
    });

    // Cleanup: cancella il timer se il componente si smonta prima della navigazione
    return () => {
      if (navTimer) clearTimeout(navTimer);
    };
  }, [purchaseState, reduceMotion]);

  const packages = [
    { id: "monthly" as const, title: t("modal.pro_upgrade.plan.monthly.title"), price: t("modal.pro_upgrade.plan.monthly.price"), recurring: t("modal.pro_upgrade.plan.monthly.recurring"), productId: PRODUCT_IDS.monthly },
    { id: "yearly" as const, title: t("modal.pro_upgrade.plan.yearly.title"), price: t("modal.pro_upgrade.plan.yearly.price"), recurring: t("modal.pro_upgrade.plan.yearly.recurring"), tag: t("modal.pro_upgrade.plan.yearly.tag"), productId: PRODUCT_IDS.yearly },
  ];

  /** Carica le offering con timeout, senza estenderlo al flusso di acquisto. */
  const loadOfferingsWithTimeout = async () => {
    return new Promise<Awaited<ReturnType<typeof Purchases.getOfferings>>>((resolve, reject) => {
      timeoutRef.current = setTimeout(
        () => reject(new Error(t("modal.pro_upgrade.error.timeout"))),
        OFFERINGS_TIMEOUT_MS,
      );
      Purchases.getOfferings()
        .then(resolve, reject)
        .finally(() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        });
    });
  };

  const handleSubscribe = async () => {
    // Guardia di rientro: senza questa, "Riprova" durante un acquisto ancora
    // aperto manda una seconda purchasePackage a RevenueCat, che risponde con
    // un errore di operazione già in corso e lascia orfano il timer precedente.
    if (purchaseInFlight.current) return;
    purchaseInFlight.current = true;

    setPurchaseState("loading");
    setErrorMessage("");

    try {
      const offerings = await loadOfferingsWithTimeout();
      if (!offerings.current) {
        throw new Error(t("modal.pro_upgrade.error.loading_prices"));
      }

      // Mappiamo il piano selezionato all'ID prodotto RevenueCat/Google Play.
      // Usa startsWith() per coprire sia l'identifier semplice sia il qualified
      // base plan (es. "vela_premium_yearly:vela-premium-yearly-base").
      const targetId = PRODUCT_IDS[selectedPlan];
      const pkg = offerings.current.availablePackages.find(
        (p: PurchasesPackage) => !!p.product.identifier?.startsWith(targetId)
      );

      if (!pkg) {
        // Diagnostica: distingue "prodotto assente dall'offering" da un
        // mismatch di identifier, i due casi che si presentano identici a video.
        console.warn(
          `[ProUpgrade] nessun package per "${targetId}" — identifier disponibili nell'offering "${offerings.current.identifier}":`,
          offerings.current.availablePackages.map((p: PurchasesPackage) => p.product.identifier),
        );
        throw new Error(`${t("modal.pro_upgrade.error.product_not_found")} (${targetId})`);
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (customerInfo.entitlements.active['pro']) {
        setPurchaseState("success");
      } else {
        // L'acquisto è andato a buon fine su Google Play ma RevenueCat non ha
        // attivato l'entitlement 'pro': tipicamente il prodotto non è agganciato
        // all'entitlement nel progetto RevenueCat.
        console.warn(
          `[ProUpgrade] acquisto completato ma entitlement 'pro' assente per "${pkg.product.identifier}" — entitlement attivi:`,
          Object.keys(customerInfo.entitlements.active),
        );
        setPurchaseState("error");
        setErrorMessage(t("modal.pro_upgrade.error.subscription_not_detected"));
      }
    } catch (e: any) {
      if (e?.userCancelled) {
        setPurchaseState("idle");
        return;
      }
      // Il codice RevenueCat (ProductNotAvailableForPurchaseError,
      // PurchaseNotAllowedError, ReceiptAlreadyInUseError…) è l'unica
      // informazione che rende diagnosticabile un fallimento da remoto:
      // senza, ogni causa diversa arriva come lo stesso messaggio generico.
      const code = e?.code ?? e?.userInfo?.readableErrorCode;
      console.warn("[ProUpgrade] acquisto fallito", {
        plan: selectedPlan,
        productId: PRODUCT_IDS[selectedPlan],
        code,
        message: e?.message,
        underlying: e?.underlyingErrorMessage,
      });
      setPurchaseState("error");
      const base = e?.message || t("modal.pro_upgrade.error.unknown");
      setErrorMessage(code ? `${base} [${code}]` : base);
    } finally {
      purchaseInFlight.current = false;
    }
  };

  const handleRetry = () => {
    if (purchaseInFlight.current) return;
    setPurchaseState("idle");
    setErrorMessage("");
    handleSubscribe();
  };

  const handleRestore = async () => {
    setPurchaseState("restoring");
    setErrorMessage("");
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['pro']) {
        setPurchaseState("success");
      } else {
        setPurchaseState("error");
        setErrorMessage(t("modal.pro_upgrade.restore.not_found"));
      }
    } catch (e: any) {
      setPurchaseState("error");
      setErrorMessage(e.message || t("modal.pro_upgrade.restore.error"));
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPlan)!;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Intestazione */}
      <View style={s.header}>
        <Text style={s.title}>{t("modal.pro_upgrade.title")}</Text>
        <Text style={s.subtitle}>{t("modal.pro_upgrade.subtitle")}</Text>
      </View>

      {/* Vantaggi — unificati con InvoiceLimitModal */}
      <View style={s.featuresBox}>
        <FeatureItem text={t("modal.pro_upgrade.feature.unlimited")} />
        <FeatureItem text={t("modal.pro_upgrade.feature.email_pdf")} />
        <FeatureItem text={t("modal.pro_upgrade.feature.ritenuta")} />
        <FeatureItem text={t("modal.pro_upgrade.feature.support")} />
        <FeatureItem text={t("modal.pro_upgrade.feature.cancel_anytime")} />
      </View>

      {/* Piani */}
      <View style={s.plansContainer} accessibilityRole="radiogroup" accessibilityLabel={t("modal.pro_upgrade.plans.a11y")}>
        {packages.map((pkg) => {
          const isActive = selectedPlan === pkg.id;
          const trial = trialFor(rcOffering, pkg.productId, t);
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.planCard, isActive && s.planCardActive]}
              onPress={() => setSelectedPlan(pkg.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityLabel={`${pkg.title}: ${pkg.price}. ${pkg.recurring}${pkg.tag ? ". " + pkg.tag : ""}${trial.hasTrial ? ". Prova gratuita " + trial.text : ""}`}
              accessibilityState={{ selected: isActive }}
            >
              {pkg.tag && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{pkg.tag}</Text>
                </View>
              )}
              <View style={s.planHeader}>
                <Text style={[s.planTitle, isActive && s.textActive]}>{pkg.title}</Text>
                <Text style={[s.planPrice, isActive && s.textActive]}>{pkg.price}</Text>
              </View>
              <Text style={[s.planRecurring, isActive && s.textActiveDesc]}>
                {pkg.recurring}
              </Text>
              {trial.hasTrial && (
                <Text style={[s.planTrial, isActive && s.textActiveDesc]}>
                  {t("modal.pro_upgrade.trial_line").replace("{trial}", trial.text).replace("{price}", pkg.price)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Trust signals */}
      <View style={s.reassuranceRow}>
        <Text style={s.reassuranceText}>{t("modal.pro_upgrade.trust.secure")}</Text>
        <Text style={s.reassuranceText}>{t("modal.pro_upgrade.trust.cancel_anytime")}</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[s.ctaButton, (purchaseState === "loading" || purchaseState === "restoring") && s.ctaDisabled]}
        onPress={handleSubscribe}
        disabled={purchaseState === "loading" || purchaseState === "restoring"}
        accessibilityRole="button"
        accessibilityLabel={t("modal.pro_upgrade.cta.a11y_subscribe").replace("{periodo}", selectedPlan === "yearly" ? t("modal.pro_upgrade.cta.a11y_yearly") : t("modal.pro_upgrade.cta.a11y_monthly")).replace("{prezzo}", selectedPkg.recurring)}
        accessibilityHint={t("modal.pro_upgrade.cta.a11y_hint")}
      >
        {purchaseState === "loading" ? (
          reduceMotion ? (
            <Text style={s.ctaText}>{t("modal.pro_upgrade.cta.processing")}</Text>
          ) : (
            <ActivityIndicator color="#fff" />
          )
        ) : (
          <View style={s.ctaContent}>
            <Text style={s.ctaText}>{t("modal.pro_upgrade.cta.text").replace("{plano}", selectedPkg.recurring)}</Text>
            <Text style={s.ctaSub}>{t("modal.pro_upgrade.cta.sub")}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Restore Purchases — obbligatorio Play Store Policy */}
      <TouchableOpacity
        style={[s.restoreBtn, purchaseState === "restoring" && s.ctaDisabled]}
        onPress={handleRestore}
        disabled={purchaseState === "loading" || purchaseState === "restoring"}
        accessibilityRole="button"
        accessibilityLabel={t("modal.pro_upgrade.restore.a11y")}
        accessibilityHint="Recupera un abbonamento Pro già acquistato su questo account Google"
      >
        {purchaseState === "restoring" ? (
          reduceMotion ? (
            <Text style={s.restoreText}>{t("modal.pro_upgrade.restore.processing")}</Text>
          ) : (
            <ActivityIndicator size="small" color="#6b7280" />
          )
        ) : (
          <Text style={s.restoreText}>{t("modal.pro_upgrade.restore.text")}</Text>
        )}
      </TouchableOpacity>

      {/* Error state */}
      {purchaseState === "error" && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleRetry} accessibilityRole="button" accessibilityLabel={t("modal.pro_upgrade.retry.a11y")}>
            <Text style={s.retryText}>{t("modal.pro_upgrade.retry.text")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Close */}
      <View style={s.footerLinks}>
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => router.replace("/(app)/(tabs)" as any)}
          accessibilityRole="button"
          accessibilityLabel={t("modal.pro_upgrade.cancel.text")}
        >
          <Text style={s.cancelText}>{t("modal.pro_upgrade.cancel.text")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const FeatureItem = ({ text }: { text: string }) => (
  <View style={s.featureRow}>
    <Ionicons name="checkmark" size={18} color="#a78bfa" style={s.check} />
    <Text style={s.featureText}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", padding: 24 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#f0f0f2", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#9ca3af", textAlign: "center", lineHeight: 24 },

  featuresBox: { backgroundColor: "#111318", borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: "#1e2029" },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  check: { marginRight: 10 },
  featureText: { color: "#f0f0f2", fontSize: 15 },

  plansContainer: { marginBottom: 16 },
  planCard: {
    backgroundColor: "#111318", borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 2, borderColor: "#1e2029", position: "relative"
  },
  planCardActive: { borderColor: "#a78bfa", backgroundColor: "#a78bfa15" },
  badge: {
    position: "absolute", top: -12, right: 20, backgroundColor: "#a78bfa",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  planTitle: { fontSize: 18, fontWeight: "bold", color: "#f0f0f2" },
  planPrice: { fontSize: 20, fontWeight: "bold", color: "#f0f0f2" },
  planRecurring: { fontSize: 13, color: "#9ca3af" },
  planTrial: { fontSize: 12, color: "#a78bfa", marginTop: 4, fontWeight: "600" },
  textActive: { color: "#a78bfa" },
  textActiveDesc: { color: "#c4b5fd" },

  reassuranceRow: { alignItems: "center", marginBottom: 16, gap: 4 },
  reassuranceText: { color: "#6b7280", fontSize: 13 },

  ctaButton: { backgroundColor: "#a78bfa", paddingVertical: 18, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  ctaDisabled: { opacity: 0.6 },
  ctaContent: { alignItems: "center" },
  ctaText: { color: "#0a0b0f", fontSize: 18, fontWeight: "bold" },
  ctaSub: { color: "#0a0b0f99", fontSize: 12, marginTop: 2 },

  errorBanner: {
    backgroundColor: "#1f1315", borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#fca5a544", flexDirection: "row", alignItems: "center", justifyContent: "space-between"
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  retryText: { color: "#a78bfa", fontSize: 14, fontWeight: "600", marginLeft: 12 },

  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#6b7280", fontSize: 15 },
  
  footerLinks: { marginTop: 8, gap: 4 },
  restoreBtn: { alignItems: "center", paddingVertical: 12 },
  restoreText: { color: "#9ca3af", fontSize: 13, textDecorationLine: "underline" },
});
