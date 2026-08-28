/**
 * understanding/index.ts — Comprensione semantica locale (euristica).
 *
 * Trasforma una richiesta in linguaggio naturale in un DocumentModel strutturato.
 * Zero rete, sempre disponibile: è il fallback obbligatorio del layer AI.
 *
 * Classifica il tipo documento (fattura, cv, report, lettera, verbale, contratto...)
 * ed estrae struttura (righe+prezzi per fattura, sezioni carriera per CV, ecc.).
 */

import type {
  DocumentModel,
  DocumentType,
  BlockElement,
  InlineElement,
  TableRow,
  TableCell,
} from '../model';
import {
  text,
  paragraph,
  heading,
  bulletList,
  orderedList,
  listItem,
  table,
  tableRow,
  tableCell,
  pageBreak,
  horizontalRule,
  signatureBlock,
  checklist,
  checklistItem,
} from '../model';
import { applyTemplate, parseDocumentType } from '../templates';

// ============================================================
// TIPI
// ============================================================

export interface UnderstandingResult {
  /** Tipo documento rilevato */
  type: DocumentType;
  /** Modello strutturato */
  model: DocumentModel;
  /** Confidenza della classificazione (0-1) */
  confidence: number;
  /** Fonte: 'local' (euristica), 'ai' (LLM) o 'remote' (Edge Function) */
  source: 'local' | 'ai' | 'remote';
  /** Campi estratti (per debug/UI) */
  extractedFields: Record<string, unknown>;
}

export interface UnderstandingInput {
  /** Testo libero della richiesta utente */
  text: string;
  /** Titolo esplicito (opzionale) */
  title?: string;
  /** Tipo forzato (opzionale, salta la classificazione) */
  forcedType?: DocumentType;
}

// ============================================================
// CLASSIFICAZIONE
// ============================================================

interface TypeSignal {
  type: DocumentType;
  keywords: string[];
  weight: number;
}

const TYPE_SIGNALS: TypeSignal[] = [
  {
    type: 'invoice',
    keywords: ['fattura', 'invoice', 'fatturare', 'imponibile', 'iva', 'aliquota', 'netto a pagare', 'totale fattura', 'numero fattura', 'p.iva', 'partita iva'],
    weight: 3,
  },
  {
    type: 'quote',
    keywords: ['preventivo', 'quotazione', 'offerta', 'quote', 'valido fino', 'listino', 'stima'],
    weight: 3,
  },
  {
    type: 'cv',
    keywords: ['curriculum', 'cv', 'resume', 'esperienza lavorativa', 'formazione', 'competenze', 'lingue', 'profilo professionale', 'titolo di studio', 'certificazioni'],
    weight: 3,
  },
  {
    type: 'coverLetter',
    keywords: ['lettera di presentazione', 'cover letter', 'candidatura', 'mi candido', 'posizione lavorativa', 'annuncio di lavoro'],
    weight: 3,
  },
  {
    type: 'businessLetter',
    keywords: ['lettera commerciale', 'spett.le', 'spettabile', 'alla cortese attenzione', 'cordiali saluti', 'distinti saluti'],
    weight: 2,
  },
  {
    type: 'meetingMinutes',
    keywords: ['verbale', 'riunione', 'ordine del giorno', 'partecipanti', 'delibera', 'assemblea', 'convocazione'],
    weight: 3,
  },
  {
    type: 'proposal',
    keywords: ['proposta progettuale', 'proposta di progetto', 'obiettivi del progetto', 'fasi', 'deliverable', 'milestone', 'costi del progetto'],
    weight: 2,
  },
  {
    type: 'contract',
    keywords: ['contratto', 'clausole', 'tra le parti', 'parte contraente', 'durata del contratto', 'recesso', 'penale', 'foro competente'],
    weight: 3,
  },
  {
    type: 'professionalReport',
    keywords: ['relazione professionale', 'relazione tecnica', 'perizia', 'consulenza', 'raccomandazioni', 'appendici'],
    weight: 2,
  },
  {
    type: 'academic',
    keywords: ['abstract', 'paper', 'tesi', 'bibliografia', 'metodologia', 'riferimenti', 'citazioni', 'accademico', 'ricerca'],
    weight: 2,
  },
  {
    type: 'checklist',
    keywords: ['checklist', 'elenco attività', 'spuntare', 'da fare', 'todo', 'verifiche', 'controlli'],
    weight: 2,
  },
  {
    type: 'presentationPrint',
    keywords: ['presentazione', 'slide', 'diapositive', 'pitch', 'deck'],
    weight: 2,
  },
  {
    type: 'report',
    keywords: ['report', 'relazione', 'sintesi', 'conclusioni', 'analisi', 'andamento', 'risultati', 'kpi', 'metriche'],
    weight: 2,
  },
  {
    type: 'notes',
    keywords: ['note', 'appunti', 'promemoria', 'memo'],
    weight: 1,
  },
];

