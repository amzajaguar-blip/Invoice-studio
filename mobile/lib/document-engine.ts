/**
 * document-engine.ts — Orchestratore principale della pipeline documentale.
 *
 * Entry point unificato: UI → Understanding → Template → DocumentModel → Builder → Validate → Preview → Share
 * Sostituisce l'uso diretto di document-format-engine.ts nelle schermate.
 */

import type { DocumentModel, DocumentType, TemplatePreset, Heading } from '@/lib/document/model';
import { fromLegacyFormatData, heading, text, paragraph } from '@/lib/document/model';
import { understandDocument } from '@/lib/document-understand';
import type { UnderstandingInput } from '@/lib/document/understanding';
import { getTemplate, applyTemplate, DOCUMENT_TYPES } from '@/lib/document/templates';
import { OutputFormat as BuilderOutputFormat, isOutputFormat } from '@/lib/document/builders';
import { generateValidateRepair, PipelineResult, GenerateAndValidateOptions } from '@/lib/document/validation';
import {
  shareDocumentSafely,
  shareDocument,
  parseOutputFormat,
  FORMAT_META,
  type OutputFormat,
  type DocumentFormatData,
  type DocumentLineItem,
  type DocumentTotals,
  type DocumentClientInfo,
  type DocumentFormatOptions,
} from '@/lib/document-format-engine';
export {
  shareDocumentSafely,
  shareDocument,
  parseOutputFormat,
  FORMAT_META,
  type OutputFormat,
  type DocumentFormatData,
  type DocumentLineItem,
  type DocumentTotals,
  type DocumentClientInfo,
  type DocumentFormatOptions,
};

/** Converte la chiave formato legacy (rivolta alle schermate) in quella del builder interno. */
function toBuilderFormat(format: OutputFormat): BuilderOutputFormat {
  return format === 'doc' ? 'docx' : format;
}

// ============================================================
// TIPI
// ============================================================

export interface DocumentGenerationInput {
  /** Testo libero della richiesta (per generazione AI/euristica) */
  prompt?: string;
  /** Titolo esplicito */
  title?: string;
  /** Tipo documento forzato (salta classificazione) */
  documentType?: DocumentType;
  /** Template da applicare */
  template?: DocumentType;
  /** Dati legacy DocumentFormatData (per migrazione schermate esistenti) */
  legacyData?: any; // DocumentFormatData
  /** Campi extra per template (client, lineItems, ecc.) */
  fields?: Record<string, unknown>;
  /** Opzioni formato */
  formatOptions?: {
    logoUrl?: string;
    translatedLabel?: string;
  };
}

export interface DocumentGenerationResult {
  filepath: string;
  filename: string;
  format: OutputFormat;
  documentType: DocumentType;
  template: DocumentType;
  validation: any; // ValidationResult
  repaired: boolean;
  shared: boolean;
  shareError?: string;
}

export interface GenerationState {
  phase: 'idle' | 'understanding' | 'building' | 'validating' | 'preview' | 'sharing' | 'complete' | 'error';
  message: string;
  progress?: number; // 0-100 opzionale, non percentuali false
  error?: string;
}

// ============================================================
// COSTRUZIONE DOCUMENTMODEL
// ============================================================

/**
 * Costruisce il DocumentModel completo da input utente.
 * Pipeline: Understanding → Template → Model
 */
export async function buildDocumentModel(input: DocumentGenerationInput): Promise<DocumentModel> {
  // 1. Se c'è legacy data, converte direttamente (migrazione schermate esistenti)
  if (input.legacyData) {
    return fromLegacyFormatData(input.legacyData);
  }

  // 2. Understanding (euristico o AI)
  let understandingResult;
  if (input.prompt) {
    const understandingInput: UnderstandingInput = {
      text: input.prompt,
      title: input.title,
      forcedType: input.documentType,
    };
    understandingResult = await understandDocument(understandingInput);
  } else {
    // Nessun prompt: usa template o tipo forzato
    const type = input.documentType ?? input.template ?? 'simple';
    understandingResult = {
      type,
      model: applyTemplate(type, { metadata: { title: input.title ?? getTemplate(type).label } }),
      confidence: 1,
      source: 'local' as const,
      extractedFields: {},
    };
  }

  // 3. Applica template se specificato (override tipo understanding)
  const templateType = input.template ?? understandingResult.type;
  const template = getTemplate(templateType);

  // 4. Merge campi espliciti (fields) nel modello
  let model = understandingResult.model;
  if (input.fields) {
    model = mergeFieldsIntoModel(model, input.fields, template);
  }

  // 5. Applica formatOptions (logo, translatedLabel)
  if (input.formatOptions) {
    model = applyFormatOptions(model, input.formatOptions);
  }

  return model;
}

