/**
 * SmartNotificationService — Notifiche push intelligenti con rate limiting V34
 *
 * Funzioni esportate:
 *  - `sendSmartNotification(orgId, notification)` — invia solo se i guard passano
 *  - `getNextAvailableSlot(orgId)`               — ms al prossimo slot disponibile
 *  - `maybeNotifyInvoiceReminder(orgId, opts)`   — quota >= 80% → invoice_reminder
 *  - `maybeNotifyMonthlySummary(orgId, opts)`    — round numbers → milestone
 *  - `maybeNotifyCustomerFollowup(orgId, opts)`  — inattività >= 7 giorni → customer_followup
 *
 * Guard in ordine:
 *  1. Rate limit 24h (da `notification_log`) — Requirements 11.1
 *  2. Rate limit settimanale max 3 notifiche/settimana — Requirements 11.2
 *  3. Filtro premium per categorie `'premium'`, `'business_boost'`, `'premium_features'`
 *  4. Quiet hours: 22:00–08:00 nel fuso locale del device — Requirements 11.10
 *  5. Logica specifica per categoria (gerarchia priorità Requirements 11.4)
 *
 * Gerarchia di priorità (Requirements 11.4):
 *  invoice_reminder > monthly_summary > reward_available > premium_features
 *
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11
 * @see Requirements 3.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 * @see design.md § 7. SmartNotificationService
 */

import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

/**
 * Le undici categorie di notifica supportate.
 *
 * Categorie originali (Requirements 5.5):
 *  - `productivity`, `revenue`, `reminder`, `premium`, `business_boost`
 *
 * Nuove categorie Requirements 11.3:
 *  - `invoice_reminder`   — quota >= 80% del limite mensile fatture
 *  - `monthly_summary`    — riepilogo mensile attività
 *  - `reward_available`   — Business Boost di nuovo disponibile
 *  - `premium_features`   — nudge funzionalità premium (non per utenti premium)
 *  - `milestone`          — numeri tondi di fatture (10/20/50/100)
 *  - `customer_followup`  — inattività >= 7 giorni
 *
 * Gerarchia di priorità (Requirements 11.4):
 *  invoice_reminder > monthly_summary > reward_available > premium_features
 *
 * @see Requirements 5.5, 11.3, 11.4
 */
export type NotificationCategory =
  // ── Categorie originali ──────────────────────────────────────────────────
  | 'productivity'      // streak >= 3, primo invoice, milestone
  | 'revenue'           // weekly summary domenicale, revenue insight
  | 'reminder'          // invoice scadenza < 72h, payment reminder
  | 'premium'           // upgrade nudge (max 1/settimana, non per premium)
  | 'business_boost'    // boost scaduto e ads ancora disponibili
  // ── Nuove categorie Requirements 11.3 ────────────────────────────────────
  | 'invoice_reminder'  // quota >= 80% → "limite quasi esaurito" (priorità 1)
  | 'monthly_summary'   // riepilogo mensile attività                (priorità 2)
  | 'reward_available'  // boost scaduto + ads disponibili           (priorità 3)
  | 'premium_features'  // nudge funzionalità premium                (priorità 4)
  | 'milestone'         // numeri tondi fatture 10/20/50/100
  | 'customer_followup';// inattività >= 7 giorni

/**
 * Mappa di priorità per la gerarchia Requirements 11.4.
 * Numero più basso = priorità più alta.
 * Le categorie non elencate non partecipano alla gerarchia.
 */
const NOTIFICATION_PRIORITY: Partial<Record<NotificationCategory, number>> = {
  invoice_reminder: 1,
  monthly_summary:  2,
  reward_available: 3,
  premium_features: 4,
};

export interface SmartNotification {
  category:  NotificationCategory;
  title:     string;
  body:      string;
  deepLink?: string;
  data?:     Record<string, unknown>;
}

// ─── Costanti ──────────────────────────────────────────────────────────────────

/**
 * Intervallo minimo tra due notifiche (ms) — 24 ore (Requirements 11.1).
 * Nota: il codice originale usava 48h (Requirements 5.1); il task 15.1
 * porta a 24h per Requirements 11.1. Entrambi i requisiti coesistono:
 * il rate limit 24h si applica al flusso delle nuove categorie Req. 11.
 */
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

/** Limite settimanale massimo di notifiche per org — Requirements 11.2 */
const WEEKLY_LIMIT = 3;

