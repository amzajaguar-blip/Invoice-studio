import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  AccessibilityInfo,
} from "react-native";
import { useRouter } from "expo-router";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PURCHASE_TIMEOUT_MS = 15_000;

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [purchaseState, setPurchaseState] = useState<"idle" | "loading" | "restoring" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const packages = [
    { id: "monthly" as const, title: "Mensile", price: "€ 4,99", recurring: "€4,99/mese" },
    { id: "yearly" as const, title: "Annuale", price: "€ 49,99", recurring: "€4,16/mese", tag: "PIÙ CONVENIENTE" },
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
      
      // Mappiamo i nostri ID (mensile / annuale) all'offerta
      const pkg = offerings.current.availablePackages.find(
        (p: PurchasesPackage) => p.product.identifier === selectedPlan || 
           (selectedPlan === "monthly" && p.product.identifier === "mensile") || 
           (selectedPlan === "yearly" && p.product.identifier === "annuale")
      );

      if (!pkg) {
        throw new Error("Prodotto non trovato.");
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      if (customerInfo.entitlements.active['pro']) {
        setPurchaseState("idle");
        router.back();
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
      if (customerInfo.entitlements.active['pro']) {
        setPurchaseState("idle");
        router.back();
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
        <Text style={s.title}>Passa a Pro 🚀</Text>
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
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.planCard, isActive && s.planCardActive]}
              onPress={() => setSelectedPlan(pkg.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityLabel={`${pkg.title}: ${pkg.price}. ${pkg.recurring}${pkg.tag ? ". " + pkg.tag : ""}`}
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
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Trust signals */}
      <View style={s.reassuranceRow}>
        <Text style={s.reassuranceText}>🔒 Pagamento sicuro via Google Play</Text>
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
    <Text style={s.check} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">✓</Text>
    <Text style={s.featureText}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", padding: 24 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#9ca3af", textAlign: "center", lineHeight: 24 },

  featuresBox: { backgroundColor: "#111318", borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: "#1e2029" },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  check: { color: "#a78bfa", fontSize: 18, fontWeight: "bold", marginRight: 10 },
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
