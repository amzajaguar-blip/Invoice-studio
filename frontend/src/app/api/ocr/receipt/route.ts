export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";

// ─── Parsing helpers ──────────────────────────────────────────────────────────

const TOTAL_RE = /totale\s*(da\s*pagare)?|total[ei]?|importo\s*(totale)?|da\s*pagare|subtotale|amount|tot\b/i;
const DATE_RE = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/;

function parseVendor(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^\d/.test(l));
  return (lines[0] ?? "").slice(0, 60);
}

function parseDate(text: string): string {
  const match = text.match(DATE_RE);
  if (!match) return "";
  const [, d, m, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`;
}

function parseTotal(text: string): number | null {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (TOTAL_RE.test(lines[i])) {
      const combined = `${lines[i]} ${lines[i + 1] ?? ""}`;
      const m = combined.match(/\b(\d{1,6})[.,](\d{2})\b/);
      if (m) return parseFloat(m[0].replace(",", "."));
    }
  }

  // Fallback: last monetary-looking value (usually the grand total at bottom)
  const all = [...text.matchAll(/\b(\d{1,6})[.,](\d{2})\b/g)];
  if (all.length > 0) return parseFloat(all[all.length - 1][0].replace(",", "."));
  return null;
}

function detectCurrency(text: string): string {
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  if (/\$|\bUSD\b/i.test(text)) return "USD";
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  return "EUR";
}

// ─── POST /api/ocr/receipt ────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let imageBase64: string;
  try {
    const body = await request.json();
    imageBase64 = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,...")
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  try {
    const worker = await createWorker(["ita", "eng"]);
    const {
      data: { text },
    } = await worker.recognize(buffer);
    await worker.terminate();

    return NextResponse.json({
      vendor: parseVendor(text),
      date: parseDate(text),
      total: parseTotal(text),
      currency: detectCurrency(text),
      rawText: text,
    });
  } catch (err) {
    console.error("OCR failed:", err);
    return NextResponse.json(
      {
        error: "OCR processing failed",
        detail: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
