/**
 * validation/index.ts — Validazione e riparazione runtime post-generazione.
 *
 * Ogni file generato passa: GENERATE → VALIDATE → REPAIR → VALIDATE → FINALIZE
 * Controlla: esistenza, dimensione, magic bytes, struttura, parsing, contenuto non vuoto.
 * Se fallisce: tenta riparazione (builder semplificato), poi errore comprensibile.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import type { DocumentModel, BlockElement } from '../model';
import type { OutputFormat } from '../builders';
import { documentToText } from '../builders/shared';
import { safeName } from '../builders/shared';

export interface ValidationResult {
  valid: boolean;
  /** Dimensione file in byte */
  size?: number;
  /** MIME type rilevato */
  mimeType?: string;
  /** Magic bytes (hex) */
  magicBytes?: string;
  /** Errori di validazione */
  errors: string[];
  /** Avvisi non bloccanti */
  warnings: string[];
  /** Se è stato tentato un repair */
  repaired: boolean;
  /** Dettagli tecnici per log */
  details: Record<string, unknown>;
}

export interface RepairOptions {
  /** Modello originale per rigenerazione semplificata */
  model?: DocumentModel;
  /** Formato target */
  format: OutputFormat;
  /** Massimo tentativi di riparazione */
  maxAttempts?: number;
}

export interface ValidationConfig {
  /** Dimensione minima plausibile (byte) */
  minSize?: number;
  /** Dimensione massima plausibile (byte) - 0 = nessun limite */
  maxSize?: number;
  /** Verifica magic bytes */
  checkMagicBytes?: boolean;
  /** Verifica contenuto non vuoto */
  checkNonEmpty?: boolean;
  /** Verifica parsing specifico formato */
  checkParsing?: boolean;
}

// ============================================================
// MAGIC BYTES PER FORMATO
// ============================================================

const MAGIC_BYTES: Record<OutputFormat, { bytes: number[]; hex: string }> = {
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46], hex: '25504446' },      // %PDF
  docx: { bytes: [0x50, 0x4B, 0x03, 0x04], hex: '504B0304' },      // PK ZIP
  xlsx: { bytes: [0x50, 0x4B, 0x03, 0x04], hex: '504B0304' },      // PK ZIP
  rtf: { bytes: [0x7B, 0x5C, 0x72, 0x74, 0x66], hex: '7B5C727466' }, // {\rtf
  txt: { bytes: [], hex: '' },                                       // Nessun magic
  html: { bytes: [], hex: '' },                                      // Nessun magic
};

// ============================================================
// VALIDAZIONE PRINCIPALE
// ============================================================

const DEFAULT_CONFIG: Required<ValidationConfig> = {
  minSize: 100,           // 100 byte minimo
  maxSize: 50 * 1024 * 1024, // 50 MB max
  checkMagicBytes: true,
  checkNonEmpty: true,
  checkParsing: true,
};

/**
 * Valida un file generato.
 * Lancia se il file non esiste; ritorna dettagli validazione.
 */
export async function validateFile(
  filepath: string,
  format: OutputFormat,
  config: ValidationConfig = {}
): Promise<ValidationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = { format };

  try {
    // 1. Esistenza
    const info = await FileSystem.getInfoAsync(filepath);
    if (!info.exists) {
      return {
        valid: false,
        size: 0,
        errors: ['File non esiste'],
        warnings: [],
        repaired: false,
        details: { ...details, reason: 'not_found' },
      };
    }

    details.size = info.size;
    details.uri = info.uri;

    // 2. Dimensione
    if (info.size < cfg.minSize) {
      errors.push(`File troppo piccolo: ${info.size} byte (min ${cfg.minSize})`);
    }
    if (cfg.maxSize > 0 && info.size > cfg.maxSize) {
      errors.push(`File troppo grande: ${info.size} byte (max ${cfg.maxSize})`);
    }

    // 3. Magic bytes
    let magicBytes = '';
    if (cfg.checkMagicBytes && MAGIC_BYTES[format].bytes.length > 0) {
      const magic = MAGIC_BYTES[format];
      const header = await FileSystem.readAsStringAsync(filepath, {
        encoding: FileSystem.EncodingType.Base64,
        length: 16,
      });
      // Base64 -> bytes
      const bytes = base64ToBytes(header);
      const matches = magic.bytes.every((b, i) => bytes[i] === b);
      magicBytes = bytes.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      details.magicBytes = magicBytes;

      if (!matches) {
        errors.push(`Magic bytes non validi per ${format.toUpperCase()}: attesi ${magic.hex}, trovati ${magicBytes}`);
      }
    }

    // 4. Contenuto non vuoto (per formati testuali)
    if (cfg.checkNonEmpty && (format === 'txt' || format === 'html' || format === 'rtf')) {
      const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.UTF8 });
      if (!content.trim()) {
        errors.push('File vuoto (nessun contenuto testuale)');
      }
    }

    // 5. Parsing specifico formato
    if (cfg.checkParsing) {
      const parseResult = await parseFormat(filepath, format);
      if (!parseResult.valid) {
        errors.push(...parseResult.errors);
      }
      warnings.push(...parseResult.warnings);
      Object.assign(details, parseResult.details);
    }

    return {
      valid: errors.length === 0,
      size: info.size,
      magicBytes,
      errors,
      warnings,
      repaired: false,
      details,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [`Errore validazione: ${String(err)}`],
      warnings: [],
      repaired: false,
      details: { ...details, error: String(err) },
    };
  }
}

