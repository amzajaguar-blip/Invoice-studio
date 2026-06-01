import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useIsFocused } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { COLORS, SIZES, SHADOWS } from "../../constants/theme";
import {
  incrementScanCount,
  SCAN_LIMIT,
  scheduleRetentionNotifications,
} from "../../lib/scanner-quota";

type ScanState = "idle" | "capturing" | "preview" | "analyzing" | "result";

interface OcrResult {
  vendor: string;
  date: string;
  total: number | null;
  currency: string;
  rawText: string;
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
  const isFocused = useIsFocused();
  const isMounted = useRef(true);
  
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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
    if (scanState === "idle" && isFocused) {
      // Looping scan line
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
  }, [scanState, scanAnim, isFocused]);

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
          setError("Impossibile acquisire l'immagine.");
          setScanState("idle");
        }
      }
    } catch (e) {
      if (isMounted.current) {
        console.error("Camera capture error:", e);
        setError("Errore durante lo scatto. Assicurati che la fotocamera sia pronta.");
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
        setTimeout(() => reject(new Error("Timeout: il server non risponde. Riprova tra poco.")), ANALYZE_TIMEOUT_MS)
      );
      const { data, error: apiError } = await Promise.race<ApiFetchResult>([
        fetchPromise,
        timeoutPromise,
      ]);

      if (isMounted.current) {
        if (apiError || !data) {
          setError("Estrazione non riuscita. Prova con una foto più nitida.");
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
        setOcrResult(data as OcrResult);
        setScanState("result");

        // Fire-and-forget retention notifications
        scheduleRetentionNotifications();
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Errore di rete o di sistema. Riprova tra poco.");
        setScanState("preview");
      }
    }
  };

  const handleReset = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setOcrResult(null);
    setError(null);
    setScanState("idle");
  };

  const handleConfirm = () => {
    router.back();
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
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        <View style={styles.permissionBox}>
          <View style={styles.permissionIconWrap}>
            <Text style={styles.permissionEmoji}>📷</Text>
          </View>
          <Text style={styles.permTitle}>Accesso fotocamera</Text>
          <Text style={styles.permSubtitle}>
            Consenti l'accesso per scansionare ricevute e documenti con l'AI in stile Milo.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnTxt}>Consenti fotocamera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelLink}>
            <Text style={styles.cancelLinkTxt}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────

  if (scanState === "result" && ocrResult) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={styles.successBadge}>
            <Text style={styles.successDot}>✓</Text>
            <Text style={styles.successLabel}>Ricevuta rilevata</Text>
          </View>
        </View>

        <Text style={styles.resultHint}>Verifica i dati estratti dall'AI</Text>

        <ScrollView style={styles.resultCard} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <ResultRow label="Fornitore" value={ocrResult.vendor || "—"} />
          <View style={styles.divider} />
          <ResultRow label="Data" value={ocrResult.date || "—"} />
          <View style={styles.divider} />
          <ResultRow
            label="Totale"
            value={
              ocrResult.total !== null
                ? `${ocrResult.total.toFixed(2)} ${ocrResult.currency || '€'}`
                : "—"
            }
            highlight
          />
        </ScrollView>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
            <Text style={styles.secondaryBtnTxt}>✕ Riprova</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
            <Text style={styles.primaryBtnTxt}>Conferma →</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.paywallTitle}>Limite di scansioni raggiunto</Text>
            <Text style={styles.paywallMessage}>Hai usato le 3 scansioni gratuite del mese. Sblocca scansioni illimitate con il nostro abbonamento.</Text>
            <TouchableOpacity style={styles.paywallButton} onPress={() => { setShowPaywall(false); router.push("/(app)/ProUpgrade" as any); }}>
              <Text style={styles.paywallButtonText}>Vai a Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paywallClose} onPress={() => setShowPaywall(false)}>
              <Text style={styles.paywallCloseText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} disabled={isCapturing || isAnalyzing}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        {/* Torch — idle only */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
            onPress={() => setTorchOn((v) => !v)}
            disabled={isCapturing || isAnalyzing}
          >
            <Text style={[styles.torchIcon, torchOn && { color: COLORS.accent }]}>⚡</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      <Text style={styles.screenTitle}>
        {isPreview ? "Controlla Scansione" : isAnalyzing ? "Analisi in corso…" : "Carica Ricevuta"}
      </Text>
      <Text style={styles.screenSub}>
        {isPreview
          ? "I dati sono leggibili in modo nitido?"
          : isAnalyzing
          ? "Attendere, l'AI sta elaborando i dati."
          : "Inquadra la ricevuta all'interno del riquadro."}
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

        {/* Live camera or photo preview. Unmount camera when not focused to save resources */}
        {photoUri && scanState !== "idle" ? (
          <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} resizeMode="cover" />
        ) : (
          isFocused ? (
            <CameraView
              ref={cameraRef}
              style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
              facing="back"
              enableTorch={torchOn}
              flash="off"
            />
          ) : (
             <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.background, zIndex: 0 }]} />
          )
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
              <Text style={styles.frameLabelTxt}>Allinea la ricevuta qui</Text>
            </View>
          )}
        </View>

        {/* Analyzing overlay */}
        {isAnalyzing && (
          <View style={styles.analyzingOverlay}>
            <Animated.View style={[styles.analysisRing, { transform: [{ scale: pulseAnim }] }]}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </Animated.View>
            <Text style={styles.analyzingTitle}>Lettura AI…</Text>
            <Text style={styles.analyzingHint}>L'AI di Milo è a lavoro</Text>
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
              <Text style={styles.secondaryBtnTxt}>↩ Riscattare</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAnalyze} disabled={isAnalyzing}>
              <Text style={styles.primaryBtnTxt}>Usa Foto 📤</Text>
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
  closeTxt: { color: COLORS.textMuted, fontSize: 16, fontWeight: "600" },

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
  torchIcon: { fontSize: 16, color: COLORS.textMuted },

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
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permissionEmoji: { fontSize: 40 },
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
