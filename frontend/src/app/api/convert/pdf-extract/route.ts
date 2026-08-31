export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PDF_BUCKET_BYTES } from "@/lib/upload-limits";
import { checkMiloQuota, incrementMiloQuota } from "@/lib/milo-quota";

/**
 * POST /api/convert/pdf-extract — estrae il testo di un PDF, pagina per pagina.
 *
 * Perche' esiste
 * ──────────────
 * Milo Office converte i file sul dispositivo: fogli di calcolo con SheetJS,
 * .docx via JSZip, testo semplice direttamente. Il PDF e' l'unica sorgente che
 * il telefono non sa leggere — servirebbe un motore di parsing che su React
 * Native non e' praticabile. Qui c'e' gia' `pdfjs-dist`, quindi l'estrazione
 * passa dal server.
 *
 * La rotta e' volutamente SOTTILE: restituisce solo il testo, non il file
 * finale. Il PDF, l'Excel o il Word li produce poi l'app con i motori che ha
 * gia', cosi' la resa dei documenti non si biforca su due stack diversi.
 *
 * Flusso (Agosto 2026)
 * ────────────────────
 * Prima il PDF viaggiava come base64 nel body JSON. Il body Vercel si ferma a
 * 4,5 MB, e in base64 un file e' 4/3 piu' grande — quindi il tetto reale era
 * circa 3,4 MB, ben sotto il limite utente di 10 MB. Ora il client carica il
 * PDF DIRETTAMENTE sul bucket `pdf-imports` via signed URL (rotta sorella
 * `/api/convert/pdf-extract/upload-url`), e qui riceviamo solo il `path`.
 *
 * Vantaggi:
 * - Bypassa il body Vercel 4,5 MB.
 * - Il limite utente (20 MB) e il limite infrastrutturale (25 MB bucket)
 *   tornano ad essere gli unici tetti rilevanti.
 *
 * Ingresso  { path: string, filename?: string }
 * Uscita    { success: true, pages: string[] } | { success: false, error }
 */

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface ExtractSuccess {
  success: true;
  pages: string[];
  /**
   * Numero di pagine del PDF originale.
   *
   * Serve perche' `pages.length` puo' essere inferiore: oltre MAX_PAGES
   * l'estrazione si ferma. Senza dirlo, chi converte un PDF di 300 pagine
   * riceveva un documento che sembra completo e ne ha perse cento — un danno
   * silenzioso, il tipo peggiore.
   */
  totalPages: number;
  /** true se l'estrazione si e' fermata a MAX_PAGES. */
  truncated: boolean;
}

interface ExtractError {
  success: false;
  error: string;
  detail?: string;
}

type ExtractResponse = ExtractSuccess | ExtractError;

/**
 * Limite infrastrutturale: coincide con il file_size_limit del bucket
 * `pdf-imports` (25 MB). NON e' il tetto utente (20 MB) — la differenza e'
 * margine di sicurezza per il client che non ha letto MAX_UPLOAD_BYTES.
 * Vedi `frontend/src/lib/upload-limits.ts`.
 */
const MAX_PDF_BYTES = MAX_PDF_BUCKET_BYTES;

/** Limite di pagine: oltre, l'estrazione supererebbe maxDuration. */
const MAX_PAGES = 200;

const BUCKET = "pdf-imports";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Scarica il PDF dal bucket e lo elimina (best-effort) in ogni caso.
 * L'eliminazione e' centralizzata qui cosi' le rotte di errore non lasciano
 * file orfani.
 */
