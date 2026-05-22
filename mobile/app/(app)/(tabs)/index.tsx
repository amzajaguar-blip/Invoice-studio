import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";

interface DashboardStats {
  invoiceCount: number;
  totalRevenue: number;
  pendingCount: number;
  paidCount: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    invoiceCount: 0,
    totalRevenue: 0,
    pendingCount: 0,
    paidCount: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data } = await apiFetch<{
      data: Array<{ total: number; status: string }>;
      total: number;
    }>("/api/invoices?limit=100");

    if (data) {
      const invoices = Array.isArray(data) ? data : (data as { data: Array<{ total: number; status: string }> }).data || [];
      const invoiceCount = invoices.length;
      const totalRevenue = invoices.reduce(
        (sum: number, inv: { total: number }) => sum + (inv.total || 0),
        0
      );
      const paidCount = invoices.filter(
        (inv: { status: string }) => inv.status === "paid"
      ).length;
      const pendingCount = invoices.filter(
        (inv: { status: string }) => inv.status === "sent" || inv.status === "overdue"
      ).length;

      setStats({ invoiceCount, totalRevenue, pendingCount, paidCount });
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

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

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>
            {loading ? "..." : stats.invoiceCount}
          </Text>
          <Text style={styles.cardLabel}>Fatture emesse</Text>
        </View>
        <View style={styles.card}>
          <Text style={[styles.cardValue, { color: "#6c63ff" }]}>
            {loading ? "..." : formatCurrency(stats.totalRevenue)}
          </Text>
          <Text style={styles.cardLabel}>Fatturato totale</Text>
        </View>
      </View>

      <View style={styles.cards}>
        <View style={[styles.card, { borderColor: "#22c55e30" }]}>
          <Text style={[styles.cardValue, { color: "#22c55e" }]}>
            {loading ? "..." : stats.paidCount}
          </Text>
          <Text style={styles.cardLabel}>Pagate</Text>
        </View>
        <View style={[styles.card, { borderColor: "#f59e0b30" }]}>
          <Text style={[styles.cardValue, { color: "#f59e0b" }]}>
            {loading ? "..." : stats.pendingCount}
          </Text>
          <Text style={styles.cardLabel}>In attesa</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push("/(app)/scanner")}
      >
        <Text style={styles.scanButtonText}>📷 Scansiona ricevuta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60 },
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
  scanButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
