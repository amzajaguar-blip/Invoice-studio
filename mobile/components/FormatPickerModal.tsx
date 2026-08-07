/**
 * FormatPickerModal.tsx — Selezione formato documento
 *
 * Mostra 3 opzioni (PDF / DOCX / RTF) con icona, nome e descrizione breve.
 * Persiste l'ultima scelta via AsyncStorage alla chiave `milo_last_doc_format`.
 * Al primo uso (nessuna preferenza salvata) nessun formato è pre-selezionato.
 *
 * Requirements: 19.2, 19.3, 18.5
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocale } from "@/components/LocaleProvider";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type DocumentFormat = "pdf" | "doc" | "rtf";

export interface FormatPickerModalProps {
  visible: boolean;
  /** Formato attualmente selezionato (null = nessuna selezione). */
  selectedFormat: DocumentFormat | null;
  onSelect: (format: DocumentFormat) => void;
  onDismiss: () => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "milo_last_doc_format";

interface FormatOption {
  id: DocumentFormat;
  iconName: keyof typeof Ionicons.glyphMap;
  descriptionKey: string;
  accentColor: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "pdf",
    iconName: "document-text-outline",
    descriptionKey: "format_picker.pdf_desc",
    accentColor: "#ef4444",
  },
  {
    id: "doc",
    iconName: "document-outline",
    descriptionKey: "format_picker.doc_desc",
    accentColor: "#3b82f6",
  },
  {
    id: "rtf",
    iconName: "code-slash-outline",
    descriptionKey: "format_picker.rtf_desc",
    accentColor: "#a855f7",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function loadLastDocFormat(): Promise<DocumentFormat | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "pdf" || raw === "doc" || raw === "rtf") return raw;
    return null;
  } catch {
    return null;
  }
}

async function saveLastDocFormat(format: DocumentFormat): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, format);
  } catch {
    // Non-blocking
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FormatPickerModal({
  visible,
  selectedFormat,
  onSelect,
  onDismiss,
}: FormatPickerModalProps) {
  const { t } = useLocale();
  const [localSelected, setLocalSelected] = useState<DocumentFormat | null>(
    selectedFormat
  );
  const [loadingLastFormat, setLoadingLastFormat] = useState(true);

  // Carica l'ultima preferenza salvata all'apertura
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingLastFormat(true);
    loadLastDocFormat().then((last) => {
      if (cancelled) return;
      if (!selectedFormat && last) {
        setLocalSelected(last);
      } else {
        setLocalSelected(selectedFormat);
      }
      setLoadingLastFormat(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedFormat]);

  const handleSelect = useCallback(
    (format: DocumentFormat) => {
      setLocalSelected(format);
      void saveLastDocFormat(format);
      onSelect(format);
    },
    [onSelect]
  );

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

        {/* Title */}
        <Text style={s.title}>{t("format_picker.title")}</Text>

        {loadingLastFormat ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="small" color="#6c63ff" />
          </View>
        ) : (
          <View style={s.optionsList}>
            {FORMAT_OPTIONS.map((option) => {
              const isSelected = localSelected === option.id;
              const label = t(`format_picker.${option.id}` as any);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    s.optionRow,
                    isSelected && s.optionRowSelected,
                    isSelected && {
                      borderColor: `${option.accentColor}60`,
                      backgroundColor: `${option.accentColor}10`,
                    },
                  ]}
                  onPress={() => handleSelect(option.id)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                >
                  {/* Icona */}
                  <View
                    style={[
                      s.iconContainer,
                      { backgroundColor: `${option.accentColor}20` },
                    ]}
                  >
                    <Ionicons
                      name={option.iconName}
                      size={22}
                      color={option.accentColor}
                    />
                  </View>

                  {/* Testo */}
                  <View style={s.optionTextContainer}>
                    <Text style={[s.optionLabel, isSelected && { color: option.accentColor }]}>
                      {label}
                    </Text>
                  </View>

                  {/* Check */}
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={option.accentColor}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2e3040",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f0f0f2",
    marginBottom: 16,
    textAlign: "center",
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e2029",
    backgroundColor: "#0d0e12",
  },
  optionRowSelected: {
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f0f0f2",
  },
  cancelBtn: {
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
