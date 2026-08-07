/**
 * translation-service.ts — Traduzione contenuti documento tramite Gemini Flash
 *
 * Invia SOLO i campi testuali inseriti dall'utente (titolo, descrizioni voci, note).
 * NON invia: valori numerici, date, email, P.IVA, credenziali, Product_ID IAP.
 *
 * Timeout: 30 secondi. Fallback graceful: restituisce i campi originali.
 * La traduzione NON incrementa il Quota_Engine.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.6, 21.7, 21.10
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Lingue supportate ────────────────────────────────────────────────────────

export interface SupportedLanguage {
  code: string;
  displayName: string;
  flag: string;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: SupportedLanguage[] = [
  { code: "it", displayName: "Italiano", flag: "🇮🇹" },
  { code: "en", displayName: "English", flag: "🇬🇧" },
  { code: "es", displayName: "Español", flag: "🇪🇸" },
  { code: "fr", displayName: "Français", flag: "🇫🇷" },
  { code: "de", displayName: "Deutsch", flag: "🇩🇪" },
  { code: "pt", displayName: "Português", flag: "🇵🇹" },
  { code: "zh", displayName: "中文", flag: "🇨🇳" },
  { code: "ar", displayName: "العربية", flag: "🇸🇦" },
  { code: "ja", displayName: "日本語", flag: "🇯🇵" },
  { code: "ru", displayName: "Русский", flag: "🇷🇺" },
];

// ─── Tipi ─────────────────────────────────────────────────────────────────────

/**
 * Campi testuali inseribili dall'utente in un documento.
 * Contiene SOLO testo — nessun campo numerico, data, email, P.IVA.
 */
export interface TranslatableFields {
  /** Titolo del documento (es. "Preventivo Progetto X") */
  title?: string;
  /** Descrizioni delle voci (es. ["Consulenza strategica", "Sviluppo UI"]) */
  descriptions: string[];
  /** Note aggiuntive dell'utente */
  notes?: string;
}

export interface TranslationResult {
  fields: TranslatableFields;
  translated: boolean;
  targetLang?: string;
  error?: string;
}

export class TranslationTimeoutError extends Error {
  constructor() {
    super("Translation API timeout after 30 seconds");
    this.name = "TranslationTimeoutError";
  }
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TRANSLATION_TIMEOUT_MS = 30_000;

// ─── Regex per filtraggio campi non testuali ──────────────────────────────────

/** Rimuove valori che sembrano numerici, date ISO, email, P.IVA — non li manda a Gemini */
const NUMERIC_RE = /^\d+([.,]\d+)?([eE][+-]?\d+)?$/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}/;
const EMAIL_RE = /\S+@\S+\.\S+/;
const VAT_IT_RE = /^IT\d{11}$/i;

function isSafeToTranslate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (NUMERIC_RE.test(v)) return false;
  if (DATE_ISO_RE.test(v)) return false;
  if (EMAIL_RE.test(v)) return false;
  if (VAT_IT_RE.test(v)) return false;
  return true;
}

// ─── Helper: chiave API ───────────────────────────────────────────────────────

function getGeminiApiKey(): string {
  // In produzione la chiave viene iniettata via variabile d'ambiente a build time
  // tramite expo-constants o process.env configurato nel build pipeline.
  // NON viene mai hardcoded nel codice sorgente.
  const rawKey =
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_GEMINI_API_KEY : undefined;
  const key: string = typeof rawKey === "string" ? rawKey : "";
  return key;
}

// ─── Funzione principale ──────────────────────────────────────────────────────

/**
 * Traduce i campi testuali di un documento nella lingua target.
 *
 * - Filtra automaticamente i valori non testuali (numeri, date, email, P.IVA)
 * - Timeout 30s → restituisce campi originali con { translated: false, error: 'timeout' }
 * - Errore rete → restituisce campi originali con { translated: false, error: string }
 * - NON incrementa il Quota_Engine
 * - NON invia credenziali, identificatori sessione o Product_ID IAP
 */
export async function translateDocumentContent(
  fields: TranslatableFields,
  targetLang: string
): Promise<TranslationResult> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn("[translation-service] EXPO_PUBLIC_GEMINI_API_KEY not set — skipping translation");
    return {
      fields,
      translated: false,
      error: "api_key_missing",
    };
  }

  // Filtra solo i campi che vale la pena tradurre
  const filteredDescriptions = fields.descriptions.filter(isSafeToTranslate);
  const hasContent =
    (fields.title && isSafeToTranslate(fields.title)) ||
    filteredDescriptions.length > 0 ||
    (fields.notes && isSafeToTranslate(fields.notes));

  if (!hasContent) {
    return {
      fields,
      translated: false,
      error: "no_translatable_content",
    };
  }

  // Costruisce il payload da inviare (solo testo)
  const payload: Record<string, string | string[]> = {};
  if (fields.title && isSafeToTranslate(fields.title)) {
    payload.title = fields.title;
  }
  if (filteredDescriptions.length > 0) {
    payload.descriptions = filteredDescriptions;
  }
  if (fields.notes && isSafeToTranslate(fields.notes)) {
    payload.notes = fields.notes;
  }

  const langName =
    SUPPORTED_TRANSLATION_LANGUAGES.find((l) => l.code === targetLang)?.displayName ??
    targetLang;

  const prompt = `Translate the following JSON fields to ${langName}. 
Return ONLY a valid JSON object with the same structure. 
Do NOT translate keys. Do NOT add explanations.
Input: ${JSON.stringify(payload)}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Race tra la chiamata API e il timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TranslationTimeoutError()), TRANSLATION_TIMEOUT_MS)
    );

    const generatePromise = model.generateContent(prompt);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const text = result.response.text().trim();

    // Parsing della risposta JSON
    let parsed: Record<string, string | string[]>;
    try {
      // Gemini a volte wrappa con ```json ... ```
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Invalid JSON response from Gemini: ${text.slice(0, 200)}`);
    }

    // Ricostruisce TranslatableFields con i valori tradotti
    const translatedFields: TranslatableFields = {
      title:
        typeof parsed.title === "string" ? parsed.title : fields.title,
      descriptions: Array.isArray(parsed.descriptions)
        ? (parsed.descriptions as string[])
        : fields.descriptions,
      notes:
        typeof parsed.notes === "string" ? parsed.notes : fields.notes,
    };

    return {
      fields: translatedFields,
      translated: true,
      targetLang,
    };
  } catch (err) {
    if (err instanceof TranslationTimeoutError) {
      return {
        fields,
        translated: false,
        error: "timeout",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[translation-service] error:", message);

    return {
      fields,
      translated: false,
      error: message,
    };
  }
}

/**
 * Estrae i campi tradubili da un documento generico.
 * Utility per costruire TranslatableFields dai dati delle schermate.
 */
export function extractTranslatableFields(params: {
  title?: string;
  lineItemDescriptions?: string[];
  notes?: string;
}): TranslatableFields {
  return {
    title: params.title,
    descriptions: (params.lineItemDescriptions ?? []).filter(Boolean),
    notes: params.notes,
  };
}
