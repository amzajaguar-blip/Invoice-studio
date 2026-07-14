import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TouchableOpacity, Animated, AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import EditClientSheet from "@/app/(app)/clients/EditClientSheet";

// V34 — gate, modals, banner, contextual card
import { usePlan } from "@/context/PlanContext";
import { useBusinessBoost } from "@/hooks/useBusinessBoost";
import { trackEvent } from "@/lib/analytics-events";
import BusinessBoostModal from "@/components/BusinessBoostModal";
import BoostSuccessModal from "@/components/BoostSuccessModal";
import { BannerAdWrapper } from "@/components/BannerAdWrapper";
import InAppContextualCard from "@/components/InAppContextualCard";
import { useSmartCards } from "@/hooks/useSmartCards";
import { useEngagementContext } from "@/context/EngagementContext";

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  currency: string;
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // V34 — engagement context (Req 9.5)
  const { recordAction } = useEngagementContext();

  // Req 18.2: micro animation on "+" button when new client detected
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // Ref to track client count across focus events for recordAction (Req 9.5)
  const prevClientCountRef = useRef<number | null>(null);

  // V34 — plan gate
  const { checkCanCreate, isPremium, limits } = usePlan();
  const {
    boostSession,
    showBoostModal,
    openBoostModal,
    closeBoostModal,
    currentResource,
  } = useBusinessBoost();

  // BoostSuccessModal visible when boost just activated
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // V34 — contextual card: show only if customers_used >= 2 (Req 9.7, 6.7)
  const { card: contextCard, dismiss: dismissCard } = useSmartCards("customers_upsell");
  const customersUsed = limits.customers.used;
  const showContextCard = contextCard !== null && customersUsed >= 2;

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
    if (data) {
      const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
      setClients(list);
      prevClientCountRef.current = list.length;
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── V34: useFocusEffect — detect new clients on return (Req 9.5) ─────────
  /**
   * When the screen regains focus (user navigated back from add.tsx),
   * reload the list and compare count. If count increased, a new client
   * was successfully created → call recordAction('customer').
   *
   * Requirements: 9.5
   */
  useFocusEffect(
    useCallback(() => {
      // Skip on first mount — prevClientCountRef is set by the initial useEffect
      if (prevClientCountRef.current === null) return;

      const prevCount = prevClientCountRef.current;

      void (async () => {
        const { data } = await apiFetch<{ data: Client[] }>("/api/clients");
        if (!data) return;
        const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
        setClients(list);
        setLoading(false);

        // If the count increased, a new client was created
        if (list.length > prevCount) {
          prevClientCountRef.current = list.length;
          recordAction('customer').catch(() => {});

          // Req 18.2: scale pulse on "+" button — skip if reduceMotion
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
          prevClientCountRef.current = list.length;
        }
      })();
    }, [recordAction, reduceMotion, scaleAnim]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // V34 — gated "Aggiungi Cliente" handler (Req 9.3)
  const handleAddClient = useCallback(() => {
    const result = checkCanCreate("customer");

    if (result.allowed === false && !limits.isLoading) {
      // Track limit_reached event
      trackEvent({ event: "limit_reached", properties: { resource: "customer" } });
      // Open BusinessBoostModal instead of navigating (Req 9.3)
      openBoostModal("customer");
      return;
    }

    router.push("/(app)/clients/add");
  }, [checkCanCreate, limits.isLoading, openBoostModal, router]);

  // V34 — upgrade handler from BusinessBoostModal
  const handleUpgrade = useCallback(() => {
    closeBoostModal();
    router.push("/(app)/ProUpgrade" as never);
  }, [closeBoostModal, router]);

  // V34 — close BusinessBoostModal
  const handleCloseBoostModal = useCallback(() => {
    closeBoostModal();
  }, [closeBoostModal]);

  // V34 — contextual card CTA: open boost modal
  const handleCardCTA = useCallback(() => {
    openBoostModal("customer");
  }, [openBoostModal]);

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.headerRow}>
          <Text style={s.title}>{t("tabs.clients.title")}</Text>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={s.addButton}
              onPress={handleAddClient}
              accessibilityRole="button"
              accessibilityLabel={t("tabs.clients.add.a11y")}
            >
              <Text style={s.addButtonText}>+</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
          <SkeletonCard lines={2} height={80} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.headerRow}>
        <Text style={s.title}>{t("tabs.clients.title")}</Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={s.addButton}
            onPress={handleAddClient}
            accessibilityRole="button"
            accessibilityLabel={t("tabs.clients.add.a11y")}
          >
            <Text style={s.addButtonText}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={s.sub}>{t("tabs.clients.sub_count").replace("{n}", String(clients.length)).replace("{e|i}", clients.length === 1 ? "e" : "i")}</Text>

      {/* V34 — InAppContextualCard for customers_upsell (Req 9.7, 6.7) */}
      {showContextCard && contextCard && (
        <View style={s.contextCardWrapper}>
          <InAppContextualCard
            card={contextCard}
            onDismiss={dismissCard}
            onCTA={handleCardCTA}
          />
        </View>
      )}

      <FlatList
        data={clients}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
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
            onPress={() => router.push({
              pathname: "/(app)/clients/[id]" as any,
              params: { id: item.id },
            })}
            onLongPress={() => setSelectedClient(item)}
            delayLongPress={400}
          >
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.currency}>{item.currency}</Text>
            </View>
            <Text style={s.email}>{item.email}</Text>
            {item.vat_number && <Text style={s.vat}>P.IVA: {item.vat_number}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          /* V34 — Smart Empty State (Req 17.1, 20.1) */
          <EmptyState
            icon="people-outline"
            title={t("tabs.clients.empty.title")}
            hint={t("tabs.clients.empty.hint")}
            cta={t("tabs.clients.empty.cta")}
            onCTA={handleAddClient}
          />
        }
        ListFooterComponent={
          /* V34 — BannerAdWrapper at the bottom of the list, only if !isPremium (Req 9.7, 4.1) */
          !isPremium ? <BannerAdWrapper screen="customers" /> : null
        }
      />

      <EditClientSheet
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onSaved={(updated) => {
          setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedClient(null);
        }}
      />

      {/* V34 — BusinessBoostModal (Req 9.3, 9.11) */}
      <BusinessBoostModal
        visible={showBoostModal}
        resource={currentResource ?? "customer"}
        boostSession={boostSession}
        onUpgrade={handleUpgrade}
        onClose={handleCloseBoostModal}
      />

      {/* V34 — BoostSuccessModal (Req 18.3) */}
      <BoostSuccessModal
        visible={showSuccessModal}
        resource={currentResource ?? "customer"}
        expiresIn={boostSession.boostExpiresIn ?? "24 ore"}
        onClose={() => setShowSuccessModal(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  addButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: "#ffffff", fontSize: 20, lineHeight: 22 },
  sub: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 16, paddingHorizontal: 20 },
  contextCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: { backgroundColor: "#111318", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e2029", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#f0f0f2" },
  currency: { fontSize: 12, color: "#6c63ff", fontWeight: "600", backgroundColor: "#6c63ff15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  email: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  vat: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
