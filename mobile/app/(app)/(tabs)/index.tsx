import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { usePlan } from "@/context/PlanContext";
import { useEngagementContext } from "@/context/EngagementContext";
import { useSmartCards } from "@/hooks/useSmartCards";
import { BannerAdWrapper } from "@/components/BannerAdWrapper";
import MilestoneCelebration from "@/components/MilestoneCelebration";
import InAppContextualCard from "@/components/InAppContextualCard";

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
  created_at?: string;
  due_date?: string;
  clients?: { name: string };
}

interface MonthlyReportMetric {
  label: string;
  current: number;
  previous: number;
}

interface MonthlyReport {
  metrics: MonthlyReportMetric[];
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

// ─── Monthly Report Helpers ───────────────────────────────────────────────────

/** Ritorna la stringa YYYY-MM del mese corrente e del mese precedente */
function getCurrentAndPreviousMonth(): { current: string; previous: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const current = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const previous = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  return { current, previous };
}

/** Calcola il report mensile derivando i dati dall'array fatture esistente */
function computeMonthlyReport(invoices: Invoice[]): MonthlyReport {
  const { current, previous } = getCurrentAndPreviousMonth();

  const invoicesCurrentMonth = invoices.filter((inv) => {
    const date = inv.created_at ? inv.created_at.substring(0, 7) : null;
    return date === current;
  });

  const invoicesPreviousMonth = invoices.filter((inv) => {
    const date = inv.created_at ? inv.created_at.substring(0, 7) : null;
    return date === previous;
  });

  const countPaid = (list: Invoice[]) =>
    list.filter((inv) => inv.status === "paid").length;

  const countCreated = (list: Invoice[]) => list.length;

  const metrics: MonthlyReportMetric[] = [
    {
      label: "Fatture create",
      current: countCreated(invoicesCurrentMonth),
      previous: countCreated(invoicesPreviousMonth),
    },
    {
      label: "Fatture pagate",
      current: countPaid(invoicesCurrentMonth),
      previous: countPaid(invoicesPreviousMonth),
    },
    {
      label: "In scadenza",
      current: invoicesCurrentMonth.filter(
        (inv) =>
          inv.status === "sent" || inv.status === "overdue"
      ).length,
      previous: invoicesPreviousMonth.filter(
        (inv) =>
          inv.status === "sent" || inv.status === "overdue"
      ).length,
    },
  ];

  return { metrics };
}

/** Formatta la variazione percentuale tra valore corrente e precedente */
function formatGrowth(current: number, previous: number): { text: string; color: string } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { text: "Nuovo", color: "#22c55e" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null; // nessuna variazione significativa
  const rounded = Math.round(pct);
  if (rounded > 0) return { text: `+${rounded}%`, color: "#22c55e" };
  return { text: `${rounded}%`, color: "#ef4444" };
}

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

  // ─── V34 Phase 2 hooks ─────────────────────────────────────────────────────
  const { isPremium, limits } = usePlan();
  const { pendingMilestone, dismissMilestone, engagement } = useEngagementContext();
  const { card, dismiss: dismissCard } = useSmartCards("dashboard_limit_warning");

