import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/voice-transcription";

const bodySchema = z.object({
  audioUrl: z.string().url(),
  language: z.string().min(2).max(8).optional(),
  prompt: z.string().max(500).optional(),
});

/**
 * POST /api/ai/voice-transcribe
 * Transcribe an audio file at `audioUrl` using Whisper via Forge.
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = auth;

  // Rate limit: 10 transcriptions per 5 minutes per user
  const rlKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`voice-transcribe:${rlKey}`, 10, 5 * 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Troppe richieste. Attendi qualche minuto." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }

  const result = await transcribeAudio(parsed.data);

  if ("error" in result) {
    const status =
      result.code === "FILE_TOO_LARGE"
        ? 413
        : result.code === "INVALID_FORMAT"
        ? 400
        : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    text: result.text,
    language: result.language,
    duration: result.duration,
    segments: result.segments,
  });
}
