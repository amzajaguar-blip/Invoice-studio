import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { COLORS, SIZES, SHADOWS } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  incrementScanCount,
  SCAN_LIMIT,
  scheduleRetentionNotifications,
} from "../../lib/scanner-quota";
import {
  scoreAllFields,
  scoreAmount,
  scoreDate,
  scoreVendor,
  scoreVat,
  scoreInvoiceNumber,
  normalizeVendorName,
  type FieldConfidence,
} from "../../lib/ocr-confidence";
import {
  recordCorrection,
  getSuggestion,
} from "../../lib/ocr-corrections";
import { OCRFieldReview } from "../../components/OCRFieldReview";
import {
  FormatPickerModal,
  DocumentFormat,
  loadLastDocFormat,
} from "@/components/FormatPickerModal";
import { generateDocumentPDF } from "@/lib/pdf-utils";
import {
  generateDocumentDOC,
  generateDocumentRTF,
  shareDocument,
  DocumentFormatData,
} from "@/lib/document-format-engine";
import * as Sharing from "expo-sharing";
import { useDocumentAd } from "@/lib/useDocumentAd";

type ScanState = "idle" | "capturing" | "preview" | "analyzing" | "result";

interface OcrResult {
  vendor: string;
  date: string;
  total: number | null;
  currency: string;
  rawText: string;
  /** Optional fields — may be missing in legacy API responses. */
  vat_number?: string;
  invoice_number?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Network timeout for OCR API calls
const ANALYZE_TIMEOUT_MS = 15000;

// Scanning frame dimensions — 85% of screen width, 4:3 aspect
const FRAME_W = SCREEN_WIDTH * 0.85;
const FRAME_H = FRAME_W * 1.33;
const CORNER = 32;       // corner arm length
const CORNER_W = 4;      // corner stroke width
const CORNER_R = SIZES.radiusSm;      // corner radius

export default function ScannerScreen() {
  const router = useRouter();
  const isMounted = useRef(true);
  const { t } = useLocale();
  
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // ── OCR Confidence / learning state (additive) ─────────────────────────────
  // The original code stored `ocrResult` as a snapshot. We now ALSO hold
  // a `Record<field, FieldConfidence>` so each value can carry its own
  // confidence metadata. Initial state is null until the API returns.
  const [fieldScores, setFieldScores] = useState<Record<string, FieldConfidence> | null>(null);
  // Tracks which fields were auto-filled from previous corrections, so the
  // UI can show a "learned from previous scan" hint.
  const [autoFilledFields, setAutoFilledFields] = useState<Record<string, string>>({});

  // Format picker per l'output del documento scansionato
  const [formatPickerVisible, setFormatPickerVisible] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentFormat | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const { runWithAd, adLoading } = useDocumentAd();
  // Records the ORIGINAL value the user sees for each field, so we can
  // detect corrections and persist them on confirm.
  const originalValuesRef = useRef<Record<string, string>>({});

  // Animated scan line
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cleanup effect to avoid state updates on unmounted components
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (scanState === "idle") {
      // Looping scan line — scanner is always focused when mounted (push screen)
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [scanState, scanAnim]);

  useEffect(() => {
    if (scanState === "analyzing") {
      // Pulse animation during analysis
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [scanState, pulseAnim]);

  const handleCapture = async () => {
    if (!cameraRef.current || scanState !== "idle") return;
    setScanState("capturing");
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      if (isMounted.current) {
        if (photo && photo.uri) {
          setPhotoUri(photo.uri);
          setPhotoBase64(photo.base64 ?? null);
          setScanState("preview");
        } else {
          setError(t("scanner.capture_error.unable_acquire"));
          setScanState("idle");
        }
      }
    } catch (e) {
      if (isMounted.current) {
        console.error("Camera capture error:", e);
        setError(t("scanner.capture_error.shot_failed"));
        setScanState("idle");
      }
    }
  };


  const handleAnalyze = async () => {
    if (!photoBase64) return;
    setScanState("analyzing");
    setError(null);

    try {
      type ApiFetchResult = Awaited<ReturnType<typeof apiFetch<OcrResult>>>;
      const fetchPromise = apiFetch<OcrResult>("/api/ocr/receipt", {
        method: "POST",
        body: JSON.stringify({ imageBase64: photoBase64 }),
      });
      const timeoutPromise = new Promise<ApiFetchResult>((_, reject) =>
        setTimeout(() => reject(new Error(t("scanner.analyze.timeout"))), ANALYZE_TIMEOUT_MS)
      );
      const { data, error: apiError, status } = await Promise.race<ApiFetchResult>([
        fetchPromise,
        timeoutPromise,
      ]);

      if (isMounted.current) {
        if (apiError || !data) {
          if (status === 401) {
            router.replace("/(auth)/login" as any);
            return;
          }
          setError(t("scanner.analyze.extraction_failed"));
          setScanState("preview");
          return;
        }

        // Enforce scan quota AFTER a successful extraction
        const newCount = await incrementScanCount();

        if (newCount > SCAN_LIMIT) {
          // Hard block — paywall, discard result
          setShowPaywall(true);
          setScanState("preview");
          return;
        }

        // Successful scan — show result
        const result = data as OcrResult;
        setOcrResult(result);
        setScanState("result");

        // ── Compute per-field confidence + pre-fill from previous corrections ──
        const scores = scoreAllFields(result.rawText, {
          vendor: result.vendor,
          date: result.date,
          amount: result.total !== null ? result.total.toFixed(2) : "",
          vat_number: result.vat_number ?? "",
          invoice_number: result.invoice_number ?? "",
        });
        setFieldScores(scores);

        // Snapshot of what the user sees for each field, so we can detect
        // corrections at confirm-time and persist them.
        originalValuesRef.current = {
          vendor: scores.vendor.value,
          date: scores.date.value,
          amount: scores.amount.value,
          vat_number: scores.vat_number.value,
          invoice_number: scores.invoice_number.value,
        };

        // Look up corrections from previous scans of the same vendor.
        // We do this asynchronously to avoid blocking the UI.
        const vendorKey = normalizeVendorName(result.vendor);
        if (vendorKey) {
          void (async () => {
            try {
              const [sVendor, sDate, sAmount, sVat, sInv] = await Promise.all([
                getSuggestion(vendorKey, "vendor"),
                getSuggestion(vendorKey, "date"),
                getSuggestion(vendorKey, "amount"),
                getSuggestion(vendorKey, "vat_number"),
                getSuggestion(vendorKey, "invoice_number"),
              ]);
              if (!isMounted.current) return;
              const autoFilled: Record<string, string> = {};
              // Only override when the current OCR value is empty (low signal).
              if (sVendor && !scores.vendor.value) autoFilled.vendor = sVendor;
              if (sDate && !scores.date.value) autoFilled.date = sDate;
              if (sAmount && !scores.amount.value) autoFilled.amount = sAmount;
              if (sVat && !scores.vat_number.value) autoFilled.vat_number = sVat;
              if (sInv && !scores.invoice_number.value) autoFilled.invoice_number = sInv;

              if (Object.keys(autoFilled).length > 0) {
                setAutoFilledFields(autoFilled);
                // Re-score any auto-filled fields so the user sees a green badge.
                setFieldScores((prev) => {
                  if (!prev) return prev;
                  const updated: Record<string, FieldConfidence> = { ...prev };
                  if (autoFilled.vendor) {
                    updated.vendor = scoreVendor(autoFilled.vendor);
                  }
                  if (autoFilled.date) {
                    updated.date = scoreDate(autoFilled.date);
                  }
                  if (autoFilled.amount) {
                    updated.amount = scoreAmount(autoFilled.amount);
                  }
                  if (autoFilled.vat_number) {
                    updated.vat_number = scoreVat(autoFilled.vat_number);
                  }
                  if (autoFilled.invoice_number) {
                    updated.invoice_number = scoreInvoiceNumber(autoFilled.invoice_number);
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Non-fatal — auto-fill is a best-effort UX enhancement.
              console.warn("[scanner] auto-fill lookup failed:", e);
            }
          })();
        }

        // Fire-and-forget retention notifications
        scheduleRetentionNotifications();
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : t("scanner.analyze.network"));
        setScanState("preview");
      }
    }
  };

  const handleReset = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setOcrResult(null);
    setError(null);
    setFieldScores(null);
    setAutoFilledFields({});
    originalValuesRef.current = {};
    setScanState("idle");
  };

  /**
   * Persist corrections e apre il FormatPickerModal per scegliere il formato
   * di output del documento scansionato. Genera e condivide il documento
   * nel formato scelto dall'utente (PDF / DOCX / RTF).
   */
  const handleConfirm = async () => {
    // 1. Persisti correzioni OCR (fire-and-forget)
    try {
      const originals = originalValuesRef.current;
      const vendorKey = normalizeVendorName(originals.vendor || ocrResult?.vendor);
      if (vendorKey && fieldScores) {
        const fields: ReadonlyArray<keyof typeof originals> = [
          "vendor", "date", "amount", "vat_number", "invoice_number",
        ];
        const writes: Array<Promise<void>> = [];
        for (const field of fields) {
          const live = fieldScores[field]?.value ?? "";
          const original = originals[field] ?? "";
          if (live !== original && live.trim().length > 0) {
            writes.push(recordCorrection({ field, originalValue: original, correctedValue: live, vendorNormalized: vendorKey, at: new Date().toISOString() }));
          }
        }
        if (writes.length > 0) await Promise.all(writes);
      }
    } catch (e) {
      console.warn("[scanner] correction write failed:", e);
    }

    // 2. Carica ultima preferenza formato e apre il picker
    const last = await loadLastDocFormat();
    if (last) setSelectedFormat(last);
    setFormatPickerVisible(true);
  };

  /**
   * Genera il documento scansionato nel formato scelto e lo condivide.
   * Mostra pubblicità obbligatoria per utenti free prima della generazione.
   */
  const handleGenerateScannedDoc = async (format: DocumentFormat) => {
    if (!ocrResult || generatingDoc) return;
    setFormatPickerVisible(false);
    setGeneratingDoc(true);

    await runWithAd(async () => {
      try {
        const title = ocrResult.vendor
          ? `Documento — ${ocrResult.vendor}`
          : "Documento scansionato";
        const amount = ocrResult.total ?? 0;
        const currency = ocrResult.currency || "EUR";
        const dateStr = ocrResult.date
          ? new Date(ocrResult.date).toLocaleDateString("it-IT")
          : new Date().toLocaleDateString("it-IT");

        const docData: DocumentFormatData = {
          type: "invoice",
          title,
          number: ocrResult.invoice_number ?? undefined,
          issueDate: dateStr,
          client: ocrResult.vendor ? { name: ocrResult.vendor, taxId: ocrResult.vat_number ?? undefined } : undefined,
          lineItems: [{ description: "Importo scansionato", quantity: 1, rate: amount, amount }],
          totals: { subtotal: amount, grandTotal: amount, currency },
          notes: `Documento acquisito via scanner il ${dateStr}`,
        };

        const safeVendor = (ocrResult.vendor ?? "documento").replace(/[^a-zA-Z0-9_-]/g, "_");

        if (format === "pdf") {
          // Costruisce un InvoiceData minimale compatibile con generateDocumentPDF
          const pdfData = {
            id: `scan_${Date.now()}`,
            invoiceNumber: ocrResult.invoice_number ?? `SCAN-${Date.now()}`,
            clientId: "",
            client: {
              id: "",
              name: ocrResult.vendor || "—",
              email: "",
              taxId: ocrResult.vat_number,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            status: "sent" as const,
            issueDate: ocrResult.date ? new Date(ocrResult.date) : new Date(),
            dueDate: new Date(),
            lineItems: [{ id: "1", description: "Importo scansionato", quantity: 1, rate: amount, amount }],
            subtotal: amount,
            taxRate: 0,
            taxAmount: 0,
            discountAmount: 0,
            total: amount,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const filepath = await generateDocumentPDF(pdfData, { documentType: "invoice" });
          if (!filepath) { Alert.alert(t("error"), "Impossibile generare il PDF."); return; }
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) await Sharing.shareAsync(filepath, { mimeType: "application/pdf", dialogTitle: title });
          else Alert.alert("PDF generato", `File: ${filepath}`);
        } else if (format === "doc") {
          const fp = await generateDocumentDOC(docData);
          await shareDocument(fp, `${safeVendor}.docx`);
        } else if (format === "rtf") {
          const fp = await generateDocumentRTF(docData);
          await shareDocument(fp, `${safeVendor}.rtf`);
        }

        // Torna indietro dopo generazione riuscita
        router.back();
      } catch (err) {
        Alert.alert(t("error"), "Errore durante la generazione del documento.");
        console.error("[scanner] generateScannedDoc error:", err);
      }
    });

    setGeneratingDoc(false);
  };

  /**
   * Update a field's value as the user edits. Re-scores that field so the
   * confidence badge stays in sync.
   */
  const updateFieldValue = (field: string, value: string) => {
    setFieldScores((prev) => {
      if (!prev) return prev;
      let next: FieldConfidence;
      switch (field) {
        case "vendor":
          next = scoreVendor(value);
          break;
        case "date":
          next = scoreDate(value);
          break;
        case "amount":
          next = scoreAmount(value);
          break;
        case "vat_number":
          next = scoreVat(value);
          break;
        case "invoice_number":
          next = scoreInvoiceNumber(value);
          break;
        default:
          return prev;
      }
      return { ...prev, [field]: next };
    });
  };

  // ── Permission loading ─────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
        <View style={styles.permissionBox}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={40} color="#6c63ff" />
          </View>
          <Text style={styles.permTitle}>{t("scanner.permission.title")}</Text>
          <Text style={styles.permSubtitle}>
            {t("scanner.permission.subtitle")}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnTxt}>{t("scanner.permission.allow")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelLink}>
            <Text style={styles.cancelLinkTxt}>{t("scanner.permission.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────

  if (scanState === "result" && ocrResult) {
    // Field-confidence UI. We render OCRFieldReview when `fieldScores` is
    // populated (post-OCR). For an instant first paint we still show the
    // legacy read-only ResultRow beneath, so the result screen never goes
    // blank — additive only, the original flow keeps working.
    const hasScores = fieldScores !== null;
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.successLabel}>{t("scanner.result.success_badge")}</Text>
          </View>
        </View>

        <Text style={styles.resultHint}>{t("scanner.result.hint")}</Text>

        <ScrollView style={styles.resultCard} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          {hasScores && fieldScores ? (
            <>
              <OCRFieldReview
                field={fieldScores.vendor}
                label={t("scanner.result.label.vendor")}
                onChange={(v) => updateFieldValue("vendor", v)}
                autoFilledFromCorrection={autoFilledFields.vendor}
              />
              <OCRFieldReview
                field={fieldScores.date}
                label={t("scanner.result.label.date")}
                onChange={(v) => updateFieldValue("date", v)}
                autoFilledFromCorrection={autoFilledFields.date}
              />
              <OCRFieldReview
                field={fieldScores.amount}
                label={t("scanner.result.label.total")}
                onChange={(v) => updateFieldValue("amount", v)}
                autoFilledFromCorrection={autoFilledFields.amount}
                trailingHint={ocrResult.currency || "€"}
              />
              <OCRFieldReview
                field={fieldScores.vat_number}
                label={t("scanner.result.label.vat") ?? "P.IVA"}
                onChange={(v) => updateFieldValue("vat_number", v)}
                autoFilledFromCorrection={autoFilledFields.vat_number}
              />
              <OCRFieldReview
                field={fieldScores.invoice_number}
                label={t("scanner.result.label.invoice_number") ?? "Numero documento"}
                onChange={(v) => updateFieldValue("invoice_number", v)}
                autoFilledFromCorrection={autoFilledFields.invoice_number}
              />
            </>
          ) : (
            // Fallback rendering while `fieldScores` is still null — same
            // visual shape as before, no flicker.
            <>
              <ResultRow label={t("scanner.result.label.vendor")} value={ocrResult.vendor || t("scanner.result.dash")} />
              <View style={styles.divider} />
              <ResultRow label={t("scanner.result.label.date")} value={ocrResult.date || t("scanner.result.dash")} />
              <View style={styles.divider} />
              <ResultRow
                label={t("scanner.result.label.total")}
                value={
                  ocrResult.total !== null
                    ? `${ocrResult.total.toFixed(2)} ${ocrResult.currency || '€'}`
                    : t("scanner.result.dash")
                }
                highlight
              />
            </>
          )}
        </ScrollView>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
            <Text style={styles.secondaryBtnTxt}>{t("scanner.actions.retry")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, (generatingDoc || adLoading) && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={generatingDoc || adLoading}
          >
            {(generatingDoc || adLoading) ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnTxt}>
                {adLoading ? "Pub…" : t("scanner.actions.confirm")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Format Picker — selezione formato output documento scansionato */}
        <FormatPickerModal
          visible={formatPickerVisible}
          selectedFormat={selectedFormat}
          onSelect={(format) => {
            setSelectedFormat(format);
            void handleGenerateScannedDoc(format);
          }}
          onDismiss={() => {
            setFormatPickerVisible(false);
            // Se l'utente chiude senza scegliere, torna indietro normalmente
            router.back();
          }}
        />
      </View>
    );
  }

  // ── Camera / preview / analyzing screen ──────────────────────────────────

  const isCapturing = scanState === "capturing";
  const isPreview = scanState === "preview";
  const isAnalyzing = scanState === "analyzing";

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_H - 3],
  });

  return (
    <View style={styles.container}>
      {/* Paywall modal */}
      {showPaywall && (
        <View style={styles.paywallOverlay}>
          <View style={styles.paywallContent}>
            <Text style={styles.paywallTitle}>{t("scanner.paywall.title")}</Text>
            <Text style={styles.paywallMessage}>{t("scanner.paywall.message")}</Text>
            <TouchableOpacity style={styles.paywallButton} onPress={() => { setShowPaywall(false); router.push("/(app)/ProUpgrade" as any); }}>
              <Text style={styles.paywallButtonText}>{t("scanner.paywall.go_pro")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paywallClose} onPress={() => setShowPaywall(false)}>
              <Text style={styles.paywallCloseText}>{t("scanner.paywall.close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} disabled={isCapturing || isAnalyzing}>
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
        {/* Torch — idle only */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
            onPress={() => setTorchOn((v) => !v)}
            disabled={isCapturing || isAnalyzing}
          >
            <Ionicons
              name={torchOn ? "flash" : "flash-outline"}
              size={18}
              color={torchOn ? COLORS.accent : COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      <Text style={styles.screenTitle}>
        {isPreview ? t("scanner.title.preview") : isAnalyzing ? t("scanner.title.analyzing") : t("scanner.title.idle")}
      </Text>
      <Text style={styles.screenSub}>
        {isPreview
          ? t("scanner.subtitle.preview")
          : isAnalyzing
          ? t("scanner.subtitle.analyzing")
          : t("scanner.subtitle.idle")}
      </Text>

      {/* Camera / preview area */}
      <View style={styles.cameraContainer}>
        {/* Darkened overlay outside frame */}
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]} pointerEvents="none">
          <View style={[styles.mask, { height: (500 - FRAME_H) / 2 }]} />
          <View style={{ flexDirection: "row", height: FRAME_H }}>
            <View style={[styles.mask, { width: (SCREEN_WIDTH - FRAME_W) / 2, flex: 0 }]} />
            <View style={{ width: FRAME_W }} />
            <View style={[styles.mask, { width: (SCREEN_WIDTH - FRAME_W) / 2, flex: 0 }]} />
          </View>
          <View style={[styles.mask, { flex: 1 }]} />
        </View>

        {/* Live camera or photo preview. Scanner is a push screen — always focused when mounted. */}
        {photoUri && scanState !== "idle" ? (
          <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
            facing="back"
            enableTorch={torchOn}
            flash="off"
          />
        )}

        {/* Scanning frame — centered */}
        <View style={styles.frameWrap} pointerEvents="none">
          {/* Corners */}
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />

          {/* Animated scan line (idle only) */}
          {scanState === "idle" && (
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineY }] },
              ]}
            />
          )}

          {/* Center hint label */}
          {scanState === "idle" && (
            <View style={styles.frameLabelBox}>
              <Text style={styles.frameLabelTxt}>{t("scanner.frame.label")}</Text>
            </View>
          )}
        </View>

        {/* Analyzing overlay */}
        {isAnalyzing && (
          <View style={styles.analyzingOverlay}>
            <Animated.View style={[styles.analysisRing, { transform: [{ scale: pulseAnim }] }]}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </Animated.View>
            <Text style={styles.analyzingTitle}>{t("scanner.analyzing.title")}</Text>
            <Text style={styles.analyzingHint}>{t("scanner.analyzing.hint")}</Text>
          </View>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorMsg}>{error}</Text>
        </View>
      )}

      {/* Bottom actions */}
      <View style={styles.actionsRow}>
        {isPreview ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} disabled={isAnalyzing}>
              <Text style={styles.secondaryBtnTxt}>{t("scanner.actions.preview_retry")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAnalyze} disabled={isAnalyzing}>
              <Text style={styles.primaryBtnTxt}>{t("scanner.actions.use_photo")}</Text>
            </TouchableOpacity>
          </>
        ) : scanState === "idle" ? (
          <TouchableOpacity style={styles.captureBtnWrap} onPress={handleCapture} disabled={isCapturing} activeOpacity={0.8}>
            <View style={styles.captureBtnRing}>
              <View style={[styles.captureBtnInner, isCapturing && styles.captureBtnInnerActive]} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.primaryBtn, styles.btnDisabled]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, highlight && styles.resultHighlight]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Paywall
  paywallOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  paywallContent: {
    backgroundColor: COLORS.surfacePrimary,
    padding: 24,
    borderRadius: SIZES.radiusLg,
    alignItems: "center",
    gap: 16,
  },
  paywallTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
  paywallMessage: { textAlign: "center", color: COLORS.textSecondary },
  paywallButton: { backgroundColor: COLORS.accent, padding: 16, borderRadius: SIZES.radiusMd, width: "100%", alignItems: "center" },
  paywallButtonText: { color: "#fff", fontWeight: "700" },
  paywallClose: { marginTop: 10 },
  paywallCloseText: { color: COLORS.textMuted },

  // ── Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: SIZES.radiusRound,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Torch
  torchBtn: {
    width: 38,
    height: 38,
    borderRadius: SIZES.radiusRound,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  torchBtnOn: {
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accent
  },

  // ── Titles
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  screenSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  // ── Camera container
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
    borderRadius: SIZES.radiusXl,
    backgroundColor: COLORS.background,
    marginBottom: 20,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  mask: {
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  // ── Scanning frame
  frameWrap: {
    position: "absolute",
    width: FRAME_W,
    height: FRAME_H,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: COLORS.accent,
  },
  cTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: CORNER_R,
  },
  cTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: CORNER_R,
  },
  cBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: CORNER_R,
  },
  cBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: CORNER_R,
  },

  scanLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.accent,
    ...SHADOWS.glow,
  },

  frameLabelBox: {
    position: "absolute",
    bottom: -32,
    backgroundColor: COLORS.surfaceOverlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radiusSm,
  },
  frameLabelTxt: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceOverlay,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    zIndex: 10,
  },
  analysisRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 2,
    borderColor: COLORS.accentGlow,
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  analyzingHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // ── Errors
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.errorBorder,
    borderWidth: 1,
    borderRadius: SIZES.radiusSm,
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 10,
  },
  errorMsg: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },

  // ── Action bar
  actionsRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accent,
  },
  captureBtnInnerActive: {
    opacity: 0.5,
    transform: [{ scale: 0.9 }],
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.radiusMd,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  primaryBtnTxt: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
  },
  secondaryBtnTxt: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  btnDisabled: { opacity: 0.5 },

  // ── Permission screen
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 16,
  },
  permissionIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6c63ff18',
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  permSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  cancelLink: { paddingVertical: 12 },
  cancelLinkTxt: { color: COLORS.textSecondary, fontSize: 15 },

  // ── Result card
  resultHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  resultCard: {
    flex: 1,
    backgroundColor: COLORS.surfacePrimary,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  resultContent: { padding: 24, gap: 18 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  resultLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
    flex: 0.4,
  },
  resultValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 0.6,
    textAlign: "right",
    fontWeight: "500",
  },
  resultHighlight: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.accent,
  },
  divider: { height: 1, backgroundColor: COLORS.surfaceSecondary },

  // ── Success badge
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: SIZES.radiusRound,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  successDot: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  successLabel: { color: COLORS.success, fontSize: 14, fontWeight: "600" },
});
