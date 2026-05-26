import { useRef, useState } from "react";
import {
  ActivityIndicator,
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

  const handleCapture = async () => {
    if (!cameraRef.current || scanState !== "idle") return;
    setScanState("capturing");
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });
      setPhotoUri(photo.uri);
      setPhotoBase64(photo.base64 ?? null);
      setScanState("preview");
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

  // ── Permission loading ──────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.permissionBox}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.title}>Permesso fotocamera richiesto</Text>
          <Text style={styles.subtitle}>
            Consenti l'accesso alla fotocamera per scansionare le ricevute.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Consenti fotocamera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Result screen ───────────────────────────────────────────────────────────

  if (scanState === "result" && ocrResult) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ricevuta rilevata</Text>
        <Text style={styles.subtitle}>Verifica i dati estratti e conferma</Text>

        <ScrollView style={styles.resultCard} contentContainerStyle={styles.resultContent}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Fornitore</Text>
            <Text style={styles.resultValue} numberOfLines={2}>
              {ocrResult.vendor || "—"}
            </Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Data</Text>
            <Text style={styles.resultValue}>{ocrResult.date || "—"}</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Totale</Text>
            <Text style={[styles.resultValue, styles.resultTotal]}>
              {ocrResult.total !== null
                ? `${ocrResult.total.toFixed(2)} ${ocrResult.currency}`
                : "—"}
            </Text>
          </View>
        </ScrollView>

        {error && <Text style={styles.message}>{error}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Riprova</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>Conferma</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera / preview / analyzing screen ────────────────────────────────────

  const titleMap: Record<ScanState, string> = {
    idle: "Scanner Ricevute",
    capturing: "Scanner Ricevute",
    preview: "Controlla la foto",
    analyzing: "Analisi in corso",
    result: "",
  };

  const subtitleMap: Record<ScanState, string> = {
    idle: "Inquadra la ricevuta all'interno del riquadro",
    capturing: "Inquadra la ricevuta all'interno del riquadro",
    preview: "La ricevuta è nitida e leggibile?",
    analyzing: "Estrazione dati dalla ricevuta...",
    result: "",
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{titleMap[scanState]}</Text>
      <Text style={styles.subtitle}>{subtitleMap[scanState]}</Text>

      <View style={styles.cameraFrame}>
        {photoUri && scanState !== "idle" ? (
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            enableTorch={torchOn}
            flash="off"
          />
        )}

        {/* Frame guide overlay — only in idle */}
        {scanState === "idle" && (
          <View style={styles.frameOverlay} pointerEvents="none">
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            <Text style={styles.frameHint}>Allinea la ricevuta qui</Text>
          </View>
        )}

        {/* Analyzing overlay */}
        {scanState === "analyzing" && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#6c63ff" />
            <Text style={styles.analyzingText}>Lettura testo...</Text>
          </View>
        )}

        {/* Flash toggle — only in idle */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
            onPress={() => setTorchOn((v) => !v)}
          >
            <Text style={styles.torchIcon}>{torchOn ? "🔦" : "💡"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.message}>{error}</Text>}

      <View style={styles.actions}>
        {scanState === "preview" ? (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>Riprova</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAnalyze}>
              <Text style={styles.primaryButtonText}>Analizza ricevuta</Text>
            </TouchableOpacity>
          </>
        ) : scanState === "idle" ? (
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <Text style={styles.captureButtonText}>Scatta ricevuta</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.captureButton, styles.buttonDisabled]}>
            <ActivityIndicator color="#ffffff" />
          </View>
        )}
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
    padding: 20,
    paddingTop: 60,
  },
  close: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e2029",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  closeText: { color: "#9ca3af", fontSize: 16 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 6,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 19,
  },

  // ── Camera frame ────────────────────────────────────────────────────────────
  cameraFrame: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 20,
    backgroundColor: "#111318",
  },
  camera: { flex: 1 },
  preview: { width: "100%", height: "100%" },

  // ── Frame overlay corners ────────────────────────────────────────────────────
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerTL: {
    position: "absolute",
    top: 24,
    left: 24,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "rgba(255,255,255,0.7)",
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: "absolute",
    top: 24,
    right: 24,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "rgba(255,255,255,0.7)",
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: "absolute",
    bottom: 24,
    left: 24,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "rgba(255,255,255,0.7)",
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "rgba(255,255,255,0.7)",
    borderBottomRightRadius: 4,
  },
  frameHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginTop: 4,
  },

  // ── Flash toggle ────────────────────────────────────────────────────────────
  torchBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  torchBtnActive: {
    backgroundColor: "rgba(108,99,255,0.55)",
  },
  torchIcon: { fontSize: 18 },

  // ── Analyzing overlay ───────────────────────────────────────────────────────
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  analyzingText: {
    color: "#f0f0f2",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Permission box ──────────────────────────────────────────────────────────
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: { fontSize: 48, marginBottom: 16 },

  // ── Result card ─────────────────────────────────────────────────────────────
  resultCard: {
    flex: 1,
    backgroundColor: "#111318",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 4,
  },
  resultContent: {
    padding: 20,
    gap: 14,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  resultLabel: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "600",
    flex: 0.4,
  },
  resultValue: {
    fontSize: 14,
    color: "#f0f0f2",
    flex: 0.6,
    textAlign: "right",
  },
  resultTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6c63ff",
  },
  resultDivider: {
    height: 1,
    backgroundColor: "#1e2029",
  },

  // ── Actions bar ─────────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  captureButton: {
    flex: 1,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  captureButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#1e2029",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#f0f0f2",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: { opacity: 0.6 },
  message: {
    color: "#f59e0b",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },
});
