/**
 * BusinessBoostModal.tsx — Modal Business Boost V34
 *
 * Appare quando l'utente raggiunge il limite di una risorsa (fatture, clienti,
 * preventivi) e offre due percorsi:
 *  - Guarda video rewarded (30s) → Business Boost attivo 24h
 *  - Upgrade a Premium → fatture/clienti/preventivi illimitati
 *
 * Pattern animato slide-up + fadeAnim overlay riusato da InvoiceLimitModal.tsx.
 * Revenue Ethics: nessun countdown timer, nessun dark pattern (Req 20.3).
 *
 * Requirements: 2.9, 2.10, 2.11, 2.12, 9.11, 15.5, 18.3, 20.3, 20.4, 20.5, 8.7
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trackEvent } from '@/lib/analytics-events';
import type { BoostSession } from '@/lib/business-boost';
import type { ResourceType } from '@/lib/rate-limit-engine';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BusinessBoostModalProps {
  visible:      boolean;
  resource:     ResourceType;
  boostSession: BoostSession;
  onUpgrade:    () => void;
  onClose:      () => void;
}

// ─── Testo dinamico per risorsa ────────────────────────────────────────────────

const RESOURCE_COPY: Record<ResourceType, {
  title:      string;
  subtitle:   string;
  boostLabel: string;
  icon:       string;
}> = {
  invoice: {
    title:      'Hai bisogno di altre fatture?',
    subtitle:   'Guarda un breve video per sbloccare 3 fatture extra oggi.',
    boostLabel: '+3 fatture per 24 ore',
    icon:       '📄',
  },
  customer: {
    title:      'Stai crescendo — aggiungi altri clienti',
    subtitle:   'Guarda un breve video per espandere il tuo portfolio clienti.',
    boostLabel: '+1 cliente per 24 ore',
    icon:       '👥',
  },
  quote: {
    title:      'Hai bisogno di altri preventivi?',
    subtitle:   'Guarda un breve video per inviare altri preventivi oggi.',
    boostLabel: '+1 preventivo per 24 ore',
    icon:       '📝',
  },
};

// ─── Componente ───────────────────────────────────────────────────────────────

const { height } = Dimensions.get('window');

export default function BusinessBoostModal({
  visible,
  resource,
  boostSession,
  onUpgrade,
  onClose,
}: BusinessBoostModalProps) {
  const router = useRouter();

  const { state, errorMsg, showAd, dailyAdsLeft } = boostSession;

  // ─── Animazioni ────────────────────────────────────────────────────────
  const slideAnim  = useRef(new Animated.Value(height)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Rileva preferenza accessibilità (Req 18.3)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Animazione entrata/uscita — pattern identico a InvoiceLimitModal
  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        slideAnim.setValue(0);
        fadeAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 180,
            mass: 1,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      const dur = reduceMotion ? 0 : 250;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: reduceMotion ? 0 : 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, reduceMotion, slideAnim, fadeAnim]);

  // ─── Analytics: traccia boost_modal_shown al mount (Req 8.7) ──────────
  const hasTrackedMount = useRef(false);
  useEffect(() => {
    if (visible && !hasTrackedMount.current) {
      hasTrackedMount.current = true;
      trackEvent({ event: 'boost_modal_shown', properties: { resource } });
    }
    if (!visible) {
      hasTrackedMount.current = false;
    }
  }, [visible, resource]);

  // ─── Chiusura: traccia boost_modal_dismissed se senza reward ──────────
  const handleClose = () => {
    trackEvent({ event: 'boost_modal_dismissed', properties: { resource } });
    onClose();
  };

  // ─── Upgrade: traccia premium_clicked (Req 8.7) ────────────────────────
  const handleUpgrade = () => {
    trackEvent({ event: 'premium_clicked', properties: { source: 'boost_modal', resource } });
    onUpgrade();
  };

  // ─── Naviga a PremiumPreview (Req 15.5) ──────────────────────────────
  const handleViewPremiumFeatures = () => {
    trackEvent({ event: 'premium_clicked', properties: { source: 'boost_modal_preview_link', resource } });
    router.push('/(app)/PremiumPreview' as never);
  };

  const copy = RESOURCE_COPY[resource];

  // ─── Determina il contenuto del Primary CTA ────────────────────────────
  // Regola (Req 2.11, 2.12):
  //   - Se state === 'unavailable' → testo "Video non disponibile"
  //   - Se dailyAdsLeft === 0      → non mostrare il boost CTA, mostrare solo upgrade
  //   - Se state === 'error'       → mostrare "Riprova"
  //   - Se state === 'loading'     → spinner
  //   - Altrimenti                 → CTA principale "Guarda video — Business Boost"
  const showBoostCTA = state !== 'unavailable' && dailyAdsLeft > 0;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      accessibilityViewIsModal
      accessibilityLabel={`${copy.title}. Guarda un video gratis o passa a Premium.`}
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        {/* Tap overlay per chiudere */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityLabel="Chiudi"
        />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Icona risorsa */}
          <View style={s.iconWrap}>
            <Text
              style={s.icon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {copy.icon}
            </Text>
            <View style={s.badgeWrap}>
              <Text
                style={s.badgeIcon}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                🔒
              </Text>
            </View>
          </View>

          {/* Titolo + sottotitolo dinamici */}
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.subtitle}>{copy.subtitle}</Text>

          <View style={s.divider} />

          {/* ── Primary CTA: Business Boost ────────────────────────────── */}
          {showBoostCTA && (
            <BoostCTA
              state={state}
              errorMsg={errorMsg}
              boostLabel={copy.boostLabel}
              onShowAd={showAd}
            />
          )}

          {/* ── Se video non disponibile (state === 'unavailable') ──────── */}
          {state === 'unavailable' && (
            <View style={s.unavailableBox}>
              <Text style={s.unavailableText}>📵 Video non disponibile</Text>
              <Text style={s.unavailableHint}>
                Hai guardato tutti i video disponibili oggi.
              </Text>
            </View>
          )}

          {/* ── Secondary CTA: Upgrade a Premium ───────────────────────── */}
          <TouchableOpacity
            style={s.upgradeBtn}
            onPress={handleUpgrade}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Upgrade a Premium. Fatture, clienti e preventivi illimitati, niente pubblicità."
            accessibilityHint="Apre la pagina di abbonamento Premium"
          >
            <Text
              style={s.upgradeBtnIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              🚀
            </Text>
            <View style={s.upgradeBtnText}>
              <Text style={s.upgradeBtnTitle}>Upgrade a Premium</Text>
              <View style={s.upgradeFeatureList}>
                <FeatureRow label="Fatture, clienti e preventivi illimitati" />
                <FeatureRow label="Nessuna pubblicità" />
                <FeatureRow label="Supporto prioritario" />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Link: Vedi tutte le funzioni Premium (Req 15.5) ─────────── */}
          <TouchableOpacity
            onPress={handleViewPremiumFeatures}
            style={s.premiumLink}
            accessibilityRole="link"
            accessibilityLabel="Vedi tutte le funzioni Premium"
          >
            <Text style={s.premiumLinkText}>Vedi tutte le funzioni Premium →</Text>
          </TouchableOpacity>

          {/* ── Chiudi (conseguenza trasparente, no dark pattern) ────────── */}
          <TouchableOpacity
            onPress={handleClose}
            style={s.closeLink}
            accessibilityRole="button"
            accessibilityLabel="Chiudi senza attivare il boost"
          >
            <Text style={s.closeLinkText}>Chiudi</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Sotto-componente: BoostCTA ───────────────────────────────────────────────

