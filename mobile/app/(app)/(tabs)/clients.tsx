import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { apiFetch } from "@/lib/ai";

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  currency: string;
}

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
      setClients(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Clienti</Text>
      <Text style={s.sub}>{clients.length} client{clients.length === 1 ? "e" : "i"}</Text>

      <FlatList
        data={clients}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.currency}>{item.currency}</Text>
            </View>
            <Text style={s.email}>{item.email}</Text>
            {item.vat_number && <Text style={s.vat}>P.IVA: {item.vat_number}</Text>}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>👥</Text>
            <Text style={s.emptyT}>Nessun cliente</Text>
            <Text style={s.emptyH}>Aggiungi clienti dalla versione web</Text>
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
  name: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  currency: { fontSize: 12, color: "#6c63ff", fontWeight: "600", backgroundColor: "#6c63ff15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  email: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  vat: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyT: { fontSize: 16, color: "#6b7280", fontWeight: "600", marginTop: 12 },
  emptyH: { fontSize: 13, color: "#4b5563", marginTop: 4 },
});
