import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import EditClientSheet from "@/app/(app)/clients/EditClientSheet";

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  currency: string;
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
      setClients(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.headerRow}>
          <Text style={s.title}>Clienti</Text>
          <TouchableOpacity
            style={s.addButton}
            onPress={() => router.push("/(app)/clients/add")}
            accessibilityRole="button"
            accessibilityLabel="Aggiungi cliente"
          >
            <Text style={s.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.headerRow}>
        <Text style={s.title}>Clienti</Text>
        <TouchableOpacity
          style={s.addButton}
          onPress={() => router.push("/(app)/clients/add")}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi cliente"
        >
          <Text style={s.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.sub}>{clients.length} client{clients.length === 1 ? "e" : "i"}</Text>

      <FlatList
        data={clients}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
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
          <TouchableOpacity style={s.card} onPress={() => setSelectedClient(item)}>
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.currency}>{item.currency}</Text>
            </View>
            <Text style={s.email}>{item.email}</Text>
            {item.vat_number && <Text style={s.vat}>P.IVA: {item.vat_number}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="Nessun cliente ancora"
            hint="Aggiungi il tuo primo cliente per iniziare a fatturare"
            cta="+ Aggiungi cliente"
            onCTA={() => router.push("/(app)/clients/add")}
          />
        }
      />

      <EditClientSheet
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onSaved={(updated) => {
          setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedClient(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  addButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: "#ffffff", fontSize: 20, lineHeight: 22 },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 16, paddingHorizontal: 20 },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  currency: { fontSize: 12, color: "#6c63ff", fontWeight: "600", backgroundColor: "#6c63ff15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  email: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  vat: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
