/**
 * quotes.tsx — Schermata preventivi
 *
 * Funzionalità:
 * - Lista preventivi dell'organizzazione corrente da Supabase via apiFetch
 * - Filtri per stato: all | draft | sent | accepted | rejected | invoiced
 * - Empty state specifico ("Crea il tuo primo preventivo")
 * - Header con contatore mensile per utenti free: "X/3 preventivi questo mese"
 * - CTA "+ Nuovo preventivo" con gate freemium: se l'utente free ha già 3
 *   preventivi nel mese corrente, mostra Alert invece di navigare
 * - Ogni riga mostra: numero preventivo, nome cliente (da client_snapshot.name),
 *   stato badge, totale, data
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
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "@/lib/ai";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import { usePlan } from "@/context/PlanContext";
import { useLocale } from "@/components/LocaleProvider";
import { useEngagementContext } from "@/context/EngagementContext";
import * as Haptics from "@/lib/haptics";

// ─── Costanti ─────────────────────────────────────────────────────────────────

/** Limite mensile preventivi per utenti free */
const FREE_MONTHLY_QUOTE_LIMIT = 3;

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "invoiced";
type FilterStatus = QuoteStatus | "all";

interface ClientSnapshot {
  id?: string;
  name: string;
  email?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  /** Alias restituito dall'API (potrebbe essere number o quote_number) */
  number?: string;
  status: QuoteStatus;
  total: number;
  currency: string;
  created_at: string;
  /** Snapshot cliente copiato al momento della creazione */
  client_snapshot?: ClientSnapshot;
  /** Legacy: alcune versioni API restituiscono ancora questo campo */
  clients?: { id?: string; name: string; email?: string };
}

// ─── Colori e label per stato ─────────────────────────────────────────────────

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft:    "#6b7280",
  sent:     "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  invoiced: "#a855f7",
};

// ─── Helper: nome cliente con fallback ───────────────────────────────────────

function getClientName(quote: Quote): string {
  return (
    quote.client_snapshot?.name ||
    quote.clients?.name ||
    "—"
  );
}

// ─── Helper: numero preventivo con fallback ──────────────────────────────────

function getQuoteNumber(quote: Quote): string {
  return quote.quote_number || quote.number || "—";
}

// ─── Filtro locale ────────────────────────────────────────────────────────────

function filterQuotes(quotes: Quote[], status: FilterStatus): Quote[] {
  if (status === "all") return quotes;
  return quotes.filter((q) => q.status === status);
}

// ─── Contatore mensile locale ─────────────────────────────────────────────────

