/**
 * LanguagePickerModal.tsx — Selezione lingua per traduzione documento
 *
 * Lista le 10 lingue supportate con flag emoji e nome display.
 * Usato prima di avviare translateDocumentContent().
 *
 * Requirements: 21.1, 21.5
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  SupportedLanguage,
} from "@/lib/translation-service";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LanguagePickerModalProps {
  visible: boolean;
  /** Codice lingua attualmente selezionata (es. "it") */
  selectedLang?: string | null;
  onSelect: (langCode: string) => void;
  onDismiss: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function LanguagePickerModal({
  visible,
  selectedLang,
  onSelect,
  onDismiss,
}: LanguagePickerModalProps) {
  const { t } = useLocale();

  const renderItem = useCallback(
    ({ item }: { item: SupportedLanguage }) => {
      const isSelected = item.code === selectedLang;
      return (
        <TouchableOpacity
          style={[s.langRow, isSelected && s.langRowSelected]}
          onPress={() => onSelect(item.code)}
          activeOpacity={0.75}
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`${item.displayName} ${item.flag}`}
        >
          <Text style={s.flag}>{item.flag}</Text>
          <Text style={[s.langName, isSelected && s.langNameSelected]}>
            {item.displayName}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={20} color="#6c63ff" style={s.checkIcon} />
          )}
        </TouchableOpacity>
      );
    },
    [selectedLang, onSelect]
  );

  const keyExtractor = useCallback((item: SupportedLanguage) => item.code, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        style={s.backdrop}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
      />

      {/* Sheet */}
      <View style={s.sheet}>
        {/* Handle bar */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.headerRow}>
          <Ionicons name="language-outline" size={20} color="#6c63ff" />
          <Text style={s.title}>{t("translator.title")}</Text>
        </View>
        <Text style={s.subtitle}>{t("translator.select_language")}</Text>

        {/* Nota privacy GDPR */}
        <View style={s.privacyNote}>
          <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
          <Text style={s.privacyText}>{t("translator.privacy_note")}</Text>
        </View>

        {/* Lista lingue */}
        <FlatList
          data={SUPPORTED_TRANSLATION_LANGUAGES}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />

        {/* Annulla */}
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("cancel")}
        >
          <Text style={s.cancelText}>{t("cancel")}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#1e2029",
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2e3040",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f0f0f2",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 10,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#0d0e12",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e2029",
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#1e2029",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  langRowSelected: {
    backgroundColor: "#6c63ff12",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  flag: {
    fontSize: 22,
    marginRight: 12,
    ...Platform.select({
      android: { lineHeight: 26 },
    }),
  },
  langName: {
    flex: 1,
    fontSize: 15,
    color: "#f0f0f2",
    fontWeight: "500",
  },
  langNameSelected: {
    color: "#6c63ff",
    fontWeight: "700",
  },
  checkIcon: {
    marginLeft: 8,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#1e2029",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },
});
