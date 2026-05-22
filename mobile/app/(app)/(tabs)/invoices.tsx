import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { apiFetch } from "@/lib/ai";

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  clients?: { name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", sent: "#3b82f6",
  paid: "#22c55e", overdue: "#ef4444", cancelled: "#9ca3af",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviata",
  paid: "Pagata", overdue: "Scaduta", cancelled: "Annullata",
};

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Invoice[] }>("/api/invoices?limit=50");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Invoice[] }).data || [];
      setInvoices(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Fatture</Text>
      <Text style={s.sub}>{invoices.length} fattur{invoices.length === 1 ? "a" : "e"}</Text>

      <FlatList
        data={invoices}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.num}>{item.number}</Text>
              <View style={[s.badge, { backgroundColor: `${STATUS_COLORS[item.status] || "#6b7280"}20` }]}>
                <Text style={[s.badgeT, { color: STATUS_COLORS[item.status] || "#6b7280" }]}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
            <Text style={s.client}>{item.clients?.name || "—"}</Text>
            <View style={s.row}>
              <Text style={s.date}>{new Date(item.created_at).toLocaleDateString("it-IT")}</Text>
              <Text style={s.total}>{fmt(item.total, item.currency)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📄</Text>
            <Text style={s.emptyT}>Nessuna fattura</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", paddingTop: 60 },
  center: { justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", paddingHorizontal: 20 },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 16, paddingHorizontal: 20 },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  num: { fontSize: 15, fontWeight: "700", color: "#f0f0f2" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 11, fontWeight: "600" },
  client: { fontSize: 14, color: "#9ca3af", marginVertical: 6 },
  date: { fontSize: 12, color: "#6b7280" },
  total: { fontSize: 16, fontWeight: "700", color: "#6c63ff" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyT: { fontSize: 16, color: "#6b7280", fontWeight: "600", marginTop: 12 },
});