async function downloadAndCleanup(
  path: string,
  buffer: { value?: Uint8Array; loaded: boolean }
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(path);
    if (error || !data) {
      return { ok: false, error: "download_failed", status: 500 };
    }
    // supabase-js restituisce Blob su Node 18+. ArrayBuffer e' il modo
    // piu' diretto per ottenere Uint8Array senza dipendere da Buffer globale.
    const ab = await data.arrayBuffer();
    buffer.value = new Uint8Array(ab);
    buffer.loaded = true;
    return { ok: true, data: buffer.value };
  } finally {
    // best-effort: non propaghiamo errori di cleanup. Se fallisce resta un
    // file orfano che il cron giornaliero (TODO) raccogliera'.
    void admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<ExtractResponse>> {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  const { orgId, supabase } = auth;

  // Questa rotta e' la piu' cara del progetto: fino a 60 secondi di parsing
  // pdf.js su un corpo che puo' arrivare al tetto del bucket (25 MB).
  // Autenticare non basta — un solo account puo' ripetere la richiesta in
  // ciclo e tenere occupata la concorrenza delle funzioni. Stesso meccanismo
  // gia' usato da /api/ai/suggest, con un tetto piu' basso perche' qui ogni
  // richiesta pesa molto di piu': convertire un PDF e' un gesto occasionale,
  // non un ciclo.
  const rateKey = getRateLimitKey(request, auth.user.id);
  const { allowed } = rateLimit(`pdf-extract:${rateKey}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  // Pre-check economico: evita di scaricare ed elaborare un PDF (fino a
  // 25 MB, fino a 60s di parsing) per un'org che ha gia' esaurito la quota
  // gratuita e non e' Pro. Vedi frontend/src/lib/milo-quota.ts.
  const quota = await checkMiloQuota(supabase, orgId);
  if (!quota.allowed) {
    return NextResponse.json(
      { success: false, error: "quota_exceeded" },
      { status: 402 }
    );
  }

  let path: string;
  try {
    const body = (await request.json()) as { path?: unknown };
    if (typeof body.path !== "string" || body.path.length === 0) {
      return NextResponse.json(
        { success: false, error: "missing_path" },
        { status: 400 }
      );
    }
    // Sanity: il path DEVE iniziare con l'user id della sessione. La policy
    // RLS gia' lo impone, ma un controllo esplicito qui significa che un bug
    // nella policy non diventa un data leak — diventa un 403 leggibile.
    if (!body.path.startsWith(`${auth.user.id}/`)) {
      return NextResponse.json(
        { success: false, error: "forbidden_path" },
        { status: 403 }
      );
    }
    path = body.path;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  // Scarica dal bucket (e marca per cleanup in finally).
  const cleanupBag: { value?: Uint8Array; loaded: boolean } = { loaded: false };
  let data: Uint8Array;
  try {
    const result = await downloadAndCleanup(path, cleanupBag);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }
    data = result.data;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "download_failed",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }

  if (data.length === 0) {
    return NextResponse.json(
      { success: false, error: "invalid_file" },
      { status: 400 }
    );
  }

  // Doppia protezione sulla dimensione: il bucket dovrebbe rifiutare file
  // oltre 25 MB, ma se una regola Supabase cambia senza che ce ne accorgiamo
  // vogliamo comunque un 413 pulito invece di OOM.
  if (data.length > MAX_PDF_BYTES) {
    return NextResponse.json(
      { success: false, error: "file_too_large" },
      { status: 413 }
    );
  }

  // %PDF — se i magic bytes non ci sono, non è un PDF e non ha senso proseguire.
  // String.fromCharCode invece di .toString("latin1"): TS 5.7+ type-narrows
  // Uint8Array<ArrayBuffer> in modo che .toString() accetti 0 argomenti.
  if (String.fromCharCode(...data.slice(0, 4)) !== "%PDF") {
    return NextResponse.json(
      { success: false, error: "not_a_pdf" },
      { status: 400 }
    );
  }

  try {
    // Build "legacy": è quella pensata per Node, senza dipendenze dal DOM.
    // L'import è dinamico perché pdfjs-dist è ESM e il bundle della rotta
    // resta più leggero quando la conversione non viene usata.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const doc = await pdfjs.getDocument({
      data,
      // Nessun worker separato: in ambiente server il costo di avviarlo non
      // ripaga, e semplifica il deploy. (isEvalSupported rimosso: deprecato
      // nelle versioni recenti di pdfjs-dist, ora sotto 'disableCombineTextItems'
      // o rimosso del tutto a seconda della major.)
      useSystemFonts: true,
    }).promise;

    // Si legge PRIMA di distruggere il documento: `doc.destroy()` libera le
    // strutture interne di pdf.js, e leggere `doc.numPages` dopo quel punto
    // significa interrogare un oggetto smontato. Se restituisse `undefined`,
    // `truncated` diventerebbe falso e l'avviso di troncamento non partirebbe
    // mai — proprio il danno silenzioso che questo campo esiste per evitare.
    const numPages = doc.numPages;
    const total = Math.min(numPages, MAX_PAGES);
    const pages: string[] = [];

    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: unknown) =>
          typeof item === "object" && item !== null && "str" in item
            ? String((item as { str: unknown }).str)
            : ""
        )
        .join(" ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      pages.push(text);
      page.cleanup();
    }

    // In pdfjs 4.x, distruggere esplicitamente il documento non serve: la GC
    // libera le strutture interne quando doc esce dallo scope, e destroy() e'
    // stato rimosso dal typing di PDFDocumentProxy. Chiamare page.cleanup()
    // (gia' fatto nel loop) e' sufficiente per liberare la memoria di ogni
    // pagina dopo l'elaborazione.

    // Un PDF fatto di sole immagini scansionate non ha testo estraibile: dirlo,
    // invece di restituire pagine vuote che l'app convertirebbe in un file vuoto.
    if (pages.every((p) => p.length === 0)) {
      return NextResponse.json(
        { success: false, error: "no_text_layer" },
        { status: 422 }
      );
    }

    // Gate autoritativo, DOPO il successo: il pre-check sopra e' solo
    // un'ottimizzazione, questo e' cio' che conta davvero la quota (skip per
    // le org Pro e per gli errori di rete — vedi incrementMiloQuota).
    if (!quota.isPremium && !quota.networkError) {
      const counted = await incrementMiloQuota(supabase, orgId);
      if (!counted) {
        return NextResponse.json(
          { success: false, error: "quota_exceeded" },
          { status: 402 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      pages,
      totalPages: numPages,
      truncated: numPages > MAX_PAGES,
    });
  } catch (err) {
    console.error("POST /api/convert/pdf-extract error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "extraction_failed",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }
}
