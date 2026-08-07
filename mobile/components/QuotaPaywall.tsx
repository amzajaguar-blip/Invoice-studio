/**
 * QuotaPaywall.tsx — Paywall quota documenti gratuiti
 *
 * Mostrato quando l'utente free ha esaurito i documenti gratuiti.
 * Offre due CTA:
 *  1. Passa a Premium (IAP via IAPPaywall)
 *  2. Guarda un video per +1 documento (Google Rewarded Ad + accredito server)
 *
 * VINCOLI DI SICUREZZA:
 *  - Il contatore quota NON viene mai incrementato lato client.
 *  - L'accredito parte SOLO dalla callback EARNED_REWARD (video completato),
 *    passa dall'Edge Function reward-document-credit e vale solo con
 *    risposta server { credited: true } (rate limit max 3/giorno per org).
 *  - onQuotaUpdated() viene chiamato solo dopo accredito confermato.
 *
 * Il ciclo di vita dell'ad (preload, timeout, show) vive in lib/reward-ad.ts.
 *
 * Requirements: 20.3, 20.7, 20.8, 25.3
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/components/LocaleProvider";
import { supabase } from "@/lib/supabase";
import { usePlan } from "@/context/PlanContext";
import {
  preloadDocumentsRewardAd,
  showDocumentsRewardAd,
} from "@/lib/reward-ad";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface QuotaPaywallProps {
  visible: boolean;
  /** Numero di documenti rimasti (0 quando arriva questo paywall) */
  remaining: number;
  /** Quota massima piano gratuito */
  limit: number;
  /** Called quando l'utente compra Premium o ottiene un documento reward */
  onQuotaUpdated: () => void;
  /** Called quando l'utente chiude senza agire */
  onDismiss: () => void;
  /** Called per aprire il paywall IAP Premium */
  onUpgradeToPremium: () => void;
}

/** Stato del rewarded ad precaricato, riflesso sul bottone "Guarda video". */
type RewardAdState = "idle" | "loading" | "ready" | "unavailable";

// ─── Componente ───────────────────────────────────────────────────────────────

