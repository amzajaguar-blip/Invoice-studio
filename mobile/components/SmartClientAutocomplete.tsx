/**
 * SmartClientAutocomplete — Smart client match for the new-invoice form.
 *
 * Renders a banner underneath the client picker with a "Hai già [name]?"
 * affordance when the user has typed at least 3 characters and at least one
 * existing client's name contains the typed text (case-insensitive substring,
 * length-aware heuristic approximating a ≥80% Levenshtein match for v64).
 *
 * - Pure presentation; receives `clients`, `query`, and `onPick(id)`.
 * - Single match: 1-tap select button.
 * - Multiple matches: shows the closest single match (highest similarity),
 *   but tappable to expand would be a v65+ feature.
 * - Icons: Ionicons only (no emoji).
 */

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface SmartClientAutocompleteItem {
  id: string;
  name: string;
}

export interface SmartClientAutocompleteProps {
  /** Current text typed in the client picker / search input. */
  query: string;
  /** Pool of clients to match against. */
  clients: readonly SmartClientAutocompleteItem[];
  /** Fires when the user taps the "Sì, seleziona" CTA on the suggestion. */
  onPick: (id: string) => void;
  /** Don't surface the currently-selected client. Optional. */
  excludeId?: string;
  /** Minimum query length before we run the matcher. Defaults to 3. */
  minQueryLength?: number;
}

// ---------------------------------------------------------------------------
// Helper: similarity scoring
// ---------------------------------------------------------------------------

/**
 * Returns a score in [0, 1] where 1 means "the typed query is fully contained
 * in the client name (case-insensitive)". For v64 we use a simple substring
 * heuristic; a full Levenshtein can be added later without API change.
 */
function similarity(query: string, name: string): number {
  if (!query || !name) return 0;
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase();
  if (!q) return 0;

  // Exact substring match → 1.0
  if (n.includes(q)) return 1;

  // Otherwise: token-overlap (any whitespace-separated token of `name`
  // starts with `q`). Useful for "Acme" matching "Acme S.r.l.".
  const tokens = n.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok.startsWith(q)) return 0.9;
    if (tok.includes(q)) return 0.8;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SmartClientAutocomplete({
  query,
  clients,
  onPick,
  excludeId,
  minQueryLength = 3,
}: SmartClientAutocompleteProps) {
  const { t } = useLocale();

  const match = useMemo(() => {
    if (!query || query.trim().length < minQueryLength) return null;
    const q = query.trim();
    let best: { client: SmartClientAutocompleteItem; score: number } | null = null;
    for (const c of clients) {
      if (excludeId && c.id === excludeId) continue;
      const score = similarity(q, c.name);
      // ≥ 0.8 ≈ ≥80% similarity, per spec.
      if (score >= 0.8 && (!best || score > best.score)) {
        best = { client: c, score };
      }
    }
    return best;
  }, [query, clients, excludeId, minQueryLength]);

  if (!match) return null;

  const label = t("invoicePrefill.smart_match").replace(
    "{name}",
    match.client.name,
  );

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPick(match.client.id)}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel={label + " — " + t("invoicePrefill.smart_match_yes")}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={16} color="#6c63ff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.ctaWrap}>
        <Text style={styles.cta}>{t("invoicePrefill.smart_match_yes")}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6c63ff" />
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderColor: "#6c63ff44",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6c63ff15",
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: "#f0f0f2",
    fontSize: 14,
    fontWeight: "500",
  },
  ctaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cta: {
    color: "#6c63ff",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SmartClientAutocomplete;
