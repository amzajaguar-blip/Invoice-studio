/**
 * scanner.tsx — La fotocamera di Milo Office.
 *
 * Cosa fa: scatta una foto, ne estrae il testo, lo mostra modificabile, e da
 * quel testo produce un PDF, un Excel, un Word o un RTF. Nient'altro.
 *
 * Cosa NON fa piu'
 * ────────────────
 * Fino alla versione precedente questa schermata leggeva dalla risposta OCR
 * cinque campi da fattura — fornitore, P.IVA, numero documento, imponibile,
 * totale — e ne costruiva un `type: "invoice"` con voci e totali. Era il
 * residuo del vecchio gestionale, e non funzionava nemmeno: il server risponde
 * `supplierName / invoiceDate / totalAmount`, il client leggeva
 * `vendor / date / total`, e la prima riga che toccava `result.total.toFixed(2)`
 * sollevava un TypeError su `undefined`. Ogni scansione riuscita finiva
 * nell'`catch`, mostrava un errore di rete, e intanto aveva gia' consumato il
 * contatore. La schermata risultato non veniva mai raggiunta.
 *
 * Ora si legge `rawText`, che e' l'unico campo il cui nome coincide davvero fra
 * client e server: il disallineamento non puo' ripresentarsi perche' non c'e'
 * piu' niente da rimappare.
 *
 * Il testo mostrato E' la sorgente del file. Prima le correzioni dell'utente
 * finivano in uno stato separato dai dati usati per generare, e il documento
 * usciva sempre con i valori grezzi: qui lo stato e' uno solo, quindi le due
 * cose non possono divergere.
 *
 * La generazione passa da `generateFromImported`, lo stesso motore di un file
 * importato da `generate.tsx`. Prima il PDF usciva da `pdf-utils` con un
 * template diverso: due rese distinte nella stessa app per lo stesso formato.
 *
 * Il muro e' quello dei documenti (`quota-engine`), non un secondo contatore da
 * tre scansioni al mese, e viene applicato PRIMA della chiamata OCR: consumare
 * la quota e poi rifiutare era il peggiore dei due ordini possibili.
 */

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { usePlan } from "@/context/PlanContext";
import { COLORS, SIZES, SHADOWS } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { scheduleRetentionNotifications } from "../../lib/retention-notifications";
import {
  FormatPickerModal,
  DocumentFormat,
  loadLastDocFormat,
} from "@/components/FormatPickerModal";
import {
  generateFromImported,
  shareDocumentSafely,
} from "@/lib/document-format-engine";
import { QuotaPaywall } from "@/components/QuotaPaywall";
import {
  checkQuotaOrLocal,
  countGeneratedDocument,
  DEFAULT_FREE_QUOTA,
} from "@/lib/quota-engine";
import { supabase } from "@/lib/supabase";
import { toDisplayName } from "@/lib/generated-files";
import { useDocumentAd } from "@/lib/useDocumentAd";

type ScanState = "idle" | "capturing" | "preview" | "analyzing" | "result";

/**
 * Forma della risposta di `/api/convert`... piu' precisamente di
 * `/api/ocr/receipt`, ridotta ai due campi che il server nomina davvero cosi'.
 * La rotta ne restituisce altri, pensati per il client web che fa ancora
 * estrazione di campi fattura: qui non servono e non vanno letti.
 */
interface OcrResult {
  rawText: string;
  currency?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * La rotta ha `maxDuration = 60` e Tesseract su una foto grande ci mette
 * volentieri piu' di quindici secondi. Il timeout precedente era 15 s: piu'
 * corto del tempo che il server ha diritto di prendersi, quindi trasformava
 * scansioni lente ma riuscite in errori di rete.
 */
const ANALYZE_TIMEOUT_MS = 45000;

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
  const { isPremium } = usePlan();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Il testo riconosciuto, modificabile. E' la sorgente del file generato:
  // quello che si legge qui e' esattamente quello che finisce nel documento.
  const [scannedText, setScannedText] = useState("");
  const [docTitle, setDocTitle] = useState("");

  // Format picker per l'output del documento scansionato
  const [formatPickerVisible, setFormatPickerVisible] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentFormat | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const generatingRef = useRef(false);
  const { runWithAd, adLoading } = useDocumentAd();

