/**
 * Voice transcription using Whisper API via Forge gateway.
 *
 * Configure via env:
 *   FORGE_API_URL  — e.g. https://forge.manus.im
 *   FORGE_API_KEY  — bearer token
 *
 * @example
 * ```ts
 * import { transcribeAudio } from "@/lib/voice-transcription";
 *
 * const result = await transcribeAudio({
 *   audioUrl: "https://example.com/audio.mp3",
 *   language: "it",
 * });
 *
 * if ("error" in result) {
 *   console.error(result.error);
 * } else {
 *   console.log(result.text);
 * }
 * ```
 */

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "TRANSCRIPTION_FAILED"
    | "UPLOAD_FAILED"
    | "SERVICE_ERROR";
  details?: string;
};

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB

const LANG_MAP: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", ja: "Japanese", ko: "Korean", zh: "Chinese",
  ar: "Arabic", hi: "Hindi", nl: "Dutch", pl: "Polish", tr: "Turkish",
  sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish",
};

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp3": "mp3",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
};

function getFileExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "audio";
}

function getLanguageName(code: string): string {
  return LANG_MAP[code] ?? code;
}

export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  const apiUrl = process.env.FORGE_API_URL;
  const apiKey = process.env.FORGE_API_KEY;

  if (!apiUrl) {
    return {
      error: "Voice transcription service is not configured",
      code: "SERVICE_ERROR",
      details: "FORGE_API_URL is not set",
    };
  }
  if (!apiKey) {
    return {
      error: "Voice transcription service authentication is missing",
      code: "SERVICE_ERROR",
      details: "FORGE_API_KEY is not set",
    };
  }

  // Step 1: Download the audio (Edge-compatible; uses ArrayBuffer, not Buffer)
  let audioBuffer: ArrayBuffer;
  let mimeType: string;
  try {
    const dlResponse = await fetch(options.audioUrl);
    if (!dlResponse.ok) {
      return {
        error: "Failed to download audio file",
        code: "INVALID_FORMAT",
        details: `HTTP ${dlResponse.status}: ${dlResponse.statusText}`,
      };
    }
    audioBuffer = await dlResponse.arrayBuffer();
    mimeType = dlResponse.headers.get("content-type") ?? "audio/mpeg";

    if (audioBuffer.byteLength > MAX_BYTES) {
      return {
        error: "Audio file exceeds maximum size limit",
        code: "FILE_TOO_LARGE",
        details: `File size ${(audioBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB > 16MB`,
      };
    }
  } catch (err) {
    return {
      error: "Failed to fetch audio file",
      code: "SERVICE_ERROR",
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Step 2: Build multipart form
  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([audioBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const prompt =
    options.prompt ??
    (options.language
      ? `Transcribe the user's voice to text. Working language: ${getLanguageName(options.language)}`
      : "Transcribe the user's voice to text");
  formData.append("prompt", prompt);

  // Step 3: Call Whisper
  const baseUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "Accept-Encoding": "identity",
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    return {
      error: "Transcription service request failed",
      code: "TRANSCRIPTION_FAILED",
      details: `${response.status} ${response.statusText}${errText ? `: ${errText}` : ""}`,
    };
  }

  const whisperResponse = (await response.json()) as WhisperResponse;

  if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
    return {
      error: "Invalid transcription response",
      code: "SERVICE_ERROR",
      details: "Service returned an invalid format",
    };
  }

  return whisperResponse;
}
