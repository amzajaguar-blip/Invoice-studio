/**
 * reminders/[id].tsx — Dettaglio e modifica promemoria
 */

import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import {
  scheduleReminderNotification,
  cancelReminderNotification,
  hasNotificationPermission,
} from "@/lib/notifications-service";

type Recurrence = "once" | "monthly" | "yearly";

interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  due_date: string;
  recurrence: Recurrence;
  notification_id?: string | null;
  completed: boolean;
}

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "once", label: "Una volta" },
  { value: "monthly", label: "Mensile" },
  { value: "yearly", label: "Annuale" },
];

export default function ReminderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: Reminder }>(`/api/reminders/${id}`).then(({ data }) => {
      if (data) {
        const r = (data as any).data ?? data;
        setReminder(r);
        setTitle(r.title);
        setDueDate(r.due_date.split("T")[0]);
        setNotes(r.notes ?? "");
        setRecurrence(r.recurrence ?? "once");
      }
      setLoading(false);
    });
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!reminder) return;
    if (!title.trim()) {
      Alert.alert("Titolo obbligatorio", "Inserisci un titolo.");
      return;
    }
    setSaving(true);

    // Cancella la notifica esistente prima di ri-schedulare
    if (reminder.notification_id) {
      await cancelReminderNotification(reminder.notification_id).catch(() => {});
    }

    const { error } = await apiFetch(`/api/reminders/${reminder.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: new Date(dueDate).toISOString(),
        recurrence,
      }),
    });

    if (error) {
      setSaving(false);
      Alert.alert("Errore", error);
      return;
    }

    // Ri-schedula notifica
    let newNotifId: string | null = null;
    const hasPerm = await hasNotificationPermission();
    if (hasPerm) {
      newNotifId = await scheduleReminderNotification({
        id: reminder.id,
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: new Date(dueDate),
        recurrence,
      });
      if (newNotifId) {
        await apiFetch(`/api/reminders/${reminder.id}`, {
          method: "PATCH",
          body: JSON.stringify({ notification_id: newNotifId }),
        }).catch(() => {});
      }
    }

    setSaving(false);
    setReminder(prev =>
      prev
        ? { ...prev, title: title.trim(), notes: notes.trim() || null, due_date: new Date(dueDate).toISOString(), recurrence, notification_id: newNotifId }
        : prev
    );
    Alert.alert("Salvato", "Il promemoria è stato aggiornato.", [{ text: "OK" }]);
  }, [reminder, title, dueDate, notes, recurrence]);

  const handleComplete = useCallback(async () => {
    if (!reminder) return;
    Alert.alert(
      "Segna come completato",
      "Vuoi contrassegnare questo promemoria come completato?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Completa",
          onPress: async () => {
            setSaving(true);
            // Cancella notifica
            if (reminder.notification_id) {
              await cancelReminderNotification(reminder.notification_id).catch(() => {});
            }
            const { error } = await apiFetch(`/api/reminders/${reminder.id}`, {
              method: "PATCH",
              body: JSON.stringify({ completed: true, notification_id: null }),
            });
            setSaving(false);
            if (!error) {
              setReminder(prev => prev ? { ...prev, completed: true } : prev);
            }
          },
        },
      ]
    );
  }, [reminder]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!reminder) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Promemoria non trovato</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>← {t("back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← {t("back")}</Text>
        </TouchableOpacity>

        <Text style={s.title}>
          {reminder.completed ? "✓ " : ""}Modifica promemoria
        </Text>

        {reminder.completed && (
          <View style={s.completedBanner}>
            <Text style={s.completedText}>Questo promemoria è stato completato</Text>
          </View>
        )}

        {/* Titolo */}
        <Text style={s.label}>TITOLO *</Text>
        <TextInput
          style={[s.input, reminder.completed && s.inputDisabled]}
          value={title}
          onChangeText={setTitle}
          editable={!reminder.completed}
        />

        {/* Data scadenza */}
        <Text style={s.label}>DATA SCADENZA</Text>
        <TextInput
          style={[s.input, reminder.completed && s.inputDisabled]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#4b5563"
          value={dueDate}
          onChangeText={setDueDate}
          autoCapitalize="none"
          editable={!reminder.completed}
        />

        {/* Ricorrenza */}
        <Text style={s.label}>RICORRENZA</Text>
        <View style={s.recRow}>
          {RECURRENCE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                s.recBtn,
                recurrence === opt.value && s.recBtnActive,
                reminder.completed && s.recBtnDisabled,
              ]}
              onPress={() => !reminder.completed && setRecurrence(opt.value)}
              disabled={reminder.completed}
            >
              <Text style={[s.recText, recurrence === opt.value && s.recTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <Text style={s.label}>NOTE</Text>
        <TextInput
          style={[s.input, s.notesInput, reminder.completed && s.inputDisabled]}
          placeholder="Dettagli aggiuntivi…"
          placeholderTextColor="#4b5563"
          multiline
          value={notes}
          onChangeText={setNotes}
          editable={!reminder.completed}
        />

        {/* Azioni */}
        {!reminder.completed && (
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={[s.saveBtn, saving && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Salva modifiche</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.completeBtn, saving && s.saveBtnDisabled]}
              onPress={handleComplete}
              disabled={saving}
            >
              <Text style={s.completeBtnText}>✓ Completa</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: {
    flex: 1, backgroundColor: "#0a0b0f",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  emptyTitle: { fontSize: 18, color: "#f0f0f2", marginBottom: 16 },
  backBtn: { marginBottom: 16 },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", marginBottom: 16 },
  completedBanner: {
    backgroundColor: "#22c55e15", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#22c55e44", marginBottom: 16,
  },
  completedText: { color: "#22c55e", fontWeight: "600", fontSize: 14 },
  label: {
    fontSize: 11, fontWeight: "700", color: "#6b7280",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },
  input: {
    backgroundColor: "#0f1117", borderRadius: 10, padding: 12,
    color: "#f0f0f2", fontSize: 15, borderWidth: 1, borderColor: "#1e2029", marginBottom: 4,
  },
  inputDisabled: { opacity: 0.5 },
  notesInput: { height: 80, textAlignVertical: "top" },
  recRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  recBtn: {
    flex: 1, borderRadius: 10, padding: 12, alignItems: "center",
    backgroundColor: "#111318", borderWidth: 1, borderColor: "#1e2029",
  },
  recBtnActive: { backgroundColor: "#6c63ff15", borderColor: "#6c63ff66" },
  recBtnDisabled: { opacity: 0.4 },
  recText: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  recTextActive: { color: "#6c63ff" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 32 },
  saveBtn: {
    flex: 1, backgroundColor: "#6c63ff", borderRadius: 12,
    padding: 15, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  completeBtn: {
    flex: 1, backgroundColor: "#22c55e", borderRadius: 12,
    padding: 15, alignItems: "center",
  },
  completeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
