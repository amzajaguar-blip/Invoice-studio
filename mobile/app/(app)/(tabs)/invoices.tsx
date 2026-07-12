/**
 * invoices.tsx — Schermata fatture con gate V34
 *
 * Integra il Rate Limit Gate (Req 9.1, 9.2), Business Boost Modal (Req 9.11),
 * InApp Contextual Card (Req 6.4), e Smart Empty State (Req 17.2, 20.1, 20.2).
 *
 * Requirements: 9.1, 9.2, 9.11, 17.2, 20.1, 20.2
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity, Animated, AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/ai";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useInvoiceFilters } from "@/hooks/useInvoiceFilters";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
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

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  clients?: { id?: string; name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", sent: "#3b82f6",
  paid: "#22c55e", overdue: "#ef4444", cancelled: "#9ca3af",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviata",
  paid: "Pagata", overdue: "Scaduta", cancelled: "Annullata",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InvoicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ─── Data state ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── V34: Engagement context (Req 9.4) ──────────────────────────────────
  const { recordAction } = useEngagementContext();

  // ─── Req 18.1: micro animation on "Nuova Fattura" button ─────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

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

  // ─── V34: InApp contextual card ──────────────────────────────────────────
  const { card, dismiss: dismissCard } = useSmartCards("invoices_boost_available");

  // ─── Data loading ────────────────────────────────────────────────────────
  const { filters, setFilters, filtered } = useInvoiceFilters(invoices);

  // Ref to track invoice count across focus events for recordAction (Req 9.4)
  const prevInvoiceCountRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Invoice[] }>("/api/invoices?limit=50");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Invoice[] }).data || [];
      setInvoices(list);
      return list.length;
    }
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    load().then((count) => {
      if (count !== null) {
        prevInvoiceCountRef.current = count;
        setLoading(false);
      }
    });
  }, [load]);

  // ─── V34: useFocusEffect — detect new invoices on return (Req 9.4) ───────
  /**
   * When the screen regains focus (user navigated back from new.tsx),
   * reload the list and compare count. If count increased, a new invoice
   * was successfully created → call recordAction('invoice').
   *
   * Requirements: 9.4
   */
  useFocusEffect(
    useCallback(() => {
      // Skip on first mount — prevInvoiceCountRef is set by the initial useEffect
      if (prevInvoiceCountRef.current === null) return;

      const prevCount = prevInvoiceCountRef.current;

      void (async () => {
        const { data } = await apiFetch<{ data: Invoice[] }>("/api/invoices?limit=50");
        if (!data) return;
        const list = Array.isArray(data) ? data : (data as { data: Invoice[] }).data || [];
        setInvoices(list);
        setLoading(false);

        // If the count increased, a new invoice was created
        if (list.length > prevCount) {
          prevInvoiceCountRef.current = list.length;
          await recordAction('invoice');

          // Req 18.1: scale pulse on "Nuova Fattura" button — skip if reduceMotion
          if (!reduceMotion) {
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.04,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        } else {
          prevInvoiceCountRef.current = list.length;
        }
      })();
    }, [recordAction, reduceMotion, scaleAnim]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const count = await load();
    if (count !== null) prevInvoiceCountRef.current = count;
    setRefreshing(false);
  }, [load]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  // ─── V34 Gate: handler creazione fattura (Req 9.1, 9.2) ──────────────────
  /**
   * Prima di navigare alla schermata di creazione:
   *  1. Chiama checkCanCreate('invoice')
   *  2. Se allowed === false e isLoading === false → traccia limit_reached,
   *     apre BusinessBoostModal (NON naviga)
   *  3. Se allowed === true → naviga normalmente
   *
   * Requirements: 9.1, 9.2
   */
  const handleNewInvoice = useCallback(() => {
    const result = checkCanCreate("invoice");

    if (!result.allowed && !limits.isLoading) {
      // Req 9.2: traccia limit_reached con { resource: 'invoice' }
      trackEvent({ event: "limit_reached", properties: { resource: "invoice" } });
      // Req 9.1: apri BusinessBoostModal invece di navigare
      openBoostModal("invoice");
      return;
    }

    // Naviga alla schermata di creazione — recordAction('invoice') viene
    // chiamato automaticamente al ritorno da useFocusEffect (Req 9.4)
    router.push("/(app)/invoices/new");
  }, [checkCanCreate, limits.isLoading, openBoostModal, router]);

  // ─── Handler per chiusura BusinessBoostModal con successo boost ───────────
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
    // La card 'invoices_boost_available' ha ctaAction === 'show_boost'
    openBoostModal("invoice");
  }, [openBoostModal]);

  // ─── Smart Empty State (Req 17.2, 20.1, 20.2) ────────────────────────────
  /**
   * Req 17.2: icona 📄, titolo "Crea la tua prima fattura professionale.",
   * hint "VELA ti guida passo per passo.", CTA "Crea fattura"
   * Req 20.1: CTA presente e chiaramente visibile
   * Req 20.2: no dark pattern, testo onesto
   */
  const renderEmpty = () => {
    if (filters.query) {
      return (
        <EmptyState
          icon="search-outline"
          title="Nessun risultato"
          hint={`Nessuna fattura trovata per "${filters.query}"`}
        />
      );
    }
    if (filters.status === "overdue") {
      return (
        <EmptyState
          icon="checkmark-circle-outline"
          title="Nessuna fattura scaduta"
          hint="Ottimo lavoro! Tutti i pagamenti sono in ordine."
        />
      );
    }
    if (filters.status === "paid") {
      return (
        <EmptyState
          icon="cash-outline"
          title="Ancora nessun incasso"
          hint="Invia le tue fatture per iniziare a ricevere pagamenti."
        />
      );
    }
    if (filters.status === "draft") {
      return (
        <EmptyState
          icon="document-text-outline"
          title="Nessuna bozza"
          hint="Le fatture salvate come bozza appariranno qui."
        />
      );
    }
    // Smart Empty State V34 (Req 17.2)
    return (
      <EmptyState
        icon="document-text-outline"
        title="Crea la tua prima fattura professionale."
        hint="VELA ti guida passo per passo."
        cta="Crea fattura"
        onCTA={handleNewInvoice}
      />
    );
  };

  // ─── Header quota info (usa i nuovi limiti da PlanContext) ────────────────
  const invoiceLimits = limits.invoices;
  const canCreate = invoiceLimits?.canCreate ?? true;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Fatture</Text>
          <Text style={s.sub}>
            {invoices.length} fattur{invoices.length === 1 ? "a" : "e"}
          </Text>
        </View>

        {/* Quota badge — ora usa i limiti V34 da PlanContext */}
        <TouchableOpacity
          style={[s.quotaBadge, !canCreate && s.quotaBadgeWarn]}
          onPress={handleNewInvoice}
          accessibilityRole="button"
          accessibilityLabel="Quota fatture"
        >
          <Text style={[s.quotaText, !canCreate && s.quotaTextWarn]}>
            {invoiceLimits?.used ?? 0}/{invoiceLimits?.base ?? 5} 📄
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pulsante nuova fattura */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity style={s.newBtn} onPress={handleNewInvoice} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ Nuova Fattura</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* SearchBar */}
      <View style={s.searchWrapper}>
        <SearchBar
          value={filters.query}
          onChangeText={(text) => setFilters((p) => ({ ...p, query: text }))}
          onClear={() => setFilters((p) => ({ ...p, query: "" }))}
        />
      </View>

      {/* FilterBar */}
      <View style={s.filterWrapper}>
        <FilterBar
          activeStatus={filters.status}
          onStatusChange={(status) => setFilters((p) => ({ ...p, status }))}
        />
      </View>

      {/* V34: InAppContextualCard per context 'invoices_boost_available'
          Mostrata sopra la lista, solo se card !== null (Req 6.4) */}
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
          data={filtered}
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
              onPress={() => router.push(`/(app)/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={s.row}>
                <Text style={s.num}>{item.number}</Text>
                <View style={[s.badge, { backgroundColor: `${STATUS_COLORS[item.status] || "#6b7280"}20` }]}>
                  <Text style={[s.badgeT, { color: STATUS_COLORS[item.status] || "#6b7280" }]}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <Text style={s.client}>{item.clients?.name || "—"}</Text>
              <View style={s.row}>
                <Text style={s.date}>{new Date(item.created_at).toLocaleDateString("it-IT")}</Text>
                <Text style={s.total}>{fmt(item.total, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* V34: BannerAdWrapper — invoices non è nella lista allowed delle schermate
          banner ('dashboard' | 'customers' | 'settings' | 'reports'), quindi
          BannerAdWrapper renderebbe null automaticamente. Non aggiungere banner
          su questa schermata. */}

      {/* V34: BusinessBoostModal (Req 9.1, 9.11) */}
      <BusinessBoostModal
        visible={showBoostModal}
        resource={currentResource ?? "invoice"}
        boostSession={boostSession}
        onUpgrade={handleUpgrade}
        onClose={handleBoostModalClose}
      />

      {/* V34: BoostSuccessModal — mostrato dopo boost completato con successo */}
      <BoostSuccessModal
        visible={showSuccessModal}
        resource={currentResource ?? "invoice"}
        expiresIn={boostSession.boostExpiresIn ?? "24 ore"}
        onClose={() => setShowSuccessModal(false)}
      />
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  quotaBadge: {
    backgroundColor: "#1e2029",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2d2f3a",
  },
  quotaBadgeWarn: {
    borderColor: "#ef444466",
    backgroundColor: "#ef444411",
  },
  quotaText: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  quotaTextWarn: { color: "#ef4444" },
  newBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  // V34: wrapper per la InAppContextualCard sopra la lista
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    backgroundColor: "#111318",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  num: { fontSize: 15, fontWeight: "700", color: "#f0f0f2" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 11, fontWeight: "600" },
  client: { fontSize: 14, color: "#9ca3af", marginVertical: 6 },
  date: { fontSize: 12, color: "#6b7280" },
  total: { fontSize: 16, fontWeight: "700", color: "#6c63ff" },
});
