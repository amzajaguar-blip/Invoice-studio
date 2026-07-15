/**
 * FilterBar — Barra di filtro a pills scorrevole orizzontalmente
 *
 * Permette all'utente di filtrare le fatture per status tramite pill selezionabili.
 * Emette haptic feedback leggero ad ogni tap.
 *
 * @see Requisiti 5.1, 5.4, 5.5, 5.6, 14.5
 * @see design.md § 2.6 Componenti UI — Ricerca e Filtri
 */

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from '@/lib/haptics';
import type { InvoiceStatus } from '@/hooks/useInvoiceFilters';
import { useLocale } from '@/components/LocaleProvider';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  activeStatus: InvoiceStatus | 'all';
  onStatusChange: (status: InvoiceStatus | 'all') => void;
}

// ---------------------------------------------------------------------------
// Mappa pill → chiave di traduzione
// ---------------------------------------------------------------------------

const PILL_TRANSLATION_KEYS: Record<InvoiceStatus | 'all', string> = {
  all:       'filter.pill.all',
  draft:     'filter.pill.draft',
  sent:      'filter.pill.sent',
  paid:      'filter.pill.paid',
  overdue:   'filter.pill.overdue',
  cancelled: 'filter.pill.cancelled',
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Barra orizzontale scorribile con pill per il filtraggio delle fatture per status.
 *
 * - Pill attiva: sfondo #6c63ff, testo bianco
 * - Pill inattiva: sfondo #111318, testo #9ca3af, bordo #1e2029
 * - Haptic feedback leggero ad ogni tap (Requisito 14.5)
 * - ScrollView orizzontale senza scrollbar visibile (Requisito 5.5)
 */
export function FilterBar({ activeStatus, onStatusChange }: FilterBarProps) {
  const { t } = useLocale();
  const handlePillPress = async (key: InvoiceStatus | 'all') => {
    // Haptic feedback leggero (Requisiti 5.6, 14.5)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStatusChange(key);
  };

  return (
    <ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {(['all', 'draft', 'sent', 'paid', 'overdue'] as Array<InvoiceStatus | 'all'>).map((key) => {
        const isActive = key === activeStatus;
        const label = t(PILL_TRANSLATION_KEYS[key]);
        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            onPress={() => handlePillPress(key)}
            accessibilityRole="button"
            accessibilityLabel={t('filter.pill.a11y').replace('{label}', label)}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  pillInactive: {
    backgroundColor: '#111318',
    borderColor: '#1e2029',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '400',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pillTextInactive: {
    color: '#9ca3af',
  },
});

export default FilterBar;
