/**
 * InAppContextualCard.tsx — Card contestuale inline per messaggi in-app
 *
 * Card sottile (~72px) mostrata inline nelle schermate per:
 *  - Avvisi di limite imminente
 *  - Opportunità Business Boost
 *  - Upsell Premium
 *  - Suggerimenti produttività
 *  - Richiesta recensione
 *
 * Bordo sinistro colorato per context (CARD_ACCENT_COLORS),
 * pulsante X per dismiss, CTA link opzionale a destra.
 *
 * Requirements: 6.8, 6.9
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {
  CARD_ACCENT_COLORS,
  CARD_ACCENT_FALLBACK,
  type ContextualCard,
} from '@/lib/in-app-messaging';

// ─── Emoji per context ────────────────────────────────────────────────────────

/**
 * Icona emoji derivata dal context/titolo della card.
 * Usata come decorazione visiva sinistra.
 */
const CONTEXT_EMOJI: Record<ContextualCard['id'], string> = {
  dashboard_limit_warning:  '⚠️',
  invoices_boost_available: '🎬',
  customers_upsell:         '🚀',
  quotes_convert_hint:      '📝',
  settings_review_ask:      '⭐',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InAppContextualCardProps {
  card:      ContextualCard;
  onDismiss: () => void;
  onCTA:     () => void;
  style?:    StyleProp<ViewStyle>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function InAppContextualCard({
  card,
  onDismiss,
  onCTA,
  style,
}: InAppContextualCardProps) {
  // Determina il colore accent per il bordo sinistro (Req 6.8, 6.9)
  const accentColor = CARD_ACCENT_COLORS[card.id] ?? CARD_ACCENT_FALLBACK;

  const emoji = CONTEXT_EMOJI[card.id] ?? '💡';

  return (
    <View
      style={[s.card, { borderLeftColor: accentColor }, style]}
      accessibilityRole="region"
      accessibilityLabel={card.title}
    >
      {/* Bordo sinistro colorato — reso come sottocomponente separato
          per garantire l'altezza piena indipendente dal contenuto */}
      <View style={[s.accentBar, { backgroundColor: accentColor }]} />

      {/* Emoji icona sinistra */}
      <Text
        style={s.emoji}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {emoji}
      </Text>

      {/* Testo: titolo + body */}
      <View style={s.textBlock}>
        <Text style={s.title} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={s.body} numberOfLines={2}>
          {card.body}
        </Text>
      </View>

      {/* CTA link destra — solo se card.cta è definito (Req task 11.4) */}
      {card.cta != null && (
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={onCTA}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={card.cta}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[s.ctaText, { color: accentColor }]} numberOfLines={1}>
            {card.cta}
          </Text>
        </TouchableOpacity>
      )}

      {/* Pulsante X dismiss */}
      <TouchableOpacity
        style={s.dismissBtn}
        onPress={onDismiss}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Chiudi"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.dismissIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    minHeight:        72,
    backgroundColor:  '#111318',
    borderWidth:      1,
    borderColor:      '#1e2029',
    borderRadius:     12,
    overflow:         'hidden',
    paddingVertical:  12,
    paddingRight:     10,
    // Il bordo sinistro è gestito dall'accentBar separato
    // per evitare conflitti con borderLeftColor e borderWidth
  },

  // Striscia colorata 3px a sinistra (Req 6.9)
  accentBar: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           3,
    borderTopLeftRadius:    12,
    borderBottomLeftRadius: 12,
  },

  // Icona emoji sinistra
  emoji: {
    fontSize:    22,
    marginLeft:  16,
    marginRight: 10,
    lineHeight:  28,
  },

  // Blocco testo centrale
  textBlock: {
    flex:    1,
    gap:     2,
    marginRight: 6,
  },
  title: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#f0f0f2',
    lineHeight: 18,
  },
  body: {
    fontSize:   12,
    color:      '#9ca3af',
    lineHeight: 16,
  },

  // CTA link destra
  ctaBtn: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    marginRight:       4,
    flexShrink:        0,
  },
  ctaText: {
    fontSize:   12,
    fontWeight: '600',
    lineHeight: 16,
  },

  // Pulsante X dismiss
  dismissBtn: {
    paddingHorizontal: 6,
    paddingVertical:   4,
    flexShrink:        0,
  },
  dismissIcon: {
    fontSize:   13,
    color:      '#6b7280',
    lineHeight: 16,
  },
});
