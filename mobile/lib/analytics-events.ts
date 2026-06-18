import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | 'rewarded_opened'
  | 'rewarded_completed'
  | 'business_boost_activated'
  | 'premium_clicked'
  | 'premium_purchase'
  | 'banner_impression'
  | 'banner_click'
  | 'notification_opened'
  | 'notification_clicked'
  | 'invoice_created'
  | 'customer_created'
  | 'quote_created'
  | 'review_requested'
  | 'review_completed'
  | 'streak_updated'
  | 'milestone_reached'
  | 'limit_reached'
  | 'boost_modal_shown'
  | 'boost_modal_dismissed';

export interface AnalyticsEvent {
  event:       AnalyticsEventName;
  properties?: Record<string, string | number | boolean | null>;
}

// ─── Internal queue item ─────────────────────────────────────────────────────

interface QueuedEvent {
  event:      AnalyticsEventName;
  properties: Record<string, string | number | boolean | null>;
  retries:    number;         // number of failed insert attempts so far
  queuedAt:   string;         // ISO timestamp
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUEUE_KEY      = 'analytics_event_queue';
const MAX_QUEUE_SIZE = 500;
const MAX_RETRIES    = 5;
const INSERT_TIMEOUT = 50;    // ms — target for online inserts

// ─── Connectivity helper ─────────────────────────────────────────────────────

/**
 * Best-effort online check: try a lightweight Supabase ping.
 * Returns true if the network appears reachable; false otherwise.
 * Does NOT block `trackEvent` — it is called inside a void promise chain.
 */
async function isOnline(): Promise<boolean> {
  try {
    // Using a simple HEAD request against the Supabase URL is the
    // lightest possible connectivity check (no auth, no data).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const { data: sessionData } = await supabase.auth.getSession();
    clearTimeout(timer);
    return sessionData !== null;
  } catch {
    return false;
  }
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedEvent[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.warn('[analytics] Failed to persist event queue');
  }
}

/**
 * Appends an event to the AsyncStorage offline queue.
 * Enforces the 500-event cap (drops oldest if full).
 */
async function enqueueEvent(event: AnalyticsEvent, retries: number): Promise<void> {
  const queue = await readQueue();

  const item: QueuedEvent = {
    event:      event.event,
    properties: event.properties ?? {},
    retries,
    queuedAt:   new Date().toISOString(),
  };

  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop the oldest event (index 0) to make room
    queue.shift();
  }

  queue.push(item);
  await writeQueue(queue);
}

// ─── Supabase insert helpers ──────────────────────────────────────────────────

interface InsertRow {
  event:      string;
  properties: Record<string, string | number | boolean | null>;
  user_id:    string | null;
  org_id:     string | null;
}

/** Resolve current user/org from the active Supabase session */
async function resolveSessionIds(): Promise<{ userId: string | null; orgId: string | null }> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id ?? null;
    // org_id may be stored as user metadata (V33 pattern)
    const orgId =
      (data?.session?.user?.user_metadata?.org_id as string | undefined) ??
      null;
    return { userId, orgId };
  } catch {
    return { userId: null, orgId: null };
  }
}

/**
 * Attempts to insert a single event row into `analytics_events`.
 * Returns true on success, false on any error.
 */
async function insertEvent(event: AnalyticsEvent): Promise<boolean> {
  const { userId, orgId } = await resolveSessionIds();

  const row: InsertRow = {
    event:      event.event,
    properties: event.properties ?? {},
    user_id:    userId,
    org_id:     orgId,
  };

  const { error } = await supabase.from('analytics_events').insert(row);
  return error === null;
}

/**
 * Bulk-inserts an array of queued events.
 * Returns the subset that failed to insert.
 */
async function bulkInsertEvents(items: QueuedEvent[]): Promise<QueuedEvent[]> {
  if (items.length === 0) return [];

  const { userId, orgId } = await resolveSessionIds();

  const rows = items.map((item) => ({
    event:      item.event,
    properties: item.properties,
    user_id:    userId,
    org_id:     orgId,
  }));

  const { error } = await supabase.from('analytics_events').insert(rows);

  if (!error) {
    // All succeeded
    return [];
  }

  // Bulk failed — fall back to individual inserts so we can identify which ones succeed
  const failed: QueuedEvent[] = [];
  for (const item of items) {
    const { error: singleError } = await supabase.from('analytics_events').insert({
      event:      item.event,
      properties: item.properties,
      user_id:    userId,
      org_id:     orgId,
    });

    if (singleError) {
      failed.push(item);
    }
  }

  return failed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Tracks an analytics event. Fire-and-forget — never blocks the calling thread.
 *
 * Behaviour:
 *  • Online  → inserts directly into `analytics_events` (target ≤50ms)
 *  • Offline → appends to AsyncStorage queue (max 500, drop oldest)
 *  • Insert fails → appends to queue, up to MAX_RETRIES per event
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Immediately return to caller; all async work happens in the background.
  void (async () => {
    try {
      const online = await Promise.race([
        isOnline(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), INSERT_TIMEOUT)),
      ]);

      if (!online) {
        await enqueueEvent(event, 0);
        return;
      }

      const success = await insertEvent(event);
      if (!success) {
        // First failure: enqueue with retries = 1
        await enqueueEvent(event, 1);
      }
    } catch {
      // Swallow all errors — analytics must never crash the app
      try {
        await enqueueEvent(event, 0);
      } catch {
        // Last resort: silently discard
      }
    }
  })();
}

/**
 * Flushes the offline queue to Supabase.
 *
 * Strategy:
 *  1. Read queue from AsyncStorage
 *  2. Attempt bulk insert
 *  3. Keep only the events that failed (preserving retry counter)
 *  4. Discard events that have exceeded MAX_RETRIES
 *  5. Write surviving failures back to the queue
 */
export async function flushEventQueue(): Promise<void> {
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;

    const failed = await bulkInsertEvents(queue);

    // Increment retry counter for each failed event and filter out exhausted ones
    const surviving = failed
      .map((item) => ({ ...item, retries: item.retries + 1 }))
      .filter((item) => item.retries <= MAX_RETRIES);

    await writeQueue(surviving);
  } catch (err) {
    console.warn('[analytics] flushEventQueue error:', err);
  }
}

// ─── AppState listener ────────────────────────────────────────────────────────

/**
 * Registers the AppState listener that flushes the queue whenever the app
 * returns to the foreground. Also triggers an immediate flush on call
 * (i.e., on mount).
 *
 * Returns a cleanup function that removes the listener when called.
 *
 * Usage inside a React component:
 *   useEffect(() => {
 *     const cleanup = initAnalyticsFlush();
 *     return cleanup;
 *   }, []);
 */
export function initAnalyticsFlush(): () => void {
  // Flush immediately on mount
  void flushEventQueue();

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      void flushEventQueue();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
  };
}
