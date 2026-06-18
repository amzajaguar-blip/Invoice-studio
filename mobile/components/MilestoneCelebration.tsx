/**
 * MilestoneCelebration — Overlay non-modale che celebra un milestone appena raggiunto.
 *
 * Comportamento:
 * - Se `milestone === null`: restituisce null (nulla renderizzato)
 * - Se `reduceMotion === false`: slide-up 200ms → rimane 3s → auto-dismiss;
 *   confetti emoji animate max 2s (Requirements 7.10, 13.3)
 * - Se `reduceMotion === true`: appare istantaneamente, auto-dismiss dopo 3s,
 *   nessuna animazione (Requirements 7.11, 13.4)
 * - Haptic feedback Heavy quando il milestone appare (Requirements 13.2)
 * - Non blocca l'interazione utente — overlay non-modal, posizionato in alto
 * - Tutte le animazioni usano `useNativeDriver: true`
 * - CTA opzionale "Sblocca Premium per crescita illimitata" per milestone > first_invoice
 *
 * @see Requirements 7.10, 7.11, 7.13, 13.2, 13.3, 13.4, 18.5, 18.6, 18.7, 18.8
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import type { MilestoneEvent, MilestoneType } from '@/lib/engagement-engine';
import { ImpactFeedbackStyle, impactAsync } from '@/lib/haptics';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MilestoneCelebrationProps {
  /** Milestone da celebrare. Se null, il componente non renderizza nulla. */
  milestone: MilestoneEvent | null;
  /** Chiamato quando la celebrazione si chiude (auto o manuale). */
  onDismiss: () => void;
  /** Se true, nessuna animazione; l'overlay appare istantaneamente. */
  reduceMotion: boolean;
}

// ─── Milestone Copy ───────────────────────────────────────────────────────────

/**
 * Testo e emoji per ogni tipo di milestone.
 * Definiti localmente come da specifica task 11.5.
 */
export const MILESTONE_COPY: Record<
  MilestoneType,
  { emoji: string; title: string; body: string }
> = {
  first_invoice: {
    emoji: '🎉',
    title: 'Prima fattura creata!',
    body:  'Hai fatto il primo passo. Il tuo business è ufficialmente partito!',
  },
  invoices_10: {
    emoji: '🏆',
    title: '10 fatture create!',
    body:  'Stai costruendo una solida base clienti. Continua così!',
  },
  invoices_25: {
    emoji: '🏆',
    title: '25 fatture create!',
    body:  'Un traguardo importante. Stai crescendo!',
  },
  invoices_50: {
    emoji: '🚀',
    title: '50 fatture create!',
    body:  'Sei un professionista in piena attività. Impressionante!',
  },
  invoices_100: {
    emoji: '💎',
    title: '100 fatture create!',
    body:  'Un professionista affermato. Straordinario!',
  },
  invoices_500: {
    emoji: '🌟',
    title: '500 fatture create!',
    body:  'Sei una leggenda del freelancing. Incredibile!',
  },
  invoices_1000: {
    emoji: '🏆',
    title: '1000 fatture create!',
    body:  'Un risultato epico. Complimenti!',
  },
  clients_100: {
    emoji: '💼',
    title: '100 clienti aggiunti!',
    body:  'Un network straordinario. Il tuo business sta crescendo forte!',
  },
  review_ask: {
    emoji: '⭐',
    title: 'Ti piace InvoiceStudio?',
    body:  'Lascia una recensione e aiuta altri freelancer a scoprirci!',
  },
};

// ─── Particelle confetti ───────────────────────────────────────────────────────

/** Emoji confetti semplici da animare */
const CONFETTI_PARTICLES = ['🎊', '✨', '🌟', '💫', '🎈', '🎉'];

/** Posizioni orizzontali casuali (statiche — generate una volta) per evitare layout shift */
const CONFETTI_POSITIONS = [8, 22, 38, 52, 68, 80]; // % da sinistra

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MilestoneCelebration({
  milestone,
  onDismiss,
  reduceMotion,
}: MilestoneCelebrationProps) {
  // Req 7.13: se milestone === null → return null
  if (milestone === null) return null;

  return (
    <MilestoneCelebrationInner
      milestone={milestone}
      onDismiss={onDismiss}
      reduceMotion={reduceMotion}
    />
  );
}

// ─── Tipo interno (milestone garantito non-null) ─────────────────────────────

interface MilestoneCelebrationInnerProps {
  milestone:    MilestoneEvent;
  onDismiss:    () => void;
  reduceMotion: boolean;
}

// ─── Componente interno (separato per evitare hook condizionali) ──────────────