/** Classifica il testo in un DocumentType con confidenza. */
export function classifyDocumentType(text: string): { type: DocumentType; confidence: number } {
  const lower = text.toLowerCase();
  const scores = new Map<DocumentType, number>();

  for (const signal of TYPE_SIGNALS) {
    for (const kw of signal.keywords) {
      if (lower.includes(kw)) {
        scores.set(signal.type, (scores.get(signal.type) ?? 0) + signal.weight);
      }
    }
  }

  if (scores.size === 0) {
    return { type: 'simple', confidence: 0.3 };
  }

  let best: DocumentType = 'simple';
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }

  // Confidenza normalizzata: più segnali = più fiducia
  const confidence = Math.min(0.95, 0.4 + bestScore * 0.1);
  return { type: best, confidence };
}

// ============================================================
// ESTRAZIONE STRUTTURATA
// ============================================================

/** Estrae righe di una fattura/preventivo dal testo (pattern "descrizione quantità prezzo"). */
function extractLineItems(text: string): { description: string; quantity: number; rate: number }[] {
  const items: { description: string; quantity: number; rate: number }[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Pattern: "descrizione 2 x 50,00" oppure "descrizione €50,00" oppure "descrizione 50,00"
  const linePattern = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*$/i;
  const pricePattern = /^(.+?)\s+[€$]?\s*(\d+(?:[.,]\d+)?)\s*$/;

  for (const line of lines) {
    const m = line.match(linePattern);
    if (m) {
      items.push({
        description: m[1].trim(),
        quantity: parseFloat(m[2].replace(',', '.')),
        rate: parseFloat(m[3].replace(',', '.')),
      });
      continue;
    }
    const p = line.match(pricePattern);
    if (p && p[1].length > 2) {
      items.push({
        description: p[1].trim(),
        quantity: 1,
        rate: parseFloat(p[2].replace(',', '.')),
      });
    }
  }

  return items;
}

/** Estrae sezioni dal testo (righe che sembrano titoli). */
function extractSections(text: string): { title: string; body: string[] }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  const headingPattern = /^(#{1,6}\s+)?([A-ZÀ-Ý][^.!?]{2,60}):?\s*$/;

  for (const line of lines) {
    if (!line) continue;
    if (headingPattern.test(line) && line.length < 80) {
      if (current) sections.push(current);
      current = { title: line.replace(/^#{1,6}\s+/, '').replace(/:$/, ''), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      current = { title: '', body: [line] };
    }
  }
  if (current) sections.push(current);

  return sections;
}

/** Estrae elenchi puntati/numerati dal testo. */
function extractListItems(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const items: string[] = [];
  const bulletPattern = /^[-•*]\s+(.+)$/;
  const numberedPattern = /^\d+[.)]\s+(.+)$/;

  for (const line of lines) {
    const b = line.match(bulletPattern);
    if (b) { items.push(b[1]); continue; }
    const n = line.match(numberedPattern);
    if (n) items.push(n[1]);
  }

  return items;
}

/** Estrae un titolo dal testo (prima riga non vuota significativa). */
function extractTitle(text: string, fallback: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return fallback;
  // La prima riga è il titolo se è corta e non è un elenco
  const first = lines[0];
  if (first.length <= 80 && !/^[-•*\d]/.test(first)) {
    return first.replace(/^#{1,6}\s+/, '');
  }
  return fallback;
}

// ============================================================
// COSTRUZIONE MODELLO PER TIPO
// ============================================================

function buildInvoiceModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const items = extractLineItems(rawText);
  const sections = extractSections(rawText);
  const number = rawText.match(/(?:fattura|n[°o])\s*(?:n[°o]\.?)?\s*[:#]?\s*(\d{1,6})/i)?.[1];
  const date = rawText.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/)?.[1];

  const blocks: BlockElement[] = [];
  blocks.push(heading(1, [text(title ?? 'FATTURA')], { alignment: 'center' }));
  if (number || date) {
    const meta: InlineElement[] = [];
    if (number) meta.push(text('N°: ', { bold: true }), text(number), text('   '));
    if (date) meta.push(text('Data: ', { bold: true }), text(date));
    blocks.push(paragraph(meta, { alignment: 'center', spaceAfter: 12 }));
  }

  if (items.length > 0) {
    const headerRow = tableRow([
      tableCell([paragraph([text('Descrizione', { bold: true, size: 9 })])]),
      tableCell([paragraph([text('Q.tà', { bold: true, size: 9 })])], { alignment: 'right' }),
      tableCell([paragraph([text('Prezzo', { bold: true, size: 9 })])], { alignment: 'right' }),
      tableCell([paragraph([text('Importo', { bold: true, size: 9 })])], { alignment: 'right' }),
    ], true);
    const rows = items.map((it) =>
      tableRow([
        tableCell([paragraph([text(it.description)])]),
        tableCell([paragraph([text(String(it.quantity))])], { alignment: 'right' }),
        tableCell([paragraph([text(`€${it.rate.toFixed(2)}`)])], { alignment: 'right' }),
        tableCell([paragraph([text(`€${(it.quantity * it.rate).toFixed(2)}`)])], { alignment: 'right' }),
      ])
    );
    blocks.push(table(rows, { header: headerRow, columnWidths: [55, 10, 17.5, 17.5], repeatHeader: true }));
  }

  // Note / condizioni
  const notesSection = sections.find((s) => /note|condizion|pagament/i.test(s.title));
  if (notesSection) {
    blocks.push(paragraph([text('Note:', { bold: true }), text('\n'), text(notesSection.body.join('\n'))], { spaceBefore: 16 }));
  }

  const model = applyTemplate('invoice', { blocks, metadata: { title: title ?? 'Fattura' } });
  return { model, fields: { number, date, items } };
}

function buildCvModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const sections = extractSections(rawText);
  const blocks: BlockElement[] = [];

  blocks.push(heading(1, [text(title ?? 'Curriculum Vitae')], { alignment: 'center' }));

  for (const section of sections) {
    const lower = section.title.toLowerCase();
    if (/profilo|obiettivo|chi sono/i.test(lower)) {
      blocks.push(heading(2, [text('Profilo')]));
      blocks.push(paragraph([text(section.body.join('\n'))]));
    } else if (/esperienz|lavor/i.test(lower)) {
      blocks.push(heading(2, [text('Esperienza')]));
      const items = extractListItems(section.body.join('\n'));
      if (items.length) blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
      else blocks.push(paragraph([text(section.body.join('\n'))]));
    } else if (/formazion|studi|istruzion/i.test(lower)) {
      blocks.push(heading(2, [text('Formazione')]));
      const items = extractListItems(section.body.join('\n'));
      if (items.length) blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
      else blocks.push(paragraph([text(section.body.join('\n'))]));
    } else if (/competenz|abilit|skill/i.test(lower)) {
      blocks.push(heading(2, [text('Competenze')]));
      const items = extractListItems(section.body.join('\n'));
      if (items.length) blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
      else blocks.push(paragraph([text(section.body.join('\n'))]));
    } else if (/lingue|language/i.test(lower)) {
      blocks.push(heading(2, [text('Lingue')]));
      const items = extractListItems(section.body.join('\n'));
      if (items.length) blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
      else blocks.push(paragraph([text(section.body.join('\n'))]));
    } else if (/certificaz|attestat/i.test(lower)) {
      blocks.push(heading(2, [text('Certificazioni')]));
      const items = extractListItems(section.body.join('\n'));
      if (items.length) blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
      else blocks.push(paragraph([text(section.body.join('\n'))]));
    } else {
      blocks.push(heading(2, [text(section.title)]));
      blocks.push(paragraph([text(section.body.join('\n'))]));
    }
  }

  if (blocks.length <= 1) {
    // Nessuna sezione riconosciuta: testo libero
    blocks.push(paragraph([text(rawText)]));
  }

  const model = applyTemplate('cv', { blocks, metadata: { title: title ?? 'Curriculum Vitae' } });
  return { model, fields: { sections: sections.map((s) => s.title) } };
}

function buildReportModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const sections = extractSections(rawText);
  const blocks: BlockElement[] = [];

  blocks.push(heading(1, [text(title ?? 'Report')], { alignment: 'center' }));
  blocks.push(horizontalRule());

  for (const section of sections) {
    if (!section.title) {
      blocks.push(paragraph([text(section.body.join('\n'))]));
      continue;
    }
    blocks.push(heading(2, [text(section.title)]));
    const items = extractListItems(section.body.join('\n'));
    if (items.length > 0 && items.length === section.body.length) {
      blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
    } else {
      blocks.push(paragraph([text(section.body.join('\n'))]));
    }
  }

  if (blocks.length <= 2) {
    blocks.push(paragraph([text(rawText)]));
  }

  const model = applyTemplate('report', { blocks, metadata: { title: title ?? 'Report' } });
  return { model, fields: { sections: sections.map((s) => s.title) } };
}

function buildChecklistModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const items = extractListItems(rawText);
  const blocks: BlockElement[] = [];
  blocks.push(heading(1, [text(title ?? 'Checklist')], { alignment: 'center' }));

  if (items.length > 0) {
    blocks.push(checklist(items.map((i) => checklistItem([text(i)]))));
  } else {
    // Ogni riga non vuota diventa un item
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    blocks.push(checklist(lines.map((l) => checklistItem([text(l)]))));
  }

  const model = applyTemplate('checklist', { blocks, metadata: { title: title ?? 'Checklist' } });
  return { model, fields: { items } };
}