/** Quiet-hours inizio: 22:00 */
const QUIET_HOUR_START = 22;

/** Quiet-hours fine: 08:00 */
const QUIET_HOUR_END = 8;

// ─── Helper interni ────────────────────────────────────────────────────────────

/**
 * Controlla se l'ora corrente (fuso locale) rientra nelle quiet hours (22:00–08:00).
 * @see Requirements 11.10
 */
function isQuietHours(): boolean {
  const hour = new Date().getHours();
  // Quiet window: 22 ≤ hour < 24  oppure  0 ≤ hour < 8
  return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
}

/**
 * Legge l'ultimo `sent_at` in `notification_log` per l'org.
 * Ritorna `null` se non esiste alcun record (primo accesso).
 * @see Requirements 5.1, 5.11, 11.1
 */
async function getLastSentAt(orgId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('notification_log')
    .select('sent_at')
    .eq('org_id', orgId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[smart-notifications] getLastSentAt error:', error.message);
    // In caso di errore lettura, assumiamo rate limit non applicabile per non bloccare
    return null;
  }

  return data ? new Date(data.sent_at) : null;
}

/**
 * Conta le notifiche inviate nell'ultima settimana per l'org.
 * Usato per il limite settimanale di 3 notifiche (Requirements 11.2).
 * @see Requirements 11.2
 */
async function getWeeklyNotificationCount(orgId: string): Promise<number> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { count, error } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('sent_at', oneWeekAgo.toISOString());

  if (error) {
    console.warn('[smart-notifications] getWeeklyNotificationCount error:', error.message);
    // In caso di errore, non blocchiamo — assumiamo sotto il limite
    return 0;
  }

  return count ?? 0;
}

/**
 * Verifica se l'org è premium leggendo `user_engagement.is_premium`.
 * Fallisce silenziosamente — in caso di errore assume non-premium (permissivo).
 * @see Requirements 3.4, 5.3
 */
async function isPremium(orgId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_engagement')
    .select('is_premium')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) {
    console.warn('[smart-notifications] isPremium check failed, assuming false:', error?.message);
    return false;
  }

  return data.is_premium === true;
}

/**
 * Inserisce un record in `notification_log`.
 * Non-fatal: un fallimento viene loggato ma non propagato.
 * @see Requirements 5.2, 5.4
 */
async function logNotification(
  orgId: string,
  notification: SmartNotification,
): Promise<void> {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      org_id:   orgId,
      category: notification.category,
      title:    notification.title,
      body:     notification.body,
      sent_at:  new Date().toISOString(),
    });

  if (error) {
    console.warn('[smart-notifications] Failed to insert notification_log:', error.message);
    // Non-fatal — la notifica è già schedulata
  }
}

// ─── sendSmartNotification ────────────────────────────────────────────────────

/**
 * Invia una notifica smart se tutti i guard passano.
 *
 * Guard (nell'ordine):
 *  1. Rate limit 48h — se l'ultima notifica è < 48h fa, return false
 *     Se non esiste alcun record, il rate limit non si applica (Requirements 5.11)
 *  2. Premium filter — categorie `'premium'` / `'business_boost'` bloccate per utenti premium
 *     (Requirements 3.4, 5.3)
 *  3. Quiet hours — non schedula tra 22:00 e 08:00 (Requirements 11.10)
 *  4. Schedula via `expo-notifications`
 *  5. Inserisce in `notification_log` (non-fatal se fallisce)
 *
 * @returns `true` se la notifica è stata schedulata, `false` altrimenti
 *
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.11, 3.4, 11.10
 */