/** Parsing specifico per formato. */
async function parseFormat(filepath: string, format: OutputFormat): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    switch (format) {
      case 'pdf': {
        // Verifica base: inizia con %PDF, ha %%EOF
        const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.Base64, length: 2048 });
        const bytes = base64ToBytes(content);
        const text = bytesToString(bytes);
        if (!text.includes('%PDF')) errors.push('PDF: mancante header %PDF');
        if (!text.includes('%%EOF')) warnings.push('PDF: mancante trailer %%EOF (potrebbe essere troncato)');
        details.hasEOF = text.includes('%%EOF');
        break;
      }
      case 'docx': {
        // Verifica ZIP OOXML: ha [Content_Types].xml e word/document.xml
        const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.Base64 });
        const bytes = base64ToBytes(content);
        const text = bytesToString(bytes);
        if (!text.includes('[Content_Types].xml')) errors.push('DOCX: mancante [Content_Types].xml');
        if (!text.includes('word/document.xml')) errors.push('DOCX: mancante word/document.xml');
        details.hasDocumentXml = text.includes('word/document.xml');
        break;
      }
      case 'xlsx': {
        // Verifica SheetJS può leggerlo
        const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.Base64 });
        try {
          const wb = XLSX.read(content, { type: 'base64' });
          details.sheets = wb.SheetNames;
          if (wb.SheetNames.length === 0) errors.push('XLSX: nessun foglio');
        } catch {
          errors.push('XLSX: parsing fallito (ZIP corrotto o non OOXML)');
        }
        break;
      }
      case 'rtf': {
        const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.UTF8, length: 1024 });
        if (!content.trim().startsWith('{\\rtf')) errors.push('RTF: non inizia con {\\rtf');
        if (!content.includes('\\par')) warnings.push('RTF: nessun \\par (paragrafi)');
        break;
      }
      case 'html': {
        const content = await FileSystem.readAsStringAsync(filepath, { encoding: FileSystem.EncodingType.UTF8 });
        if (!content.trim().startsWith('<!DOCTYPE html') && !content.trim().startsWith('<html')) {
          errors.push('HTML: non inizia con <!DOCTYPE html> o <html>');
        }
        break;
      }
    }
  } catch (err) {
    errors.push(`Parsing ${format} fallito: ${String(err)}`);
  }

  return { valid: errors.length === 0, errors, warnings, repaired: false, details };
}

// ============================================================
// RIPARAZIONE
// ============================================================

/**
 * Tenta di riparare un file non valido rigenerando con builder semplificato.
 * Ritorna il nuovo filepath se riuscito, null se fallito.
 */
export async function repairFile(
  originalPath: string,
  options: RepairOptions
): Promise<string | null> {
  const { model, format, maxAttempts = 1 } = options;

  if (!model) {
    return null; // Non possiamo riparare senza il modello
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Genera versione semplificata (solo testo, no tabelle/immagini complesse)
      const simpleModel = simplifyModel(model, attempt);
      const newPath = await generateSimple(simpleModel, format);

      // Valida il nuovo file
      const validation = await validateFile(newPath, format, { checkParsing: true });
      if (validation.valid) {
        // Elimina l'originale corrotto
        await FileSystem.deleteAsync(originalPath, { idempotent: true });
        return newPath;
      }
      // Altrimenti elimina il tentativo fallito e riprova
      await FileSystem.deleteAsync(newPath, { idempotent: true });
    } catch {
      // Continua al tentativo successivo
    }
  }

  return null;
}

/** Semplifica il modello per riparazione (rimuove elementi complessi). */
function simplifyModel(model: DocumentModel, attempt: number): DocumentModel {
  if (attempt === 1) {
    // Tentativo 1: rimuovi solo immagini e tabelle complesse
    return {
      ...model,
      blocks: model.blocks.filter((b) => b.type !== 'imageBlock' && b.type !== 'table'),
    };
  }
  // Tentativo 2+: solo testo puro
  return {
    ...model,
    blocks: model.blocks
      .filter((b): b is Extract<BlockElement, { type: 'heading' | 'paragraph' }> => b.type === 'heading' || b.type === 'paragraph')
      .map((b) => ({
        ...b,
        children: b.children.filter((c) => c.type === 'text'),
      })),
  };
}

