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
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/components/LocaleProvider';
import {
  CARD_ACCENT_COLORS,
  CARD_ACCENT_FALLBACK,
  type ContextualCard,
} from '@/lib/in-app-messaging';

// ─── Icone per context ──────────────────────────────────────────────────────────

/**
 * Icone Ionicons derivate dal context della card.
 * Usate come decorazione visiva sinistra.
 */
const CONTEXT_ICON: Record<ContextualCard['id'], keyof typeof Ionicons.glyphMap> = {
  dashboard_limit_warning:  'warning-outline',
  invoices_boost_available: 'play-circle-outline',
  customers_upsell:         'rocket-outline',
  quotes_convert_hint:      'document-text-outline',
  settings_review_ask:      'star-outline',
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
  const { t } = useLocale();

  // Determina il colore accent per il bordo sinistro (Req 6.8, 6.9)
  const accentColor = CARD_ACCENT_COLORS[card.id] ?? CARD_ACCENT_FALLBACK;

  const iconName = CONTEXT_ICON[card.id] ?? 'bulb-outline';

  return (
    <View
      style={[s.card, { borderLeftColor: accentColor }, style]}
      accessibilityLabel={t(card.titleKey)}
    >
      {/* Bordo sinistro colorato — reso come sottocomponente separato
          per garantire l'altezza piena indipendente dal contenuto */}
      <View style={[s.accentBar, { backgroundColor: accentColor }]} />

      {/* Icona Ionicons sinistra */}
      <Ionicons
        name={iconName}
        size={22}
        color={accentColor}
        style={s.icon}
        accessibilityElementsHidden
      />

      {/* Testo: titolo + body */}
      <View style={s.textBlock}>
        <Text style={s.title} numberOfLines={1}>
          {t(card.titleKey)}
        </Text>
        <Text style={s.body} numberOfLines={2}>
          {t(card.bodyKey)}
        </Text>
      </View>

      {/* CTA link destra — solo se card.ctaKey è definito (Req task 11.4) */}
      {card.ctaKey != null && (
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={onCTA}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t(card.ctaKey)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[s.ctaText, { color: accentColor }]} numberOfLines={1}>
            {t(card.ctaKey)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Pulsante X dismiss */}
      <TouchableOpacity
        style={s.dismissBtn}
        onPress={onDismiss}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('cancel') ?? 'Chiudi'}
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

  // Icona Ionicons sinistra
  icon: {
    marginLeft:  16,
    marginRight: 10,
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