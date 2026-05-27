import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { getMonthlyRevenueTrend, predictCashflow, type MonthlyRevenue, type CashflowPrediction } from "@/lib/analytics";
import { MiniBarChart } from "@/components/MiniBarChart";
import { schedulePaymentReminders, scheduleOverdueNotifications } from "@/lib/notifications-service";

interface DashboardStats {
  invoiceCount: number;
  totalRevenue: number;
  pendingCount: number;
  paidCount: number;
}

const fmt = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    invoiceCount: 0,
    totalRevenue: 0,
    pendingCount: 0,
    paidCount: 0,
  });
  const [trend, setTrend] = useState<MonthlyRevenue[]>([]);
  const [cashflow, setCashflow] = useState<CashflowPrediction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data } = await apiFetch<{ data: any[]; total: number }>(
      "/api/invoices?limit=200"
    );

    if (data) {
      const invoices: any[] = Array.isArray(data)
        ? data
        : (data as { data: any[] }).data ?? [];

      const invoiceCount = invoices.length;
      const totalRevenue = invoices
        .filter((inv) => inv.status === "paid")
        .reduce((s, inv) => s + (inv.total ?? 0), 0);
      const paidCount = invoices.filter((inv) => inv.status === "paid").length;
      const pendingCount = invoices.filter(
        (inv) => inv.status === "sent" || inv.status === "overdue"
      ).length;

      setStats({ invoiceCount, totalRevenue, pendingCount, paidCount });
      setTrend(getMonthlyRevenueTrend(invoices, 6));
      setCashflow(predictCashflow(invoices));

      // Schedule reminders & overdue notifications in background
      schedulePaymentReminders(invoices).catch(() => {});
      scheduleOverdueNotifications(invoices).catch(() => {});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />
      }
    >
      <Text style={styles.title}>✦ InvoiceStudio</Text>
      <Text style={styles.subtitle}>Dashboard</Text>

      {/* KPI Row */}
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{loading ? "…" : stats.invoiceCount}</Text>
          <Text style={styles.cardLabel}>Fatture emesse</Text>
        </View>
        <View style={styles.card}>
          <Text style={[styles.cardValue, { color: "#6c63ff" }]}>
            {loading ? "…" : fmt(stats.totalRevenue)}
          </Text>
          <Text style={styles.cardLabel}>Incassato</Text>
        </View>
      </View>

      <View style={styles.cards}>
        <View style={[styles.card, { borderColor: "#22c55e30" }]}>
          <Text style={[styles.cardValue, { color: "#22c55e" }]}>
            {loading ? "…" : stats.paidCount}
          </Text>
          <Text style={styles.cardLabel}>Pagate</Text>
        </View>
        <View style={[styles.card, { borderColor: "#f59e0b30" }]}>
          <Text style={[styles.cardValue, { color: "#f59e0b" }]}>
            {loading ? "…" : stats.pendingCount}
          </Text>
          <Text style={styles.cardLabel}>In attesa / Scadute</Text>
        </View>
      </View>

      {/* Trend 6 mesi */}
      {!loading && trend.length > 0 && (
        <View style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <Text style={styles.analyticsTitle}>📈 Trend incassi — ultimi 6 mesi</Text>
          </View>
          <MiniBarChart data={trend} height={88} />
          <View style={styles.trendLegend}>
            {trend.slice(-3).map((t, i) => (
              <Text key={i} style={styles.trendLegendText}>
                {t.month}: <Text style={{ color: "#f0f0f2" }}>{fmt(t.total)}</Text>
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Cashflow Predictor */}
      {!loading && cashflow && (
        <View style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <Text style={styles.analyticsTitle}>🔮 Cashflow previsto — prossimi 30 giorni</Text>
            <View style={[styles.confidenceBadge, { borderColor: CONFIDENCE_COLOR[cashflow.confidence] + "40", backgroundColor: CONFIDENCE_COLOR[cashflow.confidence] + "12" }]}>
              <Text style={[styles.confidenceText, { color: CONFIDENCE_COLOR[cashflow.confidence] }]}>
                {cashflow.confidence === "high" ? "Alta" : cashflow.confidence === "medium" ? "Media" : "Bassa"} affidabilità
              </Text>
            </View>
          </View>
          <Text style={styles.cashflowAmount}>{fmt(cashflow.expectedNext30Days)}</Text>
          <View style={styles.cashflowMeta}>
            <Text style={styles.cashflowMetaText}>
              📄 {cashflow.pendingInvoices} fattura/e in scadenza nei prossimi 30gg
            </Text>
            <Text style={styles.cashflowMetaText}>
              📊 Media mensile: {fmt(cashflow.avgMonthlyRevenue)}
            </Text>
          </View>
        </View>
      )}

      {/* Scan button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push("/(app)/scanner")}
        accessibilityRole="button"
        accessibilityLabel="Scansiona una ricevuta con la fotocamera"
      >
        <Text style={styles.scanButtonText}>📷 Scansiona ricevuta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginBottom: 24, marginTop: 4 },
  cards: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e2029",
  },
  cardValue: { fontSize: 22, fontWeight: "bold", color: "#f0f0f2" },
  cardLabel: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  analyticsCard: {
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 12,
  },
  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 6,
  },
  analyticsTitle: { fontSize: 13, fontWeight: "600", color: "#f0f0f2" },
  trendLegend: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" },
  trendLegendText: { fontSize: 11, color: "#6b7280" },
  cashflowAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#6c63ff",
    fontFamily: "serif",
    marginBottom: 10,
  },
  cashflowMeta: { gap: 4 },
  cashflowMetaText: { fontSize: 12, color: "#9ca3af" },
  confidenceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  confidenceText: { fontSize: 10, fontWeight: "600" },
  scanButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
