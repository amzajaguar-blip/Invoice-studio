export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/convert/pdf-extract/upload-url
 *
 * Genera un signed upload URL per il bucket `pdf-imports`. Il client
 * (web o mobile) usa questo URL per caricare il PDF DIRETTAMENTE su Supabase
 * Storage, evitando il body Vercel (~4,5 MB) che prima cappava i PDF a
 * ~3,4 MB. La rotta sorella `/api/convert/pdf-extract` poi scarica il file
 * dal bucket con service role, estrae il testo e cancella il file.
 *
 * Ingresso: nessuno (vuoto). L'autenticazione arriva da cookie (web) o
 *           Bearer token (mobile), gestita da `getAuthFromRequest`.
 * Uscita:   { signedUrl, path, token } | { error }
 *
 * Convenzione di path: `${user.id}/${randomUUID()}.pdf` — la prima cartella
 * e' l'user id, in modo che la policy RLS
 * `pdf_imports_user_folder` (vedi migration 20260831...) impedisca a un
 * utente di sovrascrivere file nella cartella di un altro.
 */

const BUCKET = "pdf-imports";

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }
  const { user } = auth;

  // Throttle stretto: questa rotta e' il "passaggio del testimone" per il
  // flusso OCR, e ogni chiamata genera un signed URL che andra' consumato.
  // Un utente che ne chiede in raffica puo' solo accumulare URL inutilizzati
  // — non un danno diretto, ma rumore che nasconde abusi. 10 al minuto e'
  // molto oltre l'uso reale.
  const rlKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(
    `pdf-upload-url:${rlKey}`,
    RATE_LIMITS.strict.max,
    RATE_LIMITS.strict.windowMs
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 }
    );
  }

  const path = `${user.id}/${randomUUID()}.pdf`;

  // createSignedUploadUrl restituisce { signedUrl, path, token }. Il token
  // e' richiesto solo se si vuole completare l'upload con il flusso
  // supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file).
  // Noi restituiamo l'URL intero: il client fara' un PUT diretto, che
  // supabase Storage accetta senza bisogno del token separato.
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      {
        error: "signed_url_failed",
        detail: process.env.NODE_ENV === "production"
          ? undefined
          : error?.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  });
}
