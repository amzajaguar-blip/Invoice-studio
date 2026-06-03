/**
 * ocr-preprocess.ts — Lightweight image preprocessing for OCR accuracy
 *
 * Applies grayscale → contrast normalization → binary threshold → smart resize
 * to dramatically improve Tesseract.js text extraction from smartphone photos.
 *
 * Graceful degradation: if Jimp fails for any reason, the original buffer
 * is returned unchanged so OCR can still be attempted on the raw image.
 */
import { Jimp } from "jimp";

const MAX_WIDTH = 2500;
const THRESHOLD = 128;

/**
 * Preprocess an image buffer for OCR.
 * - Converts to grayscale
 * - Normalizes contrast
 * - Applies binary threshold (pixel < 128 → black, ≥ 128 → white)
 * - Resizes if width exceeds 2500px (maintains aspect ratio)
 * - Exports as PNG
 *
 * @returns Preprocessed PNG buffer, or the original buffer if preprocessing fails
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = await Jimp.read(buffer);

    // Step 1: Grayscale
    image.greyscale();

    // Step 2: Normalize contrast (stretches histogram to full 0-255 range)
    image.normalize();

    // Step 3: Binary threshold — hard black/white for OCR engines
    image.scan(
      0,
      0,
      image.bitmap.width,
      image.bitmap.height,
      function (this: typeof image, _x: number, _y: number, idx: number) {
        // In grayscale, R=G=B, so check any channel
        const value = this.bitmap.data[idx]!;
        const binary = value < THRESHOLD ? 0 : 255;
        this.bitmap.data[idx] = binary; // R
        this.bitmap.data[idx + 1] = binary; // G
        this.bitmap.data[idx + 2] = binary; // B
        // Alpha channel (idx + 3) left unchanged
      }
    );

    // Step 4: Resize if too large (preserve aspect ratio)
    // Jimp 1.x: specify only width, height auto-calculated
    if (image.bitmap.width > MAX_WIDTH) {
      image.resize({ w: MAX_WIDTH });
    }

    // Step 5: Export as PNG buffer
    const pngBuffer = await image.getBuffer("image/png");
    return pngBuffer;
  } catch (err) {
    console.warn(
      "[ocr-preprocess] Preprocessing failed, falling back to original image:",
      err instanceof Error ? err.message : err
    );
    return buffer;
  }
}
