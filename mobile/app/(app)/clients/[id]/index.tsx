import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

export type ClientDetailParams = { id: string };

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  fiscal_code?: string | null;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  country?: string | null;
  phone?: string | null;
  pec?: string | null;
  codice_destinatario?: string | null;
  currency: string;
  notes?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface InvoiceLite {
  id: string;
  number: string;
  status: string;
  total: number;
  created_at: string;
}

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

const fmt = (n: number, c = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

export default function ClientDetailScreen() {
  const { client } = useLocalSearchParams<{ client: string }>();
  const router = useRouter();
  const clientId = typeof client === "string" && client ? client : "";
  const { t } = useLocale();

  const [data, setData] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      router.back();
      return;
    }
    const { data: clientData } = await apiFetch<Client>(`/api/clients/${clientId}`);
    if (clientData) setData(clientData);

    const { data: invData } = await apiFetch<{ data: InvoiceLite[] }>("/api/invoices?limit=50");
    if (invData) {
      const list = Array.isArray(invData) ? invData : (invData as { data: InvoiceLite[] }).data || [];
      setInvoices(list.filter((inv) => (inv as any).client_id === clientId));
    }
    setLoading(false);
  }, [clientId, router]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEdit = () => {
    router.push(`/clients/edit/${clientId}` as any);
  };

  const handleDelete = () => {
    Alert.alert(
      t("client.delete.title") || "Elimina cliente",
      t("client.delete.confirm") || "Eliminare questo cliente? L'operazione potrebbe essere irreversibile.",
      [
        { text: t("cancel") || "Annulla", style: "cancel" },
        {
          text: t("delete") || "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
            if (error) {
              Alert.alert(t("error") || "Errore", error);
              return;
            }
            router.back();
          },
        },
      ]
    );
  };

  const handleNewInvoice = () => {
    router.push({
      pathname: "/(app)/invoices/new",
      params: { client_id: clientId, name: data?.name || "" },
    } as any);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Cliente non trovato</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>← Indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const paidInvoices = invoices.filter((i) => i.status === "paid").length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Indietro</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{data.name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={s.title}>{data.name}</Text>
        <Text style={s.subtitle}>{data.email}</Text>
      </View>

      {/* Quick actions */}
      <View style={s.quickRow}>
        <TouchableOpacity style={s.quickBtn} onPress={() => Linking.openURL(`mailto:${data.email}`)}>
          <Ionicons name="mail-outline" size={20} color="#6c63ff" />
          <Text style={s.quickBtnText}>Email</Text>
        </TouchableOpacity>
        {data.phone ? (
          <TouchableOpacity style={s.quickBtn} onPress={() => Linking.openURL(`tel:${data.phone}`)}>
            <Ionicons name="call-outline" size={20} color="#6c63ff" />
            <Text style={s.quickBtnText}>Chiama</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.quickBtn} onPress={handleNewInvoice}>
          <Ionicons name="add-circle-outline" size={20} color="#6c63ff" />
          <Text style={s.quickBtnText}>Nuova fattura</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {invoices.length > 0 && (
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>FATTURATO TOTALE</Text>
            <Text style={s.statValue}>{fmt(totalInvoiced, data.currency)}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>PAGATE</Text>
            <Text style={s.statValue}>{paidInvoices}/{invoices.length}</Text>
          </View>
        </View>
      )}

      {/* Dati anagrafici / fiscali */}
      <Text style={s.sectionLabel}>DATI ANAGRAFICI</Text>
      <View style={s.card}>
        {data.vat_number ? <InfoRow label="P.IVA" value={data.vat_number} /> : null}
        {data.fiscal_code ? <InfoRow label="Codice Fiscale" value={data.fiscal_code} /> : null}
        {data.address ? <InfoRow label="Indirizzo" value={data.address} /> : null}
        {data.city || data.zip_code ? (
          <InfoRow
            label="Città / CAP"
            value={[data.zip_code, data.city].filter(Boolean).join(" ")}
          />
        ) : null}
        {data.country ? <InfoRow label="Paese" value={data.country} /> : null}
        {data.phone ? <InfoRow label="Telefono" value={data.phone} /> : null}
        {data.pec ? <InfoRow label="PEC" value={data.pec} /> : null}
        {data.codice_destinatario ? (
          <InfoRow label="Cod. Destinatario SDI" value={data.codice_destinatario} />
        ) : null}
        {data.notes ? <InfoRow label="Note" value={data.notes} /> : null}
      </View>

      {/* Storico fatture */}
      {invoices.length > 0 && (
        <>
          <Text style={s.sectionLabel}>STORICO FATTURE</Text>
          <View style={s.card}>
            {invoices.map((inv, i) => (
              <TouchableOpacity
                key={inv.id}
                style={[s.invRow, i < invoices.length - 1 && s.invRowBorder]}
                onPress={() => router.push(`/(app)/${inv.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.invNumber}>{inv.number}</Text>
                  <Text style={s.invDate}>
                    {new Date(inv.created_at).toLocaleDateString("it-IT")}
                  </Text>
                </View>
                <Text style={[s.invStatus, { color: STATUS_COLORS[inv.status] || "#6b7280" }]}>
                  {STATUS_LABELS[inv.status] || inv.status}
                </Text>
                <Text style={s.invTotal}>{fmt(inv.total, data.currency)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Azioni */}
      <View style={s.actionsRow}>
        <TouchableOpacity style={[s.actionBtn, s.editBtn]} onPress={handleEdit}>
          <Text style={s.editBtnText}>Modifica</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={handleDelete}>
          <Text style={s.deleteBtnText}>Elimina</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0b0f" },
  errorText: { color: "#ef4444", fontSize: 16, marginBottom: 12 },
  link: { color: "#6c63ff", fontSize: 15 },

  backBtn: { marginBottom: 16 },
  backText: { color: "#9ca3af", fontSize: 15 },

  header: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6c63ff20",
    borderWidth: 2,
    borderColor: "#6c63ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#6c63ff", fontSize: 22, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: "700", color: "#f0f0f2", fontFamily: "serif", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#9ca3af" },

  quickRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  quickBtn: {
    flex: 1,
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e2029",
    gap: 4,
  },
  quickBtnText: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: "#111318",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e2029",
  },
  statLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700", letterSpacing: 0.6 },
  statValue: { fontSize: 18, color: "#6c63ff", fontWeight: "700", marginTop: 4 },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20 },

  card: { backgroundColor: "#111318", borderRadius: 16, padding: 4, borderWidth: 1, borderColor: "#1e2029" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  rowLabel: { fontSize: 13, color: "#9ca3af", flex: 0.4 },
  rowValue: { fontSize: 13, color: "#f0f0f2", fontWeight: "500", flex: 0.6, textAlign: "right" },

  invRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  invRowBorder: { borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  invNumber: { fontSize: 14, color: "#f0f0f2", fontWeight: "600" },
  invDate: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  invStatus: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  invTotal: { fontSize: 14, color: "#6c63ff", fontWeight: "700", minWidth: 70, textAlign: "right" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  editBtn: { backgroundColor: "#1e2029", borderWidth: 1, borderColor: "#6c63ff44" },
  editBtnText: { color: "#6c63ff", fontSize: 15, fontWeight: "700" },
  deleteBtn: { borderWidth: 1, borderColor: "rgba(220,38,38,0.3)", backgroundColor: "rgba(220,38,38,0.06)" },
  deleteBtnText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
});