interface BoostCTAProps {
  state:      BoostSession['state'];
  errorMsg:   string | null;
  boostLabel: string;
  onShowAd:   () => void;
}

function BoostCTA({ state, errorMsg, boostLabel, onShowAd }: BoostCTAProps) {
  const isLoading  = state === 'loading';
  const isError    = state === 'error';
  const isReady    = state === 'ready';
  const isShowing  = state === 'showing';
  const isDisabled = isLoading || isShowing;

  if (isError) {
    // Stato errore: mostra "Riprova" (Req 2.12)
    return (
      <View style={s.boostErrorBox}>
        <Text style={s.boostErrorText}>
          {errorMsg ?? 'Errore caricamento video.'}
        </Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={onShowAd}
          accessibilityRole="button"
          accessibilityLabel="Riprova a caricare il video"
        >
          <Text style={s.retryBtnText}>🔄 Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[s.boostBtn, isDisabled && s.btnDisabled]}
      onPress={onShowAd}
      disabled={isDisabled || !isReady}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={
        isLoading
          ? 'Caricamento video in corso…'
          : isShowing
            ? 'Video in riproduzione…'
            : `Guarda video per sbloccare ${boostLabel}`
      }
      accessibilityState={{ disabled: isDisabled }}
    >
      <View style={s.boostBtnContent}>
        <View style={s.boostBtnLeft}>
          <Text
            style={s.boostBtnIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            🎬
          </Text>
          <View>
            <Text style={s.boostBtnTitle}>Guarda video — Business Boost</Text>
            <Text style={s.boostBtnSub}>{boostLabel}</Text>
          </View>
        </View>

        {/* Badge destra: stato del caricamento */}
        {isLoading || isShowing ? (
          <ActivityIndicator size="small" color="#6c63ff" />
        ) : isReady ? (
          <View style={s.boostReadyBadge}>
            <Text style={s.boostReadyBadgeText}>GRATIS</Text>
          </View>
        ) : (
          <View style={s.boostUnavailableBadge}>
            <Text style={s.boostUnavailableBadgeText}>...</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Sotto-componente: FeatureRow ─────────────────────────────────────────────

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={s.featureRow}>
      <Text style={s.featureCheck}>✓</Text>
      <Text style={s.featureItem}>{label}</Text>
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1e2029',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2d2f3a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // ── Icona ─────────────────────────────────────────────────────────────
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  icon: { fontSize: 52 },
  badgeWrap: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: '#1e2029',
    borderRadius: 12,
    padding: 2,
  },
  badgeIcon: { fontSize: 18 },

  // ── Titolo / sottotitolo ──────────────────────────────────────────────
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0f0f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e2029',
    marginBottom: 16,
  },

  // ── Boost CTA (primary) ───────────────────────────────────────────────
  boostBtn: {
    backgroundColor: '#1a1030',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6c63ff33',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  boostBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boostBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  boostBtnIcon: { fontSize: 28 },
  boostBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f0f2',
    marginBottom: 2,
  },
  boostBtnSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  boostReadyBadge: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c63ff',
  },
  boostReadyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c63ff',
    letterSpacing: 0.5,
  },
  boostUnavailableBadge: {
    backgroundColor: '#1e2029',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  boostUnavailableBadgeText: {
    fontSize: 11,
    color: '#6b7280',
  },

  // ── Boost error box ───────────────────────────────────────────────────
  boostErrorBox: {
    backgroundColor: '#2a1010',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ef444433',
    marginBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  boostErrorText: {
    fontSize: 13,
    color: '#fca5a5',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#6c63ff44',
  },
  retryBtnText: {
    fontSize: 13,
    color: '#6c63ff',
    fontWeight: '600',
  },

  // ── Unavailable box ───────────────────────────────────────────────────
  unavailableBox: {
    backgroundColor: '#1e2029',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    gap: 4,
  },
  unavailableText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  unavailableHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },

  // ── Upgrade CTA (secondary) ───────────────────────────────────────────
  upgradeBtn: {
    backgroundColor: '#f59e0b18',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b55',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  upgradeBtnIcon: { fontSize: 28, marginTop: 2 },
  upgradeBtnText: { flex: 1 },
  upgradeBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 10,
  },
  upgradeFeatureList: { gap: 6 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureCheck: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  featureItem: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },

  // ── Link funzioni Premium ─────────────────────────────────────────────
  premiumLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  premiumLinkText: {
    fontSize: 13,
    color: '#6c63ff',
    fontWeight: '500',
  },

  // ── Chiudi link ───────────────────────────────────────────────────────
  closeLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeLinkText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
