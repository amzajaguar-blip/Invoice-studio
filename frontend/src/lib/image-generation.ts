/**
 * Image generation using Forge ImageService.
 * Saves the generated PNG to Supabase Storage (`generated-images` bucket).
 *
 * Configure via env:
 *   FORGE_API_URL                — e.g. https://forge.manus.im
 *   FORGE_API_KEY                — bearer token
 *   NEXT_PUBLIC_SUPABASE_URL     — public Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (server-only)
 *
 * Bucket setup (run once in Supabase SQL editor):
 *   insert into storage.buckets (id, name, public) values ('generated-images', 'generated-images', true);
 *
 * @example
 * ```ts
 * const { url } = await generateImage({ prompt: "A futuristic invoice dashboard" });
 * ```
 */

import { createClient } from "@supabase/supabase-js";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url: string;
};

const BUCKET = "generated-images";

function base64ToBytes(base64: string): Uint8Array {
  // Edge-compatible base64 → Uint8Array (no Buffer)
  if (typeof globalThis.atob === "function") {
    const bin = globalThis.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // Node.js fallback
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiUrl = process.env.FORGE_API_URL;
  const apiKey = process.env.FORGE_API_KEY;

  if (!apiUrl) throw new Error("FORGE_API_URL is not configured");
  if (!apiKey) throw new Error("FORGE_API_KEY is not configured");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase storage env vars not configured");
  }

  // Step 1: Call Forge ImageService
  const baseUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages ?? [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: { b64Json: string; mimeType: string };
  };

  // Step 2: Decode base64 → bytes (Edge-compatible)
  const bytes = base64ToBytes(result.image.b64Json);

  // Step 3: Upload to Supabase Storage
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: result.image.mimeType ?? "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { url: data.publicUrl };
}
