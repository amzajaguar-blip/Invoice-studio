import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { apiFetch } from "@/lib/ai";
import { useRewardedInvoice } from "@/lib/useRewardedInvoice";
import { useRouter } from "expo-router";
import InvoiceLimitModal from "../InvoiceLimitModal";

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
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);

  const { quota, adLoaded, adLoading, adError, showAd, refreshQuota } = useRewardedInvoice();

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
    await Promise.all([load(), refreshQuota()]);
    setRefreshing(false);
  }, [load, refreshQuota]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  // Gestione tasto "Nuova Fattura"
  const handleNewInvoice = useCallback(() => {
    if (!quota.canCreate) {
      setLimitModalVisible(true);
      return;
    }
    router.push("/(app)/invoices/new");
  }, [quota.canCreate, router]);

  const handleWatchAd = useCallback(() => {
    showAd();
    setLimitModalVisible(false);
  }, [showAd]);

  const handleUpgrade = useCallback(() => {
    setLimitModalVisible(false);
    router.push("/(app)/ProUpgrade");
  }, [router]);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Fatture</Text>
          <Text style={s.sub}>
            {invoices.length} fattur{invoices.length === 1 ? "a" : "e"}
          </Text>
        </View>

        {/* Quota badge */}
        <TouchableOpacity
          style={[s.quotaBadge, !quota.canCreate && s.quotaBadgeWarn]}
          onPress={handleNewInvoice}
        >
          <Text style={[s.quotaText, !quota.canCreate && s.quotaTextWarn]}>
            {quota.invoicesThisMonth}/{quota.limit} 📄
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pulsante nuova fattura */}
      <TouchableOpacity style={s.newBtn} onPress={handleNewInvoice} activeOpacity={0.85}>
        <Text style={s.newBtnText}>+ Nuova Fattura</Text>
      </TouchableOpacity>

      <FlatList
        data={invoices}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => router.push(`/(app)/${item.id}` as any)}
            activeOpacity={0.8}
          >
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
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📄</Text>
            <Text style={s.emptyT}>Nessuna fattura ancora</Text>
            <Text style={s.emptyH}>Crea la tua prima fattura e inizia a farti pagare</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={handleNewInvoice}>
              <Text style={s.emptyBtnText}>+ Crea fattura</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modale limite raggiunto */}
      <InvoiceLimitModal
        visible={limitModalVisible}
        adLoaded={adLoaded}
        adLoading={adLoading}
        adError={adError}
        quota={quota}
        onWatchAd={handleWatchAd}
        onUpgrade={handleUpgrade}
        onClose={() => setLimitModalVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", paddingTop: 60 },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  quotaBadge: {
    backgroundColor: "#1e2029",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2d2f3a",
  },
  quotaBadgeWarn: {
    borderColor: "#ef444466",
    backgroundColor: "#ef444411",
  },
  quotaText: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  quotaTextWarn: { color: "#ef4444" },
  newBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
  emptyH: { fontSize: 13, color: "#4b5563", marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  emptyBtn: { marginTop: 20, backgroundColor: "#6c63ff", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