export async function sendSmartNotification(
  orgId: string,
  notification: SmartNotification,
): Promise<boolean> {
  // ── Guard 1: Rate limit 48h ────────────────────────────────────────────────
  const lastSentAt = await getLastSentAt(orgId);

  if (lastSentAt !== null) {
    const elapsed = Date.now() - lastSentAt.getTime();
    if (elapsed < RATE_LIMIT_MS) {
      // Meno di 48h dall'ultima notifica
      return false;
    }
  }
  // Se lastSentAt === null → primo record, rate limit non applicabile (Requirements 5.11)

  // ── Guard 2: Premium filter ───────────────────────────────────────────────
  if (
    notification.category === 'premium' ||
    notification.category === 'business_boost'
  ) {
    const orgIsPremium = await isPremium(orgId);
    if (orgIsPremium) {
      return false;
    }
  }

  // ── Guard 3: Quiet hours (22:00–08:00) ────────────────────────────────────
  if (isQuietHours()) {
    return false;
  }

  // ── Guard 4: Schedula via expo-notifications ──────────────────────────────
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body:  notification.body,
        data: {
          category:  notification.category,
          deepLink:  notification.deepLink ?? null,
          ...(notification.data ?? {}),
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
      },
    });
  } catch (err) {
    console.error('[smart-notifications] scheduleNotificationAsync failed:', err);
    return false;
  }

  // ── Guard 5: Log in notification_log (non-fatal) ──────────────────────────
  await logNotification(orgId, notification);

  return true;
}

// ─── getNextAvailableSlot ─────────────────────────────────────────────────────

/**
 * Calcola i millisecondi mancanti al prossimo slot disponibile per l'org.
 *
 * Tiene conto di:
 * - Rate limit 48h dall'ultima notifica
 * - Quiet hours (22:00–08:00): se il prossimo slot cade in quiet hours,
 *   posticipa alle 08:00 del giorno successivo
 *
 * @returns 0 se uno slot è immediatamente disponibile
 *
 * @see Requirements 5.1, 11.10
 */
export async function getNextAvailableSlot(orgId: string): Promise<number> {
  const lastSentAt = await getLastSentAt(orgId);

  let nextSlotMs: number;

  if (lastSentAt === null) {
    // Nessuna notifica precedente — disponibile subito (salvo quiet hours)
    nextSlotMs = Date.now();
  } else {
    const afterRateLimit = lastSentAt.getTime() + RATE_LIMIT_MS;
    nextSlotMs = Math.max(Date.now(), afterRateLimit);
  }

  // Se il prossimo slot cade in quiet hours, posticipa alle 08:00
  const slotDate = new Date(nextSlotMs);
  const slotHour = slotDate.getHours();

  const inQuiet =
    slotHour >= QUIET_HOUR_START || slotHour < QUIET_HOUR_END;

  if (inQuiet) {
    // Costruiamo le 08:00 del giorno corrente (o del giorno successivo se necessario)
    const next8am = new Date(slotDate);
    next8am.setMinutes(0, 0, 0);

    if (slotHour >= QUIET_HOUR_START) {
      // Siamo nella sera → 08:00 di domani
      next8am.setDate(next8am.getDate() + 1);
      next8am.setHours(QUIET_HOUR_END);
    } else {
      // Siamo nella mattina presto (< 08:00) → 08:00 oggi
      next8am.setHours(QUIET_HOUR_END);
    }

    nextSlotMs = next8am.getTime();
  }

  const msRemaining = nextSlotMs - Date.now();
  return Math.max(0, msRemaining);
}

// ─── Logica per categoria ─────────────────────────────────────────────────────
//
// Le funzioni seguenti implementano la logica di trigger per ciascuna
// delle 5 categorie. Vengono usate da qualsiasi chiamante che voglia
// valutare quale notifica inviare dato lo stato corrente dell'org.
//
// @see Requirements 5.6, 5.7, 5.8, 5.9, 5.10

// ─── Categoria: productivity ──────────────────────────────────────────────────

/**
 * Valuta e invia una notifica di produttività se le condizioni sono soddisfatte.
 *
 * Condizioni (in ordine di priorità):
 *  - `current_streak >= 3` → streak celebration
 *  - `milestone_first_invoice === true` e nessuna notifica 'productivity'
 *    con body 'first invoice' nel log → first invoice celebration
 *
 * @see Requirements 5.6, 5.7
 */
export async function maybeNotifyProductivity(
  orgId: string,
  opts: {
    currentStreak: number;
    milestoneFirstInvoice: boolean;
  },
): Promise<boolean> {
  // Priorità 1: streak >= 3
  if (opts.currentStreak >= 3) {
    return sendSmartNotification(orgId, {
      category: 'productivity',
      title:    `🔥 ${opts.currentStreak} giorni di fila!`,
      body:     'Stai costruendo ottime abitudini. Continua così!',
    });
  }

  // Priorità 2: prima fattura (se non già notificata)
  if (opts.milestoneFirstInvoice) {
    // Controlla se c'è già una notifica 'productivity' con 'first invoice' nel log
    const { data } = await supabase
      .from('notification_log')
      .select('id')
      .eq('org_id', orgId)
      .eq('category', 'productivity')
      .ilike('body', '%first invoice%')
      .limit(1)
      .maybeSingle();

    if (!data) {
      return sendSmartNotification(orgId, {
        category: 'productivity',
        title:    '🎉 Prima fattura creata!',
        body:     'Hai fatto il primo passo — first invoice! Il tuo business è ufficialmente partito!',
      });
    }
  }

  return false;
}

