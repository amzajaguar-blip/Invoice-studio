/**
 * contacts.tsx — Tab "Rubrica clienti"
 *
 * Wrapper della schermata clienti che legge dalla tabella `clients` esistente.
 * Usa le chiavi i18n `tabs.contacts.*` per titolo ed empty state Rubrica.
 * Nessun rate-limit: il pulsante "+ Aggiungi cliente" naviga direttamente a
 * /(app)/clients/add senza gate di piano.
 *
 * Design doc: "Il tab contacts.tsx è un wrapper che legge dalla stessa tabella
 * clients. Questo evita breaking change a qualsiasi route o API esistente."
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import EditClientSheet from "@/app/(app)/clients/EditClientSheet";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  tax_id?: string | null;
  /** Legacy field — mantiene compatibilità con voci create prima della migrazione */
  vat_number?: string | null;
  address?: string | null;
  default_currency?: string | null;
  currency: string;
}

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const prevClientCountRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
      setClients(list);
      prevClientCountRef.current = list.length;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ricarica la lista quando la schermata torna in focus (es. dopo add/edit)
  useFocusEffect(
    useCallback(() => {
      if (prevClientCountRef.current === null) return;

      void (async () => {
        const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
        if (!data) return;
        const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
        setClients(list);
        setLoading(false);
        prevClientCountRef.current = list.length;
      })();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * Nessun rate-limit (Req 7.x, design doc §Principi guida punto 3).
   * Naviga direttamente alla route di aggiunta cliente esistente.
   */
  const handleAddClient = useCallback(() => {
    router.push("/(app)/clients/add");
  }, [router]);

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.headerRow}>
          <Text style={s.title}>{t("tabs.contacts.title")}</Text>
          <TouchableOpacity
            style={s.addButton}
            onPress={handleAddClient}
            accessibilityRole="button"
            accessibilityLabel={t("tabs.contacts.add.a11y")}
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
        <Text style={s.title}>{t("tabs.contacts.title")}</Text>
        <TouchableOpacity
          style={s.addButton}
          onPress={handleAddClient}
          accessibilityRole="button"
          accessibilityLabel={t("tabs.contacts.add.a11y")}
        >
          <Text style={s.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.sub}>
        {t("tabs.contacts.sub_count")
          .replace("{n}", String(clients.length))
          .replace("{e|i}", clients.length === 1 ? "e" : "i")}
      </Text>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
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
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              router.push({
                pathname: "/(app)/clients/[id]" as any,
                params: { id: item.id },
              })
            }
            onLongPress={() => setSelectedClient(item)}
            delayLongPress={400}
          >
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.currency}>
                {item.default_currency ?? item.currency}
              </Text>
            </View>
            {!!item.email && <Text style={s.email}>{item.email}</Text>}
            {/* tax_id (Rubrica) oppure vat_number (legacy) */}
            {!!(item.tax_id ?? item.vat_number) && (
              <Text style={s.taxId}>
                P.IVA: {item.tax_id ?? item.vat_number}
              </Text>
            )}
            {!!item.phone && <Text style={s.detail}>{item.phone}</Text>}
            {!!item.address && (
              <Text style={s.detail} numberOfLines={1}>
                {item.address}
              </Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={t("tabs.contacts.empty.title")}
            hint={t("tabs.contacts.empty.hint")}
            cta={t("tabs.contacts.empty.cta")}
            onCTA={handleAddClient}
          />
        }
      />

      <EditClientSheet
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onSaved={(updated) => {
          setClients((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
          );
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
  },
  addButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: "#ffffff", fontSize: 20, lineHeight: 22 },
  sub: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#111318",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  currency: {
    fontSize: 12,
    color: "#6c63ff",
    fontWeight: "600",
    backgroundColor: "#6c63ff15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  email: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  taxId: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  detail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});
