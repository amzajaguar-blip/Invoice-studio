import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceDetail {
  id: string;
  number: string;
  invoice_number?: string;
  client_name?: string;
  client_email?: string;
  total: number;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string;
  created_at: string;
  notes?: string;
  line_items?: LineItem[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", sent: "#3b82f6",
  paid: "#22c55e", overdue: "#ef4444", cancelled: "#9ca3af",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviata",
  paid: "Pagata", overdue: "Scaduta", cancelled: "Annullata",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "sent",
  sent: "paid",
  paid: "paid",
  overdue: "paid",
};
const NEXT_STATUS_LABEL: Record<string, string> = {
  draft: "Segna come Inviata",
  sent: "Segna come Pagata ✓",
  overdue: "Segna come Pagata ✓",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export default function InvoiceDetailScreen() {
  const { invoice } = useLocalSearchParams();
  const router = useRouter();
  const invoiceId = typeof invoice === "string" ? invoice : "";
  const localeCtx = useLocale();
  const t = typeof localeCtx?.t === 'function' ? localeCtx.t : ((key: string) => key);

  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    apiFetch<InvoiceDetail>(`/api/invoices/${invoiceId}`)
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const invoiceNum = data?.number || data?.invoice_number || invoiceId.slice(0, 8);

  // ─── Cambio status ────────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!data) return;
    const next = NEXT_STATUS[data.status];
    if (!next || next === data.status) return;

    setUpdatingStatus(true);
    const { data: updated, error } = await apiFetch<InvoiceDetail>(
      `/api/invoices/${invoiceId}`,
      { method: "PATCH", body: JSON.stringify({ status: next }) }
    );
    setUpdatingStatus(false);

    if (error) {
      Alert.alert(t("error"), error);
      return;
    }
    if (updated) {
      setData(updated);
    } else {
      // aggiorna localmente se l'API non ritorna il dato aggiornato
      setData((prev) => prev ? { ...prev, status: next as InvoiceDetail["status"] } : prev);
    }
  };

  // ─── Condivisione nativa ──────────────────────────────────────────────────
  const buildShareText = () => {
    const lines = [
      `📄 Fattura #${invoiceNum}`,
      `Cliente: ${data?.client_name ?? "—"}`,
      `Importo: ${fmt(data?.total ?? 0)}`,
      `Scadenza: ${data?.due_date ? new Date(data.due_date).toLocaleDateString("it-IT") : "—"}`,
      `Stato: ${STATUS_LABELS[data?.status ?? "draft"]}`,
      "",
      "Visualizza su VELA",
      `https://invoicestudio.app`,
    ];
    return lines.join("\n");
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await Share.share({
        message: buildShareText(),
        title: `Fattura #${invoiceNum}`,
      });
    } catch {
      // utente ha annullato — nessun errore
    } finally {
      setSharing(false);
    }
  };

  const handleEmail = async () => {
    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      Alert.alert(t("invoice_email_unavailable_title"), t("invoice_email_unavailable_msg"));
      return;
    }
    await MailComposer.composeAsync({
      recipients: data?.client_email ? [data.client_email] : [],
      subject: `Fattura #${invoiceNum} — ${fmt(data?.total ?? 0)}`,
      body: buildShareText(),
    });
  };

  const handleWhatsApp = async () => {
    const text = encodeURIComponent(buildShareText());
    const { Linking } = await import("react-native");
    const url = `whatsapp://send?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(t("invoice_whatsapp_not_found_title"), t("invoice_whatsapp_not_found_msg"));
      return;
    }
    await Linking.openURL(url);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      "Elimina fattura",
      "Sei sicuro? L'operazione non può essere annullata.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error } = await apiFetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
            if (error) { Alert.alert(t("error"), error); return; }
            router.back();
          },
        },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
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
        <Text style={s.errorText}>Fattura non trovata</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>← Indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canChangeStatus = data.status !== "paid" && data.status !== "cancelled";

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Indietro</Text>
      </TouchableOpacity>

      {/* Title + status */}
      <View style={s.titleRow}>
        <Text style={s.title}>Fattura #{invoiceNum}</Text>
        <View style={[s.badge, {
          borderColor: STATUS_COLORS[data.status] + "40",
          backgroundColor: STATUS_COLORS[data.status] + "12",
        }]}>
          <Text style={[s.badgeText, { color: STATUS_COLORS[data.status] }]}>
            {STATUS_LABELS[data.status] ?? data.status}
          </Text>
        </View>
      </View>

      {/* Info card */}
      <View style={s.card}>
        <Row label="Cliente" value={data.client_name ?? "—"} />
        <Row
          label="Importo totale"
          value={fmt(data.total)}
          highlight
        />
        {data.subtotal !== undefined && data.subtotal !== data.total && (
          <Row label="Imponibile" value={fmt(data.subtotal)} />
        )}
        {data.tax_rate !== undefined && data.tax_rate > 0 && (
          <Row label={`IVA (${data.tax_rate}%)`} value={fmt(data.tax_amount ?? 0)} />
        )}
        <Row
          label="Scadenza"
          value={new Date(data.due_date).toLocaleDateString("it-IT")}
        />
        <Row
          label="Emessa il"
          value={new Date(data.created_at).toLocaleDateString("it-IT")}
        />
        {data.notes ? <Row label="Note" value={data.notes} /> : null}
      </View>

      {/* Voci */}
      {data.line_items && data.line_items.length > 0 && (
        <>
          <Text style={s.sectionLabel}>VOCI</Text>
          <View style={s.card}>
            {data.line_items.map((item, i) => (
              <View key={i} style={[s.lineRow, i < data.line_items!.length - 1 && s.lineRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lineDesc}>{item.description}</Text>
                  <Text style={s.lineSub}>
                    {item.quantity} × {fmt(item.rate)}
                  </Text>
                </View>
                <Text style={s.lineAmount}>{fmt(item.amount)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Azioni stato */}
      {canChangeStatus && NEXT_STATUS_LABEL[data.status] && (
        <TouchableOpacity
          style={[s.statusBtn, updatingStatus && s.disabled]}
          onPress={handleStatusUpdate}
          disabled={updatingStatus}
        >
          {updatingStatus ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.statusBtnText}>{NEXT_STATUS_LABEL[data.status]}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Condivisione */}
      <Text style={s.sectionLabel}>CONDIVIDI</Text>
      <View style={s.shareRow}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} disabled={sharing}>
          <Text style={s.shareBtnIcon}>📤</Text>
          <Text style={s.shareBtnText}>Condividi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={handleEmail}>
          <Text style={s.shareBtnIcon}>✉️</Text>
          <Text style={s.shareBtnText}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={handleWhatsApp}>
          <Text style={s.shareBtnIcon}>💬</Text>
          <Text style={s.shareBtnText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* Elimina */}
      <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
        <Text style={s.deleteBtnText}>Elimina fattura</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, highlight && s.rowValueHighlight]}>{value}</Text>
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

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20 },

  card: { backgroundColor: "#111318", borderRadius: 16, padding: 4, borderWidth: 1, borderColor: "#1e2029" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  rowLabel: { fontSize: 14, color: "#9ca3af", flex: 0.45 },
  rowValue: { fontSize: 14, color: "#f0f0f2", fontWeight: "500", flex: 0.55, textAlign: "right" },
  rowValueHighlight: { fontSize: 16, color: "#6c63ff", fontWeight: "700" },

  lineRow: { flexDirection: "row", alignItems: "center", padding: 12 },
  lineRowBorder: { borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  lineDesc: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  lineSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  lineAmount: { fontSize: 14, color: "#6c63ff", fontWeight: "700" },

  statusBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 12, padding: 15,
    alignItems: "center", marginTop: 20,
  },
  statusBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },

  shareRow: { flexDirection: "row", gap: 10 },
  shareBtn: {
    flex: 1, backgroundColor: "#111318", borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#1e2029",
  },
  shareBtnIcon: { fontSize: 22, marginBottom: 4 },
  shareBtnText: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },

  deleteBtn: {
    marginTop: 24, borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1,
    borderColor: "rgba(220,38,38,0.3)",
    backgroundColor: "rgba(220,38,38,0.06)",
  },
  deleteBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
});