function countCurrentMonthQuotes(quotes: Quote[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return quotes.filter(
    (q) => new Date(q.created_at).getTime() >= monthStart
  ).length;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  // ─── Translated status labels ────────────────────────────────────────────
  const STATUS_LABELS: Record<QuoteStatus, string> = {
    draft:    t("draft_quote"),
    sent:     t("sent_quote"),
    accepted: t("accepted"),
    rejected: t("rejected"),
    invoiced: t("invoiced"),
  };

  const FILTER_LABELS: Record<FilterStatus, string> = {
    all:      t("filter.pill.all"),
    draft:    t("filter.pill.draft"),
    sent:     t("filter.pill.sent"),
    accepted: t("accepted"),
    rejected: t("rejected"),
    invoiced: t("invoiced"),
  };

  // ─── Data state ─────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  // ─── Plan context ─────────────────────────────────────────────────────────
  const { isPremium } = usePlan();

  // ─── Engagement context ──────────────────────────────────────────────────
  const { recordAction } = useEngagementContext();

  // ─── Ref per rilevare nuovi preventivi al focus ──────────────────────────
  const prevQuoteCountRef = useRef<number | null>(null);

  // ─── Contatore mensile ────────────────────────────────────────────────────
  const monthlyCount = countCurrentMonthQuotes(quotes);
  const monthlyLimitReached = !isPremium && monthlyCount >= FREE_MONTHLY_QUOTE_LIMIT;

  // ─── Data loading ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<{ data: Quote[] }>("/api/documents?limit=100");
      if (data) {
        const list = Array.isArray(data)
          ? data
          : (data as { data: Quote[] }).data || [];
        setQuotes(list);
        return list.length;
      }
    } catch {
      // Non fatale — mostra lista vuota
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

  // ─── useFocusEffect — rileva nuovi preventivi al ritorno ─────────────────
  useFocusEffect(
    useCallback(() => {
      if (prevQuoteCountRef.current === null) return;

      const prevCount = prevQuoteCountRef.current;

      void (async () => {
        try {
          const { data } = await apiFetch<{ data: Quote[] }>("/api/documents?limit=100");
          if (!data) return;
          const list = Array.isArray(data)
            ? data
            : (data as { data: Quote[] }).data || [];
          setQuotes(list);
          setLoading(false);

          if (list.length > prevCount) {
            prevQuoteCountRef.current = list.length;
            await recordAction("invoice");
          } else {
            prevQuoteCountRef.current = list.length;
          }
        } catch {
          setLoading(false);
        }
      })();
    }, [recordAction]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const count = await load();
    if (count !== null) prevQuoteCountRef.current = count;
    setRefreshing(false);
  }, [load]);

  const fmt = (n: number, c = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

  // ─── Handler pill filtro ──────────────────────────────────────────────────
  const handleFilterChange = useCallback(async (status: FilterStatus) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(status);
  }, []);

  // ─── Handler CTA "Nuovo preventivo" ──────────────────────────────────────
  /**
   * Se l'utente è free e ha già raggiunto il limite di 3 preventivi mensili,
   * mostra un Alert invece di navigare.
   * Se premium (o sotto limite) → naviga a quotes/new.
   */
  const handleNewQuote = useCallback(() => {
    if (monthlyLimitReached) {
      Alert.alert(
        "Limite mensile raggiunto",
        "Hai già creato 3 preventivi questo mese. Passa a Premium per preventivi illimitati.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Passa a Premium",
            onPress: () => router.push("/(app)/ProUpgrade" as never),
          },
        ]
      );
      return;
    }

    router.push("/(app)/invoices/new?document_type=custom" as never);
  }, [monthlyLimitReached, router]);

  // ─── Liste filtrate ───────────────────────────────────────────────────────
  const filteredQuotes = filterQuotes(quotes, activeFilter);

  // ─── Empty state ──────────────────────────────────────────────────────────
  const renderEmpty = () => {
    if (activeFilter !== "all") {
      return (
        <EmptyState
          icon="document-text-outline"
          title="Nessuna bozza"
          hint={`Nessuna bozza con stato "${FILTER_LABELS[activeFilter]}".`}
        />
      );
    }
    return (
      <EmptyState
        icon="document-text-outline"
        title="Crea la tua prima bozza"
        hint="Converti facilmente le bozze in documenti."
        cta="+ Nuova bozza"
        onCTA={handleNewQuote}
      />
    );
  };

  // ─── Pill filtri ──────────────────────────────────────────────────────────
  const FILTER_PILLS: FilterStatus[] = ["all", "draft", "sent", "accepted", "rejected", "invoiced"];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>{t("quotes")}</Text>
          <Text style={s.sub}>
            {t("tabs.quotes.sub_count")
              .replace("{n}", String(quotes.length))
              .replace("{o|i}", quotes.length === 1 ? "o" : "i")}
          </Text>
        </View>

        {/* Contatore mensile — visibile solo per utenti free */}
        {!isPremium && (
          <View
            style={[
              s.monthlyBadge,
              monthlyLimitReached && s.monthlyBadgeWarn,
            ]}
            accessibilityRole="text"
            accessibilityLabel={`${monthlyCount} su 3 preventivi questo mese`}
          >
            <Text
              style={[
                s.monthlyText,
                monthlyLimitReached && s.monthlyTextWarn,
              ]}
            >
              {monthlyCount}/{FREE_MONTHLY_QUOTE_LIMIT} questo mese
            </Text>
          </View>
        )}
      </View>

      {/* Pulsante nuovo preventivo */}
      <TouchableOpacity
        style={[s.newBtn, monthlyLimitReached && s.newBtnDisabled]}
        onPress={handleNewQuote}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("tabs.quotes.new.a11y")}
      >
        <Text style={s.newBtnText}>+ Nuova bozza</Text>
      </TouchableOpacity>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterContainer}
      >
        {FILTER_PILLS.map((key) => {
          const isActive = key === activeFilter;
          return (
            <TouchableOpacity
              key={key}
              style={[s.pill, isActive ? s.pillActive : s.pillInactive]}
              onPress={() => handleFilterChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filtra per ${FILTER_LABELS[key]}`}
            >
              <Text
                style={[
                  s.pillText,
                  isActive ? s.pillTextActive : s.pillTextInactive,
                ]}
              >
                {FILTER_LABELS[key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista o skeleton */}
      {loading ? (
        <View style={s.skeletonContainer}>
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
          <SkeletonCard lines={2} height={88} />
        </View>
      ) : (
        <FlatList
          data={filteredQuotes}
          keyExtractor={(item) => item.id}
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
              accessibilityRole="button"
              accessibilityLabel={`Bozza ${getQuoteNumber(item)}, cliente ${getClientName(item)}, stato ${STATUS_LABELS[item.status] || item.status}, totale ${fmt(item.total, item.currency)}`}
            >
              {/* Riga 1: numero preventivo + badge stato */}
              <View style={s.row}>
                <Text style={s.num}>{getQuoteNumber(item)}</Text>
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: `${STATUS_COLORS[item.status] || "#6b7280"}20`,
                    },
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

              {/* Riga 2: nome cliente (da client_snapshot.name) */}
              <Text style={s.client}>{getClientName(item)}</Text>

              {/* Riga 3: data + totale */}
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
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#0a0b0f" },

  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    paddingHorizontal: 20,
    marginBottom:      12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  title:  { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  sub:    { fontSize: 14, color: "#9ca3af", marginTop: 4 },

  // Badge contatore mensile
  monthlyBadge: {
    backgroundColor:  "#1e2029",
    borderRadius:     10,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderWidth:      1,
    borderColor:      "#2d2f3a",
    alignSelf:        "flex-start",
  },
  monthlyBadgeWarn: {
    borderColor:      "#ef444466",
    backgroundColor:  "#ef444411",
  },
  monthlyText:     { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  monthlyTextWarn: { color: "#ef4444" },

  // Pulsante CTA
  newBtn: {
    marginHorizontal: 20,
    marginBottom:     12,
    backgroundColor:  "#6c63ff",
    borderRadius:     14,
    paddingVertical:  14,
    alignItems:       "center",
  },
  newBtnDisabled: {
    backgroundColor: "#3d3a6b",
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Filter pills
  filterScroll:    { flexGrow: 0, marginBottom: 12 },
  filterContainer: { paddingHorizontal: 16, alignItems: "center" },
  pill: {
    borderRadius:     20,
    paddingHorizontal: 14,
    paddingVertical:   7,
    marginRight:       8,
    borderWidth:       1,
  },
  pillActive:       { backgroundColor: "#6c63ff", borderColor: "#6c63ff" },
  pillInactive:     { backgroundColor: "#111318", borderColor: "#1e2029" },
  pillText:         { fontSize: 13, fontWeight: "400" },
  pillTextActive:   { color: "#ffffff", fontWeight: "600" },
  pillTextInactive: { color: "#9ca3af" },

  // Skeleton
  skeletonContainer: { paddingHorizontal: 20, gap: 10 },

  // Card preventivo
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
