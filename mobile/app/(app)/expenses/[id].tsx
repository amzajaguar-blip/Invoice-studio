/**
 * expenses/[id].tsx — Dettaglio nota spese
 * Genera documento (PDF/DOCX/RTF) con ad obbligatoria + quota gate + traduci.
 * Export Excel/CSV gated da IAP vela.export.excel.
 * Requirements: 5.3-5.6, 19.3, 19.7, 20.3, 21.4
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { generateDocumentPDF } from "@/lib/pdf-utils";
import { generateExpenseExport, shareExpenseExport } from "@/lib/excel-engine";
import { checkEntitlement } from "@/lib/iap-engine";
import IAPPaywall from "@/components/IAPPaywall";
import * as Sharing from "expo-sharing";
import { FormatPickerModal, DocumentFormat, loadLastDocFormat } from "@/components/FormatPickerModal";
import { generateDocumentDOC, generateDocumentRTF, shareDocument, DocumentFormatData } from "@/lib/document-format-engine";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";
import { translateDocumentContent, extractTranslatableFields, TranslatableFields } from "@/lib/translation-service";
import { QuotaPaywall } from "@/components/QuotaPaywall";
import { checkQuota, incrementQuota } from "@/lib/quota-engine";
import { supabase } from "@/lib/supabase";
import { useDocumentAd } from "@/lib/useDocumentAd";

interface ExpenseItem { id: string; date: string; category: string; amount: number; currency: string; description?: string; }
interface ExpenseReport {
  id: string; report_number: string; title: string;
  period_from: string; period_to: string; items: ExpenseItem[];
  total_by_category: Record<string, number>; grand_total: number;
  currency: string; created_at: string;
}
type ExportType = "xlsx" | "csv" | null;

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<ExportType>(null);
  const [showExcelPaywall, setShowExcelPaywall] = useState(false);
  const [pendingExport, setPendingExport] = useState<ExportType>(null);
  const generatingRef = useRef(false);

  const [formatPickerVisible, setFormatPickerVisible] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentFormat | null>(null);

  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedFields, setTranslatedFields] = useState<TranslatableFields | null>(null);
  const [isTranslated, setIsTranslated] = useState(false);

  const [quotaPaywallVisible, setQuotaPaywallVisible] = useState(false);
  const [premiumPaywallVisible, setPremiumPaywallVisible] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const { runWithAd, adLoading } = useDocumentAd();

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: ExpenseReport }>(`/api/expenses/${id}`).then(({ data }) => {
      if (data) setReport((data as any).data ?? data);
      setLoading(false);
    });
    loadLastDocFormat().then((last) => { if (last) setSelectedFormat(last); });
    supabase.auth.getUser().then(({ data: auth }) => {
      if (auth?.user?.id) {
        supabase.from("organizations").select("id").eq("user_id", auth.user.id).maybeSingle()
          .then(({ data: org }) => { if (org?.id) setOrgId(org.id); });
      }
    });
  }, [id]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  const buildDocumentData = useCallback((): DocumentFormatData | null => {
    if (!report) return null;
    return {
      type: "expense_report",
      title: translatedFields?.title ?? report.title,
      number: report.report_number ?? report.id,
      issueDate: `${new Date(report.period_from).toLocaleDateString("it-IT")} – ${new Date(report.period_to).toLocaleDateString("it-IT")}`,
      lineItems: (report.items ?? []).map((i, idx) => ({
        description: translatedFields?.descriptions[idx] ?? `[${i.category}] ${i.description ?? ""}`.trim(),
        quantity: 1, rate: i.amount, amount: i.amount,
      })),
      totals: { subtotal: report.grand_total, grandTotal: report.grand_total, currency: report.currency ?? "EUR" },
      notes: translatedFields?.notes,
    };
  }, [report, translatedFields]);

  // ── Genera documento (quota gate + ad obbligatoria) ───────────────────────
  const handleGenerateDocument = useCallback(async (format: DocumentFormat) => {
    if (!report || generatingRef.current) return;
    setFormatPickerVisible(false);

    if (orgId) {
      try {
        const q = await checkQuota(orgId);
        if (!q.allowed) { setQuotaPaywallVisible(true); return; }
      } catch {
        Alert.alert(t("error"), "Impossibile verificare la quota documenti. Riprova tra un momento.");
        setGenerating(false);
        generatingRef.current = false;
        return;
      }
    }

    generatingRef.current = true;
    setGenerating(true);

    await runWithAd(async () => {
      try {
        if (format === "pdf") {
          const data = {
            id: report.id, reportNumber: report.report_number ?? report.id,
            title: translatedFields?.title ?? report.title,
            period: { from: new Date(report.period_from), to: new Date(report.period_to) },
            items: (report.items ?? []).map((i, idx) => ({
              ...i,
              date: new Date(i.date),
              description: translatedFields?.descriptions[idx] ?? i.description,
            })),
            totalByCategory: report.total_by_category ?? {},
            grandTotal: report.grand_total, currency: report.currency ?? "EUR",
          };
          const filepath = await generateDocumentPDF(data, { documentType: "expense_report" });
          if (!filepath) { Alert.alert(t("error"), "Impossibile generare il PDF."); return; }
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) await Sharing.shareAsync(filepath, { mimeType: "application/pdf", dialogTitle: `Nota spese — ${report.title}` });
          else Alert.alert("PDF generato", `File: ${filepath}`);
        } else {
          const docData = buildDocumentData();
          if (!docData) throw new Error("Dati non disponibili");
          if (format === "doc") { const fp = await generateDocumentDOC(docData); await shareDocument(fp, `nota_spese_${report.id}.docx`); }
          else { const fp = await generateDocumentRTF(docData); await shareDocument(fp, `nota_spese_${report.id}.rtf`); }
        }
        if (orgId) { try { await incrementQuota(orgId); } catch { /* quota esaurita */ } }
      } catch { Alert.alert(t("error"), "Errore durante la generazione del documento."); }
    });

    setGenerating(false);
    generatingRef.current = false;
  }, [report, orgId, translatedFields, buildDocumentData, runWithAd, t]);

  // ── Traduzione ────────────────────────────────────────────────────────────
  const handleTranslate = useCallback(async (langCode: string) => {
    if (!report) return;
    setLangPickerVisible(false);
    setTranslating(true);
    try {
      const fields = extractTranslatableFields({
        title: report.title,
        lineItemDescriptions: (report.items ?? []).map((i) => `[${i.category}] ${i.description ?? ""}`.trim()),
      });
      const result = await translateDocumentContent(fields, langCode);
      if (result.translated) { setTranslatedFields(result.fields); setIsTranslated(true); }
      else Alert.alert(t("error"), result.error === "timeout" ? "Traduzione scaduta." : "Traduzione non disponibile.");
    } catch { Alert.alert(t("error"), "Errore durante la traduzione."); }
    finally { setTranslating(false); }
  }, [report, t]);

  // ── Export Excel/CSV (IAP gated) ──────────────────────────────────────────
  const doExport = useCallback(async (format: "xlsx" | "csv") => {
    if (!report) return;
    setExporting(format);
    try {
      const data = {
        id: report.id, reportNumber: report.report_number ?? report.id, title: report.title,
        periodFrom: new Date(report.period_from), periodTo: new Date(report.period_to),
        items: (report.items ?? []).map((i) => ({ ...i, date: new Date(i.date) })),
        totalByCategory: report.total_by_category ?? {}, grandTotal: report.grand_total,
        currency: report.currency ?? "EUR", createdAt: new Date(report.created_at), updatedAt: new Date(report.created_at),
      };
      const filepath = await generateExpenseExport([data], { format, filename: `nota_spese_${report.id}`, locale: "it" });
      const result = await shareExpenseExport(filepath, `nota_spese_${report.id}.${format}`);
      if (!result.shared && result.fallbackPath) Alert.alert("File salvato", `Disponibile in: ${result.fallbackPath}`);
    } catch { Alert.alert(t("error"), "Errore durante l'esportazione."); }
    finally { setExporting(null); }
  }, [report, t]);

  const handleExport = useCallback(async (format: "xlsx" | "csv") => {
    const entitled = await checkEntitlement("vela.export.excel");
    if (!entitled) { setPendingExport(format); setShowExcelPaywall(true); return; }
    await doExport(format);
  }, [doExport]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c63ff" /></View>;
  if (!report) return (
    <View style={s.center}>
      <Ionicons name="receipt-outline" size={48} color="#6b7280" />
      <Text style={s.emptyTitle}>Nota spese non trovata</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.backText}>← {t("back")}</Text></TouchableOpacity>
    </View>
  );

  const formatLabel = selectedFormat === "doc" ? "DOCX" : selectedFormat === "rtf" ? "RTF" : "PDF";
  const busy = generating || adLoading || translating;

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← {t("back")}</Text>
        </TouchableOpacity>

        <Text style={s.title}>{translatedFields?.title ?? report.title}</Text>
        <Text style={s.period}>
          {new Date(report.period_from).toLocaleDateString("it-IT")} – {new Date(report.period_to).toLocaleDateString("it-IT")}
        </Text>

        {isTranslated && (
          <View style={s.translatedBadge}>
            <Ionicons name="language-outline" size={13} color="#6c63ff" />
            <Text style={s.translatedBadgeText}>{t("translator.auto_label")}</Text>
            <TouchableOpacity onPress={() => { setTranslatedFields(null); setIsTranslated(false); }}>
              <Ionicons name="close-circle" size={14} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {/* Azioni documento */}
        <View style={s.actionsRow}>
          {/* Genera documento (PDF/DOCX/RTF) */}
          <TouchableOpacity
            style={[s.actionBtn, busy && s.actionBtnDisabled]}
            onPress={() => !busy && setFormatPickerVisible(true)}
            disabled={busy} accessibilityRole="button">
            {(generating || adLoading) ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="document-text-outline" size={16} color="#fff" />}
            <Text style={s.actionBtnText}>{adLoading ? "Pub…" : generating ? "…" : formatLabel}</Text>
            {!busy && <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.7)" />}
          </TouchableOpacity>

          {/* Traduci */}
          <TouchableOpacity
            style={[s.actionBtnSecondary, busy && s.actionBtnDisabled]}
            onPress={() => !busy && setLangPickerVisible(true)}
            disabled={busy} accessibilityRole="button">
            {translating ? <ActivityIndicator size="small" color="#6c63ff" />
              : <Ionicons name="language-outline" size={15} color="#6c63ff" />}
            <Text style={s.actionBtnSecondaryText}>{translating ? "…" : t("translator.title")}</Text>
          </TouchableOpacity>
        </View>

        {/* Export Excel/CSV */}
        <View style={s.exportRow}>
          <TouchableOpacity
            style={[s.exportBtn, exporting === "xlsx" && s.actionBtnDisabled]}
            onPress={() => handleExport("xlsx")} disabled={!!exporting || busy} accessibilityRole="button">
            {exporting === "xlsx" ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="grid-outline" size={15} color="#fff" />}
            <Text style={s.exportBtnText}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.exportBtn, s.exportBtnOrange, exporting === "csv" && s.actionBtnDisabled]}
            onPress={() => handleExport("csv")} disabled={!!exporting || busy} accessibilityRole="button">
            {exporting === "csv" ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="list-outline" size={15} color="#fff" />}
            <Text style={s.exportBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Voci spesa */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>VOCI SPESA</Text>
          {(report.items ?? []).map((item, idx) => (
            <View key={item.id ?? idx} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemCategory}>{item.category}</Text>
                <Text style={s.itemDate}>{new Date(item.date).toLocaleDateString("it-IT")}</Text>
                {!!(translatedFields?.descriptions[idx] ?? item.description) && (
                  <Text style={s.itemDesc}>{translatedFields?.descriptions[idx] ?? item.description}</Text>
                )}
              </View>
              <Text style={s.itemAmount}>{fmt(item.amount, item.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Riepilogo per categoria */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>RIEPILOGO PER CATEGORIA</Text>
          {Object.entries(report.total_by_category ?? {}).map(([cat, amt]) => (
            <View key={cat} style={s.summaryRow}>
              <Text style={s.summaryLabel}>{cat}</Text>
              <Text style={s.summaryValue}>{fmt(amt, report.currency)}</Text>
            </View>
          ))}
          <View style={[s.summaryRow, s.summaryTotal]}>
            <Text style={s.summaryTotalLabel}>TOTALE</Text>
            <Text style={s.summaryTotalValue}>{fmt(report.grand_total, report.currency)}</Text>
          </View>
        </View>
      </ScrollView>

      <FormatPickerModal
        visible={formatPickerVisible}
        selectedFormat={selectedFormat}
        onSelect={(f) => { setSelectedFormat(f); void handleGenerateDocument(f); }}
        onDismiss={() => setFormatPickerVisible(false)}
      />
      <LanguagePickerModal visible={langPickerVisible} onSelect={handleTranslate} onDismiss={() => setLangPickerVisible(false)} />
      <QuotaPaywall
        visible={quotaPaywallVisible} remaining={0} limit={5}
        onQuotaUpdated={() => setQuotaPaywallVisible(false)}
        onDismiss={() => setQuotaPaywallVisible(false)}
        onUpgradeToPremium={() => { setQuotaPaywallVisible(false); setPremiumPaywallVisible(true); }}
      />
      {premiumPaywallVisible && (
        <IAPPaywall productId="vela.template.premium" featureName="Premium"
          featureDescription="Documenti illimitati e funzioni Pro."
          onPurchaseSuccess={() => setPremiumPaywallVisible(false)}
          onDismiss={() => setPremiumPaywallVisible(false)} />
      )}
      {showExcelPaywall && (
        <IAPPaywall productId="vela.export.excel" featureName="Export Excel & CSV"
          featureDescription="Esporta le note spese in formato .xlsx o .csv per il tuo commercialista."
          onPurchaseSuccess={() => { setShowExcelPaywall(false); if (pendingExport) { void doExport(pendingExport); setPendingExport(null); } }}
          onDismiss={() => { setShowExcelPaywall(false); setPendingExport(null); }} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#0a0b0f", justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 18, color: "#f0f0f2", marginTop: 12, marginBottom: 16 },
  backBtn: { marginBottom: 16 },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif", marginBottom: 4 },
  period: { fontSize: 14, color: "#9ca3af", marginBottom: 16 },
  translatedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#6c63ff18",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: "flex-start",
    borderWidth: 1, borderColor: "#6c63ff30" },
  translatedBadgeText: { fontSize: 12, color: "#6c63ff", fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  exportRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#6c63ff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionBtnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#6c63ff14", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "#6c63ff40" },
  actionBtnSecondaryText: { color: "#6c63ff", fontWeight: "600", fontSize: 12 },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  exportBtnOrange: { backgroundColor: "#d97706" },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  itemCategory: { fontSize: 14, fontWeight: "600", color: "#f0f0f2" },
  itemDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  itemDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: "700", color: "#6c63ff" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: "#9ca3af" },
  summaryValue: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: "#1e2029", marginTop: 6, paddingTop: 12 },
  summaryTotalLabel: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  summaryTotalValue: { fontSize: 18, fontWeight: "700", color: "#6c63ff" },
});
