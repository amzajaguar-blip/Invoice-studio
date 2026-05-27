import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logPaymentAudit } from "@/lib/payment-audit";

// Definizione stretta dei tipi per il Webhook di RevenueCat
type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "NON_RENEWING_PURCHASE"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION"
  | "BILLING_ISSUE";

interface RevenueCatWebhookPayload {
  event: {
    type: RevenueCatEventType;
    app_user_id: string;
    product_id: string;
    purchased_at_ms: number;
    expiration_at_ms?: number;
    environment: "SANDBOX" | "PRODUCTION";
  };
}

export async function POST(req: Request) {
  // Rate limit: 60 calls per minute per source IP
  const rlKey = getRateLimitKey(req);
  const { allowed } = rateLimit(`rc-webhook:${rlKey}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    // 🛡️ SECURITY LAYER 1: Validazione Header di Autorizzazione
    const authHeader = req.headers.get("authorization");
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      await logPaymentAudit({ event_type: "revenuecat.unknown", provider: "revenuecat", environment: "unknown", outcome: "failure", error_code: "unauthorized" });
      console.warn("[RevenueCat Webhook] Unauthorized attempt.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 PARSING DEL PAYLOAD
    const body = (await req.json()) as RevenueCatWebhookPayload;
    const { event } = body;

    if (!event || !event.type || !event.app_user_id) {
      console.error("❌ [RevenueCat Webhook] Payload non valido:", body);
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    const { type, app_user_id: orgId, environment } = event;
    console.log(
      `📥 [RevenueCat Webhook] Evento ${type} ricevuto per Org: ${orgId} (${environment})`
    );

    // Inizializza Admin Client per Bypass RLS
    const adminClient = createAdminClient();

    // 💳 LOGICA DI BUSINESS: Mapping Eventi -> Piani
    let targetPlan: "free" | "pro" | null = null;

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "NON_RENEWING_PURCHASE":
        targetPlan = "pro";
        break;

      case "EXPIRATION":
      case "BILLING_ISSUE":
        targetPlan = "free";
        break;

      // Per CANCELLATION (disdetta rinnovo), l'utente mantiene il PRO fino all'EXPIRATION.
      // Non cambiamo il piano immediatamente.
      case "CANCELLATION":
      case "PRODUCT_CHANGE":
      case "SUBSCRIPTION_PAUSED":
        console.log(
          `ℹ️ [RevenueCat Webhook] Evento ${type} ignorato per il cambio piano immediato.`
        );
        return NextResponse.json({ success: true, action: "ignored" });

      default:
        console.warn(
          `⚠️ [RevenueCat Webhook] Tipo di evento sconosciuto: ${type}`
        );
        return NextResponse.json({ success: true, action: "unhandled_event" });
    }

    // 💾 DATABASE UPDATE
    if (targetPlan) {
      const { error } = await adminClient
        .from("organizations")
        .update({
          plan: targetPlan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgId);

      if (error) {
        await logPaymentAudit({
          event_type: `revenuecat.${type.toLowerCase()}`,
          provider: "revenuecat",
          org_id: orgId,
          environment: environment === "PRODUCTION" ? "production" : "sandbox",
          outcome: "failure",
          error_code: error.code,
        });
        console.error("[RevenueCat Webhook] DB error updating org");
        throw error;
      }

      // PCI-DSS audit log — only IDs and event type
      await logPaymentAudit({
        event_type: `revenuecat.${type.toLowerCase()}`,
        provider: "revenuecat",
        org_id: orgId,
        environment: environment === "PRODUCTION" ? "production" : "sandbox",
        outcome: "success",
      });

      console.log(`[RevenueCat Webhook] Org ${orgId} updated to plan: ${targetPlan}`);
    }

    return NextResponse.json({ success: true, plan_applied: targetPlan });
  } catch (error) {
    await logPaymentAudit({
      event_type: "revenuecat.handler_error",
      provider: "revenuecat",
      environment: "unknown",
      outcome: "failure",
      error_code: "internal_error",
    });
    console.error("[RevenueCat Webhook] Fatal error");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
