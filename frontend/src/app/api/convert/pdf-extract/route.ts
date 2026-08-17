export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

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
 * Ingresso  { fileBase64: string, filename?: string }
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

/** Oltre questa soglia il PDF non viene nemmeno decodificato. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Limite di pagine: oltre, l'estrazione supererebbe maxDuration. */
const MAX_PAGES = 200;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<ExtractResponse>> {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  // Questa rotta e' la piu' cara del progetto: fino a 60 secondi di parsing
  // pdf.js su un corpo che puo' arrivare al tetto di Vercel. Autenticare non
  // basta — un solo account puo' ripetere la richiesta in ciclo e tenere
  // occupata la concorrenza delle funzioni. Stesso meccanismo gia' usato da
  // /api/ai/suggest, con un tetto piu' basso perche' qui ogni richiesta pesa
  // molto di piu': convertire un PDF e' un gesto occasionale, non un ciclo.
  const rateKey = getRateLimitKey(request, auth.user.id);
  const { allowed } = rateLimit(`pdf-extract:${rateKey}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  let fileBase64: string;
  try {
    const body = (await request.json()) as { fileBase64?: unknown };
    if (typeof body.fileBase64 !== "string" || body.fileBase64.length === 0) {
      return NextResponse.json(
        { success: false, error: "missing_file" },
        { status: 400 }
      );
    }
    fileBase64 = body.fileBase64;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  // Il base64 pesa ~4/3 dei byte reali: si controlla prima di decodificare,
  // così un file enorme non viene mai materializzato in memoria.
  if ((fileBase64.length * 3) / 4 > MAX_PDF_BYTES) {
    return NextResponse.json(
      { success: false, error: "file_too_large" },
      { status: 413 }
    );
  }

  const data = Buffer.from(fileBase64, "base64");
  if (data.length === 0) {
    return NextResponse.json(
      { success: false, error: "invalid_file" },
      { status: 400 }
    );
  }

  // %PDF — se i magic bytes non ci sono, non è un PDF e non ha senso proseguire.
  if (data.subarray(0, 4).toString("latin1") !== "%PDF") {
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
      data: new Uint8Array(data),
      // Nessun worker separato: in ambiente server il costo di avviarlo non
      // ripaga, e semplifica il deploy.
      useSystemFonts: true,
      isEvalSupported: false,
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

    await doc.destroy();

    // Un PDF fatto di sole immagini scansionate non ha testo estraibile: dirlo,
    // invece di restituire pagine vuote che l'app convertirebbe in un file vuoto.
    if (pages.every((p) => p.length === 0)) {
      return NextResponse.json(
        { success: false, error: "no_text_layer" },
        { status: 422 }
      );
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
