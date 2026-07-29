/**
 * LastClientChips — Smart Pre-fill chip strip.
 *
 * Shows the top-N (default 3) most-recently-used clients as tappable chips
 * above the standard client picker. Tapping a chip calls `onSelect(id)`.
 *
 * - Pure presentation: receives the resolved Client[] (filtered + sorted)
 *   and a callback. The data layer (`lastUsed.getRecentClients`) lives in
 *   the parent screen.
 * - Renders nothing when there are no recent clients.
 * - Icons: Ionicons only (no emoji).
 */

import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useLocale } from "@/components/LocaleProvider";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface LastClientChipItem {
  id: string;
  name: string;
}

export interface LastClientChipsProps {
  /** Resolved, ordered list of clients to render as chips (max ~3). */
  clients: readonly LastClientChipItem[];
  /** Fires with the tapped client id. */
  onSelect: (id: string) => void;
  /** Optional hard cap on rendered chips. Defaults to 3. */
  maxChips?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LastClientChips({
  clients,
  onSelect,
  maxChips = 3,
}: LastClientChipsProps) {
  const { t } = useLocale();

  if (!clients || clients.length === 0) return null;

  const visible = clients.slice(0, Math.max(0, maxChips));

  const handlePress = async (id: string) => {
    // Haptic feedback leggero — coerente con FilterBar pill taps.
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics may be unavailable on some devices (emulator, older Android)
    }
    onSelect(id);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={14} color="#9ca3af" />
        <Text style={styles.header}>{t("invoicePrefill.recent_clients")}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {visible.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.chip}
            onPress={() => handlePress(c.id)}
            accessibilityRole="button"
            accessibilityLabel={t("invoicePrefill.recent_clients") + ": " + c.name}
          >
            <Ionicons name="person-circle-outline" size={14} color="#6c63ff" />
            <Text style={styles.chipText} numberOfLines={1}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  header: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  scroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111318",
    borderColor: "#6c63ff44",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    maxWidth: 180,
  },
  chipText: {
    color: "#f0f0f2",
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
});

export default LastClientChips;