export function QuotaPaywall({
  visible,
  remaining,
  limit,
  onQuotaUpdated,
  onDismiss,
  onUpgradeToPremium,
}: QuotaPaywallProps) {
  const { t } = useLocale();
  const { isPremium } = usePlan();

  const [adState, setAdState] = useState<RewardAdState>("idle");
  const [adPending, setAdPending] = useState(false);
  const [ssvPending, setSsvPending] = useState(false);

  // ── Preload rewarded ad all'apertura del paywall ─────────────────────────
  // Precarica mirata (non all'avvio app): evita richieste ad sprecate per
  // utenti che non raggiungono mai la quota. Se il preload fallisce (fill
  // rate basso, offline, timeout) il bottone passa allo stato "unavailable"
  // con hint inline — nessun crash, nessuna schermata vuota.
  useEffect(() => {
    if (!visible || isPremium) return;

    let cancelled = false;
    setAdState("loading");
    preloadDocumentsRewardAd().then((ready) => {
      if (!cancelled) {
        setAdState(ready ? "ready" : "unavailable");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible, isPremium]);

  // ── Gestione accredito via Supabase Edge Function ────────────────────────
  // Chiamata SOLO da EARNED_REWARD. Il client non riceve token SSV dall'SDK
  // (react-native-google-mobile-ads espone solo { type, amount } in
  // onUserEarnedReward — il campo ssv_token non è presente nel JS layer).
  // La protezione lato server è JWT Supabase + rate limit giornaliero
  // (max 3/giorno per org) enforced dalla RPC grant_reward_document.
  // Per SSV completo (verifica firma ECDSA da Google): la Edge Function
  // supporta già PATH A — basta configurare la callback URL in AdMob
  // dashboard che punta direttamente all'Edge Function.

  const handleRewardCredit = useCallback(async () => {
    setSsvPending(true);
    try {
      // Recupera user_id dalla sessione Supabase corrente (PATH B).
      let userId = "";
      try {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id ?? "";
      } catch {
        // Non bloccante — la Edge Function verifica comunque il JWT
      }

      const { data, error } = await supabase.functions.invoke(
        "reward-document-credit",
        {
          body: { user_id: userId },
        }
      );

      if (error || !data) {
        Alert.alert(
          t("quota.reward_failed"),
          "Verifica server non riuscita. Nessun documento è stato accreditato."
        );
        return;
      }

      // Rate limit giornaliero: il server risponde 200 con credited:false —
      // NON è un successo, la quota non è cambiata.
      if (data.credited === false) {
        Alert.alert(t("quota.reward_limit_reached"));
        return;
      }

      // Accredito confermato dal server — si invalida la cache e si ricarica
      // la quota.
      Alert.alert(t("quota.reward_success"));
      onQuotaUpdated();
    } catch (err) {
      console.error("[QuotaPaywall] reward credit error:", err);
      Alert.alert(t("quota.reward_failed"), "Errore di rete. Riprova più tardi.");
    } finally {
      setSsvPending(false);
    }
  }, [t, onQuotaUpdated]);

  // ── Avvia rewarded ad ─────────────────────────────────────────────────────

  const handleWatchAd = useCallback(async () => {
    if (adState !== "ready" || adPending || ssvPending) return;

    setAdPending(true);
    const shown = await showDocumentsRewardAd(() => {
      // EARNED_REWARD — unico punto in cui parte l'accredito. Mai al tap,
      // mai al LOADED, mai allo show.
      void handleRewardCredit();
    });
    setAdPending(false);

    if (!shown) {
      // Ad non più valido allo show (scaduto o errore): riprova il preload;
      // se fallisce di nuovo la UI passa allo stato "non disponibile".
      setAdState("loading");
      const ready = await preloadDocumentsRewardAd();
      setAdState(ready ? "ready" : "unavailable");
    }
  }, [adState, adPending, ssvPending, handleRewardCredit]);

  // Defense-in-depth: se l'utente è Premium, non mostrare mai il paywall
  // (il parent dovrebbe già impedirlo via checkQuota, ma questo garantisce
  // che nessun rewarded ad venga mostrato a utenti Pro per qualsiasi motivo).
  // NB: il gate sta DOPO tutti gli hook — un early return prima di useState/
  // useEffect violerebbe le Rules of Hooks e crasherebbe se isPremium
  // cambiasse a componente montato.
  if (isPremium) {
    return null;
  }

  const isAdBusy = adState === "loading" || adPending || ssvPending;
  const rewardDisabled = adState !== "ready" || adPending || ssvPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={s.backdrop}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
      />

      <View style={s.sheet}>
        <View style={s.handle} />

        {/* Icona */}
        <View style={s.iconContainer}>
          <Ionicons name="documents-outline" size={32} color="#6c63ff" />
        </View>

        {/* Titolo */}
        <Text style={s.title}>{t("quota.exhausted.title")}</Text>
        <Text style={s.subtitle}>
          {t("quota.remaining").replace("{n}", "0")}
        </Text>

        {/* CTA 1: Passa a Premium */}
        <TouchableOpacity
          style={s.premiumBtn}
          onPress={() => {
            onDismiss();
            onUpgradeToPremium();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("quota.exhausted.cta")}
        >
          <Ionicons name="star" size={18} color="#fff" />
          <Text style={s.premiumBtnText}>{t("quota.exhausted.cta")}</Text>
        </TouchableOpacity>

        {/* CTA 2: Guarda video per +1 documento */}
        <TouchableOpacity
          style={[s.rewardBtn, rewardDisabled && s.rewardBtnDisabled]}
          onPress={handleWatchAd}
          disabled={rewardDisabled}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t("quota.reward_cta")}
          accessibilityState={{ disabled: rewardDisabled, busy: isAdBusy }}
        >
          {isAdBusy ? (
            <>
              <ActivityIndicator size="small" color="#6c63ff" />
              <Text style={s.rewardBtnText}>
                {ssvPending ? t("quota.reward_pending") : "Caricamento…"}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={18} color="#6c63ff" />
              <Text style={s.rewardBtnText}>{t("quota.reward_cta")}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Fallback "ad non disponibile" — fill rate basso o offline */}
        {adState === "unavailable" && (
          <Text style={s.rewardHint}>{t("quota.reward_unavailable")}</Text>
        )}

        {/* Annulla */}
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
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
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#1e2029",
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2e3040",
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#6c63ff18",
    borderWidth: 1,
    borderColor: "#6c63ff30",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f0f2",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
  },
  premiumBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  premiumBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  rewardBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6c63ff14",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#6c63ff40",
    marginBottom: 12,
  },
  rewardBtnDisabled: {
    opacity: 0.6,
  },
  rewardBtnText: {
    color: "#6c63ff",
    fontSize: 15,
    fontWeight: "600",
  },
  rewardHint: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  cancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
});
