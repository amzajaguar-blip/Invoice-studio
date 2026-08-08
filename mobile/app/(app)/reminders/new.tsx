/**
 * reminders/new.tsx — Crea un nuovo promemoria scadenza
 * Nessun gate di piano — promemoria illimitati per tutti.
 */

import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import {
  scheduleReminderNotification,
  hasNotificationPermission,
} from "@/lib/notifications-service";

type Recurrence = "once" | "monthly" | "yearly";

const todayISO = () => new Date().toISOString().split("T")[0];

export default function NewReminderScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [loading, setLoading] = useState(false);

  const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
    { value: "once", label: "Una volta" },
    { value: "monthly", label: "Mensile" },
    { value: "yearly", label: "Annuale" },
  ];

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Titolo obbligatorio", "Inserisci un titolo per il promemoria.");
      return;
    }
    if (!dueDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("Data non valida", "Inserisci la data nel formato YYYY-MM-DD.");
      return;
    }

    setLoading(true);

    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: new Date(dueDate).toISOString(),
      recurrence,
    };

    const { data, error } = await apiFetch<{ data: { id: string; due_date: string } }>(
      "/api/reminders",
      { method: "POST", body: JSON.stringify(payload) }
    );

    if (error) {
      setLoading(false);
      Alert.alert("Errore", error);
      return;
    }

    // Prova a schedulare la notifica push locale
    let notificationId: string | null = null;
    const permissionGranted = await hasNotificationPermission();
    if (permissionGranted && data) {
      const reminder = (data as any).data ?? data;
      notificationId = await scheduleReminderNotification({
        id: reminder.id ?? "",
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: new Date(dueDate),
        recurrence,
      });
    }

    // Se la notifica è stata schedulata, aggiorna il record con l'ID notifica
    if (notificationId && data) {
      const reminder = (data as any).data ?? data;
      if (reminder.id) {
        await apiFetch(`/api/reminders/${reminder.id}`, {
          method: "PATCH",
          body: JSON.stringify({ notification_id: notificationId }),
        }).catch(() => {});
      }
    }

    setLoading(false);

    Alert.alert(
      "Promemoria salvato",
      permissionGranted
        ? "Riceverai una notifica alla data indicata."
        : "Promemoria salvato. Abilita le notifiche nelle impostazioni per ricevere avvisi.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← {t("back")}</Text>
          </TouchableOpacity>
          <Text style={s.title}>Nuovo promemoria</Text>
        </View>

        {/* Titolo */}
        <Text style={s.label}>TITOLO *</Text>
        <TextInput
          style={s.input}
          placeholder="es. Scadenza documento n. 12"
          placeholderTextColor="#4b5563"
          value={title}
          onChangeText={setTitle}
        />

        {/* Data scadenza */}
        <Text style={s.label}>DATA SCADENZA *</Text>
        <TextInput
          style={s.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#4b5563"
          value={dueDate}
          onChangeText={setDueDate}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        {/* Ricorrenza */}
        <Text style={s.label}>RICORRENZA</Text>
        <View style={s.recRow}>
          {RECURRENCE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.recBtn, recurrence === opt.value && s.recBtnActive]}
              onPress={() => setRecurrence(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: recurrence === opt.value }}
            >
              <Text style={[s.recText, recurrence === opt.value && s.recTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <Text style={s.label}>NOTE (OPZIONALE)</Text>
        <TextInput
          style={[s.input, s.notesInput]}
          placeholder="Dettagli aggiuntivi…"
          placeholderTextColor="#4b5563"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {/* Salva */}
        <TouchableOpacity
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveBtnText}>Salva promemoria</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 28 },
  backBtn: { marginBottom: 12 },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  label: {
    fontSize: 11, fontWeight: "700", color: "#6b7280",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },
  input: {
    backgroundColor: "#0f1117", borderRadius: 10, padding: 12,
    color: "#f0f0f2", fontSize: 15, borderWidth: 1, borderColor: "#1e2029", marginBottom: 4,
  },
  notesInput: { height: 80, textAlignVertical: "top" },
  recRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  recBtn: {
    flex: 1, borderRadius: 10, padding: 12, alignItems: "center",
    backgroundColor: "#111318", borderWidth: 1, borderColor: "#1e2029",
  },
  recBtnActive: { backgroundColor: "#6c63ff15", borderColor: "#6c63ff66" },
  recText: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  recTextActive: { color: "#6c63ff" },
  saveBtn: {
    backgroundColor: "#6c63ff", borderRadius: 12, padding: 15,
    alignItems: "center", marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