function buildLetterModel(rawText: string, title?: string, type: DocumentType = 'businessLetter'): { model: DocumentModel; fields: Record<string, unknown> } {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: BlockElement[] = [];

  // Prima riga = mittente, seconda = destinatario (euristica)
  if (lines.length > 0) blocks.push(paragraph([text(lines[0], { bold: true })]));
  if (lines.length > 1) blocks.push(paragraph([text(lines[1], { bold: true })], { spaceBefore: 16 }));

  const body = lines.slice(2).join('\n');
  blocks.push(paragraph([text(body)], { spaceBefore: 16 }));
  blocks.push(paragraph([text('Cordiali saluti,')], { spaceBefore: 24 }));
  blocks.push(signatureBlock('Firma', { alignment: 'left' }));

  const model = applyTemplate(type, { blocks, metadata: { title: title ?? 'Lettera' } });
  return { model, fields: { sender: lines[0], recipient: lines[1], body } };
}

function buildMeetingModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const sections = extractSections(rawText);
  const blocks: BlockElement[] = [];
  blocks.push(heading(1, [text(title ?? 'Verbale di riunione')], { alignment: 'center' }));

  for (const section of sections) {
    if (!section.title) {
      blocks.push(paragraph([text(section.body.join('\n'))]));
      continue;
    }
    blocks.push(heading(2, [text(section.title)]));
    const items = extractListItems(section.body.join('\n'));
    if (items.length > 0) {
      blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
    } else {
      blocks.push(paragraph([text(section.body.join('\n'))]));
    }
  }

  if (blocks.length <= 1) blocks.push(paragraph([text(rawText)]));

  const model = applyTemplate('meetingMinutes', { blocks, metadata: { title: title ?? 'Verbale di riunione' } });
  return { model, fields: { sections: sections.map((s) => s.title) } };
}

function buildContractModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const sections = extractSections(rawText);
  const blocks: BlockElement[] = [];
  blocks.push(heading(1, [text(title ?? 'CONTRATTO')], { alignment: 'center' }));

  for (const section of sections) {
    if (!section.title) {
      blocks.push(paragraph([text(section.body.join('\n'))]));
      continue;
    }
    blocks.push(heading(2, [text(section.title)]));
    blocks.push(paragraph([text(section.body.join('\n'))]));
  }

  if (blocks.length <= 1) blocks.push(paragraph([text(rawText)]));

  blocks.push(signatureBlock('Firma Parte A', { alignment: 'left' }));
  blocks.push(signatureBlock('Firma Parte B', { alignment: 'right' }));

  const model = applyTemplate('contract', { blocks, metadata: { title: title ?? 'Contratto' } });
  return { model, fields: { sections: sections.map((s) => s.title) } };
}

function buildSimpleModel(rawText: string, title?: string): { model: DocumentModel; fields: Record<string, unknown> } {
  const blocks: BlockElement[] = [];
  blocks.push(heading(1, [text(title ?? extractTitle(rawText, 'Documento'))], { alignment: 'center' }));

  const items = extractListItems(rawText);
  if (items.length > 0) {
    blocks.push(bulletList(items.map((i) => listItem([paragraph([text(i)])]))));
  } else {
    // Paragrafi separati da righe vuote
    const paragraphs = rawText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      blocks.push(paragraph([text(p)]));
    }
  }

  const model = applyTemplate('simple', { blocks, metadata: { title: title ?? extractTitle(rawText, 'Documento') } });
  return { model, fields: { body: rawText } };
}

