/**
 * retention-notifications.ts — promemoria di ritorno dopo una scansione
 *
 * Viveva dentro `scanner-quota.ts`, insieme a un contatore di scansioni
 * separato (SCAN_LIMIT = 3) che e' stato rimosso: il muro dei documenti e' uno
 * solo ed e' quello di `quota-engine.ts`. Le notifiche restano, il contatore no,
 * e il file ha ora il nome di quello che fa davvero.
 *
 * Due correzioni rispetto alla versione precedente:
 *
 * 1. I testi arrivano dal chiamante invece di essere italiano cablato. Prima un
 *    utente tedesco o cinese riceveva comunque "Non lasciare i soldi sul
 *    tavolo".
 * 2. Il deep link porta all'elenco dei file generati, non a `/(app)/invoices`:
 *    quella e' una schermata del vecchio gestionale, nascosta dalla tab bar, e
 *    mandarci l'utente da una notifica la riesumava.
 *
 * Fire-and-forget: ogni errore viene ingoiato e registrato, non deve mai
 * bloccare il flusso che l'ha chiamata.
 */

import * as Notifications from 'expo-notifications';

/** Testi gia' tradotti dal chiamante, che ha accesso a `useLocale`. */
export interface RetentionCopy {
  title: string;
  day1: string;
  day3: string;
  day7: string;
}

const DAY_SECONDS = 60 * 60 * 24;

export async function scheduleRetentionNotifications(copy: RetentionCopy): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const schedules: Array<{ seconds: number; body: string }> = [
      { seconds: DAY_SECONDS, body: copy.day1 },
      { seconds: DAY_SECONDS * 3, body: copy.day3 },
      { seconds: DAY_SECONDS * 7, body: copy.day7 },
    ];

    await Promise.all(
      schedules.map(({ seconds, body }) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: copy.title,
            body,
            sound: 'default',
            data: { type: 'retention', deepLink: '/(app)/(tabs)/files' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          },
        }).catch((e) =>
          console.warn('[retention] notifica non programmata:', e)
        )
      )
    );
  } catch (err) {
    // Non fatale — non deve mai bloccare il flusso principale.
    console.warn('[retention] scheduleRetentionNotifications error:', err);
  }
}
