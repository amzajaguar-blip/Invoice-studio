import { supabase } from '@/lib/supabase';
import { understandRequest, UnderstandingInput, UnderstandingResult } from '@/lib/document/understanding';

/**
 * Remote document‑understanding via Supabase Edge Function.
 *
 * Tries to call the `understand-document` Edge Function. If the request fails
 * (network error, non‑200 response, or malformed payload) it gracefully falls
 * back to the local heuristic implementation (`understandRequest`).
 */
export async function understandDocument(input: UnderstandingInput): Promise<UnderstandingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('understand-document', {
      body: input,
    });

    // Expected shape matches local UnderstandingResult enough for downstream.
    // If the shape differs, fallback.
    if (!error && data && typeof data.type === 'string' && data.model) {
      return {
        type: data.type,
        model: data.model,
        confidence: 0.6,
        source: 'remote',
        extractedFields: {},
      };
    }
    // Fall through to fallback on any error or unexpected shape.
  } catch {
    // swallow – will use fallback.
  }
  // Fallback to local heuristic.
  return understandRequest(input);
}
