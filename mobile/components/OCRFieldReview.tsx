/**
 * OCRFieldReview.tsx — Single-Field Review Row with Confidence Styling
 * =====================================================================
 * Renders one OCR-extracted field with:
 *  - A label and an editable input
 *  - Visual indicators for low-confidence fields (red border, alert icon)
 *  - A green check + badge for high-confidence fields
 *  - Tap-to-edit UX (whole row is pressable, focus moves to input)
 *  - An optional "learned from previous" hint when the field was
 *    pre-filled from a past correction.
 *
 * The component is fully controlled: parent owns the value via `field.value`
 * and `onChange`. The component never persists corrections itself — the
 * parent scanner screen wires the save call (so it can group by vendor).
 */

import React, { useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";
import { COLORS, SHADOWS, SIZES } from "../constants/theme";
import type { FieldConfidence } from "../lib/ocr-confidence";
import { LOW_CONFIDENCE_THRESHOLD } from "../lib/ocr-confidence";

export type OCRFieldReviewProps = {
  field: FieldConfidence;
  label: string;
  onChange: (newValue: string) => void;
  /** Optional suggestion surfaced when pre-filling from a past correction. */
  autoFilledFromCorrection?: string;
  /** Optional icon override for the input (e.g. currency symbol). */
  trailingHint?: string;
  /** Disable editing (e.g. while saving). */
  readOnly?: boolean;
};

export function OCRFieldReview({
  field,
  label,
  onChange,
  autoFilledFromCorrection,
  trailingHint,
  readOnly,
}: OCRFieldReviewProps) {
  const { t } = useLocale();
  const inputRef = useRef<TextInput | null>(null);

  const isLowConfidence =
    field.present && field.confidence < LOW_CONFIDENCE_THRESHOLD;
  const isHighConfidence = field.present && field.confidence >= LOW_CONFIDENCE_THRESHOLD;

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={focusInput}
      style={[
        styles.row,
        isLowConfidence && styles.rowLow,
        isHighConfidence && styles.rowHigh,
      ]}
    >
      <View style={styles.headerLine}>
        <Text style={styles.label}>{label}</Text>
        {isLowConfidence && (
          <View style={styles.badgeLow}>
            <Ionicons name="alert-circle" size={14} color="#ef4444" />
            <Text style={styles.badgeLowText}>
              {t("ocrReview.needs_review")}
            </Text>
          </View>
        )}
        {isHighConfidence && (
          <View style={styles.badgeHigh}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.badgeHighText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={field.value}
          onChangeText={onChange}
          editable={!readOnly}
          style={[
            styles.input,
            isLowConfidence && styles.inputLow,
            isHighConfidence && styles.inputHigh,
          ]}
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {trailingHint ? (
          <Text style={styles.trailingHint}>{trailingHint}</Text>
        ) : null}
      </View>

      {/* Hint line — confidence rationale or "learned from previous". */}
      {isLowConfidence && field.present ? (
        <Text style={styles.hintLow}>{t("ocrReview.confidence_low")}</Text>
      ) : isHighConfidence && field.present ? (
        <Text style={styles.hintHigh}>{t("ocrReview.confidence_high")}</Text>
      ) : null}

      {autoFilledFromCorrection ? (
        <View style={styles.learnedLine}>
          <Ionicons name="bulb-outline" size={12} color={COLORS.accent} />
          <Text style={styles.learnedText}>
            {t("ocrReview.learned_from_previous")}
          </Text>
        </View>
      ) : null}

      <Text style={styles.tapHint}>{t("ocrReview.tap_to_edit")}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
    backgroundColor: COLORS.surfaceTertiary,
    gap: 8,
  },
  rowLow: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  rowHigh: {
    borderColor: "rgba(34,197,94,0.35)",
    backgroundColor: "rgba(34,197,94,0.05)",
  },
  headerLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  badgeLow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.radiusSm,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  badgeLowText: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "700",
  },
  badgeHigh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.radiusSm,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  badgeHighText: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
    borderRadius: SIZES.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  inputLow: {
    borderColor: "#ef4444",
  },
  inputHigh: {
    borderColor: "rgba(34,197,94,0.45)",
  },
  trailingHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  hintLow: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "500",
  },
  hintHigh: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "500",
  },
  learnedLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  learnedText: {
    fontSize: 11,
    color: COLORS.accent,
    fontStyle: "italic",
  },
  tapHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },
});