function MilestoneCelebrationInner({
  milestone,
  onDismiss,
  reduceMotion,
}: MilestoneCelebrationInnerProps) {
  // ── Animated values ────────────────────────────────────────────────────────
  /** translateY: slide-up — parte da +80 (sotto), arriva a 0 */
  const translateY   = useRef(new Animated.Value(reduceMotion ? 0 : 80)).current;
  const opacityAnim  = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  /** Confetti: opacity 0 → 1 → 0 entro 2s */
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  /** Confetti: translateY drop dall'alto */
  const confettiTranslate = useRef(new Animated.Value(-20)).current;

  // ── Dismiss handler ────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (reduceMotion) {
      onDismiss();
      return;
    }
    // Slide-out verso il basso prima del dismiss
    Animated.parallel([
      Animated.timing(translateY, {
        toValue:         80,
        duration:        150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue:         0,
        duration:        150,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [reduceMotion, onDismiss, translateY, opacityAnim]);

  // ── Effetto principale ─────────────────────────────────────────────────────
  useEffect(() => {
    let autoTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. Haptic feedback (Req 13.2) — Heavy impact
    impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {});

    if (reduceMotion) {
      // Req 7.11 / 13.4: appare istantaneamente, nessuna animazione
      translateY.setValue(0);
      opacityAnim.setValue(1);
      // Auto-dismiss dopo 3s
      autoTimer = setTimeout(dismiss, 3000);
    } else {
      // Req 7.10 / 13.3: slide-up 200ms → rimane 3s → auto-dismiss
      Animated.parallel([
        Animated.timing(translateY, {
          toValue:         0,
          duration:        200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue:         1,
          duration:        200,
          useNativeDriver: true,
        }),
      ]).start();

      // Confetti: fade-in + drop, poi fade-out — max 2s totali (Req 13.3)
      Animated.sequence([
        Animated.parallel([
          Animated.timing(confettiOpacity, {
            toValue:         1,
            duration:        300,
            useNativeDriver: true,
          }),
          Animated.timing(confettiTranslate, {
            toValue:         20,
            duration:        500,
            useNativeDriver: true,
          }),
        ]),
        // Rimane visibile ~1200ms poi fade-out entro 500ms → totale ~2s
        Animated.delay(1200),
        Animated.timing(confettiOpacity, {
          toValue:         0,
          duration:        500,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss dopo 3s (dall'apparizione)
      autoTimer = setTimeout(dismiss, 3200);
    }

    return () => {
      if (autoTimer !== null) clearTimeout(autoTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CTA Premium: mostrata per milestone > first_invoice (Req 18.8) ─────────
  const showPremiumCTA = milestone.type !== 'first_invoice';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // pointerEvents="box-none": l'overlay non intercetta tocchi al di fuori della card
    <View
      style={s.container}
      pointerEvents="box-none"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${milestone.title} ${milestone.body}`}
    >
      {/* ── Confetti particles (solo se !reduceMotion) ──────────────── */}
      {!reduceMotion && (
        <Animated.View
          style={[
            s.confettiContainer,
            {
              opacity:   confettiOpacity,
              transform: [{ translateY: confettiTranslate }],
            },
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {CONFETTI_PARTICLES.map((emoji, i) => (
            <Text
              key={i}
              style={[s.confettiEmoji, { left: `${CONFETTI_POSITIONS[i]}%` as any }]}
            >
              {emoji}
            </Text>
          ))}
        </Animated.View>
      )}

      {/* ── Card principale ─────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.card,
          {
            opacity:   opacityAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* ── Emoji + titolo ─────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <Text
            style={s.emojiLarge}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {milestone.emoji}
          </Text>
          <View style={s.headerTexts}>
            <Text style={s.title} numberOfLines={1}>
              {milestone.title}
            </Text>
            <Text style={s.body} numberOfLines={2}>
              {milestone.body}
            </Text>
          </View>

          {/* ── Pulsante chiusura manuale ─────────────────────────────── */}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Chiudi celebrazione"
          >
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── CTA Premium (solo per milestone > first_invoice) ────────── */}
        {showPremiumCTA && (
          <TouchableOpacity
            style={s.premiumCTA}
            onPress={dismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sblocca Premium per crescita illimitata"
          >
            <Text style={s.premiumCTAText}>
              ✨ Sblocca Premium per crescita illimitata
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Overlay: position absolute, copre tutta la schermata, non blocca tocchi (box-none)
  container: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          9999,
    // Padding top per rimanere sotto la status bar / safe area
    paddingTop:      Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 16,
  },

  // ── Confetti ───────────────────────────────────────────────────────────────
  confettiContainer: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   80,
    flexDirection: 'row',
  },
  confettiEmoji: {
    position: 'absolute',
    fontSize: 22,
    top:      8,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#111318',
    borderRadius:    16,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderWidth:     1,
    borderColor:     '#6c63ff55',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.30,
    shadowRadius:    12,
    elevation:       10,
    // Bordo sinistro accent violet
    borderLeftWidth: 4,
    borderLeftColor: '#6c63ff',
  },

  // ── Header row (emoji + testi + close) ────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  emojiLarge: {
    fontSize: 32,
    lineHeight: 38,
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#f0f0f2',
    letterSpacing: 0.2,
  },
  body: {
    fontSize:   13,
    color:      '#9ca3af',
    lineHeight: 18,
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#1e2029',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontSize:   12,
    color:      '#6b7280',
    lineHeight: 16,
  },

  // ── CTA Premium ───────────────────────────────────────────────────────────
  premiumCTA: {
    marginTop:       12,
    backgroundColor: '#6c63ff22',
    borderRadius:    10,
    paddingVertical:   9,
    paddingHorizontal: 14,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#6c63ff44',
  },
  premiumCTAText: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#a89bff',
    letterSpacing: 0.2,
  },
});
