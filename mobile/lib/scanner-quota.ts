/**
 * scanner-quota.ts — OCR Scan Quota & Retention Notifications
 * =============================================================
 * Manages the monthly free-scan counter for the OCR receipt scanner,
 * enforces the freemium SCAN_LIMIT, and schedules retention
 * push notifications after a successful scan.
 *
 * Architecture:
 *  - Count persisted in AsyncStorage (fast, offline-safe)
 *  - Key resets automatically on new calendar month
 *  - scheduleRetentionNotifications is fire-and-forget, non-fatal
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

// ── Constants ──────────────────────────────────────────────────────────────

/** Number of free OCR scans per month on the Free tier */
export const SCAN_LIMIT = 3;

const SCAN_COUNT_KEY   = "scanner_scan_count";
const SCAN_PERIOD_KEY  = "scanner_scan_period"; // stored as "YYYY-MM"

// ── Helpers ────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── incrementScanCount ─────────────────────────────────────────────────────

/**
 * Atomically increments the monthly scan counter.
 * Resets automatically when the calendar month changes.
 *
 * @returns The new scan count for the current month (after increment).
 */
export async function incrementScanCount(): Promise<number> {
  try {
    const period  = currentPeriod();
    const stored  = await AsyncStorage.getItem(SCAN_PERIOD_KEY);

    let count = 0;

    if (stored === period) {
      // Same month — read existing count
      const raw = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      count = raw ? parseInt(raw, 10) : 0;
    }
    // If month changed (or first run), count stays 0 → will become 1

    count += 1;

    await AsyncStorage.multiSet([
      [SCAN_COUNT_KEY,  String(count)],
      [SCAN_PERIOD_KEY, period],
    ]);

    return count;
  } catch (err) {
    console.error("[scanner-quota] incrementScanCount failed:", err);
    // Return a safe value that won't block the user unexpectedly
    return 1;
  }
}

/**
 * Read the current scan count without incrementing.
 * Returns 0 on any error or if the month has reset.
 */
export async function getScanCount(): Promise<number> {
  try {
    const period = currentPeriod();
    const stored = await AsyncStorage.getItem(SCAN_PERIOD_KEY);
    if (stored !== period) return 0;
    const raw = await AsyncStorage.getItem(SCAN_COUNT_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

// ── scheduleRetentionNotifications ─────────────────────────────────────────

/**
 * Schedules a series of re-engagement notifications after a successful scan.
 * - 1 day  → "Ready to invoice? Tap to create your invoice."
 * - 3 days → "Don't let revenue slip away — invoice it now."
 * - 7 days → "Your scanned receipt is waiting. Invoice in seconds."
 *
 * All notifications are non-invasive and respect the user's system settings.
 * Safe to call fire-and-forget — errors are swallowed and logged.
 */
export async function scheduleRetentionNotifications(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const schedules: Array<{ seconds: number; body: string }> = [
      {
        seconds: 60 * 60 * 24,         // 1 day
        body: "Pronto a fatturare? Crea la fattura in pochi secondi. 📄",
      },
      {
        seconds: 60 * 60 * 24 * 3,     // 3 days
        body: "Non lasciare i soldi sul tavolo — fattura subito! 💸",
      },
      {
        seconds: 60 * 60 * 24 * 7,     // 7 days
        body: "La tua ricevuta scansionata ti aspetta. Fattura in un tap. ⚡",
      },
    ];

    await Promise.all(
      schedules.map(({ seconds, body }) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: "InvoiceStudio",
            body,
            sound: "default",
            data: { type: "retention", deepLink: "/(app)/invoices" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          },
        }).catch((e) =>
          console.warn("[scanner-quota] retention notification failed:", e)
        )
      )
    );
  } catch (err) {
    // Non-fatal — never block the main scan flow
    console.warn("[scanner-quota] scheduleRetentionNotifications error:", err);
  }
}
