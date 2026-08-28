// supabase/functions/understand-document/index.ts
// Edge Function – Document understanding (fallback).
//
// Accepts a POST JSON payload with optional fields:
//   {
//     "prompt": string,          // Natural‑language request from the UI
//     "title": string?,         // Optional explicit title
//     "forcedType": string?    // Optional DocumentType to skip classification
//   }
//
// Returns a JSON DocumentModel representation that the client can feed into
// the existing `generateDocument` pipeline. The implementation is deliberately
// lightweight – it does **not** call any external AI service. It performs a
// very basic heuristic classification based on keyword matching (a reduced
// version of the local `understanding` module) and builds a minimal model.
//
// This function is meant as a fallback when the full AI‑driven pipeline is
// unavailable (e.g., network outage, rate‑limit). The mobile client can merge
// the result with its richer local heuristic if needed.
//
// Requires a valid Supabase JWT in the Authorization header — the client
// (mobile/lib/document-understand.ts) always calls this via
// supabase.functions.invoke(), which attaches the session token automatically.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Simple keyword map for a few common document types – extend as needed.
const TYPE_KEYWORDS: Record<string, string[]> = {
  invoice: ["fattura", "invoice", "iva", "importo", "totale"],
  quote: ["preventivo", "quote", "offerta", "stima"],
  cv: ["curriculum", "cv", "resume", "esperienza", "formazione"],
  coverLetter: ["lettera di presentazione", "cover letter", "candidatura"],
  businessLetter: ["lettera commerciale", "spett.le", "spettabile"],
  meetingMinutes: ["verbale", "riunione", "ordine del giorno"],
  contract: ["contratto", "clausole", "durata"],
  report: ["report", "relazione", "analisi"],
  notes: ["note", "appunti", "memo"],
};

type DocumentModel = {
  metadata: { title: string };
  blocks: any[];
  // other fields are optional for the consumer – they will be merged later.
};

type ResponsePayload = {
  type: string; // DocumentType (e.g., "invoice", "simple", …)
  model: DocumentModel;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Auth: richiede un JWT Supabase valido ────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  let payload: { prompt?: string; title?: string; forcedType?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const text = payload.prompt?.trim() ?? "";
  const explicitTitle = payload.title?.trim();
  const forced = payload.forcedType;

  // -----------------------------------------------------------------------
  // Simple classification – iterate over keyword sets and pick the first match.
  // -----------------------------------------------------------------------
  let docType = "simple" as string;
  if (forced) {
    docType = forced;
  } else if (text) {
    const lower = text.toLowerCase();
    outer: for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          docType = type;
          break outer;
        }
      }
    }
  }

  // Build a minimal DocumentModel. For now we only populate metadata.title.
  const model: DocumentModel = {
    metadata: { title: explicitTitle ?? (text ? text.split(/\s+/).slice(0, 4).join(" ") : "Documento") },
    blocks: [],
  };

  const response: ResponsePayload = { type: docType as any, model };
  return jsonResponse(response, 200);
});