/** Genera file semplificato. */
async function generateSimple(model: DocumentModel, format: OutputFormat): Promise<string> {
  const filename = `${safeName(model.metadata.title)}_repaired_${Date.now()}.${format}`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  switch (format) {
    case 'pdf': {
      const { buildPdf } = await import('../builders/pdf');
      await buildPdf(model);
      break;
    }
    case 'docx': {
      const { buildDocx } = await import('../builders/docx');
      await buildDocx(model);
      break;
    }
    case 'xlsx': {
      const { buildXlsx } = await import('../builders/xlsx');
      await buildXlsx(model);
      break;
    }
    case 'rtf': {
      const { buildRtf } = await import('../builders/rtf');
      await buildRtf(model);
      break;
    }
    case 'txt': {
      const { buildTxt } = await import('../builders/txt');
      await buildTxt(model);
      break;
    }
    case 'html': {
      const { buildHtml } = await import('../builders/html');
      const html = buildHtml(model);
      await FileSystem.writeAsStringAsync(filepath, html, { encoding: FileSystem.EncodingType.UTF8 });
      return filepath;
    }
  }

  return filepath;
}

// ============================================================
// PIPELINE COMPLETA: GENERATE → VALIDATE → REPAIR → VALIDATE
// ============================================================

export interface PipelineResult {
  filepath: string;
  filename: string;
  format: OutputFormat;
  validation: ValidationResult;
  repaired: boolean;
}

export interface GenerateAndValidateOptions {
  model: DocumentModel;
  format: OutputFormat;
  config?: ValidationConfig;
  repairOptions?: RepairOptions;
}

/**
 * Pipeline completa: genera, valida, ripara se necessario, valida di nuovo.
 * Non restituisce mai un file non validato silenziosamente.
 */
export async function generateValidateRepair(
  options: GenerateAndValidateOptions
): Promise<PipelineResult> {
  const { model, format, config, repairOptions } = options;

  // 1. GENERA
  let filepath: string;
  let filename: string;

  switch (format) {
    case 'pdf': {
      const { buildPdf } = await import('../builders/pdf');
      ({ filepath, filename } = await buildPdf(model));
      break;
    }
    case 'docx': {
      const { buildDocx } = await import('../builders/docx');
      ({ filepath, filename } = await buildDocx(model));
      break;
    }
    case 'xlsx': {
      const { buildXlsx } = await import('../builders/xlsx');
      ({ filepath, filename } = await buildXlsx(model));
      break;
    }
    case 'rtf': {
      const { buildRtf } = await import('../builders/rtf');
      ({ filepath, filename } = await buildRtf(model));
      break;
    }
    case 'txt': {
      const { buildTxt } = await import('../builders/txt');
      ({ filepath, filename } = await buildTxt(model));
      break;
    }
    case 'html': {
      const { buildHtml } = await import('../builders/html');
      const html = buildHtml(model);
      filename = `${safeName(model.metadata.title)}_${Date.now()}.html`;
      filepath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, html, { encoding: FileSystem.EncodingType.UTF8 });
      break;
    }
    default:
      throw new Error(`Formato non supportato: ${format}`);
  }

  // 2. VALIDA
  let validation = await validateFile(filepath, format, config);

  // 3. RIPARA se necessario
  let repaired = false;
  if (!validation.valid && repairOptions?.model) {
    const repairedPath = await repairFile(filepath, { ...repairOptions, model: repairOptions.model, format });
    if (repairedPath) {
      filepath = repairedPath;
      filename = filepath.split('/').pop() ?? filename;
      repaired = true;
      // 4. VALIDA DI NUOVO
      validation = await validateFile(filepath, format, config);
    }
  }

  // 5. FINALIZE o ERRORE
  if (!validation.valid) {
    // Log dettagliato per debug
    console.error('[Document Validation] File non valido dopo repair:', {
      filepath,
      format,
      errors: validation.errors,
      details: validation.details,
    });

    // Non cancellare il file - l'utente potrebbe volerlo recuperare
    throw new Error(
      `Generazione ${format.toUpperCase()} fallita: ${validation.errors.join('; ')}. ` +
      `Il file è stato salvato in: ${filepath} (controlla la scheda File)`
    );
  }

  return { filepath, filename, format, validation, repaired };
}

// ============================================================
// HELPER BASE64/BYTES
// ============================================================

function base64ToBytes(b64: string): number[] {
  try {
    const binary = atob(b64);
    return Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

function bytesToString(bytes: number[]): string {
  return String.fromCharCode(...bytes.slice(0, 1024));
}