import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

export default function ScannerScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    setErrorMessage(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      setPhotoUri(photo.uri);
    } catch {
      setErrorMessage("Impossibile scattare la foto. Riprova.");
    } finally {
      setCapturing(false);
    }
  };

  const handleUsePhoto = () => {
    setErrorMessage("Ricevuta acquisita. OCR in arrivo nella prossima versione.");
  };

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

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Scanner Ricevute</Text>
      <Text style={styles.subtitle}>
        Inquadra la ricevuta, scatta una foto nitida e conferma l'acquisizione
      </Text>

      <View style={styles.cameraFrame}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        )}
      </View>

      {errorMessage && <Text style={styles.message}>{errorMessage}</Text>}

      <View style={styles.actions}>
        {photoUri ? (
          <>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPhotoUri(null);
                setErrorMessage(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Riprova</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleUsePhoto}>
              <Text style={styles.primaryButtonText}>Usa foto</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.captureButton, capturing && styles.buttonDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            <Text style={styles.captureButtonText}>
              {capturing ? "Scatto..." : "Scatta ricevuta"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

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
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  cameraFrame: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 20,
    backgroundColor: "#111318",
  },
  camera: {
    flex: 1,
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: { fontSize: 48, marginBottom: 16 },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  captureButton: {
    flex: 1,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
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
  buttonDisabled: {
    opacity: 0.6,
  },
  message: {
    color: "#f59e0b",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
});
