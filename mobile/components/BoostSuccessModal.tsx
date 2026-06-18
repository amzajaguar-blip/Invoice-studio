/**
 * BoostSuccessModal — Modale di celebrazione che appare dopo l'attivazione
 * del Business Boost tramite rewarded ad.
 *
 * Mostra:
 * - Badge "Business Boost Attivato 🚀"
 * - Risorse sbloccate (+3 fatture, +1 cliente, +1 preventivo)
 * - Countdown scadenza boost (24 ore)
 * - Messaggio incoraggiante
 * - CTA "Crea la mia fattura" → chiama onClose
 *
 * Animazione: scala 1→1.08→1 + opacity 0→1, max 400ms, useNativeDriver: true
 * Skip se reduceMotion === true (letto da AccessibilityInfo).
 *
 * Non blocca l'interazione utente: l'overlay è semi-trasparente e toccabile.
 *
 * Requirements: 18.3, 18.6, 18.7, 20.5
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import type { ResourceType } from '@/lib/rate-limit-engine';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BoostSuccessModalProps {
  visible:   boolean;
  resource:  ResourceType;
  /** Testo descrittivo della scadenza, es. "24 ore" o "23h 45m" */
  expiresIn: string;
  onClose:   () => void;
}

// ─── Risorse sbloccate ────────────────────────────────────────────────────────

const UNLOCKED_RESOURCES: Array<{ emoji: string; label: string }> = [
  { emoji: '📄', label: '+3 fatture' },
  { emoji: '👤', label: '+1 cliente' },
  { emoji: '📝', label: '+1 preventivo' },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BoostSuccessModal({
  visible,
  expiresIn,
  onClose,
}: BoostSuccessModalProps) {
  // Animazione: scale 1→1.08→1 e opacity 0→1
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [reduceMotion, setReduceMotion] = useState(false);

  // Legge la preferenza di riduzione moto all'avvio
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // Avvia animazione quando il modale diventa visibile
  useEffect(() => {
    if (!visible) {
      // Reset dei valori animati per la prossima apertura
      scaleAnim.setValue(1);
      opacityAnim.setValue(0);
      return;
    }

    if (reduceMotion) {
      // Skip animazione: mostra direttamente senza transizione
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      return;
    }

    // Animazione scala 1→1.08→1 + fade in opacity 0→1
    // Durata totale max 400ms
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue:         1.08,
          duration:        200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue:         1,
          duration:        200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacityAnim, {
        toValue:         1,
        duration:        300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduceMotion]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel="Business Boost attivato con successo."
    >
      {/* Overlay semi-trasparente — non blocca interazione (pointerEvents="box-none") */}
      <View
        style={s.overlay}
        pointerEvents="box-none"
        accessibilityElementsHidden={false}
      >
        {/* Scheda animata */}
        <Animated.View
          style={[
            s.card,
            {
              opacity:   opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          accessibilityRole="region"
          accessibilityLabel="Riepilogo Business Boost attivato"
        >
          {/* ── Badge principale ─────────────────────────────────────── */}
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>Business Boost Attivato 🚀</Text>
            </View>
          </View>

          {/* ── Messaggio incoraggiante ──────────────────────────────── */}
          <Text style={s.headline}>Ottimo lavoro!</Text>
          <Text style={s.subtext}>
            Hai sbloccato risorse extra per le prossime{' '}
            <Text style={s.subtextHighlight}>{expiresIn}</Text>.{'\n'}
            Usale per far crescere il tuo business!
          </Text>

          {/* ── Risorse sbloccate ────────────────────────────────────── */}
          <View style={s.resourcesRow}>
            {UNLOCKED_RESOURCES.map((r) => (
              <View key={r.label} style={s.resourceChip}>
                <Text
                  style={s.resourceEmoji}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {r.emoji}
                </Text>
                <Text style={s.resourceLabel}>{r.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Countdown scadenza ──────────────────────────────────── */}
          <View style={s.expiryRow}>
            <Text
              style={s.expiryIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              ⏳
            </Text>
            <Text style={s.expiryText}>
              Scade in{' '}
              <Text style={s.expiryHighlight}>{expiresIn}</Text>
            </Text>
          </View>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <View style={s.divider} />

          {/* ── Messaggio di ringraziamento ──────────────────────────── */}
          <Text style={s.thankYou}>Grazie per supportare InvoiceStudio ❤️</Text>

          {/* ── CTA Primaria ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Crea la mia fattura"
            accessibilityHint="Chiude il riepilogo e torna alla schermata delle fatture"
          >
            <Text style={s.ctaBtnText}>Crea la mia fattura →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#111318',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: '#1e2029',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },

  // ── Badge ─────────────────────────────────────────────────────────────
  badgeRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#6c63ff22',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6c63ff55',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a89bff',
    letterSpacing: 0.3,
  },

  // ── Testo principale ──────────────────────────────────────────────────
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0f0f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  subtextHighlight: {
    color: '#a89bff',
    fontWeight: '600',
  },

  // ── Risorse sbloccate ─────────────────────────────────────────────────
  resourcesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  resourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2d2f4a',
  },
  resourceEmoji: {
    fontSize: 16,
  },
  resourceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c4bcff',
  },

  // ── Countdown scadenza ────────────────────────────────────────────────
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  expiryIcon: {
    fontSize: 14,
  },
  expiryText: {
    fontSize: 13,
    color: '#6b7280',
  },
  expiryHighlight: {
    color: '#f59e0b',
    fontWeight: '600',
  },

  // ── Divider ───────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: '#1e2029',
    marginBottom: 16,
  },

  // ── Ringraziamento ────────────────────────────────────────────────────
  thankYou: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  ctaBtn: {
    backgroundColor: '#6c63ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
