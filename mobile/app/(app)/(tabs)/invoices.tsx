import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/ai";
import { useRewardedInvoice } from "@/lib/useRewardedInvoice";
import { useRouter } from "expo-router";
import InvoiceLimitModal from "../InvoiceLimitModal";
import { useInvoiceFilters } from "@/hooks/useInvoiceFilters";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { EmptyState } from "@/components/EmptyState";

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  clients?: { id?: string; name: string; email: string };
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
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);

  const { quota, adLoaded, adLoading, adError, showAd, refreshQuota } = useRewardedInvoice();
  const { filters, setFilters, filtered } = useInvoiceFilters(invoices);

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

  // ListEmptyComponent contestuale
  const renderEmpty = () => {
    if (filters.query) {
      return (
        <EmptyState
          icon="🔍"
          title="Nessun risultato"
          hint={`Nessuna fattura trovata per "${filters.query}"`}
        />
      );
    }
    if (filters.status === "overdue") {
      return (
        <EmptyState
          icon="✅"
          title="Nessuna fattura scaduta"
          hint="Ottimo lavoro! Tutti i pagamenti sono in ordine."
        />
      );
    }
    if (filters.status === "paid") {
      return (
        <EmptyState
          icon="💰"
          title="Ancora nessun incasso"
          hint="Invia le tue fatture per iniziare a ricevere pagamenti."
        />
      );
    }
    if (filters.status === "draft") {
      return (
        <EmptyState
          icon="📝"
          title="Nessuna bozza"
          hint="Le fatture salvate come bozza appariranno qui."
        />
      );
    }
    return (
      <EmptyState
        icon="📄"
        title="Nessuna fattura ancora"
        hint="Crea la tua prima fattura e inizia a farti pagare"
        cta="+ Crea fattura"
        onCTA={handleNewInvoice}
      />
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
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

      {/* SearchBar */}
      <View style={s.searchWrapper}>
        <SearchBar
          value={filters.query}
          onChangeText={(text) => setFilters((p) => ({ ...p, query: text }))}
          onClear={() => setFilters((p) => ({ ...p, query: "" }))}
        />
      </View>

      {/* FilterBar */}
      <View style={s.filterWrapper}>
        <FilterBar
          activeStatus={filters.status}
          onStatusChange={(status) => setFilters((p) => ({ ...p, status }))}
        />
      </View>

      {/* Lista o skeleton */}
      {loading ? (
        <View style={s.skeletonContainer}>
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6c63ff"
              colors={["#6c63ff"]}
              progressBackgroundColor="#111318"
            />
          }
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
          ListEmptyComponent={renderEmpty}
        />
      )}

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
  container: { flex: 1, backgroundColor: "#0a0b0f" },
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
    marginBottom: 12,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  num: { fontSize: 15, fontWeight: "700", color: "#f0f0f2" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 11, fontWeight: "600" },
  client: { fontSize: 14, color: "#9ca3af", marginVertical: 6 },
  date: { fontSize: 12, color: "#6b7280" },
  total: { fontSize: 16, fontWeight: "700", color: "#6c63ff" },
});
