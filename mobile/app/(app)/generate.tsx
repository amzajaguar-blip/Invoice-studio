/**
 * generate.tsx — Il generatore di file di Milo Office.
 *
 * Milo Office non e' un'app di fatturazione: qui il file E' lo scopo
 * dell'azione, non un sottoprodotto del salvataggio di una pratica. Questa
 * schermata non chiede un cliente, non chiede un'aliquota, non ha stati
 * "bozza"/"inviata" e non scrive nulla a database — compili, tocchi Genera,
 * ottieni il file.
 *
 * Quantita' e importo restano disponibili per chi sta preparando un listino o
 * un preventivo, ma sono facoltativi: per generare basta una descrizione.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";
import { usePlan } from "@/context/PlanContext";
import { useDocumentAd } from "@/lib/useDocumentAd";
import { QuotaPaywall } from "@/components/QuotaPaywall";
import { checkQuotaOrLocal, countGeneratedDocument, DEFAULT_FREE_QUOTA } from "@/lib/quota-engine";
import { supabase } from "@/lib/supabase";
import {
  generateFromLegacy,
  generateFromImported,
  parseOutputFormat,
  FORMAT_META,
} from "@/lib/document-engine";
import type { DocumentFormatData, OutputFormat } from "@/lib/document-engine";
import { toDisplayName } from "@/lib/generated-files";
import { apiFetch } from "@/lib/ai";
import {
  pickFileToConvert,
  readLocalFile,
  readAsBlob,
  importedFromPdfPages,
  isSupportedSource,
  requiresServerExtraction,
  MAX_IMPORT_BYTES,
  resolveFileSize,
} from "@/lib/file-import";
import type { ImportedContent } from "@/lib/file-import";

// ─── Tipi locali ──────────────────────────────────────────────────────────────

interface ContentRow {
  id: string;
  description: string;
  quantity: string;
  amount: string;
}

const generateId = () => Math.random().toString(36).slice(2);

/** Ordine dei chip formato. Esaustivo su OutputFormat. */
const FORMAT_ORDER: OutputFormat[] = ["pdf", "xlsx", "doc", "rtf"];