  // ── Quota: la stessa di generate.tsx, non un contatore separato ────────────
  const [quotaPaywallVisible, setQuotaPaywallVisible] = useState(false);
  const [quotaLimit, setQuotaLimit] = useState(DEFAULT_FREE_QUOTA);
  const [quotaRemaining, setQuotaRemaining] = useState(0);
  // 'loading' finche' la lettura non ha risposto: senza questo terzo stato, chi
  // scatta subito dopo l'apertura troverebbe orgId ancora null e salterebbe il
  // gate. Se non arriva mai, `checkQuotaOrLocal` usa il contatore locale.
  const [orgId, setOrgId] = useState<string | null | "loading">("loading");

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

    // Gate quota PRIMA di spendere una chiamata OCR. Nella versione precedente
    // il contatore veniva incrementato dopo l'estrazione e poi confrontato col
    // limite: chi era oltre la soglia pagava comunque la scansione e riceveva
    // il muro, cioe' perdeva un tentativo per scoprire di non averne piu'.
    if (orgId !== "loading" && !isPremium) {
      try {
        const quota = await checkQuotaOrLocal(orgId);
        if (!isMounted.current) return;
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

      if (!isMounted.current) return;

      if (apiError || !data) {
        if (status === 401) {
          router.replace("/(auth)/login" as any);
          return;
        }
        setError(t("scanner.analyze.extraction_failed"));
        setScanState("preview");
        return;
      }

      const text = (data.rawText ?? "").trim();
      if (text.length === 0) {
        // Il server risponde 422 quando non trova testo, ma una risposta vuota
        // che arriva come successo non deve produrre un file vuoto.
        setError(t("scanner.result.empty"));
        setScanState("preview");
        return;
      }

      setScannedText(text);
      setDocTitle(
        `${t("scanner.result.default_title")} ${new Date().toLocaleDateString()}`
      );
      setScanState("result");

      // Promemoria di ritorno — fire-and-forget, i testi arrivano tradotti.
      // "Milo Office" e' il nome del prodotto: non si traduce.
      void scheduleRetentionNotifications({
        title: "Milo Office",
        day1: t("scanner.retention.day1"),
        day3: t("scanner.retention.day3"),
        day7: t("scanner.retention.day7"),
      });
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
    setScannedText("");
    setDocTitle("");
    setError(null);
    setScanState("idle");
  };

  /** Carica l'ultima preferenza di formato e apre il picker. */
  const handleChooseFormat = async () => {
    const last = await loadLastDocFormat();
    if (last) setSelectedFormat(last);
    setFormatPickerVisible(true);
  };

  /**
   * Genera il documento dal testo scansionato e lo condivide.
   *
   * Passa dallo stesso motore di un file importato: una foto e un `.txt`
   * caricato dal selettore escono impaginati allo stesso modo.
   */
  const handleGenerateScannedDoc = async (format: DocumentFormat) => {
    if (generatingRef.current) return;
    const text = scannedText.trim();
    if (text.length === 0) return;

    generatingRef.current = true;
    setFormatPickerVisible(false);
    setGeneratingDoc(true);

    try {
      const outcome: { value: { filename: string; shared: boolean } | null } = { value: null };

      const executed = await runWithAd(async () => {
        const filepath = await generateFromImported(
          {
            title: docTitle.trim() || t("scanner.result.default_title"),
            kind: "text",
            text,
            sourceName: t("scanner.result.default_title"),
          },
          format
        );
        const filename = filepath.split("/").pop() ?? "";
        const { shared } = await shareDocumentSafely(filepath, filename);
        outcome.value = { filename, shared };
      });

      const produced = outcome.value;
      if (!executed || !produced) return;

      if (orgId !== "loading") {
        await countGeneratedDocument(orgId);
      }

      const shownName = toDisplayName(produced.filename);
      const body = produced.shared
        ? t("documents.generate.success.msg").replace("{name}", shownName)
        : t("documents.generate.success.msg_not_shared").replace("{name}", shownName);

      Alert.alert(t("documents.generate.success.title"), body, [
        {
          text: t("documents.generate.success.open_files"),
          onPress: () => router.replace("/(app)/(tabs)/files"),
        },
        // "Resta qui" resta davvero qui, sul testo appena scansionato: da li'
        // si puo' generare lo stesso contenuto in un secondo formato.
        { text: t("documents.generate.success.stay"), style: "cancel" },
      ]);
    } catch (err) {
      console.error("[scanner] generazione non riuscita:", err);
      // NON `t("error")`: quella chiave non esiste in nessun locale e il vecchio
      // codice mostrava un alert intitolato letteralmente "error".
      Alert.alert(
        t("documents.generate.error.title"),
        t("documents.generate.error.msg")
      );
    } finally {
      generatingRef.current = false;
      if (isMounted.current) setGeneratingDoc(false);
    }
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t("scanner.permission.cancel")}
        >
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
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.permission.allow")}
          >
            <Text style={styles.primaryBtnTxt}>{t("scanner.permission.allow")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelLink}>
            <Text style={styles.cancelLinkTxt}>{t("scanner.permission.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Result screen — il testo riconosciuto, modificabile ───────────────────

  if (scanState === "result") {
    const busy = generatingDoc || adLoading;
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.permission.cancel")}
          >
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.successLabel}>{t("scanner.result.success_badge")}</Text>
          </View>
        </View>

        <Text style={styles.resultHint}>{t("scanner.result.text_hint")}</Text>

        <ScrollView
          style={styles.resultCard}
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>{t("scanner.result.title_label")}</Text>
          <TextInput
            style={styles.titleInput}
            value={docTitle}
            onChangeText={setDocTitle}
            placeholder={t("scanner.result.default_title")}
            placeholderTextColor={COLORS.textMuted}
            accessibilityLabel={t("scanner.result.title_label")}
          />

          <Text style={styles.fieldLabel}>{t("scanner.result.text_label")}</Text>
          <TextInput
            style={styles.scanTextInput}
            value={scannedText}
            onChangeText={setScannedText}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t("scanner.result.text_label")}
          />
        </ScrollView>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleReset}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.actions.retry")}
          >
            <Text style={styles.secondaryBtnTxt}>{t("scanner.actions.retry")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, (busy || scannedText.trim().length === 0) && styles.btnDisabled]}
            onPress={handleChooseFormat}
            disabled={busy || scannedText.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.actions.generate")}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnTxt}>{t("scanner.actions.generate")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <FormatPickerModal
          visible={formatPickerVisible}
          selectedFormat={selectedFormat}
          onSelect={(format) => {
            setSelectedFormat(format);
            void handleGenerateScannedDoc(format);
          }}
          onDismiss={() => setFormatPickerVisible(false)}
        />
        {/* Nessun QuotaPaywall qui: il gate scatta prima dell'OCR, quindi in
            questo stato non puo' comparire. Renderlo sarebbe UI irraggiungibile. */}
      </KeyboardAvoidingView>
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
      {/* Top bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          disabled={isCapturing || isAnalyzing}
          accessibilityRole="button"
          accessibilityLabel={t("scanner.permission.cancel")}
        >
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
        {/* Torch — idle only */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
            onPress={() => setTorchOn((v) => !v)}
            disabled={isCapturing || isAnalyzing}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.frame.label")}
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
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleReset}
              disabled={isAnalyzing}
              accessibilityRole="button"
              accessibilityLabel={t("scanner.actions.preview_retry")}
            >
              <Text style={styles.secondaryBtnTxt}>{t("scanner.actions.preview_retry")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleAnalyze}
              disabled={isAnalyzing}
              accessibilityRole="button"
              accessibilityLabel={t("scanner.actions.use_photo")}
            >
              <Text style={styles.primaryBtnTxt}>{t("scanner.actions.use_photo")}</Text>
            </TouchableOpacity>
          </>
        ) : scanState === "idle" ? (
          <TouchableOpacity
            style={styles.captureBtnWrap}
            onPress={handleCapture}
            disabled={isCapturing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("scanner.title.idle")}
          >
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

      {/* Il muro puo' comparire gia' in preview: il gate scatta prima dell'OCR. */}
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

  // ── Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: SIZES.radiusRound,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Torch
  torchBtn: {
    width: 48,
    height: 48,
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
    justifyContent: "center",
    minHeight: 54,
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
  cancelLink: { paddingVertical: 12, minHeight: 48, justifyContent: "center" },
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
  resultContent: { padding: 24, gap: 10 },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 6,
  },
  titleInput: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
    color: COLORS.textPrimary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  scanTextInput: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 220,
  },

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
  successLabel: { color: COLORS.success, fontSize: 14, fontWeight: "600" },
});
