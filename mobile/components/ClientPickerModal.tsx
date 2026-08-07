/**
 * ClientPickerModal — picker inline cliente riutilizzabile
 *
 * Usato da: quotes/new.tsx, expenses/new.tsx
 * Legge dalla tabella `clients` via /api/clients.
 * Alla selezione costruisce e restituisce un ClientSnapshot.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { ClientSnapshot } from "@/shared/types";

interface RawClient {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  vat_number?: string | null;
  default_currency?: string | null;
  currency?: string | null;
}

export interface ClientPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (snapshot: ClientSnapshot) => void;
  selectedClientId?: string;
}

function buildSnapshot(client: RawClient): ClientSnapshot {
  return {
    id: client.id,
    name: client.name,
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
    address: client.address ?? undefined,
    taxId: client.tax_id ?? client.vat_number ?? undefined,
    currency: client.default_currency ?? client.currency ?? "EUR",
  };
}

export function ClientPickerModal({
  visible,
  onClose,
  onSelect,
  selectedClientId,
}: ClientPickerModalProps) {
  const router = useRouter();
  const [clients, setClients] = useState<RawClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiFetch<{ data: RawClient[] }>("/api/clients");
    if (data) {
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setClients(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery("");
      load();
      // Focus search after a short delay (modal animation)
      setTimeout(() => searchRef.current?.focus(), 300);
    }
  }, [visible, load]);

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.email ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : clients;

  const handleSelect = useCallback(
    (client: RawClient) => {
      onSelect(buildSnapshot(client));
      onClose();
    },
    [onSelect, onClose]
  );

  const handleNewClient = useCallback(() => {
    onClose();
    router.push("/(app)/clients/add");
  }, [onClose, router]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Seleziona cliente</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={18} color="#6b7280" style={s.searchIcon} />
          <TextInput
            ref={searchRef}
            style={s.searchInput}
            placeholder="Cerca per nome o email…"
            placeholderTextColor="#4b5563"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#6c63ff" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="people-outline" size={40} color="#374151" />
                <Text style={s.emptyText}>
                  {query.trim()
                    ? "Nessun cliente trovato"
                    : "Nessun cliente ancora"}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedClientId;
              return (
                <TouchableOpacity
                  style={[s.row, isSelected && s.rowSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleziona ${item.name}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={s.rowLeft}>
                    <Text style={[s.rowName, isSelected && s.rowNameSelected]}>
                      {item.name}
                    </Text>
                    {!!item.email && (
                      <Text style={s.rowEmail}>{item.email}</Text>
                    )}
                    {!!(item.tax_id ?? item.vat_number) && (
                      <Text style={s.rowTax}>
                        P.IVA: {item.tax_id ?? item.vat_number}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#6c63ff" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Footer: new client */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.newClientBtn}
            onPress={handleNewClient}
            accessibilityRole="button"
          >
            <Ionicons name="person-add-outline" size={18} color="#6c63ff" />
            <Text style={s.newClientText}>Nuovo cliente</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2029",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#f0f0f2" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#111318",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#1e2029",
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    color: "#f0f0f2",
    fontSize: 15,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: {
    alignItems: "center",
    paddingTop: 48,
    gap: 12,
  },
  emptyText: { fontSize: 15, color: "#6b7280", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 8,
  },
  rowSelected: {
    borderColor: "#6c63ff66",
    backgroundColor: "#6c63ff0d",
  },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "600", color: "#f0f0f2" },
  rowNameSelected: { color: "#6c63ff" },
  rowEmail: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  rowTax: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#0a0b0f",
    borderTopWidth: 1,
    borderTopColor: "#1e2029",
  },
  newClientBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#6c63ff44",
    gap: 8,
  },
  newClientText: { color: "#6c63ff", fontSize: 15, fontWeight: "600" },
});
