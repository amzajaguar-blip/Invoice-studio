import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  client_name?: string;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  due_date: string;
  created_at: string;
  description?: string;
}

export default function InvoiceDetailScreen() {
  const { invoice } = useLocalSearchParams();
  const router = useRouter();
  const invoiceId = typeof invoice === "string" ? invoice : "";

  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    apiFetch<InvoiceDetail>(`/api/invoices/${invoiceId}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const statusLabel: Record<string, string> = {
    draft: "Bozza",
    sent: "Inviata",
    paid: "Pagata",
    overdue: "Scaduta",
  };

  const statusColor: Record<string, string> = {
    draft: "#6b7280",
    sent: "#f59e0b",
    paid: "#22c55e",
    overdue: "#ef4444",
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Fattura non trovata</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Indietro</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Fattura #{data.invoice_number}</Text>

      <View style={[styles.badge, { borderColor: statusColor[data.status] + "40", backgroundColor: statusColor[data.status] + "10" }]}>
        <Text style={[styles.badgeText, { color: statusColor[data.status] }]}>
          {statusLabel[data.status] ?? data.status}
        </Text>
      </View>

      <View style={styles.card}>
        <Row label="Cliente" value={data.client_name ?? "—"} />
        <Row label="Importo" value={new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(data.total)} />
        <Row label="Data scadenza" value={new Date(data.due_date).toLocaleDateString("it-IT")} />
        <Row label="Data emissione" value={new Date(data.created_at).toLocaleDateString("it-IT")} />
        {data.description ? <Row label="Descrizione" value={data.description} /> : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0b0f" },
  error: { color: "#ef4444", fontSize: 16, marginBottom: 12 },
  link: { color: "#6c63ff", fontSize: 15 },
  backBtn: { marginBottom: 16 },
  backText: { color: "#9ca3af", fontSize: 15 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", marginBottom: 12 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, marginBottom: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: "#111318", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1e2029" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  rowLabel: { fontSize: 14, color: "#9ca3af" },
  rowValue: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
});
