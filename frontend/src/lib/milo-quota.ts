import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * milo-quota.ts — backstop server-side per la quota documenti di Milo Office.
 *
 * PERCHE' ESISTE
 * ──────────────
 * mobile/lib/quota-engine.ts applica la quota (20 documenti gratuiti + stato
 * Pro da RevenueCat) SOLO lato client. Per le generazioni interamente locali
 * va bene cosi' — e' una scelta consapevole documentata li'. Ma
 * /api/ocr/receipt e /api/convert/pdf-extract fanno compute reale sul server
 * (Tesseract, pdf.js): senza un controllo qui, chiunque abbia un Bearer token
 * Supabase valido puo' chiamarle direttamente, bypassando sia il muro
 * gratuito sia il controllo Pro.
 *
 * Lo stato Pro qui e' organizations.milo_pro_active, scritto SOLO dal webhook
 * RevenueCat (api/webhooks/revenuecat/route.ts). NON e' organizations.plan:
 * quel campo serve al sito web legacy e non riflette lo stato Pro reale.
 */

const DEFAULT_MILO_FREE_QUOTA = 20;

export interface MiloQuotaStatus {
  allowed: boolean;
  isPremium: boolean;
  total: number;
  limit: number;
  /**
   * true quando la SELECT e' fallita: lo stato reale (Pro o no, quota usata)
   * e' sconosciuto. I chiamanti devono trattarlo come "non giudicare questa
   * richiesta" — vedi il commento su incrementMiloQuota e i call site in
   * ocr/receipt e pdf-extract, che saltano il gate autoritativo quando true.
   */
  networkError?: boolean;
}

/**
 * Pre-check economico (una SELECT) da fare PRIMA di eseguire OCR/estrazione:
 * evita di spendere compute per una richiesta che sarebbe comunque rifiutata.
 * Non e' pero' il gate autoritativo — vedi incrementMiloQuota.
 */
export async function checkMiloQuota(
  supabase: SupabaseClient,
  orgId: string
): Promise<MiloQuotaStatus> {
  const { data, error } = await supabase
    .from("organizations")
    .select("documents_generated_total, quota_limit, documents_reward_credits, milo_pro_active")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[milo-quota] checkMiloQuota failed:", error.message);
    // Stato sconosciuto — non rifiutiamo la richiesta (stesso principio di
    // fail-open gia' usato per gli errori di rete in
    // mobile/lib/quota-engine.ts), ma marchiamo networkError cosi' i
    // chiamanti saltano anche il gate post-successo: altrimenti isPremium
    // risulterebbe falsamente false e un cliente Pro reale, colpito da un
    // blip momentaneo qui, si vedrebbe rifiutare la richiesta dal gate
    // autoritativo subito dopo — che pero' non sa nulla di "Pro", sa solo
    // contare la quota free.
    return { allowed: true, isPremium: false, total: 0, limit: Infinity, networkError: true };
  }

  if (data?.milo_pro_active) {
    return { allowed: true, isPremium: true, total: 0, limit: Infinity };
  }

  const total = data?.documents_generated_total ?? 0;
  const limit =
    (data?.quota_limit ?? DEFAULT_MILO_FREE_QUOTA) + (data?.documents_reward_credits ?? 0);
  return { allowed: total < limit, isPremium: false, total, limit };
}

/**
 * Gate autoritativo: incrementa atomicamente lo stesso contatore che il
 * client mobile incrementa per le generazioni locali (RPC condivisa
 * increment_document_quota, vedi mobile/lib/quota-engine.ts e la migrazione
 * 20260831010000_milo_quota_hardening.sql che ne blocca l'uso cross-org).
 *
 * Ritorna false se la quota risultava esaurita AL MOMENTO dell'incremento
 * (race col pre-check, o bypass diretto del pre-check) — il chiamante deve
 * negare la risposta, anche se il lavoro costoso e' gia' stato fatto: e'
 * un edge case raro, non vale la pena complicare il flusso per evitarlo.
 *
 * Da chiamare SOLO sui flussi che passano da questo backend (OCR, PDF) e
 * SOLO dopo un successo. Le generazioni interamente locali continuano a
 * contare da sole via countGeneratedDocument() lato mobile — chiamare questa
 * funzione anche li' duplicherebbe il conteggio.
 */
export async function incrementMiloQuota(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("increment_document_quota", { org_id: orgId });
  if (error) {
    console.error("[milo-quota] increment_document_quota failed:", error.message);
    return false;
  }
  return data !== null;
}
