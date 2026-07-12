import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  AccessibilityInfo, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Purchases, { PurchasesPackage, PurchasesOffering } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PURCHASE_TIMEOUT_MS = 15_000;
/** Duration of the success animation before auto-navigating back. Max 500ms. */
const SUCCESS_ANIM_DURATION_MS = 400;
const SUCCESS_DISPLAY_MS = 500;

const PRODUCT_IDS = {
  monthly: 'vela-premium-monthly',
  yearly: 'vela-premium-yearly',
} as const;

/**
 * Restituisce le info sul trial SOLO se RevenueCat / Google Play lo hanno
 * configurato per il prodotto. Su Google Play il trial gratuito è esposto
 * come introPrice con prezzo 0; se non c'è (o è solo uno sconto), non lo
 * mostriamo. Ritorna { hasTrial:false } quando l'offering non è disponibile.
 */
function trialFor(offering: PurchasesOffering | null, productId: string): { hasTrial: boolean; text: string } {
  const pkg = offering?.availablePackages?.find((p) => p.product.identifier === productId);
  const intro = pkg?.product?.introPrice;
  if (!intro || Number(intro.price) !== 0) return { hasTrial: false, text: "" };

  const units = intro.periodNumberOfUnits ?? 0;
  const unit = String(intro.periodUnit ?? "").toUpperCase();
  const label =
    unit === "DAY" ? (units === 1 ? "giorno" : "giorni") :
    unit === "WEEK" ? (units === 1 ? "settimana" : "settimane") :
    unit === "MONTH" ? (units === 1 ? "mese" : "mesi") :
    unit === "YEAR" ? (units === 1 ? "anno" : "anni") : "periodo";
  return { hasTrial: true, text: `${units} ${label}` };
}

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [purchaseState, setPurchaseState] = useState<"idle" | "loading" | "restoring" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const t = setTimeout(() => router.back(), SUCCESS_DISPLAY_MS);
      return () => clearTimeout(t);
    }

    // Reset animation values
    successScaleAnim.setValue(0.8);
    successOpacityAnim.setValue(0);

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
      const t = setTimeout(() => router.back(), 200);
      return () => clearTimeout(t);
    });
  }, [purchaseState, reduceMotion]);

  const packages = [
    { id: "monthly" as const, title: "Mensile", price: "€ 4,99", recurring: "€4,99/mese", productId: PRODUCT_IDS.monthly },
    { id: "yearly" as const, title: "Annuale", price: "€ 39,99", recurring: "€3,33/mese", tag: "PIÙ CONVENIENTE", productId: PRODUCT_IDS.yearly },
  ];

  const handleSubscribe = async () => {
    setPurchaseState("loading");
    setErrorMessage("");

    // Timeout di sicurezza
    timeoutRef.current = setTimeout(() => {
      setPurchaseState("error");
      setErrorMessage("Richiesta scaduta. Verifica la connessione e riprova.");
    }, PURCHASE_TIMEOUT_MS);

    try {
      const offerings = await Purchases.getOfferings();
      if (!offerings.current) {
        throw new Error("Impossibile caricare i prezzi. Riprova più tardi.");
      }
      
      // Mappiamo il piano selezionato all'ID prodotto RevenueCat/Google Play
      const targetId = PRODUCT_IDS[selectedPlan];
      const pkg = offerings.current.availablePackages.find(
        (p: PurchasesPackage) => p.product.identifier === targetId
      );

      if (!pkg) {
        throw new Error("Prodotto non trovato.");
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      if (customerInfo.entitlements.active['pro'] || customerInfo.entitlements.active['com.Invoice_Studio.myapp Pro']) {
        setPurchaseState("success");
      } else {
        setPurchaseState("error");
        setErrorMessage("Acquisto completato ma abbonamento non rilevato. Riavvia l'app.");
      }
    } catch (e: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (!e.userCancelled) { 
        setPurchaseState("error"); 
        setErrorMessage(e.message || "Errore sconosciuto"); 
      } else {
        setPurchaseState("idle");
      }
    }
  };

  const handleRetry = () => {
    setPurchaseState("idle");
    setErrorMessage("");
    handleSubscribe();
  };

  const handleRestore = async () => {
    setPurchaseState("restoring");
    setErrorMessage("");
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['pro'] || customerInfo.entitlements.active['com.Invoice_Studio.myapp Pro']) {
        setPurchaseState("success");
      } else {
        setPurchaseState("error");
        setErrorMessage("Nessun acquisto da ripristinare su questo account.");
      }
    } catch (e: any) {
      setPurchaseState("error");
      setErrorMessage(e.message || "Errore durante il ripristino. Riprova.");
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPlan)!;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Intestazione */}
      <View style={s.header}>
        <Text style={s.title}>Passa a Pro</Text>
        <Text style={s.subtitle}>
          Fatture illimitate, invio email/PDF, ritenuta d&apos;acconto automatica.
        </Text>
      </View>

      {/* Vantaggi — unificati con InvoiceLimitModal */}
      <View style={s.featuresBox}>
        <FeatureItem text="Fatture illimitate" />
        <FeatureItem text="Invio diretto via email e PDF" />
        <FeatureItem text="Ritenuta d&apos;acconto automatica" />
        <FeatureItem text="Supporto prioritario" />
        <FeatureItem text="Annulla in qualsiasi momento" />
      </View>

      {/* Piani */}
      <View style={s.plansContainer} accessibilityRole="radiogroup" accessibilityLabel="Seleziona un piano di abbonamento">
        {packages.map((pkg) => {
          const isActive = selectedPlan === pkg.id;
          const trial = trialFor(rcOffering, pkg.productId);
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
                  Prova gratuita {trial.text} — poi {pkg.price}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Trust signals */}
      <View style={s.reassuranceRow}>
        <Text style={s.reassuranceText}>Pagamento sicuro via Google Play</Text>
        <Text style={s.reassuranceText}>Annulla quando vuoi</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[s.ctaButton, (purchaseState === "loading" || purchaseState === "restoring") && s.ctaDisabled]}
        onPress={handleSubscribe}
        disabled={purchaseState === "loading" || purchaseState === "restoring"}
        accessibilityRole="button"
        accessibilityLabel={`Attiva abbonamento ${selectedPlan === "yearly" ? "annuale" : "mensile"}. ${selectedPkg.recurring}. Rinnovo automatico.`}
        accessibilityHint="Completa l'acquisto tramite Google Play"
      >
        {purchaseState === "loading" ? (
          reduceMotion ? (
            <Text style={s.ctaText}>In elaborazione…</Text>
          ) : (
            <ActivityIndicator color="#fff" />
          )
        ) : (
          <View style={s.ctaContent}>
            <Text style={s.ctaText}>Attiva — {selectedPkg.recurring}</Text>
            <Text style={s.ctaSub}>Rinnovo automatico. Annulla quando vuoi.</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Restore Purchases — obbligatorio Play Store Policy */}
      <TouchableOpacity
        style={[s.restoreBtn, purchaseState === "restoring" && s.ctaDisabled]}
        onPress={handleRestore}
        disabled={purchaseState === "loading" || purchaseState === "restoring"}
        accessibilityRole="button"
        accessibilityLabel="Ripristina acquisti precedenti"
        accessibilityHint="Recupera un abbonamento Pro già acquistato su questo account Google"
      >
        {purchaseState === "restoring" ? (
          reduceMotion ? (
            <Text style={s.restoreText}>Ripristino in corso…</Text>
          ) : (
            <ActivityIndicator size="small" color="#6b7280" />
          )
        ) : (
          <Text style={s.restoreText}>Ripristina acquisti</Text>
        )}
      </TouchableOpacity>

      {/* Error state */}
      {purchaseState === "error" && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Riprova acquisto">
            <Text style={s.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Close */}
      <View style={s.footerLinks}>
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Continua con il piano gratuito"
        >
          <Text style={s.cancelText}>Continua con il piano gratuito</Text>
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
