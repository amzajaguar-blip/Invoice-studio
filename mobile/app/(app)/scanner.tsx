import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

/**
 * Scanner screen — placeholder for OCR receipt scanning.
 * Uses expo-camera and Google ML Kit (free on-device).
 */
export default function ScannerScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Scanner Ricevute</Text>
      <Text style={styles.subtitle}>
        Inquadra una ricevuta per estrarre automaticamente i dati
      </Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>
          Fotocamera in arrivo...
        </Text>
        <Text style={styles.placeholderHint}>
          Richiede expo-camera e Google ML Kit
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", padding: 20, paddingTop: 60 },
  close: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e2029",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  closeText: { color: "#9ca3af", fontSize: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 32 },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1e2029",
    borderRadius: 16,
    borderStyle: "dashed",
    marginBottom: 20,
  },
  placeholderIcon: { fontSize: 48, marginBottom: 12 },
  placeholderText: { fontSize: 16, color: "#6b7280" },
  placeholderHint: { fontSize: 12, color: "#4b5563", marginTop: 8 },
});
