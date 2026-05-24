/**
 * InvoiceLimitModal — Bottom sheet che appare quando l'utente raggiunge il
 * limite di 5 fatture gratuite mensili.
 *
 * Offre due percorsi:
 * - Passa a Pro (primario, €19/mese) — fatture illimitate + tutte le funzioni
 * - Guarda un video (secondario) — sblocca 1 fattura extra gratis via Rewarded Ad
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

interface InvoiceLimitModalProps {
  visible: boolean;
  adLoaded: boolean;
  adLoading: boolean;
  adError: string | null;
  onWatchAd: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}

const { height } = Dimensions.get('window');
const AD_LOAD_TIMEOUT_MS = 5000;

export default function InvoiceLimitModal({
  visible,
  adLoaded,
  adLoading,
  adError,
  onWatchAd,
  onUpgrade,
  onClose,
}: InvoiceLimitModalProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [adLoadTimedOut, setAdLoadTimedOut] = useState(false);

  // Check accessibility preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Ad loading timeout
  useEffect(() => {
    if (adLoading && visible) {
      setAdLoadTimedOut(false);
      const t = setTimeout(() => setAdLoadTimedOut(true), AD_LOAD_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    if (!adLoading) setAdLoadTimedOut(false);
  }, [adLoading, visible]);

  // Entrance/exit animation
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
  }, [visible, reduceMotion]);

  // ── Ad button right-side element ──────────────────────────────────────────

  const AdState = () => {
    if (adError || (adLoadTimedOut && !adLoaded)) {
      return (
        <View style={s.adStateWrap}>
          <Text style={s.adStateError}>Video non disponibile</Text>
          <TouchableOpacity
            onPress={onWatchAd}
            style={s.retryPill}
            accessibilityRole="button"
            accessibilityLabel="Riprova a caricare il video"
          >
            <Text style={s.retryPillText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (adLoading) {
      return (
        <View style={s.adStateWrap}>
          <ActivityIndicator size="small" color="#6c63ff" />
          <Text style={s.adStateLoading}>Caricamento…</Text>
        </View>
      );
    }

    if (!adLoaded) {
      return (
        <View style={s.adStateWrap}>
          <Text style={s.adStateUnavailable}>Non disponibile</Text>
          <Text style={s.adStateHint}>Riprova tra qualche istante</Text>
        </View>
      );
    }

    return (
      <View style={s.freeBadge}>
        <Text style={s.freeBadgeText}>GRATIS</Text>
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel="Limite mensile raggiunto. Scegli come continuare."
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Chiudi e continua senza creare altre fatture"
        />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Icon */}
          <View style={s.iconWrap}>
            <Text style={s.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              📄
            </Text>
            <View style={s.badgeWrap}>
              <Text style={s.badgeIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                🔒
              </Text>
            </View>
          </View>

          {/* Titolo + sottotitolo */}
          <Text style={s.title}>Hai raggiunto il limite mensile</Text>
          <Text style={s.subtitle}>
            5 fatture create questo mese. Per continuare:
          </Text>

          <View style={s.divider} />

          {/* ── Opzione PRIMARIA: Upgrade Pro ──────────────────────────── */}
          <TouchableOpacity
            style={s.proBtn}
            onPress={onUpgrade}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Passa a Pro. 19 euro al mese. Fatture illimitate, invio diretto via email e PDF, annulla in qualsiasi momento."
            accessibilityHint="Apre la pagina di abbonamento"
          >
            <Text
              style={s.proBtnIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              🚀
            </Text>
            <View style={s.proBtnText}>
              <Text style={s.proBtnTitle}>Passa a Pro — €19/mese</Text>
              <View style={s.proFeatureList}>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>Fatture illimitate ogni mese</Text>
                </View>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>Invio diretto via email e PDF</Text>
                </View>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>Annulla in qualsiasi momento</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Opzione SECONDARIA: Guarda video ───────────────────────── */}
          <TouchableOpacity
            style={[s.adBtn, (!adLoaded && !adLoading) && s.btnDisabled]}
            onPress={onWatchAd}
            disabled={!adLoaded}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              adLoaded
                ? 'Guarda un video breve per sbloccare una fattura extra gratis'
                : 'Video non disponibile. Riprova più tardi.'
            }
            accessibilityState={{ disabled: !adLoaded }}
          >
            <View style={s.adBtnContent}>
              <View style={s.adBtnLeft}>
                <Text
                  style={s.adBtnIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  🎬
                </Text>
                <View>
                  <Text style={s.adBtnTitle}>Guarda un video breve</Text>
                  <Text style={s.adBtnSub}>Sblocca 1 fattura extra gratis</Text>
                </View>
              </View>
              <AdState />
            </View>
          </TouchableOpacity>

          {/* ── Chiudi (conseguenza trasparente) ──────────────────────── */}
          <TouchableOpacity
            onPress={onClose}
            style={s.closeLink}
            accessibilityRole="button"
            accessibilityLabel="Continua senza creare altre fatture"
          >
            <Text style={s.closeLinkText}>
              Continua senza creare altre fatture
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

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

  // ── Pro button (PRIMARY) ──────────────────────────────────────────────
  proBtn: {
    backgroundColor: '#f59e0b18',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b55',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  proBtnIcon: { fontSize: 28, marginTop: 2 },
  proBtnText: { flex: 1 },
  proBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 10,
  },
  proFeatureList: {
    gap: 6,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proFeatureCheck: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  proFeatureItem: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },

  // ── Ad button (SECONDARY) ─────────────────────────────────────────────
  adBtn: {
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
  adBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adBtnIcon: { fontSize: 28 },
  adBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f0f2',
    marginBottom: 2,
  },
  adBtnSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  freeBadge: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c63ff',
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c63ff',
    letterSpacing: 0.5,
  },

  // ── Ad state components ───────────────────────────────────────────────
  adStateWrap: {
    alignItems: 'center',
    gap: 4,
  },
  adStateLoading: {
    fontSize: 11,
    color: '#6c63ff',
  },
  adStateUnavailable: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  adStateHint: {
    fontSize: 10,
    color: '#6b7280',
  },
  adStateError: {
    fontSize: 12,
    color: '#fca5a5',
    fontWeight: '600',
  },
  retryPill: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c63ff44',
  },
  retryPillText: {
    fontSize: 11,
    color: '#6c63ff',
    fontWeight: '600',
  },

  // ── Close link ────────────────────────────────────────────────────────
  closeLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeLinkText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