/** Merge campi espliciti nel modello (per template strutturati). */
function mergeFieldsIntoModel(model: DocumentModel, fields: Record<string, unknown>, template: TemplatePreset): DocumentModel {
  // Per ora: aggiunge campi come paragrafi in coda o aggiorna metadati
  // In futuro: mapping intelligente per ogni template
  const blocks = [...model.blocks];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;

    // Campi speciali
    if (key === 'title') {
      model = { ...model, metadata: { ...model.metadata, title: String(value) } };
      // Aggiorna anche l'heading principale se presente
      const headingIdx = blocks.findIndex((b) => b.type === 'heading' && b.level === 1);
      if (headingIdx >= 0) {
        const existingHeading = blocks[headingIdx] as Heading;
        blocks[headingIdx] = heading(existingHeading.level, [text(String(value))], existingHeading.style);
      }
    } else if (key === 'body' || key === 'notes' || key === 'content') {
      blocks.push({ type: 'paragraph', children: [{ type: 'text', text: String(value) }] });
    } else if (key === 'client' && typeof value === 'object') {
      // Blocco cliente
      const client = value as Record<string, string>;
      blocks.push(
        { type: 'heading', level: 2, children: [{ type: 'text', text: 'CLIENTE' }] },
        { type: 'paragraph', children: [{ type: 'text', text: client.name ?? '' }] }
      );
      if (client.email) blocks.push({ type: 'paragraph', children: [{ type: 'text', text: client.email }] });
      if (client.address) blocks.push({ type: 'paragraph', children: [{ type: 'text', text: client.address }] });
    }
  }

  return { ...model, blocks };
}

/** Applica opzioni formato (logo, disclaimer traduzione). */
function applyFormatOptions(model: DocumentModel, options: { logoUrl?: string; translatedLabel?: string }): DocumentModel {
  // Aggiunge logo come imageBlock all'inizio se presente
  if (options.logoUrl) {
    const logoBlock = {
      type: 'imageBlock' as const,
      source: options.logoUrl,
      width: 120,
      height: 48,
      alignment: 'left' as const,
    };
    return { ...model, blocks: [logoBlock, ...model.blocks] };
  }
  // Disclaimer traduzione in footer
  if (options.translatedLabel) {
    const disclaimer = paragraph(
      [text(options.translatedLabel, { size: 8, color: '9CA3AF', italic: true })],
      { alignment: 'center', spaceBefore: 12 }
    );
    return { ...model, blocks: [...model.blocks, disclaimer] };
  }
  return model;
}

// ============================================================
// PIPELINE PRINCIPALE
// ============================================================

export interface GenerateDocumentOptions extends DocumentGenerationInput {
  format: OutputFormat;
  /** Callback per aggiornamenti stato (per UI) */
  onStateChange?: (state: GenerationState) => void;
  /** Opzioni validazione */
  validationConfig?: any; // ValidationConfig
  /** Se true, non condivide automaticamente (per preview) */
  skipShare?: boolean;
}

/**
 * Pipeline completa: Understanding → Template → Model → Build → Validate → Repair → Share
 */