// ============================================================
// ENTRY POINT PRINCIPALE
// ============================================================

/**
 * Comprende una richiesta in linguaggio naturale e produce un DocumentModel.
 * Sempre disponibile, zero rete.
 */
export function understandRequest(input: UnderstandingInput): UnderstandingResult {
  const { text: rawText, title, forcedType } = input;
  const trimmed = (rawText ?? '').trim();

  // Testo vuoto → documento semplice vuoto (per error handling)
  if (!trimmed) {
    const model = applyTemplate('simple', {
      blocks: [heading(1, [text(title ?? 'Documento')], { alignment: 'center' })],
      metadata: { title: title ?? 'Documento' },
    });
    return { type: 'simple', model, confidence: 0, source: 'local', extractedFields: {} };
  }

  const classification = forcedType
    ? { type: forcedType, confidence: 1 }
    : classifyDocumentType(trimmed);

  let result: { model: DocumentModel; fields: Record<string, unknown> };

  switch (classification.type) {
    case 'invoice':
      result = buildInvoiceModel(trimmed, title);
      break;
    case 'quote':
      result = buildInvoiceModel(trimmed, title ?? 'Preventivo');
      result.model = applyTemplate('quote', { blocks: result.model.blocks, metadata: { title: title ?? 'Preventivo' } });
      break;
    case 'cv':
      result = buildCvModel(trimmed, title);
      break;
    case 'coverLetter':
      result = buildLetterModel(trimmed, title, 'coverLetter');
      break;
    case 'businessLetter':
      result = buildLetterModel(trimmed, title, 'businessLetter');
      break;
    case 'meetingMinutes':
      result = buildMeetingModel(trimmed, title);
      break;
    case 'proposal':
      result = buildReportModel(trimmed, title ?? 'Proposta progettuale');
      result.model = applyTemplate('proposal', { blocks: result.model.blocks, metadata: { title: title ?? 'Proposta progettuale' } });
      break;
    case 'contract':
      result = buildContractModel(trimmed, title);
      break;
    case 'professionalReport':
      result = buildReportModel(trimmed, title ?? 'Relazione professionale');
      result.model = applyTemplate('professionalReport', { blocks: result.model.blocks, metadata: { title: title ?? 'Relazione professionale' } });
      break;
    case 'academic':
      result = buildReportModel(trimmed, title ?? 'Documento accademico');
      result.model = applyTemplate('academic', { blocks: result.model.blocks, metadata: { title: title ?? 'Documento accademico' } });
      break;
    case 'checklist':
      result = buildChecklistModel(trimmed, title);
      break;
    case 'notes':
      result = buildSimpleModel(trimmed, title ?? 'Note');
      result.model = applyTemplate('notes', { blocks: result.model.blocks, metadata: { title: title ?? 'Note' } });
      break;
    case 'presentationPrint':
      result = buildReportModel(trimmed, title ?? 'Presentazione');
      result.model = applyTemplate('presentationPrint', { blocks: result.model.blocks, metadata: { title: title ?? 'Presentazione' } });
      break;
    case 'report':
    default:
      result = buildReportModel(trimmed, title);
      break;
  }

  return {
    type: classification.type,
    model: result.model,
    confidence: classification.confidence,
    source: 'local',
    extractedFields: result.fields,
  };
}

// Riesporta per comodità
export { parseDocumentType } from '../templates';