const FORMAT_ICON: Record<OutputFormat, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text-outline",
  xlsx: "grid-outline",
  doc: "document-outline",
  rtf: "text-outline",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GenerateScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { isPremium } = usePlan();
  const { runWithAd } = useDocumentAd();
  const params = useLocalSearchParams<{ format?: string }>();

  const [format, setFormat] = useState<OutputFormat>(() => parseOutputFormat(params.format));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ContentRow[]>([
    { id: generateId(), description: "", quantity: "", amount: "" },
  ]);

  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);

  // Sorgente importata. Quando c'e', "Genera" converte invece di compilare.
  const [imported, setImported] = useState<ImportedContent | null>(null);
  const [importing, setImporting] = useState(false);

  const [quotaPaywallVisible, setQuotaPaywallVisible] = useState(false);
  // Valore di partenza solo finche' checkQuota non risponde: viene da
  // quota-engine per non mostrare una soglia diversa da quella vera.
  const [quotaLimit, setQuotaLimit] = useState(DEFAULT_FREE_QUOTA);
  // Residuo reale letto da checkQuota: il paywall lo mostrava cablato a 0.
  const [quotaRemaining, setQuotaRemaining] = useState(0);
  // 'loading' finche' le due chiamate async non hanno risposto. Senza questo
  // terzo stato, chi toccava Genera appena aperta la schermata trovava orgId
  // ancora null e saltava sia il gate quota sia il conteggio.
  const [orgId, setOrgId] = useState<string | null | 'loading'>('loading');

  // L'orgId serve solo al gate quota. Se non arriva, la generazione non si
  // blocca: il gate viene saltato, non trasformato in un errore per l'utente.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!data?.user?.id) return null;
        return supabase
          .from("organizations")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: org }) => org?.id ?? null);
      })
      .then((id) => {
        if (!cancelled) setOrgId(id ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrgId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatLabel = FORMAT_META[format].label;

  // ─── Righe di contenuto ─────────────────────────────────────────────────────

  const updateRow = useCallback((id: string, field: keyof ContentRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { id: generateId(), description: "", quantity: "", amount: "" }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  /** Basta una descrizione: ne' prezzo ne' quantita' sono richiesti. */
  const validRows = rows.filter((r) => r.description.trim().length > 0);
  const canGenerate =
    (imported !== null || validRows.length > 0) && orgId !== 'loading' && !importing;

  // ─── Import di un file da convertire ────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    if (importing || generatingRef.current) return;
    setImporting(true);
    try {
      const picked = await pickFileToConvert();
      // L'utente ha chiuso il selettore: esito normale, nessun avviso.
      if (picked.status === "cancelled") return;

      const file = picked.file;

      if (!isSupportedSource(file.ext)) {
        Alert.alert(
          t("documents.import.unsupported.title"),
          t("documents.import.unsupported.msg").replace("{ext}", file.ext || "?")
        );
        return;
      }
      // La dimensione si risolve una volta sola, chiedendola al filesystem se
      // il selettore non la dichiara: scrivere `file.size !== undefined &&
      // file.size > MAX` faceva saltare il controllo proprio con i provider SAF
      // remoti, cioe' dove i file grandi arrivano davvero.
      const size = await resolveFileSize(file);

      if (size !== null && size > MAX_IMPORT_BYTES) {
        Alert.alert(
          t("documents.import.too_large.title"),
          t("documents.import.too_large.msg")
        );
        return;
      }
      // Agosto 2026: il vincolo body-Vercel non esiste piu' — il PDF viaggia
      // via Supabase Storage signed URL, e il tetto utente e' MAX_IMPORT_BYTES
      // gia' controllato sopra. Il check MAX_PDF_BYTES_FOR_VERCEL era un
      // secondo livello, ora rimosso.

      let content: ImportedContent;

      if (requiresServerExtraction(file.ext)) {
        // Il PDF non e' leggibile sul dispositivo: il testo lo estrae il server.
        // Flusso Agosto 2026: upload diretto su Supabase Storage via signed URL,
        // poi la rotta pdf-extract lo scarica ed estrae. Bypassa il body Vercel
        // 4,5 MB che prima cappava il PDF a ~3,4 MB.
        const { data: signed, error: signedError } = await apiFetch<{
          signedUrl: string;
          path: string;
          token: string;
        }>("/api/convert/pdf-extract/upload-url", { method: "POST" });

        if (signedError || !signed?.signedUrl || !signed?.path) {
          Alert.alert(
            t("documents.import.pdf_failed.title"),
            t("documents.import.pdf_failed.msg")
          );
          return;
        }

        const blob = await readAsBlob(file, "application/pdf");

        const uploadRes = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: blob,
        });
        if (!uploadRes.ok) {
          Alert.alert(
            t("documents.import.pdf_failed.title"),
            t("documents.import.pdf_failed.msg")
          );
          return;
        }

        const { data, error } = await apiFetch<{
          success: boolean;
          pages?: string[];
          error?: string;
          totalPages?: number;
          truncated?: boolean;
        }>(
          "/api/convert/pdf-extract",
          { method: "POST", body: JSON.stringify({ path: signed.path, filename: file.name }) }
        );

        if (error || !data?.success || !data.pages) {
          // Il server distingue i motivi; mapparli tutti su "controlla la
          // connessione" mandava l'utente a cercare un guasto di rete per un
          // .docx rinominato .pdf — caso comune con gli allegati email.
          const code = data?.error ?? error ?? "";
          const detail =
            code === "no_text_layer"
              ? t("documents.import.pdf_failed.no_text")
              : code === "not_a_pdf"
                ? t("documents.import.pdf_failed.not_a_pdf")
                : code === "file_too_large"
                  ? t("documents.import.pdf_too_large_for_vercel.msg")
                      .replace("{mb}", "25")
                  : code === "rate_limited"
                    ? t("documents.import.pdf_failed.rate_limited")
                    : t("documents.import.pdf_failed.msg");
          Alert.alert(t("documents.import.pdf_failed.title"), detail);
          return;
        }
        content = importedFromPdfPages(file, data.pages);

        // Il server si ferma a un tetto di pagine. Dirlo e' obbligatorio: un
        // documento amputato che sembra intero e' peggio di un errore.
        if (data.truncated) {
          Alert.alert(
            t("documents.import.pdf_truncated.title"),
            t("documents.import.pdf_truncated.msg")
              .replace("{done}", String(data.pages.length))
              .replace("{total}", String(data.totalPages ?? data.pages.length))
          );
        }
      } else {
        content = await readLocalFile(file);
      }

      setImported(content);
      // Il nome del file importato diventa il titolo, se non ne hai scelto uno.
      if (!title.trim()) setTitle(content.title);
    } catch (err) {
      console.warn("[import] lettura fallita", err);
      const detail = __DEV__ ? `\n\n${err instanceof Error ? err.message : String(err)}` : "";
      Alert.alert(t("documents.import.read_failed.title"), `${t("documents.import.read_failed.msg")}${detail}`);
    } finally {
      setImporting(false);
    }
  }, [importing, t, title]);

  const clearImported = useCallback(() => setImported(null), []);

  // ─── Generazione ────────────────────────────────────────────────────────────

  const buildData = useCallback((): DocumentFormatData => {
    const lineItems = validRows.map((r) => {
      const quantity = parseFloat(r.quantity.replace(",", ".")) || 1;
      const rate = parseFloat(r.amount.replace(",", ".")) || 0;
      return {
        description: r.description.trim(),
        quantity,
        rate,
        amount: quantity * rate,
      };
    });

    const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0);
    const cleanTitle = title.trim() || t("documents.generate.name.placeholder");

    return {
      type: "custom",
      title: cleanTitle,
      customTitle: cleanTitle.toUpperCase(),
      issueDate: new Date().toLocaleDateString("it-IT"),
      lineItems,
      // Milo Office non calcola imposte: taxAmount a 0 fa sparire la riga
      // imposta dal documento prodotto (buildDocumentHtml la omette).
      totals: {
        subtotal,
        taxRate: 0,
        taxAmount: 0,
        grandTotal: subtotal,
        currency: "EUR",
      },
      notes: notes.trim() || undefined,
      companyName: "Milo Office",
    };
  }, [validRows, title, notes, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generatingRef.current) return;

    // Gate quota. La condizione NON include piu' `orgId &&`: senza
    // organizzazione si contava in nessun posto e non si bloccava niente, cioe'
    // generazione illimitata gratuita e invisibile. `checkQuotaOrLocal` copre
    // quel caso col contatore locale.
    if (orgId !== 'loading' && !isPremium) {
      try {
        const quota = await checkQuotaOrLocal(orgId);
        setQuotaLimit(quota.limit);
        setQuotaRemaining(quota.remaining);
        if (!quota.allowed) {
          setQuotaPaywallVisible(true);
          return;
        }
      } catch {
        Alert.alert(
          t("documents.generate.error.title"),
          t("documents.generate.quota_check_failed")
        );
        return;
      }
    }

    generatingRef.current = true;
    setGenerating(true);

    try {
      // L'esito viaggia in un contenitore invece che in una variabile locale:
      // TypeScript non traccia le assegnazioni fatte dentro una closure e
      // ridurrebbe il tipo a `never` dopo la guardia.
      const outcome: { value: { filename: string; shared: boolean } | null } = { value: null };

      // runWithAd scarta la chiamata se un'altra generazione e' gia' in volo:
      // in quel caso non e' stato prodotto nulla, e dichiararlo sarebbe falso.
      const executed = await runWithAd(async () => {
        if (imported) {
          // Sorgente importata: si converte, non si compila.
          const result = await generateFromImported(
            {
              title: title.trim() || imported.title,
              kind: imported.kind,
              rows: imported.rows,
              text: imported.text,
              sourceName: imported.sourceName,
            },
            format
          );
          outcome.value = { filename: result.filename, shared: result.shared };
          return;
        }

        const result = await generateFromLegacy(buildData(), format);
        outcome.value = { filename: result.filename, shared: result.shared };
      });

      const produced = outcome.value;
      if (!executed || !produced) return;

      // Il file esiste gia': `countGeneratedDocument` non solleva, e sceglie da
      // sola fra RPC Supabase e contatore locale a seconda che l'orgId ci sia.
      if (orgId !== 'loading') {
        await countGeneratedDocument(orgId);
      }

      // Il nome mostrato e' lo stesso che l'utente legge nella scheda File,
      // non il filename grezzo col timestamp.
      const shownName = toDisplayName(produced.filename);
      const body = produced.shared
        ? t("documents.generate.success.msg").replace("{name}", shownName)
        : t("documents.generate.success.msg_not_shared").replace("{name}", shownName);

      Alert.alert(t("documents.generate.success.title"), body, [
        {
          text: t("documents.generate.success.open_files"),
          onPress: () => router.push("/(app)/(tabs)/files"),
        },
        {
          text: "Anteprima", // Italian leading, English fallback optional
          onPress: () => {
            const uri = encodeURIComponent(produced.filename);
            router.push({ pathname: "/document-preview", params: { uri } });
          },
        },
        { text: t("documents.generate.success.stay"), style: "cancel" },
      ]);
    } catch (err) {
      // All'utente un messaggio comprensibile e tradotto. Il dettaglio grezzo
      // dell'SDK contiene path interni dell'app e testo inglese: resta agli
      // sviluppatori, nei log e nelle build di debug.
      console.warn("[generate] generazione fallita", err);
      const detail = __DEV__ ? `\n\n${err instanceof Error ? err.message : String(err)}` : "";
      Alert.alert(
        t("documents.generate.error.title"),
        `${t("documents.generate.error.msg").replace("{format}", formatLabel)}${detail}`
      );
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [
    canGenerate, orgId, isPremium, t, runWithAd, buildData,
    format, formatLabel, router, imported, title,
  ]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("documents.generate.back")}
          >
            <Text style={s.backText}>{t("documents.generate.back")}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t("documents.generate.title")}</Text>
          <Text style={s.subtitle}>{t("documents.generate.subtitle")}</Text>
        </View>

        {/* Importa un file da convertire */}
        {imported ? (
          <View style={s.importedCard}>
            <Ionicons name="document-attach-outline" size={20} color="#6c63ff" />
            <View style={s.importedBody}>
              <Text style={s.importedName} numberOfLines={1}>
                {imported.sourceName}
              </Text>
              <Text style={s.importedMeta}>
                {t("documents.import.ready")
                  .replace("{ext}", imported.sourceExt.toUpperCase())
                  .replace("{format}", formatLabel)}
              </Text>
            </View>
            <TouchableOpacity
              style={s.importedRemove}
              onPress={clearImported}
              accessibilityRole="button"
              accessibilityLabel={t("documents.import.remove")}
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={s.importBtn}
              onPress={handlePickFile}
              disabled={importing}
              accessibilityRole="button"
              accessibilityState={{ disabled: importing }}
              accessibilityLabel={t("documents.import.cta")}
            >
              {importing ? (
                <ActivityIndicator color="#6c63ff" size="small" />
              ) : (
                <>
                  <Ionicons name="folder-open-outline" size={20} color="#6c63ff" />
                  <Text style={s.importBtnText}>{t("documents.import.cta")}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={s.importHint}>{t("documents.import.hint")}</Text>
            <View style={s.orRow}>
              <View style={s.orLine} />
              <Text style={s.orText}>{t("documents.import.or")}</Text>
              <View style={s.orLine} />
            </View>
          </>
        )}

        {/* Nome del file */}
        <Text style={s.sectionLabel}>{t("documents.generate.section.name")}</Text>
        <TextInput
          style={s.input}
          placeholder={t("documents.generate.name.placeholder")}
          placeholderTextColor="#4b5563"
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t("documents.generate.section.name")}
        />

        {/* Formato */}
        <Text style={s.sectionLabel}>{t("documents.generate.section.format")}</Text>
        <View style={s.formatRow}>
          {FORMAT_ORDER.map((f) => {
            const active = f === format;
            return (
              <TouchableOpacity
                key={f}
                style={[s.formatChip, active && s.formatChipActive]}
                onPress={() => setFormat(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t("documents.generate.a11y.format").replace(
                  "{format}",
                  FORMAT_META[f].label
                )}
              >
                <Ionicons
                  name={FORMAT_ICON[f]}
                  size={16}
                  color={active ? "#6c63ff" : "#6b7280"}
                />
                <Text style={[s.formatChipText, active && s.formatChipTextActive]}>
                  {FORMAT_META[f].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contenuto — nascosto quando si sta convertendo un file importato */}
        {!imported && (
        <>
        <Text style={s.sectionLabel}>{t("documents.generate.section.content")}</Text>
        {rows.map((row, index) => (
          <View key={row.id} style={s.rowCard}>
            <View style={s.rowHeader}>
              <Text style={s.rowNum}>
                {t("documents.generate.item_number_prefix")} {index + 1}
              </Text>
              {rows.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeRow(row.id)}
                  style={s.rowRemoveBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("documents.generate.item.remove")}
                >
                  <Text style={s.rowRemoveText}>{t("documents.generate.item.remove")}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={s.input}
              placeholder={t("documents.generate.item.description.placeholder")}
              placeholderTextColor="#4b5563"
              value={row.description}
              onChangeText={(v) => updateRow(row.id, "description", v)}
              multiline
              accessibilityLabel={t("documents.generate.item.description.placeholder")}
            />
            <View style={s.rowInline}>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>{t("documents.generate.item.quantity.label")}</Text>
                <TextInput
                  style={s.input}
                  placeholder="—"
                  placeholderTextColor="#4b5563"
                  keyboardType="decimal-pad"
                  value={row.quantity}
                  onChangeText={(v) => updateRow(row.id, "quantity", v)}
                  accessibilityLabel={t("documents.generate.item.quantity.label")}
                />
              </View>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>{t("documents.generate.item.amount.label")}</Text>
                <TextInput
                  style={s.input}
                  placeholder="—"
                  placeholderTextColor="#4b5563"
                  keyboardType="decimal-pad"
                  value={row.amount}
                  onChangeText={(v) => updateRow(row.id, "amount", v)}
                  accessibilityLabel={t("documents.generate.item.amount.label")}
                />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={s.addRowBtn}
          onPress={addRow}
          accessibilityRole="button"
          accessibilityLabel={t("documents.generate.add_item")}
        >
          <Text style={s.addRowText}>{t("documents.generate.add_item")}</Text>
        </TouchableOpacity>
        </>
        )}

        {/* Note — solo per il documento compilato a mano.
            In conversione la sorgente e' il file importato: `ConvertibleContent`
            non ha un campo note e `generateFromImported` non le riceve, quindi
            mostrare la casella significava farci scrivere dentro un testo che
            sparisce senza dirlo. Meglio non offrirla che perderla in silenzio. */}
        {!imported && (
          <>
            <Text style={s.sectionLabel}>{t("documents.generate.section.notes")}</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              placeholder={t("documents.generate.notes.placeholder")}
              placeholderTextColor="#4b5563"
              multiline
              value={notes}
              onChangeText={setNotes}
              accessibilityLabel={t("documents.generate.section.notes")}
            />
          </>
        )}

        {/* Azione */}
        <TouchableOpacity
          style={[s.cta, (!canGenerate || generating) && s.ctaDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate || generating}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGenerate || generating }}
          accessibilityLabel={t("documents.generate.cta").replace("{format}", formatLabel)}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.ctaText}>
              {t("documents.generate.cta").replace("{format}", formatLabel)}
            </Text>
          )}
        </TouchableOpacity>

        {!canGenerate && (
          <Text style={s.ctaHint}>
            {orgId === 'loading'
              ? t("documents.generate.cta_hint_loading")
              : t("documents.generate.cta_hint")}
          </Text>
        )}
      </ScrollView>

      <QuotaPaywall
        visible={quotaPaywallVisible}
        remaining={quotaRemaining}
        limit={quotaLimit}
        onQuotaUpdated={() => setQuotaPaywallVisible(false)}
        onDismiss={() => setQuotaPaywallVisible(false)}
        onUpgradeToPremium={() => {
          setQuotaPaywallVisible(false);
          router.push("/(app)/ProUpgrade");
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 48 },

  header: { marginBottom: 12 },
  backBtn: { marginBottom: 12, minHeight: 48, justifyContent: "center" },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 6, lineHeight: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8,
    textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },

  input: {
    backgroundColor: "#111318", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#1e2029",
    color: "#f0f0f2", fontSize: 15, minHeight: 48,
  },
  inputLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  inputHalf: { flex: 1 },
  notesInput: { minHeight: 96, textAlignVertical: "top" },

  formatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  formatChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, minHeight: 48, borderRadius: 12,
    backgroundColor: "#111318", borderWidth: 1, borderColor: "#1e2029",
  },
  formatChipActive: { backgroundColor: "#6c63ff1a", borderColor: "#6c63ff40" },
  formatChipText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  formatChipTextActive: { color: "#6c63ff" },

  rowCard: {
    backgroundColor: "#0d0e13", borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#1e2029", gap: 10,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowNum: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  rowRemoveBtn: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4 },
  rowRemoveText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  rowInline: { flexDirection: "row", gap: 12 },

  addRowBtn: {
    minHeight: 48, justifyContent: "center", alignItems: "center",
    borderRadius: 12, borderWidth: 1, borderColor: "#1e2029",
    borderStyle: "dashed", marginTop: 4,
  },
  addRowText: { color: "#6c63ff", fontSize: 14, fontWeight: "600" },

  importBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 56, borderRadius: 14, marginTop: 8,
    backgroundColor: "#6c63ff14", borderWidth: 1, borderColor: "#6c63ff40",
    borderStyle: "dashed",
  },
  importBtnText: { color: "#6c63ff", fontSize: 15, fontWeight: "700" },
  importHint: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 8, lineHeight: 17 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: "#1e2029" },
  orText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },

  importedCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111318", borderRadius: 14, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: "#6c63ff40",
  },
  importedBody: { flex: 1 },
  importedName: { color: "#f0f0f2", fontSize: 15, fontWeight: "600" },
  importedMeta: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  importedRemove: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },

  cta: {
    marginTop: 28, minHeight: 52, borderRadius: 14,
    backgroundColor: "#6c63ff", justifyContent: "center", alignItems: "center",
  },
  ctaDisabled: { backgroundColor: "#2a2b36" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ctaHint: { color: "#6b7280", fontSize: 13, textAlign: "center", marginTop: 10 },
});