export async function generateDocument(
  options: GenerateDocumentOptions
): Promise<DocumentGenerationResult> {
  const { format, onStateChange, validationConfig, skipShare, ...input } = options;
  const updateState = (phase: GenerationState['phase'], message: string, error?: string) => {
    onStateChange?.({ phase, message, error });
  };

  try {
    // ── UNDERSTANDING ────────────────────────────────────────────────────
    updateState('understanding', 'Analisi richiesta...');
    const model = await buildDocumentModel(input);

    // ── BUILDING ────────────────────────────────────────────────────────
    updateState('building', `Generazione ${format.toUpperCase()}...`);
    const builderFormat = toBuilderFormat(format);
    const pipelineOptions: GenerateAndValidateOptions = {
      model,
      format: builderFormat,
      config: validationConfig,
      repairOptions: { model, format: builderFormat, maxAttempts: 1 },
    };

    const pipelineResult: PipelineResult = await generateValidateRepair(pipelineOptions);

    // ── PREVIEW (opzionale, gestito da caller) ──────────────────────────
    updateState('preview', 'Anteprima pronta');

    // ── SHARE ───────────────────────────────────────────────────────────
    let shared = true;
    let shareError: string | undefined;
    if (!skipShare) {
      updateState('sharing', 'Condivisione...');
      const shareResult = await shareDocumentSafely(pipelineResult.filepath, pipelineResult.filename);
      shared = shareResult.shared;
      shareError = shareResult.error;
    }

    updateState('complete', 'Completato');

    return {
      filepath: pipelineResult.filepath,
      filename: pipelineResult.filename,
      format,
      documentType: input.documentType ?? input.template ?? 'simple',
      template: input.template ?? 'simple',
      validation: pipelineResult.validation,
      repaired: pipelineResult.repaired,
      shared,
      shareError,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updateState('error', 'Errore durante la generazione', errorMsg);
    throw err;
  }
}

// ============================================================
// HELPER PER SCHERMATE ESISTENTI (MIGRAZIONE GRADUALE)
// ============================================================

/**
 * Genera documento da DocumentFormatData legacy (quotes, expenses, generate, import).
 * Mantiene compatibilità al 100% con le schermate attuali durante la transizione.
 */
export async function generateFromLegacy(
  legacyData: any, // DocumentFormatData
  format: OutputFormat,
  options: { logoUrl?: string; translatedLabel?: string; onStateChange?: (s: GenerationState) => void } = {}
): Promise<DocumentGenerationResult> {
  return generateDocument({
    legacyData,
    format,
    formatOptions: { logoUrl: options.logoUrl, translatedLabel: options.translatedLabel },
    onStateChange: options.onStateChange,
  });
}

/**
 * Converte un file importato (già parsato da file-import.ts).
 */
export async function generateFromImported(
  content: any, // ConvertibleContent
  format: OutputFormat,
  title?: string
): Promise<DocumentGenerationResult> {
  return generateDocument({
    prompt: content.text ?? content.rows?.map((r: string[]) => r.join(' ')).join('\n'),
    title: title ?? content.title,
    documentType: 'simple',
    format,
  });
}

// ============================================================
// API DI ALTO LIVELLO PER UI
// ============================================================

/** Genera e condivide direttamente (equivalente a generateAndShareDocument legacy). */
export async function generateAndShare(
  input: DocumentGenerationInput,
  format: OutputFormat,
  onStateChange?: (state: GenerationState) => void
): Promise<DocumentGenerationResult> {
  return generateDocument({ ...input, format, onStateChange });
}

/** Genera per preview (no share). */
export async function generateForPreview(
  input: DocumentGenerationInput,
  format: OutputFormat,
  onStateChange?: (state: GenerationState) => void
): Promise<DocumentGenerationResult> {
  return generateDocument({ ...input, format, skipShare: true, onStateChange });
}

/** Elenco formati supportati dal builder interno (a differenza di OutputFormat, include docx/txt/html) */
export function getSupportedFormats(): BuilderOutputFormat[] {
  return ['pdf', 'docx', 'xlsx', 'rtf', 'txt', 'html'];
}

/** Elenco template disponibili */
export function getAvailableTemplates(): TemplatePreset[] {
  return DOCUMENT_TYPES.map((t) => getTemplate(t));
}

/** Normalizza un valore arbitrario in un formato builder valido */
export function normalizeFormat(value: unknown): BuilderOutputFormat {
  return isOutputFormat(value) ? value : 'pdf';
}