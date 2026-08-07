/**
 * reminders.tsx — Tab "Promemoria scadenze"
 *
 * Al primo accesso chiede il permesso notifiche.
 * Promemoria illimitati per tutti gli utenti (nessun gate di piano).
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import {
  hasNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications-service";

type ReminderRecurrence = "once" | "monthly" | "yearly";

interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  due_date: string;
  recurrence: ReminderRecurrence;
  notification_id?: string | null;
  completed: boolean;
  created_at: string;
}

const RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  once: "Una volta",
  monthly: "Mensile",
  yearly: "Annuale",
};

const PERMISSION_REQUESTED_KEY = "reminders_permission_asked";

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const permissionCheckedRef = useRef(false);

  // ── Richiesta permesso notifiche al primo accesso ──────────────────────────
  useEffect(() => {
    if (permissionCheckedRef.current) return;
    permissionCheckedRef.current = true;

    void (async () => {
      const already = await hasNotificationPermission();
      if (!already) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Notifiche disabilitate",
            "Vai in Impostazioni > Notifiche > Milo Office per abilitarle.",
            [{ text: "OK" }]
          );
        }
      }
    })();
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<{ data: Reminder[] }>(
        "/api/reminders?limit=100"
      );
      if (data) {
        const list = Array.isArray(data)
          ? data
          : (data as any).data ?? [];
        setReminders(list);
        return list.length;
      }
    } catch {
      // Non fatale
    }
    setLoading(false);
    return 0;
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { data } = await apiFetch<{ data: Reminder[] }>(
          "/api/reminders?limit=100"
        );
        if (data) {
          const list = Array.isArray(data) ? data : (data as any).data ?? [];
          setReminders(list);
          setLoading(false);
        }
      })();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Helpers UI ─────────────────────────────────────────────────────────────
  const isOverdue = (r: Reminder) =>
    !r.completed && new Date(r.due_date) < new Date();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Promemoria</Text>
        <Text style={s.sub}>{reminders.length} promemori</Text>
      </View>

      {/* CTA — nessun gate di piano */}
      <TouchableOpacity
        style={s.newBtn}
        onPress={() => router.push("/(app)/reminders/new" as never)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Nuovo promemoria"
      >
        <Text style={s.newBtnText}>+ Nuovo promemoria</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6c63ff"
              colors={["#6c63ff"]}
              progressBackgroundColor="#111318"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="alarm-outline"
              title="Nessun promemoria ancora"
              hint="Imposta scadenze per non perdere mai un pagamento o un appuntamento importante."
              cta="+ Nuovo promemoria"
              onCTA={() => router.push("/(app)/reminders/new" as never)}
            />
          }
          renderItem={({ item }) => {
            const overdue = isOverdue(item);
            return (
              <TouchableOpacity
                style={[
                  s.card,
                  item.completed && s.cardDone,
                  overdue && s.cardOverdue,
                ]}
                onPress={() =>
                  router.push(`/(app)/reminders/${item.id}` as never)
                }
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View style={s.cardRow}>
                  <Text
                    style={[s.cardTitle, item.completed && s.cardTitleDone]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {/* Recurrence badge */}
                  <View
                    style={[
                      s.recBadge,
                      item.recurrence !== "once" && s.recBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.recText,
                        item.recurrence !== "once" && s.recTextActive,
                      ]}
                    >
                      {RECURRENCE_LABELS[item.recurrence]}
                    </Text>
                  </View>
                </View>
                <View style={s.cardRow}>
                  <Text
                    style={[
                      s.cardDate,
                      overdue && s.cardDateOverdue,
                      item.completed && s.cardDateDone,
                    ]}
                  >
                    {overdue ? "⚠ Scaduto " : ""}
                    {formatDate(item.due_date)}
                  </Text>
                  {item.completed && (
                    <Text style={s.completedBadge}>✓ Completato</Text>
                  )}
                </View>
                {!!item.notes && (
                  <Text style={s.cardNotes} numberOfLines={1}>
                    {item.notes}
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
  },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  newBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skeletonWrap: { paddingHorizontal: 20, gap: 10 },
  card: {
    backgroundColor: "#111318",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 10,
  },
  cardDone: { opacity: 0.55 },
  cardOverdue: { borderColor: "#ef444466", backgroundColor: "#ef444408" },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f0f2",
    flex: 1,
    marginRight: 8,
  },
  cardTitleDone: {
    textDecorationLine: "line-through",
    color: "#6b7280",
  },
  cardDate: { fontSize: 12, color: "#9ca3af" },
  cardDateOverdue: { color: "#ef4444", fontWeight: "600" },
  cardDateDone: { color: "#6b7280" },
  cardNotes: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  completedBadge: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "600",
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#1e2029",
  },
  recBadgeActive: { backgroundColor: "#6c63ff15" },
  recText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  recTextActive: { color: "#6c63ff" },
});
