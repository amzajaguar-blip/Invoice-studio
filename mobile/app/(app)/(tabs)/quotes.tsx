/**
 * quotes.tsx — Schermata preventivi con gate V34
 *
 * Integra il Rate Limit Gate (Req 9.3 pattern), Business Boost Modal (Req 9.11),
 * InApp Contextual Card (Req 6.10), e Smart Empty State (Req 17.3, 17.5, 17.6).
 *
 * Requirements: 17.3, 17.5, 17.6
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";

// ─── V34 imports ──────────────────────────────────────────────────────────────
import { usePlan } from "@/context/PlanContext";
import { useBusinessBoost } from "@/hooks/useBusinessBoost";
import { trackEvent } from "@/lib/analytics-events";
import BusinessBoostModal from "@/components/BusinessBoostModal";
import BoostSuccessModal from "@/components/BoostSuccessModal";
import InAppContextualCard from "@/components/InAppContextualCard";
import { useSmartCards } from "@/hooks/useSmartCards";
import { useEngagementContext } from "@/context/EngagementContext";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Quote {
  id: string;
  number: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "invoiced";
  total: number;
  currency: string;
  created_at: string;
  clients?: { id?: string; name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  draft:    "#6b7280",
  sent:     "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  invoiced: "#a855f7",
};

const STATUS_LABELS: Record<string, string> = {
  draft:    "Bozza",
  sent:     "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  invoiced: "Fatturato",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ─── Data state ─────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── V34: Engagement context (Req 9.4 pattern) ──────────────────────────
  const { recordAction } = useEngagementContext();

  // ─── V34: Plan gate ─────────────────────────────────────────────────────
  const { checkCanCreate, limits } = usePlan();

  // ─── V34: Business Boost hook ────────────────────────────────────────────
  const {
    boostSession,
    showBoostModal,
    openBoostModal,
    closeBoostModal,
    currentResource,
  } = useBusinessBoost();

  // ─── V34: BoostSuccessModal state ────────────────────────────────────────
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ─── V34: InApp contextual card for quotes_convert_hint (Req 6.10) ───────
  // hasDraftQuote: true se esiste almeno un preventivo in bozza — condizione per
  // mostrare la card 'quotes_convert_hint' (Requirements 6.10)
  const hasDraftQuote = quotes.some((q) => q.status === "draft");
  const { card, dismiss: dismissCard } = useSmartCards("quotes_convert_hint", hasDraftQuote);

  // ─── Ref per rilevare nuovi preventivi al focus (Req 9.4 pattern) ────────
  const prevQuoteCountRef = useRef<number | null>(null);

  // ─── Data loading ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Quote[] }>("/api/quotes?limit=50");
    if (data) {
      const list = Array.isArray(data)
        ? data
        : (data as { data: Quote[] }).data || [];
      setQuotes(list);
      return list.length;
    }
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    load().then((count) => {
      if (count !== null) {
        prevQuoteCountRef.current = count;
        setLoading(false);
      }
    });
  }, [load]);

  // ─── V34: useFocusEffect — rileva nuovi preventivi al ritorno (Req 9.4 pattern)
  /**
   * Quando la schermata riacquista il focus (utente torna da quotes/new),
   * ricarica la lista e confronta il conteggio. Se aumentato → recordAction('quote').
   */
  useFocusEffect(
    useCallback(() => {
      if (prevQuoteCountRef.current === null) return;

      const prevCount = prevQuoteCountRef.current;

      void (async () => {
        const { data } = await apiFetch<{ data: Quote[] }>("/api/quotes?limit=50");
        if (!data) return;
        const list = Array.isArray(data)
          ? data
          : (data as { data: Quote[] }).data || [];
        setQuotes(list);
        setLoading(false);

        if (list.length > prevCount) {
          prevQuoteCountRef.current = list.length;
          await recordAction("invoice"); // quotes use 'invoice' counter in engagement
        } else {
          prevQuoteCountRef.current = list.length;
        }
      })();
    }, [recordAction]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  // ─── V34 Gate: handler creazione preventivo ───────────────────────────────
  /**
   * Prima di navigare alla schermata di creazione:
   *  1. Chiama checkCanCreate('quote')
   *  2. Se allowed === false e isLoading === false → traccia limit_reached,
   *     apre BusinessBoostModal (NON naviga)
   *  3. Se allowed === true → naviga normalmente
   *
   * Requirements: 17.3, 17.5
   */
  const handleNewQuote = useCallback(() => {
    const result = checkCanCreate("quote");

    if (!result.allowed && !limits.isLoading) {
      // Traccia limit_reached per la risorsa 'quote'
      trackEvent({ event: "limit_reached", properties: { resource: "quote" } });
      // Apri BusinessBoostModal invece di navigare
      openBoostModal("quote");
      return;
    }

    // Naviga alla schermata di creazione preventivo
    router.push("/(app)/quotes/new" as never);
  }, [checkCanCreate, limits.isLoading, openBoostModal, router]);

  // ─── Handler chiusura BusinessBoostModal ─────────────────────────────────
  const handleBoostModalClose = useCallback(() => {
    closeBoostModal();
  }, [closeBoostModal]);

  // ─── Handler upgrade a Premium dal modal ─────────────────────────────────
  const handleUpgrade = useCallback(() => {
    closeBoostModal();
    router.push("/(app)/ProUpgrade" as never);
  }, [closeBoostModal, router]);

  // ─── Handler CTA della InAppContextualCard ────────────────────────────────
  const handleCardCTA = useCallback(() => {
    // La card 'quotes_convert_hint' guida l'utente a convertire un preventivo in fattura
    openBoostModal("quote");
  }, [openBoostModal]);

  // ─── Limiti quota per badge header ───────────────────────────────────────
  const quoteLimits = limits.quotes;
  const canCreate = quoteLimits?.canCreate ?? true;

  // ─── Smart Empty State (Req 17.3, 17.5, 17.6) ────────────────────────────
  /**
   * Req 17.3: icona 📝, titolo "Prepara un preventivo prima di fatturare.",
   * hint "Converti facilmente i preventivi in fatture.", CTA "Crea preventivo"
   * Req 17.5: CTA presente e visibile
   * Req 17.6: no dark pattern
   */
  const renderEmpty = () => (
    <EmptyState
      icon="📝"
      title="Prepara un preventivo prima di fatturare."
      hint="Converti facilmente i preventivi in fatture."
      cta="Crea preventivo"
      onCTA={handleNewQuote}
    />
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Preventivi</Text>
          <Text style={s.sub}>
            {quotes.length} preventiv{quotes.length === 1 ? "o" : "i"}
          </Text>
        </View>

        {/* Quota badge — limiti V34 da PlanContext */}
        <TouchableOpacity
          style={[s.quotaBadge, !canCreate && s.quotaBadgeWarn]}
          onPress={handleNewQuote}
          accessibilityRole="button"
          accessibilityLabel="Quota preventivi"
        >
          <Text style={[s.quotaText, !canCreate && s.quotaTextWarn]}>
            {quoteLimits?.used ?? 0}/{quoteLimits?.base ?? 3} 📝
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pulsante nuovo preventivo */}
      <TouchableOpacity
        style={s.newBtn}
        onPress={handleNewQuote}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Crea nuovo preventivo"
      >
        <Text style={s.newBtnText}>+ Nuovo Preventivo</Text>
      </TouchableOpacity>

      {/* V34: InAppContextualCard per context 'quotes_convert_hint'
          Mostrata sopra la lista, solo se card !== null (Req 6.10) */}
      {card !== null && (
        <View style={s.cardWrapper}>
          <InAppContextualCard
            card={card}
            onDismiss={dismissCard}
            onCTA={handleCardCTA}
          />
        </View>
      )}

      {/* Lista o skeleton */}
      {loading ? (
        <View style={s.skeletonContainer}>
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
        </View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6c63ff"
              colors={["#6c63ff"]}
              progressBackgroundColor="#111318"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/(app)/quotes/${item.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={s.row}>
                <Text style={s.num}>{item.number}</Text>
                <View
                  style={[
                    s.badge,
                    { backgroundColor: `${STATUS_COLORS[item.status] || "#6b7280"}20` },
                  ]}
                >
                  <Text
                    style={[
                      s.badgeT,
                      { color: STATUS_COLORS[item.status] || "#6b7280" },
                    ]}
                  >
                    {STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <Text style={s.client}>{item.clients?.name || "—"}</Text>
              <View style={s.row}>
                <Text style={s.date}>
                  {new Date(item.created_at).toLocaleDateString("it-IT")}
                </Text>
                <Text style={s.total}>{fmt(item.total, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* V34: BusinessBoostModal (Req 17.3, 9.11) */}
      <BusinessBoostModal
        visible={showBoostModal}
        resource={currentResource ?? "quote"}
        boostSession={boostSession}
        onUpgrade={handleUpgrade}
        onClose={handleBoostModalClose}
      />

      {/* V34: BoostSuccessModal — mostrato dopo boost completato con successo */}
      <BoostSuccessModal
        visible={showSuccessModal}
        resource={currentResource ?? "quote"}
        expiresIn={boostSession.boostExpiresIn ?? "24 ore"}
        onClose={() => setShowSuccessModal(false)}
      />
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#0a0b0f" },
  header: {
    flexDirection:    "row",
    justifyContent:   "space-between",
    alignItems:       "flex-start",
    paddingHorizontal: 20,
    marginBottom:     12,
  },
  title:       { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  sub:         { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  quotaBadge: {
    backgroundColor: "#1e2029",
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     "#2d2f3a",
  },
  quotaBadgeWarn: {
    borderColor:     "#ef444466",
    backgroundColor: "#ef444411",
  },
  quotaText:     { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  quotaTextWarn: { color: "#ef4444" },
  newBtn: {
    marginHorizontal: 20,
    marginBottom:     12,
    backgroundColor:  "#6c63ff",
    borderRadius:     14,
    paddingVertical:  14,
    alignItems:       "center",
  },
  newBtnText:       { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom:      10,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap:               10,
  },
  card: {
    backgroundColor: "#111318",
    borderRadius:    14,
    padding:         16,
    borderWidth:     1,
    borderColor:     "#1e2029",
    marginBottom:    10,
  },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  num:    { fontSize: 15, fontWeight: "700", color: "#f0f0f2" },
  badge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 11, fontWeight: "600" },
  client: { fontSize: 14, color: "#9ca3af", marginVertical: 6 },
  date:   { fontSize: 12, color: "#6b7280" },
  total:  { fontSize: 16, fontWeight: "700", color: "#6c63ff" },
});
