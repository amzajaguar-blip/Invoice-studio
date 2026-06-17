import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import { apiFetch } from "@/lib/ai";
import {
  getMonthlyRevenueTrend,
  predictCashflow,
  type MonthlyRevenue,
  type CashflowPrediction,
} from "@/lib/analytics";
import { MiniBarChart } from "@/components/MiniBarChart";
import { schedulePaymentReminders, scheduleOverdueNotifications } from "@/lib/notifications-service";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  invoiceCount: number;
  totalRevenue: number;
  pendingCount: number;
  paidCount: number;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  clients?: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  sent: "#3b82f6",
  paid: "#22c55e",
  overdue: "#ef4444",
  cancelled: "#9ca3af",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviata",
  paid: "Pagata",
  overdue: "Scaduta",
  cancelled: "Annullata",
};

// ─── KPI Animation Hook ───────────────────────────────────────────────────────

function useKPIAnimation(index: number, reduceMotion: boolean) {
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { style: { transform: [{ translateY }], opacity } };
}

// ─── KPI Card Component ───────────────────────────────────────────────────────

interface KPICardProps {
  index: number;
  reduceMotion: boolean;
  value: string | number;
  label: string;
  valueColor?: string;
  borderColor?: string;
}

function KPICard({ index, reduceMotion, value, label, valueColor, borderColor }: KPICardProps) {
  const kpiAnim = useKPIAnimation(index, reduceMotion);
  return (
    <Animated.View
      style={[styles.card, borderColor ? { borderColor } : undefined, kpiAnim.style]}
    >
      <Text style={[styles.cardValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<DashboardStats>({
    invoiceCount: 0,
    totalRevenue: 0,
    pendingCount: 0,
    paidCount: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [trend, setTrend] = useState<MonthlyRevenue[]>([]);
  const [cashflow, setCashflow] = useState<CashflowPrediction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Read reduceMotion preference at mount
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    const { data } = await apiFetch<{ data: any[]; total: number }>(
      "/api/invoices?limit=200"
    );

    if (data) {
      const rawInvoices: any[] = Array.isArray(data)
        ? data
        : (data as { data: any[] }).data ?? [];

      const invoiceCount = rawInvoices.length;
      const totalRevenue = rawInvoices
        .filter((inv) => inv.status === "paid")
        .reduce((s, inv) => s + (inv.total ?? 0), 0);
      const paidCount = rawInvoices.filter((inv) => inv.status === "paid").length;
      const pendingCount = rawInvoices.filter(
        (inv) => inv.status === "sent" || inv.status === "overdue"
      ).length;

      setStats({ invoiceCount, totalRevenue, pendingCount, paidCount });
      setInvoices(rawInvoices as Invoice[]);
      setTrend(getMonthlyRevenueTrend(rawInvoices, 6));
      setCashflow(predictCashflow(rawInvoices));

      // Schedule reminders & overdue notifications in background
      schedulePaymentReminders(rawInvoices).catch(() => {});
      scheduleOverdueNotifications(rawInvoices).catch(() => {});
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

  const handleNewInvoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/invoices/new");
  };

  // ─── Quick Actions ─────────────────────────────────────────────────────────

  const QUICK_ACTIONS = [
    {
      icon: "📄",
      label: "Nuova\nFattura",
      onPress: handleNewInvoice,
      accessibilityLabel: "Crea nuova fattura",
    },
    {
      icon: "👤",
      label: "Nuovo\nCliente",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(app)/clients/add");
      },
      accessibilityLabel: "Aggiungi nuovo cliente",
    },
    {
      icon: "📷",
      label: "Scansiona",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(app)/scanner");
      },
      accessibilityLabel: "Scansiona ricevuta",
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !loading && stats.invoiceCount === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6c63ff"
          colors={["#6c63ff"]}
          progressBackgroundColor="#111318"
        />
      }
    >
      {/* ── Header gradient ─────────────────────────────────────────────── */}
      <View style={styles.headerGradient}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#12131a" }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0b0f", opacity: 0.6 }]} />
        <Text style={styles.title}>✦ InvoiceStudio</Text>
        <Text style={styles.subtitle}>Dashboard</Text>
      </View>

      {/* ── KPI Cards (or Skeleton) ─────────────────────────────────────── */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard height={80} lines={2} />
          <SkeletonCard height={80} lines={2} />
          <SkeletonCard height={80} lines={2} />
          <SkeletonCard height={80} lines={2} />
        </View>
      ) : isEmpty ? (
        <EmptyState
          icon="🚀"
          title="Benvenuto in InvoiceStudio"
          hint="Crea la tua prima fattura in 30 secondi"
          cta="+ Crea fattura"
          onCTA={() => router.push("/(app)/invoices/new")}
        />
      ) : (
        <>
          {/* Row 1 */}
          <View style={styles.cards}>
            <KPICard
              index={0}
              reduceMotion={reduceMotion}
              value={stats.invoiceCount}
              label="Fatture emesse"
            />
            <KPICard
              index={1}
              reduceMotion={reduceMotion}
              value={fmt(stats.totalRevenue)}
              label="Incassato"
              valueColor="#6c63ff"
            />
          </View>

          {/* Row 2 */}
          <View style={styles.cards}>
            <KPICard
              index={2}
              reduceMotion={reduceMotion}
              value={stats.paidCount}
              label="Pagate"
              valueColor="#22c55e"
              borderColor="#22c55e30"
            />
            <KPICard
              index={3}
              reduceMotion={reduceMotion}
              value={stats.pendingCount}
              label="In attesa / Scadute"
              valueColor="#f59e0b"
              borderColor="#f59e0b30"
            />
          </View>

          {/* Trend 6 mesi */}
          {trend.length > 0 && (
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
          {cashflow && (
            <View style={styles.analyticsCard}>
              <View style={styles.analyticsHeader}>
                <Text style={styles.analyticsTitle}>
                  🔮 Cashflow previsto — prossimi 30 giorni
                </Text>
                <View
                  style={[
                    styles.confidenceBadge,
                    {
                      borderColor: CONFIDENCE_COLOR[cashflow.confidence] + "40",
                      backgroundColor: CONFIDENCE_COLOR[cashflow.confidence] + "12",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.confidenceText,
                      { color: CONFIDENCE_COLOR[cashflow.confidence] },
                    ]}
                  >
                    {cashflow.confidence === "high"
                      ? "Alta"
                      : cashflow.confidence === "medium"
                      ? "Media"
                      : "Bassa"}{" "}
                    affidabilità
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

          {/* Ultime attività */}
          {invoices.length > 0 && (
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsTitle, { marginBottom: 12 }]}>
                🕒 Ultime attività
              </Text>
              {invoices.slice(0, 3).map((item) => {
                const color = STATUS_COLORS[item.status] ?? "#6b7280";
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.activityRow}
                    onPress={() => router.push(`/(app)/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Fattura ${item.number}, ${item.clients?.name ?? "—"}, ${STATUS_LABELS[item.status] ?? item.status}, ${fmt(item.total)}`}
                  >
                    <View style={styles.activityLeft}>
                      <Text style={styles.activityNumber}>{item.number}</Text>
                      <Text style={styles.activityClient}>
                        {item.clients?.name ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.activityRight}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: color + "20",
                            borderColor: color + "40",
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color }]}>
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Text>
                      </View>
                      <Text style={styles.activityAmount}>{fmt(item.total)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* ── Quick Actions Row (sempre visibile) ─────────────────────────── */}
      <View style={styles.quickActionsCard}>
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickActionItem}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
            >
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { paddingBottom: 40 },

  // Header gradient
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    overflow: "hidden",
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginTop: 4 },

  // KPI skeleton
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },

  // KPI cards
  cards: { flexDirection: "row", gap: 12, marginBottom: 12, paddingHorizontal: 20 },
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

  // Analytics / activity cards
  analyticsCard: {
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 12,
    marginHorizontal: 20,
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

  // Activity rows
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2029",
  },
  activityLeft: { flex: 1, gap: 2 },
  activityNumber: { fontSize: 13, fontWeight: "600", color: "#f0f0f2" },
  activityClient: { fontSize: 11, color: "#9ca3af" },
  activityRight: { alignItems: "flex-end", gap: 4 },
  activityAmount: { fontSize: 13, fontWeight: "600", color: "#6c63ff" },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },

  // Quick Actions
  quickActionsCard: {
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  quickActionsRow: { flexDirection: "row", gap: 8 },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1b22",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2d2f3a",
  },
  quickActionIcon: { fontSize: 28 },
  quickActionLabel: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 15,
  },
});
