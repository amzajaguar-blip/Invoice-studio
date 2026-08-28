/**
 * builders/shared.ts — Helper condivisi dai builder di formato.
 *
 * Serializzazione degli elementi inline in testo semplice, escaping HTML,
 * risoluzione stili, ecc. Nessuna logica specifica di formato qui.
 */

import type {
  InlineElement,
  FontStyle,
  ParagraphStyle,
  DocumentModel,
  BlockElement,
} from '../model';

/** Escapa caratteri HTML nei dati utente. */
export function escHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serializza elementi inline in testo semplice (per TXT/RTF). */
export function inlineToText(elements: InlineElement[]): string {
  return elements
    .map((el) => {
      switch (el.type) {
        case 'text':
          return el.text;
        case 'hyperlink':
          return el.text;
        case 'image':
          return el.alt ?? '[immagine]';
        case 'footnoteRef':
          return `[${el.id}]`;
        case 'pageNumber':
          return '';
        case 'totalPages':
          return '';
        default:
          return '';
      }
    })
    .join('');
}

/** Risolve il font effettivo di un run (default del modello + override). Family/size sono sempre presenti. */
export function resolveFont(
  model: DocumentModel,
  override?: FontStyle
): FontStyle & { family: string; size: number } {
  const base = model.styles?.defaultFont ?? { family: 'Helvetica', size: 11 };
  return {
    family: 'Helvetica',
    size: 11,
    ...base,
    ...(override ?? {}),
  };
}

/** Risolve lo stile paragrafo effettivo (default + override). */
export function resolveParagraphStyle(
  model: DocumentModel,
  override?: ParagraphStyle
): ParagraphStyle {
  const base = model.styles?.defaultParagraph ?? { alignment: 'justify', spaceAfter: 6 };
  return { ...base, ...(override ?? {}) };
}

/** Converte un colore esadecimale senza # in CSS rgb. */
export function hexToCss(color?: string): string | undefined {
  if (!color) return undefined;
  const c = color.replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(c)) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgb(${r},${g},${b})`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    const r = parseInt(c[0] + c[0], 16);
    const g = parseInt(c[1] + c[1], 16);
    const b = parseInt(c[2] + c[2], 16);
    return `rgb(${r},${g},${b})`;
  }
  return `#${c}`;
}

/** Converte un colore esadecimale senza # in formato docx (senza #). */
export function hexToDocx(color?: string): string | undefined {
  if (!color) return undefined;
  return color.replace('#', '').toUpperCase();
}

/** Converte pt in em (approssimazione per HTML, 1em = 12pt). */
export function ptToEm(pt: number): string {
  return `${(pt / 12).toFixed(3)}em`;
}

/** Converte pt in px (per HTML, 1pt = 1.333px). */
export function ptToPx(pt: number): string {
  return `${Math.round(pt * 1.333)}px`;
}

/** Converte pt in twips (per DOCX, 1pt = 20 twips). */
export function ptToTwips(pt: number): number {
  return Math.round(pt * 20);
}

/** Converte pt in half-points (per DOCX font size, 1pt = 2 half-points). */
export function ptToHalfPoints(pt: number): number {
  return Math.round(pt * 2);
}

/** Converte pt in EMU (per DOCX immagini, 1pt = 12700 EMU). */
export function ptToEmu(pt: number): number {
  return Math.round(pt * 12700);
}

/** Converte pt in twips per margini (1pt = 20 twips). */
export function ptToTwipsMargin(pt: number): number {
  return Math.round(pt * 20);
}

/** Converte pt in mm (per @page CSS, 1pt = 0.3528mm). */
export function ptToMm(pt: number): string {
  return `${(pt * 0.3528).toFixed(1)}mm`;
}

/** Converte pt in pollici (per XLSX margini, 1pt = 1/72 inch). */
export function ptToInches(pt: number): number {
  return pt / 72;
}

/** Nome file sicuro da un titolo. */
export function safeName(value?: string): string {
  return (value ?? 'documento').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'documento';
}

/** Estrae il testo piatto di un blocco (per anteprima/validazione). */
export function blockToText(block: BlockElement): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineToText(block.children);
    case 'list':
      return block.items.map((i) => i.blocks.map(blockToText).join(' ')).join('\n');
    case 'table':
      return block.rows.map((r) => r.cells.map((c) => c.blocks.map(blockToText).join(' ')).join(' | ')).join('\n');
    case 'imageBlock':
      return block.caption ? inlineToText(block.caption) : '[immagine]';
    case 'quote':
      return block.blocks.map(blockToText).join('\n');
    case 'pageBreak':
    case 'sectionBreak':
    case 'horizontalRule':
      return '';
    case 'signatureBlock':
      return block.label;
    case 'checklist':
      return block.items.map((i) => inlineToText(i.text)).join('\n');
    case 'codeBlock':
      return block.code;
    default:
      return '';
  }
}

/** Estrae tutto il testo piatto del documento (per validazione non-vuoto). */
export function documentToText(model: DocumentModel): string {
  return model.blocks.map(blockToText).join('\n').trim();
}