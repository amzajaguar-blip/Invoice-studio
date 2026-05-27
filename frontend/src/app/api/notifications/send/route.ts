import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

/**
 * POST /api/notifications/send
 * Send a push notification via Expo Push Service.
 * Authenticated endpoint — only the notification owner can call it.
 *
 * Body: { to: string, title: string, body: string, data?: object }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = auth;

  // Rate limit: 30 notifications per minute per user
  const rateKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`notif-send:${rateKey}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { to?: string; title?: string; body?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, title, body: msgBody, data } = body;

  if (!to || !title || !msgBody) {
    return NextResponse.json(
      { error: "Missing required fields: to, title, body" },
      { status: 400 }
    );
  }

  if (!to.startsWith("ExponentPushToken[")) {
    return NextResponse.json(
      { error: "Invalid Expo push token" },
      { status: 400 }
    );
  }

  const message: ExpoPushMessage = {
    to,
    title,
    body: msgBody,
    data: data ?? {},
    sound: "default",
    badge: 1,
    channelId: "invoicestudio",
  };

  try {
    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(message),
    });

    if (!expoResponse.ok) {
      const errText = await expoResponse.text();
      console.error("Expo push error:", errText);
      return NextResponse.json({ error: "Push delivery failed" }, { status: 502 });
    }

    const result = await expoResponse.json();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Expo push network error:", err);
    return NextResponse.json({ error: "Push service unreachable" }, { status: 503 });
  }
}
