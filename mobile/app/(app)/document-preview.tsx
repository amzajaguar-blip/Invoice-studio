import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/components/LocaleProvider';

/**
 * DocumentPreviewScreen — visualizza in‑app il documento generato tramite WebView.
 * Il percorso del file da mostrare è passato tramite query param `uri` (es. ?uri=file%3A%2F%2F...).
 * La screen è raggiungibile con `/document-preview?uri=<encoded‑uri>`.
 */
export default function DocumentPreviewScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const fileUri = uri ? decodeURIComponent(uri) : null;

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#6c63ff" />
        <Text style={s.backText}>← {t('back') ?? 'Indietro'}</Text>
      </TouchableOpacity>
      {fileUri ? (
        <WebView source={{ uri: fileUri }} style={s.webview} />
      ) : (
        <Text style={s.error}>{t('error') ?? 'Errore'} – file non disponibile</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b0f' },
  backBtn: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  backText: { marginLeft: 8, color: '#6c63ff', fontSize: 15 },
  webview: { flex: 1 },
  error: { color: '#f87171', textAlign: 'center', marginTop: 20 },
});