  const [stats, setStats] = useState<DashboardStats>({
    invoiceCount: 0,
    totalRevenue: 0,
    pendingCount: 0,
    paidCount: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [trend, setTrend] = useState<MonthlyRevenue[]>([]);
  const [cashflow, setCashflow] = useState<CashflowPrediction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Read reduceMotion preference at mount (used by MilestoneCelebration)
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
      setMonthlyReport(computeMonthlyReport(rawInvoices as Invoice[]));
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

  // ─── Dashboard State ───────────────────────────────────────────────────────

  const dashboardState = useMemo<'new' | 'near_limit' | 'premium' | 'growing'>(() => {
    if (loading) return 'growing'; // keep existing content during load
    if (isPremium) return 'premium';
    const effectiveLimit = limits.invoices.base + limits.invoices.boost;
    const nearLimitThreshold = Math.floor(effectiveLimit * 0.8);
    if (!limits.isLoading && limits.invoices.used >= nearLimitThreshold && limits.invoices.used > 0) return 'near_limit';
    if (stats.invoiceCount === 0) return 'new';
    return 'growing';
  }, [loading, isPremium, limits, stats.invoiceCount]);

  const prevDashboardStateRef = useRef(dashboardState);
  useEffect(() => {
    if (prevDashboardStateRef.current !== dashboardState && !reduceMotion) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    prevDashboardStateRef.current = dashboardState;
  }, [dashboardState, reduceMotion, fadeAnim]);

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

  return (
    <View style={styles.rootContainer}>
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

        {/* ── Dynamic Dashboard (4-state) ────────────────────────────────── */}
        {loading ? (
          <View style={styles.skeletonContainer}>
            <SkeletonCard height={80} lines={2} />
            <SkeletonCard height={80} lines={2} />
            <SkeletonCard height={80} lines={2} />
            <SkeletonCard height={80} lines={2} />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {dashboardState === 'new' && (
              /* ONBOARDING GUIDE CARDS */
              <View style={styles.onboardingContainer}>
                <Text style={styles.onboardingTitle}>Inizia con InvoiceStudio</Text>
                {[
                  { icon: '📄', label: 'Crea la tua prima fattura', onPress: () => router.push('/(app)/invoices/new') },
                  { icon: '👥', label: 'Aggiungi il tuo primo cliente', onPress: () => router.push('/(app)/clients/add') },
                  { icon: '⚙️', label: 'Imposta il tuo profilo', onPress: () => router.push('/(app)/(tabs)/settings') },
                ].map((item) => (
                  <TouchableOpacity key={item.label} style={styles.onboardingCard} onPress={item.onPress} activeOpacity={0.8}>
                    <Text style={styles.onboardingCardIcon}>{item.icon}</Text>
                    <Text style={styles.onboardingCardLabel}>{item.label}</Text>
                    <Text style={styles.onboardingCardChevron}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(dashboardState === 'growing' || dashboardState === 'near_limit' || dashboardState === 'premium') && (
              <>
                {/* Near-limit prominent warning */}
                {dashboardState === 'near_limit' && (
                  <View style={styles.nearLimitWarning}>
                    <Text style={styles.nearLimitText}>⚠️ Sei vicino al limite mensile — considera il Business Boost</Text>
                  </View>
                )}

                {/* Streak indicator (growing/premium) */}
                {engagement.currentStreak > 0 && (
                  <View style={[styles.analyticsCard, { marginBottom: 12 }]}>
                    <Text style={styles.analyticsTitle}>🔥 Streak: {engagement.currentStreak} giorn{engagement.currentStreak === 1 ? 'o' : 'i'} consecutivi</Text>
                  </View>
                )}

                {/* KPI Cards */}
                <View style={styles.cards}>
                  <KPICard index={0} reduceMotion={reduceMotion} value={stats.invoiceCount} label="Fatture emesse" />
                  <KPICard index={1} reduceMotion={reduceMotion} value={fmt(stats.totalRevenue)} label="Incassato" valueColor="#6c63ff" />
                </View>
                <View style={styles.cards}>
                  <KPICard index={2} reduceMotion={reduceMotion} value={stats.paidCount} label="Pagate" valueColor="#22c55e" borderColor="#22c55e30" />
                  <KPICard index={3} reduceMotion={reduceMotion} value={stats.pendingCount} label="In attesa / Scadute" valueColor="#f59e0b" borderColor="#f59e0b30" />
                </View>

                {/* Usage progress bar (growing/near_limit only) */}
                {dashboardState !== 'premium' && !limits.isLoading && (
                  <View style={styles.usageCard}>
                    <View style={styles.usageHeader}>
                      <Text style={styles.usageLabel}>Fatture mensili</Text>
                      <Text style={styles.usageCount}>{limits.invoices.used}/{limits.invoices.base + limits.invoices.boost}</Text>
                    </View>
                    <View style={styles.usageBarBg}>
                      <View style={[styles.usageBarFill, {
                        width: `${Math.min(100, (limits.invoices.used / Math.max(1, limits.invoices.base + limits.invoices.boost)) * 100)}%` as any,
                        backgroundColor: dashboardState === 'near_limit' ? '#f59e0b' : '#6c63ff',
                      }]} />
                    </View>
                  </View>
                )}

                {/* InAppContextualCard */}
                {card !== null && (
                  <InAppContextualCard card={card} onDismiss={dismissCard} onCTA={dismissCard} style={styles.contextualCard} />
                )}

                {/* Monthly Report (from task 14.1) */}
                {monthlyReport && (
                  <View style={styles.analyticsCard}>
                    <View style={styles.analyticsHeader}>
                      <Text style={styles.analyticsTitle}>📊 Report Mensile</Text>
                      {isPremium ? (
                        <Text style={styles.reportCTAText}>Vedi report completo</Text>
                      ) : (
                        <TouchableOpacity onPress={() => router.push('/(app)/ProUpgrade' as never)}>
                          <Text style={[styles.reportCTAText, { color: '#6c63ff' }]}>Sblocca Analytics →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {monthlyReport.metrics.map((metric) => {
                      const growth = formatGrowth(metric.current, metric.previous);
                      return (
                        <View key={metric.label} style={styles.reportRow}>
                          <Text style={styles.reportLabel}>{metric.label}</Text>
                          <View style={styles.reportValues}>
                            <Text style={styles.reportCurrent}>{metric.current}</Text>
                            {growth && (
                              <View style={[styles.growthBadge, { backgroundColor: growth.color + '20' }]}>
                                <Text style={[styles.growthText, { color: growth.color }]}>{growth.text}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Trend 6 mesi */}
                {trend.length > 0 && (
                  <View style={styles.analyticsCard}>
                    <View style={styles.analyticsHeader}>
                      <Text style={styles.analyticsTitle}>📈 Trend incassi — ultimi 6 mesi</Text>
                    </View>
                    <MiniBarChart data={trend} height={88} />
                    <View style={styles.trendLegend}>
                      {trend.slice(-3).map((t, i) => (
                        <Text key={i} style={styles.trendLegendText}>{t.month}: <Text style={{ color: '#f0f0f2' }}>{fmt(t.total)}</Text></Text>
                      ))}
                    </View>
                  </View>
                )}

                {/* Cashflow */}
                {cashflow && (
                  <View style={styles.analyticsCard}>
                    <View style={styles.analyticsHeader}>
                      <Text style={styles.analyticsTitle}>🔮 Cashflow previsto — prossimi 30 giorni</Text>
                      <View style={[styles.confidenceBadge, { borderColor: CONFIDENCE_COLOR[cashflow.confidence] + '40', backgroundColor: CONFIDENCE_COLOR[cashflow.confidence] + '12' }]}>
                        <Text style={[styles.confidenceText, { color: CONFIDENCE_COLOR[cashflow.confidence] }]}>
                          {cashflow.confidence === 'high' ? 'Alta' : cashflow.confidence === 'medium' ? 'Media' : 'Bassa'} affidabilità
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cashflowAmount}>{fmt(cashflow.expectedNext30Days)}</Text>
                    <View style={styles.cashflowMeta}>
                      <Text style={styles.cashflowMetaText}>📄 {cashflow.pendingInvoices} fattura/e in scadenza nei prossimi 30gg</Text>
                      <Text style={styles.cashflowMetaText}>📊 Media mensile: {fmt(cashflow.avgMonthlyRevenue)}</Text>
                    </View>
                  </View>
                )}

                {/* Ultime attività */}
                {invoices.length > 0 && (
                  <View style={styles.analyticsCard}>
                    <Text style={[styles.analyticsTitle, { marginBottom: 12 }]}>🕒 Ultime attività</Text>
                    {invoices.slice(0, 3).map((item) => {
                      const color = STATUS_COLORS[item.status] ?? '#6b7280';
                      return (
                        <TouchableOpacity key={item.id} style={styles.activityRow} onPress={() => router.push(`/(app)/${item.id}`)} accessibilityRole="button">
                          <View style={styles.activityLeft}>
                            <Text style={styles.activityNumber}>{item.number}</Text>
                            <Text style={styles.activityClient}>{item.clients?.name ?? '—'}</Text>
                          </View>
                          <View style={styles.activityRight}>
                            <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                              <Text style={[styles.statusBadgeText, { color }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
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
          </Animated.View>
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

        {/* ── BannerAdWrapper — in fondo allo ScrollView, solo per utenti free ── */}
        {!isPremium && (
          <BannerAdWrapper screen="dashboard" style={{ marginTop: 24 }} />
        )}
      </ScrollView>

      {/* ── MilestoneCelebration — overlay fuori dallo ScrollView ─────────── */}
      <MilestoneCelebration
        milestone={pendingMilestone}
        onDismiss={dismissMilestone}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Root container: wraps ScrollView + MilestoneCelebration overlay
  rootContainer: { flex: 1, backgroundColor: "#0a0b0f" },
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
  // InAppContextualCard spacing
  contextualCard: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
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

  // Monthly Report
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e2029' },
  reportLabel: { fontSize: 13, color: '#9ca3af' },
  reportValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportCurrent: { fontSize: 15, fontWeight: '700', color: '#f0f0f2' },
  reportCTAText: { fontSize: 12, color: '#6b7280' },
  growthBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  growthText: { fontSize: 11, fontWeight: '700' },

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

  // Onboarding (new state)
  onboardingContainer: { paddingHorizontal: 20, paddingTop: 8 },
  onboardingTitle: { fontSize: 16, fontWeight: '700', color: '#f0f0f2', marginBottom: 16 },
  onboardingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111318', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e2029', marginBottom: 10, gap: 12 },
  onboardingCardIcon: { fontSize: 24 },
  onboardingCardLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#f0f0f2' },
  onboardingCardChevron: { color: '#6c63ff', fontSize: 16, fontWeight: '700' },

  // Near-limit warning
  nearLimitWarning: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#f59e0b18', borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 4, borderColor: '#f59e0b44', borderLeftColor: '#f59e0b' },
  nearLimitText: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },

  // Usage progress bar
  usageCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#111318', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e2029' },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usageLabel: { fontSize: 13, color: '#9ca3af' },
  usageCount: { fontSize: 13, color: '#f0f0f2', fontWeight: '600' },
  usageBarBg: { height: 6, backgroundColor: '#1e2029', borderRadius: 3, overflow: 'hidden' },
  usageBarFill: { height: 6, borderRadius: 3 },
});