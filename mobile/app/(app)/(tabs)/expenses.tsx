/**
 * expenses.tsx — Tab "Note Spese"
 *
 * Freemium: 3 note spese/mese per utenti free. Illimitate per Premium.
 * Nessun rate-limit sulla creazione — il gate è solo nel CTA di questa lista.
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
import { usePlan } from "@/context/PlanContext";
import { useLocale } from "@/components/LocaleProvider";

const FREE_MONTHLY_EXPENSE_LIMIT = 3;

interface ExpenseReport {
  id: string;
  report_number: string;
  title: string;
  period_from: string;
  period_to: string;
  grand_total: number;
  currency: string;
  created_at: string;
  items?: unknown[];
}

function countCurrentMonthExpenses(reports: ExpenseReport[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return reports.filter(
    (r) => new Date(r.created_at).getTime() >= monthStart
  ).length;
}

export default function ExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { isPremium } = usePlan();

  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const prevCountRef = useRef<number | null>(null);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<{ data: ExpenseReport[] }>(
        "/api/expenses?limit=100"
      );
      if (data) {
        const list = Array.isArray(data)
          ? data
          : (data as { data: ExpenseReport[] }).data ?? [];
        setReports(list);
        prevCountRef.current = list.length;
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
      if (prevCountRef.current === null) return;
      void (async () => {
        const { data } = await apiFetch<{ data: ExpenseReport[] }>(
          "/api/expenses?limit=100"
        );
        if (data) {
          const list = Array.isArray(data)
            ? data
            : (data as any).data ?? [];
          setReports(list);
          setLoading(false);
          prevCountRef.current = list.length;
        }
      })();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const monthlyCount = countCurrentMonthExpenses(reports);
  const monthlyLimitReached =
    !isPremium && monthlyCount >= FREE_MONTHLY_EXPENSE_LIMIT;

  const handleNewExpense = useCallback(() => {
    if (monthlyLimitReached) {
      Alert.alert(
        "Limite mensile raggiunto",
        `Hai già creato ${FREE_MONTHLY_EXPENSE_LIMIT} note spese questo mese. Passa a Premium per note spese illimitate.`,
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Passa a Premium",
            onPress: () => router.push("/(app)/ProUpgrade" as never),
          },
        ]
      );
      return;
    }
    router.push("/(app)/expenses/new" as never);
  }, [monthlyLimitReached, router]);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>Note spese</Text>
          <Text style={s.sub}>{reports.length} report</Text>
        </View>
        {!isPremium && (
          <View
            style={[s.badge, monthlyLimitReached && s.badgeWarn]}
            accessibilityRole="text"
            accessibilityLabel={`${monthlyCount} su ${FREE_MONTHLY_EXPENSE_LIMIT} note spese questo mese`}
          >
            <Text style={[s.badgeText, monthlyLimitReached && s.badgeTextWarn]}>
              {monthlyCount}/{FREE_MONTHLY_EXPENSE_LIMIT} questo mese
            </Text>
          </View>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[s.newBtn, monthlyLimitReached && s.newBtnDisabled]}
        onPress={handleNewExpense}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Nuova nota spese"
      >
        <Text style={s.newBtnText}>+ Nuova nota spese</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
        </View>
      ) : (
        <FlatList
          data={reports}
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
              icon="receipt-outline"
              title="Registra le tue spese professionali"
              hint="Esporta in PDF, Excel o CSV e condividi con il tuo commercialista."
              cta="+ Nuova nota spese"
              onCTA={handleNewExpense}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() =>
                router.push(`/(app)/expenses/${item.id}` as never)
              }
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${fmt(item.grand_total, item.currency)}`}
            >
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardTotal}>
                  {fmt(item.grand_total, item.currency)}
                </Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardPeriod}>
                  {new Date(item.period_from).toLocaleDateString("it-IT")} –{" "}
                  {new Date(item.period_to).toLocaleDateString("it-IT")}
                </Text>
                {item.items && (
                  <Text style={s.cardSub}>{item.items.length} voci</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
  },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  badge: {
    backgroundColor: "#1e2029",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2d2f3a",
    alignSelf: "flex-start",
  },
  badgeWarn: { borderColor: "#ef444466", backgroundColor: "#ef444411" },
  badgeText: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  badgeTextWarn: { color: "#ef4444" },
  newBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnDisabled: { backgroundColor: "#3d3a6b" },
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
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#f0f0f2", flex: 1 },
  cardTotal: { fontSize: 16, fontWeight: "700", color: "#6c63ff" },
  cardPeriod: { fontSize: 12, color: "#9ca3af" },
  cardSub: { fontSize: 12, color: "#6b7280" },
});
