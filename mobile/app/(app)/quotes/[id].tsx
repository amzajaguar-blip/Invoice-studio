/**
 * quotes/[id].tsx — Dettaglio preventivo
 * Genera documento (PDF/DOCX/RTF), gate quota, traduci, converti in fattura.
 * Requirements: 4.2-4.5, 11.4, 19.2, 19.7, 20.3, 21.4
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { generateDocumentPDF } from "@/lib/pdf-utils";
import * as Sharing from "expo-sharing";
import { FormatPickerModal, DocumentFormat, loadLastDocFormat } from "@/components/FormatPickerModal";
import { generateDocumentDOC, generateDocumentRTF, shareDocument, DocumentFormatData } from "@/lib/document-format-engine";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";
import { translateDocumentContent, extractTranslatableFields, TranslatableFields } from "@/lib/translation-service";
import { QuotaPaywall } from "@/components/QuotaPaywall";
import { checkQuota, incrementQuota } from "@/lib/quota-engine";
import { supabase } from "@/lib/supabase";
import IAPPaywall from "@/components/IAPPaywall";
import { useDocumentAd } from "@/lib/useDocumentAd";

interface ClientSnapshot { id?: string; name: string; email?: string; phone?: string; address?: string; taxId?: string; currency: string; }
interface LineItem { id?: string; description: string; quantity: number; rate: number; amount: number; }
interface Quote {
  id: string; quote_number: string; number?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "invoiced";
  total: number; subtotal: number; tax_rate: number; tax_amount: number;
  discount_amount: number; currency: string; issue_date: string;
  valid_until: string; notes: string | null;
  client_snapshot?: ClientSnapshot; line_items?: LineItem[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", sent: "#3b82f6", accepted: "#22c55e",
  rejected: "#ef4444", invoiced: "#a855f7",
};
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"], sent: ["accepted", "rejected"],
  accepted: ["invoiced"], rejected: [], invoiced: [],
};

export default function QuoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const generatingRef = useRef(false);

  // Format picker
  const [formatPickerVisible, setFormatPickerVisible] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentFormat | null>(null);

  // Traduttore
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedFields, setTranslatedFields] = useState<TranslatableFields | null>(null);
  const [isTranslated, setIsTranslated] = useState(false);

  // Quota
  const [quotaPaywallVisible, setQuotaPaywallVisible] = useState(false);
  const [premiumPaywallVisible, setPremiumPaywallVisible] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Ad obbligatoria pre-generazione
  const { runWithAd, adLoading } = useDocumentAd();

  const STATUS_LABELS: Record<string, string> = {
    draft: t("draft_quote"), sent: t("sent_quote"),
    accepted: t("accepted"), rejected: t("rejected"), invoiced: t("invoiced"),
  };

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: Quote }>(`/api/quotes/${id}`).then(({ data }) => {
      if (data) setQuote((data as any).data ?? data);
      setLoading(false);
    });
    loadLastDocFormat().then((last) => { if (last) setSelectedFormat(last); });
    // Recupera orgId dall'utente corrente
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        supabase.from("organizations").select("id").eq("user_id", data.user.id).maybeSingle()
          .then(({ data: org }) => { if (org?.id) setOrgId(org.id); });
      }
    });
  }, [id]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  const buildDocumentData = useCallback((): DocumentFormatData | null => {
    if (!quote) return null;
    const snap = quote.client_snapshot;
    const fields = translatedFields ?? null;
    const lineItems = (quote.line_items ?? []).map((i, idx) => ({
      description: fields?.descriptions[idx] ?? i.description,
      quantity: i.quantity, rate: i.rate, amount: i.amount,
    }));
    return {
      type: "quote",
      title: fields?.title ?? `Preventivo ${quote.quote_number ?? quote.id}`,
      number: quote.quote_number ?? quote.id,
      issueDate: new Date(quote.issue_date).toLocaleDateString("it-IT"),
      validUntil: new Date(quote.valid_until).toLocaleDateString("it-IT"),
      client: snap ? { name: snap.name, email: snap.email, address: snap.address, taxId: snap.taxId } : undefined,
      lineItems,
      totals: {
        subtotal: quote.subtotal ?? 0,
        taxRate: quote.tax_rate,
        taxAmount: quote.tax_amount,
        grandTotal: quote.total,
        currency: quote.currency ?? "EUR",
      },
      notes: fields?.notes ?? (quote.notes ?? undefined),
    };
  }, [quote, translatedFields]);

  // ── Genera documento (con gate quota + ad obbligatoria) ────────────────────
  const handleGenerateDocument = useCallback(async (format: DocumentFormat) => {
    if (!quote || generatingRef.current) return;
    setFormatPickerVisible(false);

    // Gate quota
    if (orgId) {
      try {
        const quotaResult = await checkQuota(orgId);
        if (!quotaResult.allowed) { setQuotaPaywallVisible(true); return; }
      } catch {
        // checkQuota non raggiungibile — mostra avviso non bloccante e procede
        Alert.alert(t("error"), "Impossibile verificare la quota documenti. Riprova tra un momento.");
        setGenerating(false);
        generatingRef.current = false;
        return;
      }
    }

    generatingRef.current = true;
    setGenerating(true);

    // runWithAd: mostra interstitial per utenti free, poi esegue la generazione
    await runWithAd(async () => {
      try {
        const quoteNum = quote.quote_number ?? quote.id;
        if (format === "pdf") {
          const pdfData = {
            id: quote.id,
            quoteNumber: quoteNum,
            clientSnapshot: {
              ...(quote.client_snapshot ?? { name: "—", currency: quote.currency ?? "EUR" }),
              id: quote.client_snapshot?.id ?? "",
            } as { id: string; name: string; email?: string; phone?: string; address?: string; taxId?: string; currency: string },
            status: quote.status,
            issueDate: new Date(quote.issue_date),
            validUntil: new Date(quote.valid_until),
            lineItems: (quote.line_items ?? []).map((i) => ({
              id: i.id ?? Math.random().toString(36).slice(2),
              description: translatedFields?.descriptions[
                (quote.line_items ?? []).indexOf(i)
              ] ?? i.description,
              quantity: i.quantity, rate: i.rate, amount: i.amount,
            })),
            subtotal: quote.subtotal ?? 0, taxRate: quote.tax_rate ?? 0,
            taxAmount: quote.tax_amount ?? 0, discountAmount: quote.discount_amount ?? 0,
            total: quote.total, notes: translatedFields?.notes ?? (quote.notes ?? undefined),
          };
          const filepath = await generateDocumentPDF(pdfData, { documentType: "quote" });
          if (!filepath) { Alert.alert(t("error"), "Impossibile generare il PDF."); return; }
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) await Sharing.shareAsync(filepath, { mimeType: "application/pdf", dialogTitle: `Preventivo ${quoteNum}` });
          else Alert.alert("PDF generato", `File: ${filepath}`);
        } else {
          const docData = buildDocumentData();
          if (!docData) throw new Error("Dati non disponibili");
          if (format === "doc") {
            const fp = await generateDocumentDOC(docData);
            await shareDocument(fp, `preventivo_${quoteNum}.docx`);
          } else {
            const fp = await generateDocumentRTF(docData);
            await shareDocument(fp, `preventivo_${quoteNum}.rtf`);
          }
        }
        // Incrementa quota dopo generazione riuscita
        if (orgId) { try { await incrementQuota(orgId); } catch { /* quota esaurita */ } }
      } catch (err) {
        Alert.alert(t("error"), "Errore durante la generazione del documento.");
      }
    });

    setGenerating(false);
    generatingRef.current = false;
  }, [quote, orgId, translatedFields, buildDocumentData, runWithAd, t]);

  // ── Traduzione ────────────────────────────────────────────────────────────
  const handleTranslate = useCallback(async (langCode: string) => {
    if (!quote) return;
    setLangPickerVisible(false);
    setTranslating(true);
    try {
      const fields = extractTranslatableFields({
        title: `Preventivo ${quote.quote_number ?? quote.id}`,
        lineItemDescriptions: (quote.line_items ?? []).map((i) => i.description),
        notes: quote.notes ?? undefined,
      });
      const result = await translateDocumentContent(fields, langCode);
      if (result.translated) {
        setTranslatedFields(result.fields);
        setIsTranslated(true);
      } else {
        Alert.alert(t("error"), result.error === "timeout"
          ? "Traduzione scaduta. Riprova." : "Traduzione non disponibile.");
      }
    } catch {
      Alert.alert(t("error"), "Errore durante la traduzione.");
    } finally {
      setTranslating(false);
    }
  }, [quote, t]);

  // ── Aggiornamento stato ───────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(async (newStatus: string) => {
    if (!quote) return;
    setUpdatingStatus(true);
    const { error } = await apiFetch(`/api/quotes/${quote.id}`, {
      method: "PATCH", body: JSON.stringify({ status: newStatus }),
    });
    setUpdatingStatus(false);
    if (error) { Alert.alert(t("error"), error); return; }
    setQuote((prev) => prev ? { ...prev, status: newStatus as Quote["status"] } : prev);
  }, [quote, t]);

  const showStatusPicker = useCallback(() => {
    if (!quote) return;
    const transitions = STATUS_TRANSITIONS[quote.status] ?? [];
    if (!transitions.length) { Alert.alert("Stato finale", "Questo preventivo non può cambiare stato."); return; }
    Alert.alert("Cambia stato", `Stato: ${STATUS_LABELS[quote.status]}`, [
      ...transitions.map((s) => ({ text: STATUS_LABELS[s] ?? s, onPress: () => handleUpdateStatus(s) })),
      { text: t("cancel"), style: "cancel" as const },
    ]);
  }, [quote, STATUS_LABELS, handleUpdateStatus, t]);

  // ── Converti in Fattura ───────────────────────────────────────────────────
  const handleConvertToInvoice = useCallback(() => {
    if (!quote || quote.status !== "accepted") return;
    router.push({
      pathname: "/(app)/invoices/new" as any,
      params: {
        prefill_client_id: quote.client_snapshot?.id ?? "",
        prefill_client_name: quote.client_snapshot?.name ?? "",
        prefill_line_items: JSON.stringify(quote.line_items ?? []),
        prefill_tax_rate: String(quote.tax_rate ?? 22),
        prefill_notes: quote.notes ?? "",
      },
    });
  }, [quote, router]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c63ff" /></View>;
  if (!quote) return (
    <View style={s.center}>
      <Ionicons name="document-text-outline" size={48} color="#6b7280" />
      <Text style={s.emptyTitle}>{t("quote_not_found")}</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>{t("back")}</Text>
      </TouchableOpacity>
    </View>
  );

  const quoteNumber = quote.quote_number ?? quote.number ?? quote.id;
  const snapshot = quote.client_snapshot;
  const transitions = STATUS_TRANSITIONS[quote.status] ?? [];
  const formatLabel = selectedFormat === "doc" ? "DOCX" : selectedFormat === "rtf" ? "RTF" : "PDF";

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← {t("back")}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{quoteNumber}</Text>
          <TouchableOpacity
            style={[s.badge, { backgroundColor: `${STATUS_COLORS[quote.status] ?? "#6b7280"}20` }]}
            onPress={showStatusPicker} accessibilityRole="button">
            <Text style={[s.badgeText, { color: STATUS_COLORS[quote.status] ?? "#6b7280" }]}>
              {STATUS_LABELS[quote.status] ?? quote.status}{transitions.length > 0 ? " ▾" : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Badge traduzione attiva */}
        {isTranslated && (
          <View style={s.translatedBadge}>
            <Ionicons name="language-outline" size={13} color="#6c63ff" />
            <Text style={s.translatedBadgeText}>{t("translator.auto_label")}</Text>
            <TouchableOpacity onPress={() => { setTranslatedFields(null); setIsTranslated(false); }}>
              <Ionicons name="close-circle" size={14} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {/* Azioni */}
        <View style={s.actionsRow}>
          {/* Genera documento */}
          <TouchableOpacity
            style={[s.actionBtn, (generating || translating || adLoading) && s.actionBtnDisabled]}
            onPress={() => !(generating || adLoading) && setFormatPickerVisible(true)}
            disabled={generating || translating || adLoading} accessibilityRole="button">
            {(generating || adLoading) ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="document-text-outline" size={18} color="#fff" />}
            <Text style={s.actionBtnText}>
              {adLoading ? "Pub…" : generating ? "…" : formatLabel}
            </Text>
            {!(generating || adLoading) && <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />}
          </TouchableOpacity>

          {/* Traduci */}
          <TouchableOpacity
            style={[s.actionBtnSecondary, (generating || translating) && s.actionBtnDisabled]}
            onPress={() => !translating && setLangPickerVisible(true)}
            disabled={generating || translating} accessibilityRole="button">
            {translating ? <ActivityIndicator size="small" color="#6c63ff" />
              : <Ionicons name="language-outline" size={16} color="#6c63ff" />}
            <Text style={s.actionBtnSecondaryText}>{translating ? "…" : t("translator.title")}</Text>
          </TouchableOpacity>
        </View>

        {/* Converti in Fattura */}
        {quote.status === "accepted" && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen, { marginBottom: 16 }]}
            onPress={handleConvertToInvoice} accessibilityRole="button">
            <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
            <Text style={s.actionBtnText}>Converti in Fattura</Text>
          </TouchableOpacity>
        )}

        {/* Cliente */}
        {snapshot && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t("client")}</Text>
            <Text style={s.clientName}>{snapshot.name}</Text>
            {!!snapshot.email && <Text style={s.clientDetail}>{snapshot.email}</Text>}
            {!!snapshot.phone && <Text style={s.clientDetail}>{snapshot.phone}</Text>}
            {!!snapshot.taxId && <Text style={s.clientDetail}>P.IVA: {snapshot.taxId}</Text>}
            {!!snapshot.address && <Text style={s.clientDetail}>{snapshot.address}</Text>}
          </View>
        )}

        {/* Date */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t("details")}</Text>
          <View style={s.row}>
            <Text style={s.label}>{t("issue_date")}</Text>
            <Text style={s.value}>{new Date(quote.issue_date).toLocaleDateString("it-IT")}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>{t("valid_until")}</Text>
            <Text style={s.value}>{new Date(quote.valid_until).toLocaleDateString("it-IT")}</Text>
          </View>
        </View>

        {/* Voci */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t("items")}</Text>
          {(quote.line_items ?? []).map((item, idx) => (
            <View key={item.id ?? idx} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemDesc}>{translatedFields?.descriptions[idx] ?? item.description}</Text>
                <Text style={s.itemMeta}>{item.quantity} × {fmt(item.rate, quote.currency)}</Text>
              </View>
              <Text style={s.itemTotal}>{fmt(item.amount, quote.currency)}</Text>
            </View>
          ))}
          <View style={s.row}>
            <Text style={s.label}>{t("subtotal")}</Text>
            <Text style={s.value}>{fmt(quote.subtotal ?? 0, quote.currency)}</Text>
          </View>
          {(quote.tax_rate ?? 0) > 0 && (
            <View style={s.row}>
              <Text style={s.label}>{t("vat")} ({quote.tax_rate}%)</Text>
              <Text style={s.value}>{fmt(quote.tax_amount ?? 0, quote.currency)}</Text>
            </View>
          )}
          {(quote.discount_amount ?? 0) > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Sconto</Text>
              <Text style={s.value}>-{fmt(quote.discount_amount ?? 0, quote.currency)}</Text>
            </View>
          )}
          <View style={[s.row, s.totalRow]}>
            <Text style={s.totalLabel}>{t("total").toUpperCase()}</Text>
            <Text style={s.totalValue}>{fmt(quote.total, quote.currency)}</Text>
          </View>
        </View>

        {/* Note */}
        {!!(translatedFields?.notes ?? quote.notes) && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t("notes")}</Text>
            <Text style={s.notes}>{translatedFields?.notes ?? quote.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* Modali */}
      <FormatPickerModal
        visible={formatPickerVisible}
        selectedFormat={selectedFormat}
        onSelect={(fmt) => { setSelectedFormat(fmt); void handleGenerateDocument(fmt); }}
        onDismiss={() => setFormatPickerVisible(false)}
      />
      <LanguagePickerModal
        visible={langPickerVisible}
        onSelect={handleTranslate}
        onDismiss={() => setLangPickerVisible(false)}
      />
      <QuotaPaywall
        visible={quotaPaywallVisible}
        remaining={0}
        limit={5}
        onQuotaUpdated={() => { setQuotaPaywallVisible(false); }}
        onDismiss={() => setQuotaPaywallVisible(false)}
        onUpgradeToPremium={() => { setQuotaPaywallVisible(false); setPremiumPaywallVisible(true); }}
      />
      {premiumPaywallVisible && (
        <IAPPaywall
          productId="vela.template.premium"
          featureName="Premium"
          featureDescription="Documenti illimitati e funzioni Pro."
          onPurchaseSuccess={() => { setPremiumPaywallVisible(false); }}
          onDismiss={() => setPremiumPaywallVisible(false)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#0a0b0f", justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 18, color: "#f0f0f2", marginTop: 12, marginBottom: 20, textAlign: "center" },
  backBtn: { marginBottom: 16 },
  backText: { color: "#6c63ff", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  translatedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#6c63ff18",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: "flex-start",
    borderWidth: 1, borderColor: "#6c63ff30" },
  translatedBadgeText: { fontSize: 12, color: "#6c63ff", fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff",
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flex: 1, justifyContent: "center" },
  actionBtnGreen: { backgroundColor: "#22c55e" },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  actionBtnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6c63ff14",
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flex: 1, justifyContent: "center",
    borderWidth: 1, borderColor: "#6c63ff40" },
  actionBtnSecondaryText: { color: "#6c63ff", fontWeight: "600", fontSize: 13 },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  clientName: { fontSize: 16, fontWeight: "600", color: "#f0f0f2" },
  clientDetail: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontSize: 14, color: "#9ca3af" },
  value: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  itemDesc: { fontSize: 14, color: "#f0f0f2" },
  itemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemTotal: { fontSize: 14, color: "#f0f0f2", fontWeight: "600" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#6c63ff33", marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#6c63ff" },
  notes: { fontSize: 14, color: "#f0f0f2", lineHeight: 20 },
});
