import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications-service";
import { apiFetch } from "@/lib/ai";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  const toggle = async (key: keyof NotificationSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await updateNotificationSettings({ [key]: !settings[key] });
  };

  const handleSignOut = () => {
    Alert.alert("Esci?", "Vuoi disconnetterti da InvoiceStudio?", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: signOut },
    ]);
  };

  const executeDeleteAccount = async () => {
    try {
      const { error } = await apiFetch("/api/profile", {
        method: "DELETE",
      });

      if (error) {
        Alert.alert("Errore", error || "Impossibile eliminare l'account in questo momento.");
        return;
      }

      await signOut();
      Alert.alert("Account eliminato", "Il tuo account è stato eliminato con successo.");
    } catch (err) {
      Alert.alert("Errore", "Si è verificato un errore di rete.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Elimina account",
      "Sei sicuro di voler eliminare permanentemente il tuo account? Tutti i tuoi dati, fatture e clienti verranno cancellati in modo irreversibile.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Procedi",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Conferma finale",
              "Questa è l'ultima conferma. Se procedi, il tuo account verrà eliminato definitivamente e verrai disconnesso.",
              [
                { text: "Annulla", style: "cancel" },
                {
                  text: "Sì, elimina",
                  style: "destructive",
                  onPress: executeDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <Text style={styles.title}>Impostazioni</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {/* Notifiche */}
      <Text style={styles.sectionTitle}>🔔 Notifiche</Text>
      <View style={styles.card}>
        <ToggleRow
          label="Notifiche push"
          value={settings?.pushEnabled ?? true}
          onToggle={() => toggle("pushEnabled")}
        />
        <ToggleRow
          label="Promemoria pagamenti (3/7/14 giorni)"
          value={settings?.reminderAlerts ?? true}
          onToggle={() => toggle("reminderAlerts")}
        />
        <ToggleRow
          label="Alert fatture scadute"
          value={settings?.overdueAlerts ?? true}
          onToggle={() => toggle("overdueAlerts")}
        />
        <ToggleRow
          label="Alert pagamenti ricevuti"
          value={settings?.paymentAlerts ?? true}
          onToggle={() => toggle("paymentAlerts")}
        />
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>👤 Account</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Esci</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.deleteButton]}
        onPress={handleDeleteAccount}
      >
        <Text style={[styles.buttonText, styles.deleteText]}>Elimina account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#1e2029", true: "#6c63ff" }}
        thumbColor={value ? "#fff" : "#9ca3af"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  email: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: "#9ca3af", marginTop: 16, marginBottom: 8, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: "#111318", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#1e2029", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  rowLabel: { fontSize: 14, color: "#f0f0f2" },
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
