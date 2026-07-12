import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

interface Quote {
  id: string;
  number: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "invoiced";
  total: number;
  currency: string;
  issue_date: string;
  due_date: string;
  notes: string | null;
  clients?: { id?: string; name: string; email: string };
  quote_items?: { description: string; quantity: number; unit_price: number; tax_rate: number }[];
}

const getStatusLabels = (t: any): Record<string, string> => ({
  draft: t("draft_quote"),
  sent: t("sent_quote"),
  accepted: t("accepted"),
  rejected: t("rejected"),
  invoiced: t("invoiced"),
});

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  sent: "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  invoiced: "#a855f7",
};

export default function QuoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLocale();
  const STATUS_LABELS = getStatusLabels(t);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: Quote }>(`/api/quotes/${id}`).then(({ data }) => {
      if (data) {
        const quoteData = (data as any).data ?? data;
        setQuote(quoteData);
      }
      setLoading(false);
    });
  }, [id]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={s.center}>
        <Ionicons name="document-text-outline" size={48} color="#6b7280" />
        <Text style={s.emptyTitle}>{t("quote_not_found")}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>{t("back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>{t("back")}</Text>
      </TouchableOpacity>

      <View style={s.header}>
        <Text style={s.title}>{quote.number}</Text>
        <View
          style={[
            s.badge,
            { backgroundColor: `${STATUS_COLORS[quote.status] || "#6b7280"}20` },
          ]}
        >
          <Text style={[s.badgeText, { color: STATUS_COLORS[quote.status] || "#6b7280" }]}>
            {STATUS_LABELS[quote.status] || quote.status}
          </Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>{t("client")}</Text>
        <Text style={s.clientName}>{quote.clients?.name || "—"}</Text>
        <Text style={s.clientEmail}>{quote.clients?.email || ""}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>{t("details")}</Text>
        <View style={s.row}>
          <Text style={s.label}>{t("issue_date")}</Text>
          <Text style={s.value}>{new Date(quote.issue_date).toLocaleDateString("it-IT")}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{t("valid_until")}</Text>
          <Text style={s.value}>{new Date(quote.due_date).toLocaleDateString("it-IT")}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>{t("items")}</Text>
        {(quote.quote_items || []).map((item, idx) => (
          <View key={idx} style={s.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemDesc}>{item.description}</Text>
              <Text style={s.itemMeta}>
                {item.quantity} x {fmt(item.unit_price, quote.currency)}
              </Text>
            </View>
            <Text style={s.itemTotal}>
              {fmt(item.quantity * item.unit_price, quote.currency)}
            </Text>
          </View>
        ))}
        <View style={[s.row, s.totalRow]}>
          <Text style={s.totalLabel}>{t("total")}</Text>
          <Text style={s.totalValue}>{fmt(quote.total, quote.currency)}</Text>
        </View>
      </View>

      {quote.notes && (
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t("notes")}</Text>
          <Text style={s.notes}>{quote.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#0a0b0f", justifyContent: "center", alignItems: "center" },
  backBtn: { marginBottom: 16 },
  backText: { color: "#6c63ff", fontSize: 15 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#111318",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  clientName: { fontSize: 16, fontWeight: "600", color: "#f0f0f2" },
  clientEmail: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontSize: 14, color: "#9ca3af" },
  value: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  itemDesc: { fontSize: 14, color: "#f0f0f2" },
  itemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemTotal: { fontSize: 14, color: "#f0f0f2", fontWeight: "600" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#6c63ff33", marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#6c63ff" },
  notes: { fontSize: 14, color: "#f0f0f2", lineHeight: 20 },
  emptyTitle: { fontSize: 18, color: "#f0f0f2", marginTop: 12, marginBottom: 20 },
});
