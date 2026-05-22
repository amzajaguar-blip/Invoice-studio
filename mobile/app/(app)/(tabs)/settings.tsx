import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Esci?", "Vuoi disconnetterti da InvoiceStudio?", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Elimina account",
      "Per eliminare il tuo account, visita la pagina web:\n\ninvoicestudio.app/delete-account",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Esci</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.deleteButton]}
        onPress={handleDeleteAccount}
      >
        <Text style={[styles.buttonText, styles.deleteText]}>Elimina account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  email: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 32 },
  button: {
    backgroundColor: "#1e2029",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#f0f0f2" },
  deleteButton: { backgroundColor: "rgba(220,38,38,0.1)", borderWidth: 1, borderColor: "rgba(220,38,38,0.2)" },
  deleteText: { color: "#dc2626" },
});
