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
import { apiFetch } from "@/lib/ai";

type ScanState = "idle" | "capturing" | "preview" | "analyzing" | "result";

interface OcrResult {
  vendor: string;
  date: string;
  total: number | null;
  currency: string;
  rawText: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Scanning frame dimensions — 85% of screen width, 4:3 aspect
const FRAME_W = SCREEN_WIDTH * 0.82;
const FRAME_H = FRAME_W * 1.3;
const CORNER = 28;       // corner arm length
const CORNER_W = 3;      // corner stroke width
const CORNER_R = 6;      // corner radius

export default function ScannerScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // Animated scan line
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (scanState === "idle") {
      // Looping scan line
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2200,
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
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
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
        quality: 0.85,
        base64: true,
        skipProcessing: false,
      });
      if (photo) {
        setPhotoUri(photo.uri ?? null);
        setPhotoBase64(photo.base64 ?? null);
        setScanState("preview");
      } else {
        setError("Impossibile acquisire l'immagine.");
        setScanState("idle");
      }
    } catch {
      setError("Impossibile scattare la foto. Riprova.");
      setScanState("idle");
    }
  };

  const handleAnalyze = async () => {
    if (!photoBase64) return;
    setScanState("analyzing");
    setError(null);

    const { data, error: apiError } = await apiFetch<OcrResult>("/api/ocr/receipt", {
      method: "POST",
      body: JSON.stringify({ imageBase64: photoBase64 }),
    });

    if (apiError || !data) {
      setError("Estrazione non riuscita. Prova con una foto più nitida.");
      setScanState("preview");
      return;
    }

    setOcrResult(data as OcrResult);
    setScanState("result");
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
        <ActivityIndicator size="large" color="#6c63ff" />
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
            Consenti l'accesso per scansionare ricevute e documenti con l'AI.
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

        <Text style={styles.resultHint}>Verifica i dati estratti e conferma</Text>

        <ScrollView style={styles.resultCard} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <ResultRow label="Fornitore" value={ocrResult.vendor || "—"} />
          <View style={styles.divider} />
          <ResultRow label="Data" value={ocrResult.date || "—"} />
          <View style={styles.divider} />
          <ResultRow
            label="Totale"
            value={
              ocrResult.total !== null
                ? `${ocrResult.total.toFixed(2)} ${ocrResult.currency}`
                : "—"
            }
            highlight
          />
        </ScrollView>

        {error && <Text style={styles.errorMsg}>{error}</Text>}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
            <Text style={styles.secondaryBtnTxt}>↩ Riprova</Text>
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
    outputRange: [0, FRAME_H - 2],
  });

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        {/* Torch — idle only */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
            onPress={() => setTorchOn((v) => !v)}
          >
            <Text style={styles.torchIcon}>{torchOn ? "⚡" : "☀"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      <Text style={styles.screenTitle}>
        {isPreview ? "Controlla la foto" : isAnalyzing ? "Analisi in corso…" : "Scanner Ricevute"}
      </Text>
      <Text style={styles.screenSub}>
        {isPreview
          ? "La ricevuta è nitida e leggibile?"
          : isAnalyzing
          ? "L'AI sta estraendo i dati dalla ricevuta"
          : "Inquadra la ricevuta nel riquadro"}
      </Text>

      {/* Camera / preview area — full-flex */}
      <View style={styles.cameraContainer}>
        {/* Darkened overlay outside frame */}
        <View style={StyleSheet.absoluteFillObject}>
          {/* Top mask */}
          <View style={[styles.mask, { height: (500 - FRAME_H) / 2 }]} />
          {/* Middle row */}
          <View style={{ flexDirection: "row", height: FRAME_H }}>
            <View style={[styles.mask, { width: (SCREEN_WIDTH - FRAME_W) / 2, flex: 0 }]} />
            {/* Transparent center — camera shows through */}
            <View style={{ width: FRAME_W }} />
            <View style={[styles.mask, { width: (SCREEN_WIDTH - FRAME_W) / 2, flex: 0 }]} />
          </View>
          {/* Bottom mask */}
          <View style={[styles.mask, { flex: 1 }]} />
        </View>

        {/* Live camera or photo preview */}
        {photoUri && scanState !== "idle" ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={torchOn}
            flash="off"
          />
        )}

        {/* Scanning frame — centered */}
        <View style={styles.frameWrap} pointerEvents="none">
          {/* Corner TL */}
          <View style={[styles.corner, styles.cTL]} />
          {/* Corner TR */}
          <View style={[styles.corner, styles.cTR]} />
          {/* Corner BL */}
          <View style={[styles.corner, styles.cBL]} />
          {/* Corner BR */}
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

          {/* Center label */}
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
              <ActivityIndicator size="large" color="#6c63ff" />
            </Animated.View>
            <Text style={styles.analyzingTitle}>Lettura AI…</Text>
            <Text style={styles.analyzingHint}>Estrazione dati dalla ricevuta</Text>
          </View>
        )}
      </View>

      {/* Error */}
      {error && <Text style={styles.errorMsg}>{error}</Text>}

      {/* Bottom actions */}
      <View style={styles.actionsRow}>
        {isPreview ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
              <Text style={styles.secondaryBtnTxt}>↩ Riprova</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAnalyze}>
              <Text style={styles.primaryBtnTxt}>Analizza →</Text>
            </TouchableOpacity>
          </>
        ) : scanState === "idle" ? (
          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
            <View style={styles.captureBtnInner} />
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
    backgroundColor: "#0a0b0f",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0a0b0f",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e2029",
    justifyContent: "center",
    alignItems: "center",
  },
  closeTxt: { color: "#9ca3af", fontSize: 15, fontWeight: "600" },

  // ── Torch ────────────────────────────────────────────────────────────────
  torchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e2029",
    justifyContent: "center",
    alignItems: "center",
  },
  torchBtnOn: { backgroundColor: "rgba(108,99,255,0.4)", borderWidth: 1, borderColor: "#6c63ff" },
  torchIcon: { fontSize: 16 },

  // ── Titles ───────────────────────────────────────────────────────────────
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f0f0f2",
    textAlign: "center",
    marginBottom: 6,
  },
  screenSub: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 19,
  },

  // ── Camera container ─────────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#000",
    marginBottom: 16,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  // Semi-transparent mask outside the scan frame
  mask: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  // ── Scanning frame ────────────────────────────────────────────────────────
  frameWrap: {
    position: "absolute",
    width: FRAME_W,
    height: FRAME_H,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#6c63ff",
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

  // Animated scan line
  scanLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#6c63ff",
    shadowColor: "#6c63ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },

  // Center hint label
  frameLabelBox: {
    position: "absolute",
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  frameLabelTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "500",
  },

  // ── Analyzing overlay ─────────────────────────────────────────────────────
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,11,15,0.82)",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  analysisRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(108,99,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(108,99,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingTitle: {
    color: "#f0f0f2",
    fontSize: 16,
    fontWeight: "700",
  },
  analyzingHint: {
    color: "#6b7280",
    fontSize: 13,
  },

  // ── Error message ─────────────────────────────────────────────────────────
  errorMsg: {
    color: "#f59e0b",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 8,
  },

  // ── Action bar ────────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#6c63ff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  captureBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#6c63ff",
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryBtnTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#1a1b23",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2b35",
  },
  secondaryBtnTxt: {
    color: "#f0f0f2",
    fontSize: 15,
    fontWeight: "600",
  },
  btnDisabled: { opacity: 0.55 },

  // ── Permission screen ─────────────────────────────────────────────────────
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 14,
  },
  permissionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(108,99,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(108,99,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permissionEmoji: { fontSize: 36 },
  permTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f0f0f2",
    textAlign: "center",
  },
  permSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  cancelLink: { paddingVertical: 10 },
  cancelLinkTxt: { color: "#6b7280", fontSize: 14 },

  // ── Result card ───────────────────────────────────────────────────────────
  resultHint: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  resultCard: {
    flex: 1,
    backgroundColor: "#111318",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 16,
  },
  resultContent: { padding: 20, gap: 16 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  resultLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
    flex: 0.4,
  },
  resultValue: {
    fontSize: 14,
    color: "#f0f0f2",
    flex: 0.6,
    textAlign: "right",
    fontWeight: "500",
  },
  resultHighlight: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6c63ff",
  },
  divider: { height: 1, backgroundColor: "#1e2029" },

  // ── Success badge ────────────────────────────────────────────────────────
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  successDot: { color: "#10b981", fontSize: 13, fontWeight: "700" },
  successLabel: { color: "#10b981", fontSize: 13, fontWeight: "600" },
});
