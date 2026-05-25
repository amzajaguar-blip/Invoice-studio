import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
// Import temporaneamente commentato per evitare crash prima del setup completo
// import Purchases from "react-native-purchases";

export default function ProUpgradeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");

  // Al momento mostriamo dei prezzi "hardcoded" finché non li agganciamo a RevenueCat
  const packages = [
    { id: "monthly", title: "Mensile", price: "€ 4,99", desc: "Flessibile, cancelli quando vuoi." },
    { id: "yearly", title: "Annuale", price: "€ 49,99", desc: "Risparmi 2 mesi (Solo 4,16€/mese)." }
  ];

  const handleSubscribe = async () => {
    setLoading(true);
    // Qui andrà il vero codice:
    // try {
    //   const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
    //   if (customerInfo.entitlements.active['pro']) { router.back(); }
    // } catch (e) { Alert.alert("Errore", e.message); }
    
    // Per ora facciamo finta che stia caricando
    setTimeout(() => {
      setLoading(false);
      Alert.alert("In arrivo!", "La connessione a Google Play Billing sarà attiva non appena approveremo l'app sulla console.");
    }, 1500);
  };

  return (
    <View style={s.container}>
      {/* Intestazione */}
      <View style={s.header}>
        <Text style={s.title}>Passa a Pro 🚀</Text>
        <Text style={s.subtitle}>Libera tutto il potenziale di InvoiceStudio e fai crescere il tuo business senza limiti.</Text>
      </View>

      {/* Vantaggi */}
      <View style={s.featuresBox}>
        <FeatureItem text="Fatture illimitate per sempre" />
        <FeatureItem text="Nessuna pubblicità o interruzione" />
        <FeatureItem text="Sincronizzazione in tempo reale" />
        <FeatureItem text="Supporto prioritario" />
      </View>

      {/* Scelta Piani */}
      <View style={s.plansContainer}>
        {packages.map((pkg) => {
          const isActive = selectedPlan === pkg.id;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.planCard, isActive && s.planCardActive]}
              onPress={() => setSelectedPlan(pkg.id as any)}
              activeOpacity={0.8}
            >
              {pkg.id === "yearly" && (
                <View style={s.badge}><Text style={s.badgeText}>PIÙ CONVENIENTE</Text></View>
              )}
              <View style={s.planHeader}>
                <Text style={[s.planTitle, isActive && s.textActive]}>{pkg.title}</Text>
                <Text style={[s.planPrice, isActive && s.textActive]}>{pkg.price}</Text>
              </View>
              <Text style={[s.planDesc, isActive && s.textActiveDesc]}>{pkg.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottone Acquista */}
      <TouchableOpacity 
        style={s.ctaButton} 
        onPress={handleSubscribe} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.ctaText}>Attiva Abbonamento {selectedPlan === "yearly" ? "Annuale" : "Mensile"}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
        <Text style={s.cancelText}>Forse più tardi</Text>
      </TouchableOpacity>
    </View>
  );
}

const FeatureItem = ({ text }: { text: string }) => (
  <View style={s.featureRow}>
    <Text style={s.check}>✓</Text>
    <Text style={s.featureText}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", padding: 24, paddingTop: 60 },
  header: { marginBottom: 30, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#9ca3af", textAlign: "center", lineHeight: 24 },
  
  featuresBox: { backgroundColor: "#111318", borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: "#1e2029" },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  check: { color: "#6c63ff", fontSize: 18, fontWeight: "bold", marginRight: 10 },
  featureText: { color: "#f0f0f2", fontSize: 15 },
  
  plansContainer: { marginBottom: 30 },
  planCard: { 
    backgroundColor: "#111318", borderRadius: 16, padding: 20, marginBottom: 16, 
    borderWidth: 2, borderColor: "#1e2029", position: "relative" 
  },
  planCardActive: { borderColor: "#6c63ff", backgroundColor: "#6c63ff15" },
  badge: { 
    position: "absolute", top: -12, right: 20, backgroundColor: "#6c63ff", 
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  planTitle: { fontSize: 18, fontWeight: "bold", color: "#f0f0f2" },
  planPrice: { fontSize: 20, fontWeight: "bold", color: "#f0f0f2" },
  planDesc: { fontSize: 14, color: "#9ca3af" },
  textActive: { color: "#6c63ff" },
  textActiveDesc: { color: "#a5a0f5" },
  
  ctaButton: { backgroundColor: "#6c63ff", paddingVertical: 18, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { color: "#9ca3af", fontSize: 15 }
});
