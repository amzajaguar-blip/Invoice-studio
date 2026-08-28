/**
 * files.tsx — Il gestore dei file di Milo Office.
 *
 * E' la meta' del prodotto che mancava: l'app generava documenti, apriva il
 * foglio di condivisione e poi se ne dimenticava. Qui i file generati restano
 * a disposizione — si ricondividono, si salvano fuori dall'app, si rinominano
 * e si eliminano.
 *
 * La lista mostra i file REALMENTE presenti sul dispositivo (letti dalla
 * documentDirectory), non record a database: se un file c'e', c'e'.
 */

import { useCallback, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import { shareDocument, FORMAT_META } from "@/lib/document-engine";
import type { OutputFormat } from "@/lib/document-engine";
import {
  listGeneratedFiles,
  renameGeneratedFile,
  deleteGeneratedFile,
  saveToDevice,
  formatFileSize,
} from "@/lib/generated-files";
import type { GeneratedFile } from "@/lib/generated-files";

// ─── Costanti di presentazione ────────────────────────────────────────────────

const FORMAT_COLOR: Record<OutputFormat, string> = {
  pdf: "#ef4444",
  xlsx: "#22c55e",
  doc: "#3b82f6",
  rtf: "#a855f7",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<GeneratedFile | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);

  // ─── Caricamento ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const list = await listGeneratedFiles();
      setFiles(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Ricarica a ogni focus: un file appena generato deve comparire al ritorno.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void load();
  }, [load]);

  // ─── Azioni sul file ────────────────────────────────────────────────────────

  const closeActions = useCallback(() => setSelected(null), []);

  const reportError = useCallback(
    (err: unknown) => {
      Alert.alert(
        t("files.error.action_title"),
        err instanceof Error ? err.message : String(err)
      );
    },
    [t]
  );

  const handleShare = useCallback(async () => {
    const file = selected;
    if (!file) return;
    closeActions();
    try {
      await shareDocument(file.uri, file.filename);
    } catch (err) {
      reportError(err);
    }
  }, [selected, closeActions, reportError]);

  const handleSaveToDevice = useCallback(async () => {
    const file = selected;
    if (!file) return;
    closeActions();
    setBusy(true);
    try {
      const result = await saveToDevice(file);
      if (result.status === "saved") {
        Alert.alert(
          t("files.saved.title"),
          result.folderName
            ? t("files.saved.msg").replace("{folder}", result.folderName)
            : t("files.saved.msg_generic")
        );
      } else if (result.status === "unsupported") {
        Alert.alert(t("files.saved.title"), t("files.save.unsupported"));
      }
      // status === "cancelled": l'utente ha chiuso il selettore. Non e' un
      // errore e non merita un alert.
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }, [selected, closeActions, reportError, t]);

  const openRename = useCallback(() => {
    if (!selected) return;
    setRenameValue(selected.displayName);
    setRenameVisible(true);
  }, [selected]);

  const confirmRename = useCallback(async () => {
    const file = selected;
    if (!file) return;
    setRenameVisible(false);
    closeActions();
    setBusy(true);
    try {
      await renameGeneratedFile(file, renameValue);
      await load();
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }, [selected, renameValue, closeActions, load, reportError]);

  const handleDelete = useCallback(() => {
    const file = selected;
    if (!file) return;
    closeActions();
    Alert.alert(
      t("files.delete.title"),
      t("files.delete.msg").replace("{name}", file.displayName),
      [
        { text: t("files.actions.cancel"), style: "cancel" },
        {
          text: t("files.delete.confirm"),
          style: "destructive",
          onPress: () => {
            setBusy(true);
            deleteGeneratedFile(file)
              .then(load)
              .catch(reportError)
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  }, [selected, closeActions, t, load, reportError]);

  // ─── Render di una riga ─────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: GeneratedFile }) => (
      <View style={s.card}>
        <View style={[s.badge, { backgroundColor: `${FORMAT_COLOR[item.format]}1a` }]}>
          <Text style={[s.badgeText, { color: FORMAT_COLOR[item.format] }]}>
            {FORMAT_META[item.format].label}
          </Text>
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={2}>
            {item.displayName}
          </Text>
          <Text style={s.cardMeta}>
            {new Date(item.modifiedAt).toLocaleDateString("it-IT", {
              day: "numeric",
              month: "short",
            })}
            {" · "}
            {formatFileSize(item.size)}
          </Text>
        </View>
        <TouchableOpacity
          style={s.moreBtn}
          onPress={() => setSelected(item)}
          accessibilityRole="button"
          accessibilityLabel={t("files.a11y.actions").replace("{name}", item.displayName)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    ),
    [t]
  );

  // ─── Stati della schermata ──────────────────────────────────────────────────

  const header = (
    <View style={s.header}>
      <Text style={s.title}>{t("files.title")}</Text>
      <Text style={s.subtitle}>{t("files.subtitle")}</Text>
    </View>
  );

  let body: React.ReactNode;

  if (loading) {
    body = (
      <View style={s.stateWrap}>
        {header}
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
      </View>
    );
  } else if (loadError) {
    body = (
      <View style={s.stateWrap}>
        {header}
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={s.errorTitle}>{t("files.error.title")}</Text>
          <Text style={s.errorMsg}>{loadError}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel={t("files.error.retry")}
          >
            <Text style={s.retryText}>{t("files.error.retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  } else if (files.length === 0) {
    body = (
      <View style={s.stateWrap}>
        {header}
        <EmptyState
          icon="folder-open-outline"
          title={t("files.empty.title")}
          hint={t("files.empty.hint")}
          cta={t("files.empty.cta")}
          onCTA={() => router.push("/(app)/generate")}
        />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={files}
        keyExtractor={(item) => item.uri}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
      />
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {body}

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/(app)/generate")}
        accessibilityRole="button"
        accessibilityLabel={t("files.cta.generate")}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={s.fabText}>{t("files.cta.generate")}</Text>
      </TouchableOpacity>

      {busy && (
        <View style={s.busyOverlay}>
          <ActivityIndicator size="large" color="#6c63ff" />
        </View>
      )}

      {/* Menu azioni — un Modal, non ActionSheetIOS: deve funzionare su Android */}
      <Modal
        visible={selected !== null && !renameVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActions}
      >
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={closeActions}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle} numberOfLines={1}>
              {selected?.displayName ?? ""}
            </Text>

            <TouchableOpacity
              style={s.sheetItem}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={t("files.actions.share")}
            >
              <Ionicons name="share-outline" size={20} color="#f0f0f2" />
              <Text style={s.sheetItemText}>{t("files.actions.share")}</Text>
            </TouchableOpacity>

            {Platform.OS === "android" && (
              <TouchableOpacity
                style={s.sheetItem}
                onPress={handleSaveToDevice}
                accessibilityRole="button"
                accessibilityLabel={t("files.actions.save")}
              >
                <Ionicons name="download-outline" size={20} color="#f0f0f2" />
                <Text style={s.sheetItemText}>{t("files.actions.save")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.sheetItem}
              onPress={openRename}
              accessibilityRole="button"
              accessibilityLabel={t("files.actions.rename")}
            >
              <Ionicons name="create-outline" size={20} color="#f0f0f2" />
              <Text style={s.sheetItemText}>{t("files.actions.rename")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.sheetItem}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={t("files.actions.delete")}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[s.sheetItemText, s.sheetItemDanger]}>
                {t("files.actions.delete")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.sheetItem, s.sheetCancel]}
              onPress={closeActions}
              accessibilityRole="button"
              accessibilityLabel={t("files.actions.cancel")}
            >
              <Text style={s.sheetCancelText}>{t("files.actions.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rinomina — Alert.prompt non esiste su Android, serve un Modal vero */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setRenameVisible(false); closeActions(); }}
      >
        <View style={s.sheetBackdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>{t("files.rename.title")}</Text>
            <TextInput
              style={s.dialogInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t("files.rename.placeholder")}
              placeholderTextColor="#4b5563"
              autoFocus
              accessibilityLabel={t("files.rename.title")}
            />
            <View style={s.dialogActions}>
              <TouchableOpacity
                style={s.dialogBtn}
                onPress={() => { setRenameVisible(false); closeActions(); }}
                accessibilityRole="button"
                accessibilityLabel={t("files.actions.cancel")}
              >
                <Text style={s.dialogBtnText}>{t("files.actions.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dialogBtn, s.dialogBtnPrimary, !renameValue.trim() && s.dialogBtnDisabled]}
                onPress={confirmRename}
                disabled={!renameValue.trim()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !renameValue.trim() }}
                accessibilityLabel={t("files.rename.confirm")}
              >
                <Text style={s.dialogBtnPrimaryText}>{t("files.rename.confirm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  stateWrap: { flex: 1, paddingHorizontal: 20 },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  header: { paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4, lineHeight: 20 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111318", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#1e2029",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 52, alignItems: "center" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, color: "#f0f0f2", fontWeight: "600" },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  moreBtn: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },

  errorBox: { alignItems: "center", paddingTop: 48, paddingHorizontal: 16, gap: 10 },
  errorTitle: { fontSize: 17, fontWeight: "700", color: "#f0f0f2", marginTop: 6 },
  errorMsg: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19 },
  retryBtn: {
    marginTop: 12, minHeight: 48, paddingHorizontal: 24, borderRadius: 12,
    backgroundColor: "#6c63ff", alignItems: "center", justifyContent: "center",
  },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  fab: {
    position: "absolute", right: 20, flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: "#6c63ff",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0b0fcc", alignItems: "center", justifyContent: "center",
  },

  sheetBackdrop: {
    flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111318", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 18, paddingBottom: 28, paddingHorizontal: 16,
    borderTopWidth: 1, borderColor: "#1e2029",
  },
  sheetTitle: {
    fontSize: 13, fontWeight: "700", color: "#6b7280",
    paddingHorizontal: 8, marginBottom: 10,
  },
  sheetItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    minHeight: 52, paddingHorizontal: 8, borderRadius: 12,
  },
  sheetItemText: { fontSize: 16, color: "#f0f0f2" },
  sheetItemDanger: { color: "#ef4444" },
  sheetCancel: { justifyContent: "center", marginTop: 6, backgroundColor: "#0a0b0f" },
  sheetCancelText: { fontSize: 16, color: "#6b7280", fontWeight: "600" },

  dialog: {
    margin: 24, marginBottom: "auto", marginTop: "auto",
    backgroundColor: "#111318", borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: "#1e2029", gap: 14,
  },
  dialogTitle: { fontSize: 17, fontWeight: "700", color: "#f0f0f2" },
  dialogInput: {
    backgroundColor: "#0a0b0f", borderRadius: 12, padding: 14, minHeight: 48,
    borderWidth: 1, borderColor: "#1e2029", color: "#f0f0f2", fontSize: 15,
  },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  dialogBtn: {
    minHeight: 48, paddingHorizontal: 18, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  dialogBtnText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
  dialogBtnPrimary: { backgroundColor: "#6c63ff" },
  dialogBtnDisabled: { backgroundColor: "#2a2b36" },
  dialogBtnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