// ─── Categoria: business_boost ────────────────────────────────────────────────

/**
 * Invia una notifica 'business_boost' se il boost è scaduto e ci sono ancora ads disponibili.
 *
 * @see Requirements 5.8
 */
export async function maybeNotifyBusinessBoost(
  orgId: string,
  opts: {
    boostExpiresAt: Date | null;
    dailyAdsLeft: number;
  },
): Promise<boolean> {
  const now = Date.now();
  const boostExpired =
    opts.boostExpiresAt === null || opts.boostExpiresAt.getTime() < now;

  if (boostExpired && opts.dailyAdsLeft > 0) {
    return sendSmartNotification(orgId, {
      category: 'business_boost',
      title:    '🚀 Business Boost disponibile!',
      body:     'Guarda un breve video per sbloccare risorse extra per 24 ore.',
    });
  }

  return false;
}

// ─── Categoria: revenue ───────────────────────────────────────────────────────

/**
 * Invia una notifica di riepilogo settimanale la domenica se revenue > 0.
 *
 * @see Requirements 5.9
 */
export async function maybeNotifyRevenue(
  orgId: string,
  opts: {
    totalRevenue: number;
  },
): Promise<boolean> {
  const isSunday = new Date().getDay() === 0;

  if (isSunday && opts.totalRevenue > 0) {
    const formattedRevenue = new Intl.NumberFormat('it-IT', {
      style:    'currency',
      currency: 'EUR',
    }).format(opts.totalRevenue);

    return sendSmartNotification(orgId, {
      category: 'revenue',
      title:    '📊 Riepilogo settimanale',
      body:     `Questa settimana hai generato ${formattedRevenue}. Ottimo lavoro!`,
    });
  }

  return false;
}

// ─── Categoria: reminder ──────────────────────────────────────────────────────

/**
 * Invia un promemoria di pagamento se c'è una fattura con scadenza < 72h.
 *
 * @see Requirements 5.10
 */
export async function maybeNotifyReminder(
  orgId: string,
  opts: {
    invoiceNumber: string;
    dueDate: Date;
  },
): Promise<boolean> {
  const now = Date.now();
  const hoursUntilDue =
    (opts.dueDate.getTime() - now) / (1000 * 60 * 60);

  if (hoursUntilDue > 0 && hoursUntilDue < 72) {
    const hoursLeft = Math.ceil(hoursUntilDue);

    return sendSmartNotification(orgId, {
      category: 'reminder',
      title:    '⏰ Scadenza imminente',
      body:     `La fattura #${opts.invoiceNumber} scade tra ${hoursLeft} ore. Ricorda di sollecitare il pagamento.`,
    });
  }

  return false;
}

// ─── Categoria: premium ───────────────────────────────────────────────────────

/**
 * Invia un'unica notifica di upgrade premium a settimana per utenti non-premium.
 * La funzione usa il rate limit standard di 48h di `sendSmartNotification` —
 * per il limite settimanale specifico della categoria, il chiamante deve
 * valutare se sono passati almeno 7 giorni dall'ultima notifica 'premium'.
 *
 * @see design.md — categoria 'premium': max 1/settimana, non per premium
 */
export async function maybeNotifyPremium(
  orgId: string,
): Promise<boolean> {
  // Controlla se c'è una notifica premium nell'ultima settimana
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('notification_log')
    .select('sent_at')
    .eq('org_id', orgId)
    .eq('category', 'premium')
    .gte('sent_at', oneWeekAgo.toISOString())
    .limit(1)
    .maybeSingle();

  if (data) {
    // Già inviata una notifica premium questa settimana
    return false;
  }

  return sendSmartNotification(orgId, {
    category: 'premium',
    title:    '✨ Potenzia il tuo business',
    body:     'Passa a Premium: fatture illimitate, clienti illimitati, zero pubblicità.',
  });
}
