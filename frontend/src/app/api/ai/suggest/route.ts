import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/ai/suggest
 *
 * AI-powered suggestions for invoice creation using Google Gemini (free tier).
 * Protected: requires authenticated user (cookie or Bearer token).
 *
 * Body:
 *   { type: "description" | "notes" | "client_message", context: {...}, prompt?: string }
 * Response:
 *   { suggestion: string }
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── System prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  description:
    "Sei un assistente specializzato in fatturazione italiana. " +
    "Generi descrizioni professionali per voci di fattura in italiano. " +
    "Le descrizioni devono essere concise (max 2-3 parole), chiare e professionali. " +
    "Esempi: 'Consulenza strategica', 'Sviluppo frontend React', 'Redazione contratto', 'Gestione social media'. " +
    "Rispondi SOLO con la descrizione, senza virgolette, senza spiegazioni, senza prefissi.",

  notes:
    "Sei un assistente specializzato in fatturazione italiana. " +
    "Generi note professionali per fatture in italiano. " +
    "Le note possono includere: modalità di pagamento, scadenza, riferimenti contrattuali, ringraziamenti. " +
    "Esempio: 'Pagamento tramite bonifico bancario entro 30 giorni. IBAN: IT... Riferimento: Contratto Q1 2026.' " +
    "Rispondi SOLO con il testo della nota, senza virgolette, senza prefissi.",

  client_message:
    "Sei un assistente cortese e professionale. Scrivi un breve messaggio email per accompagnare l'invio di una fattura a un cliente italiano. " +
    "Il tono deve essere cordiale ma formale. " +
    "Rispondi SOLO con il testo del messaggio, senza oggetto, senza virgolette, senza firma.",
};

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check — supports both cookie (web) and Bearer token (mobile)
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // Rate limiting: 20 AI suggestions per minute per user (Gemini is costly)
  const rateKey = getRateLimitKey(request, auth.user.id);
  const { allowed } = rateLimit(`ai-suggest:${rateKey}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche secondo." },
      { status: 429 }
    );
  }

  // Parse body
  let body: { type: string; context?: Record<string, unknown>; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const { type, context = {}, prompt } = body;

  if (!type || !SYSTEM_PROMPTS[type]) {
    return NextResponse.json(
      { error: `Tipo non valido. Usa: ${Object.keys(SYSTEM_PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  // Build user prompt from context
  const contextStr = Object.entries(context)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userPrompt = prompt
    ? `Contesto:\n${contextStr}\n\nRichiesta dell'utente: ${prompt}`
    : `Contesto:\n${contextStr}\n\nGenera un suggerimento appropriato.`;

  // ─── Gemini API call ──────────────────────────────────────────────────────
  if (GEMINI_API_KEY) {
    try {
      const suggestion = await callGemini(SYSTEM_PROMPTS[type], userPrompt);
      return NextResponse.json({ suggestion });
    } catch (err) {
      console.error("Gemini API error:", err);
      // Fallback: return a deterministic suggestion based on type
      return NextResponse.json({
        suggestion: getFallback(type, context),
        fallback: true,
      });
    }
  }

  // No API key configured — return helpful fallback
  return NextResponse.json({
    suggestion: getFallback(type, context),
    fallback: true,
    message: "Configura GEMINI_API_KEY per suggerimenti AI avanzati",
  });
}

// ─── Gemini API helper ───────────────────────────────────────────────────────

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generation_config: {
        temperature: 0.7,
        max_output_tokens: 200,
        top_p: 0.95,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Risposta Gemini vuota");
  return text.trim();
}

// ─── Deterministic fallbacks ─────────────────────────────────────────────────

function getFallback(
  type: string,
  context: Record<string, unknown>
): string {
  switch (type) {
    case "description": {
      const area = String(context.area || context.category || "");
      const map: Record<string, string> = {
        sviluppo: "Sviluppo software",
        design: "Progettazione grafica",
        marketing: "Consulenza marketing",
        legale: "Consulenza legale",
        contabilità: "Consulenza fiscale",
        copywriting: "Redazione contenuti",
        social: "Gestione social media",
        video: "Produzione video",
        formazione: "Formazione professionale",
        default: "Consulenza professionale",
      };
      const key = Object.keys(map).find((k) => area.toLowerCase().includes(k));
      return map[key || "default"];
    }
    case "notes":
      return "Pagamento tramite bonifico bancario entro 30 giorni dalla data fattura. Per qualsiasi domanda, non esitare a contattarci.";
    case "client_message":
      return `Gentile cliente,\n\nin allegato trovi la fattura relativa ai servizi prestati. Resto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti.`;
    default:
      return "";
  }
}
