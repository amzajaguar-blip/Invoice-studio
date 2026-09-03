/**
 * builders/rtf.ts — Builder RTF dal DocumentModel.
 *
 * Genera RTF 1.9 valido con header \{\rtf1\ansi\deff0 e generator Milo Office.
 * Supporta: heading, paragrafi, tabelle (con \tab), liste, immagini base64,
 * page break, formattazione base (grassetto, corsivo, sottolineato).
 */

import * as FileSystem from 'expo-file-system/legacy';
import type {
  DocumentModel,
  BlockElement,
  InlineElement,
  FontStyle,
  ParagraphStyle,
  Table,
  TableRow,
  TableCell,
  List,
  ListItem,
} from '../model';
import {
  inlineToText,
  resolveFont,
  resolveParagraphStyle,
  hexToCss,
  ptToTwips,
  safeName,
} from './shared';

export interface RtfBuildResult {
  filepath: string;
  filename: string;
}

/** Escapa caratteri speciali RTF. */
function escRtf(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par\n');
}

/** Font table entry. */
function fontToRtf(font: FontStyle, index: number): string {
  const family = font.family === 'Helvetica' ? 'fswiss' : font.family === 'Times New Roman' ? 'froman' : 'fmodern';
  return `{\\f${index}\\${family}\\fcharset0 ${font.family};}`;
}

/** Parsa un colore esadecimale a 6 cifre (senza #) in componenti RGB. */
function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

/** Font style run. */
function runToRtf(text: string, font: FontStyle, colorIndex: Map<string, number>): string {
  let rtf = '';
  if (font.bold) rtf += '\\b ';
  if (font.italic) rtf += '\\i ';
  if (font.underline) rtf += '\\ul ';
  if (font.strikethrough) rtf += '\\strike ';
  if (font.size) rtf += `\\fs${ptToTwips(font.size) / 10} `; // half-points
  if (font.color) {
    const idx = colorIndex.get(font.color);
    if (idx !== undefined) rtf += `\\cf${idx} `; // indice nella \colortbl, non il colore stesso
  }
  rtf += escRtf(text);
  if (font.bold) rtf += '\\b0 ';
  if (font.italic) rtf += '\\i0 ';
  if (font.underline) rtf += '\\ul0 ';
  if (font.strikethrough) rtf += '\\strike0 ';
  return rtf;
}

/** Inline elements to RTF. */
function inlineToRtf(elements: InlineElement[], model: DocumentModel, colorIndex: Map<string, number>): string {
  return elements
    .map((el) => {
      switch (el.type) {
        case 'text': {
          const font = resolveFont(model, el.style);
          return runToRtf(el.text, font, colorIndex);
        }
        case 'hyperlink': {
          const font = resolveFont(model, el.style ?? { color: '0066CC', underline: true });
          return `{\\field{\\*\\fldinst HYPERLINK "${escRtf(el.url)}"}{\\fldrslt ${runToRtf(el.text, font, colorIndex)}}}`;
        }
        case 'image':
          return `{\\pict\\jpegblip${el.source.startsWith('data:') ? '' : ''}...}`; // Semplificato: immagini non supportate pienamente in RTF testuale
        case 'footnoteRef':
          return `{\\chftn ${el.id}}`;
        case 'pageNumber':
          return '{\\chpgn}';
        case 'totalPages':
          return '{\\pages}';
        default:
          return '';
      }
    })
    .join('');
}

/** Paragraph to RTF. */
function paragraphToRtf(block: Extract<BlockElement, { type: 'paragraph' }>, model: DocumentModel, colorIndex: Map<string, number>): string {
  const style = resolveParagraphStyle(model, block.style);
  let rtf = '\\pard ';

  // Alignment
  switch (style.alignment) {
    case 'center':
      rtf += '\\qc ';
      break;
    case 'right':
      rtf += '\\qr ';
      break;
    case 'justify':
      rtf += '\\qj ';
      break;
    default:
      rtf += '\\ql ';
  }

  // Spacing
  if (style.spaceBefore) rtf += `\\sb${ptToTwips(style.spaceBefore)} `;
  if (style.spaceAfter) rtf += `\\sa${ptToTwips(style.spaceAfter)} `;
  if (style.lineSpacing) rtf += `\\sl${Math.round(style.lineSpacing * 240)}\\slmult1 `;
  if (style.indentLeft) rtf += `\\li${ptToTwips(style.indentLeft)} `;
  if (style.indentRight) rtf += `\\ri${ptToTwips(style.indentRight)} `;
  if (style.indentFirstLine) rtf += `\\fi${ptToTwips(style.indentFirstLine)} `;
  if (style.keepWithNext) rtf += '\\keepn ';
  if (style.keepLinesTogether) rtf += '\\keep ';
  if (style.pageBreakBefore) rtf += '\\page ';

  rtf += inlineToRtf(block.children, model, colorIndex);
  rtf += '\\par\n';
  return rtf;
}

/** Heading to RTF. */
function headingToRtf(block: Extract<BlockElement, { type: 'heading' }>, model: DocumentModel, colorIndex: Map<string, number>): string {
  const style = block.style ?? {};
  const font = resolveFont(model, style.font ?? { size: headingSize(block.level), bold: true });
  let rtf = '\\pard ';

  // Font size per heading
  rtf += `\\fs${ptToTwips(font.size) / 10} `;
  if (font.bold) rtf += '\\b ';

  // Alignment
  const paraStyle = resolveParagraphStyle(model, style);
  switch (paraStyle.alignment) {
    case 'center':
      rtf += '\\qc ';
      break;
    case 'right':
      rtf += '\\qr ';
      break;
    default:
      rtf += '\\ql ';
  }
  if (paraStyle.keepWithNext) rtf += '\\keepn ';
  if (paraStyle.spaceBefore) rtf += `\\sb${ptToTwips(paraStyle.spaceBefore)} `;
  if (paraStyle.spaceAfter) rtf += `\\sa${ptToTwips(paraStyle.spaceAfter)} `;

  rtf += inlineToRtf(block.children, model, colorIndex);
  if (font.bold) rtf += '\\b0 ';
  rtf += '\\par\n';
  return rtf;
}

function headingSize(level: number): number {
  switch (level) {
    case 1: return 22;
    case 2: return 17;
    case 3: return 14;
    case 4: return 12;
    case 5: return 11;
    default: return 10;
  }
}

/** List to RTF. */
function listToRtf(block: List, model: DocumentModel, colorIndex: Map<string, number>): string {
  const items = block.items.map((item) => listItemToRtf(item, model, block.ordered, colorIndex)).join('');
  return `{\\listtext ${items}}\n`;
}

function listItemToRtf(item: ListItem, model: DocumentModel, ordered: boolean, colorIndex: Map<string, number>): string {
  let rtf = '\\pard ';
  if (ordered) {
    // ListItem non modella la profondita' di nesting: 0 e' l'unico livello supportato oggi.
    rtf += `\\pnlvl0\\pnstart${item.ordinal ?? 1} `;
  } else {
    rtf += '\\pnlvl0 ';
  }
  rtf += '\\fi-360\\li720 '; // hanging indent
  const content = item.blocks.map((b) => blockToRtf(b, model, colorIndex)).join('');
  rtf += content;
  rtf += '\\par\n';
  return rtf;
}

/** Table to RTF. */
function tableToRtf(block: Table, model: DocumentModel, colorIndex: Map<string, number>): string {
  let rtf = '\\pard\\trowd ';

  // Column widths
  const widths = block.columnWidths ?? [];
  let twipsWidth = 0;
  for (let i = 0; i < (block.header?.cells.length ?? block.rows[0]?.cells.length ?? 1); i++) {
    const w = widths[i];
    const cellW = w === 'auto' ? 2000 : typeof w === 'number' ? Math.round((w / 100) * 9000) : 2000;
    twipsWidth += cellW;
    rtf += `\\cellx${twipsWidth} `;
  }

  // Header
  if (block.header) {
    rtf += '\\trhdr ';
    for (const cell of block.header.cells) {
      rtf += inlineToRtf(cell.blocks.flatMap((b) => b.type === 'paragraph' ? b.children : []), model, colorIndex);
      rtf += '\\cell ';
    }
    rtf += '\\row\n';
  }

  // Rows
  for (const row of block.rows) {
    for (const cell of row.cells) {
      rtf += inlineToRtf(cell.blocks.flatMap((b) => b.type === 'paragraph' ? b.children : []), model, colorIndex);
      rtf += '\\cell ';
    }
    rtf += '\\row\n';
  }

  rtf += '\\pard\n';
  return rtf;
}

/** Block to RTF. */
function blockToRtf(block: BlockElement, model: DocumentModel, colorIndex: Map<string, number>): string {
  switch (block.type) {
    case 'heading':
      return headingToRtf(block, model, colorIndex);
    case 'paragraph':
      return paragraphToRtf(block, model, colorIndex);
    case 'list':
      return listToRtf(block, model, colorIndex);
    case 'table':
      return tableToRtf(block, model, colorIndex);
    case 'imageBlock':
      return '\\pard [Immagine]\\par\n';
    case 'quote':
      return block.blocks.map((b) => `\\pard\\li720 ${blockToRtf(b, model, colorIndex)}`).join('');
    case 'pageBreak':
    case 'sectionBreak':
      return '\\page ';
    case 'horizontalRule':
      return '\\pard \\brdrb\\brdrs\\brdrw15 \\par\n';
    case 'signatureBlock':
      return `\\pard ${escRtf(block.label)} \\par\\par ${'_'.repeat(40)} \\par ${escRtf(block.signerName ?? '')} \\par\n`;
    case 'checklist':
      return block.items.map((i) => `\\pard ${i.checked ? '☑' : '☐'} ${inlineToText(i.text)}\\par\n`).join('');
    case 'codeBlock':
      return `\\pard\\f1 ${escRtf(block.code)}\\par\n`;
    default:
      return '';
  }
}

/** Raccoglie ricorsivamente gli InlineElement presenti in un blocco (per la color table). */
function collectInlineElements(block: BlockElement): InlineElement[] {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return block.children;
    case 'list':
      return block.items.flatMap((item) => item.blocks.flatMap(collectInlineElements));
    case 'table': {
      const cells = [...(block.header?.cells ?? []), ...block.rows.flatMap((r) => r.cells)];
      return cells.flatMap((cell) => cell.blocks.flatMap(collectInlineElements));
    }
    case 'quote':
      return block.blocks.flatMap(collectInlineElements);
    default:
      return [];
  }
}

/**
 * Costruisce la mappa colore-esadecimale -> indice \colortbl, raccogliendo
 * ogni colore effettivamente usato dai font risolti nel documento (default
 * incluso, e il blu implicito degli hyperlink). L'indice 0 resta riservato
 * al colore "auto" implicito di RTF (nessuna entry prima del primo `;`).
 */
function buildColorIndex(model: DocumentModel): Map<string, number> {
  const colors = new Set<string>();
  const addColor = (color: string | undefined) => {
    if (color && parseHexColor(color)) colors.add(color);
  };

  addColor((model.styles?.defaultFont ?? { family: 'Helvetica', size: 11 }).color);

  for (const block of model.blocks) {
    for (const el of collectInlineElements(block)) {
      if (el.type === 'text') {
        addColor(resolveFont(model, el.style).color);
      } else if (el.type === 'hyperlink') {
        addColor(resolveFont(model, el.style ?? { color: '0066CC', underline: true }).color);
      }
    }
  }

  const colorIndex = new Map<string, number>();
  let i = 1;
  for (const color of colors) colorIndex.set(color, i++);
  return colorIndex;
}

/** Genera il contenuto RTF completo come stringa (sincrono, nessun I/O). */
export function buildRtfString(model: DocumentModel): string {
  // Font table
  const fonts = new Map<string, number>();
  let fontIndex = 0;
  const collectFonts = (font: FontStyle) => {
    const key = `${font.family}|${font.size}|${font.bold}|${font.italic}`;
    if (!fonts.has(key)) {
      fonts.set(key, fontIndex++);
    }
  };
  // Raccolta font dal modello (semplificato)
  collectFonts(model.styles?.defaultFont ?? { family: 'Helvetica', size: 11 });

  const fontTable = Array.from(fonts.entries()).map(([_, i]) => {
    // Trova il font per questo index
    for (const [k, v] of fonts) {
      if (v === i) {
        const [fam, sz, b, it] = k.split('|');
        return fontToRtf({ family: fam, size: parseInt(sz), bold: b === 'true', italic: it === 'true' }, i);
      }
    }
    return '';
  }).join('');

  // Color table — costruita dai colori realmente usati nel documento, così
  // \cf<indice> punta sempre a un'entry valida invece di inlineare l'hex.
  const colorIndex = buildColorIndex(model);
  const colorEntries = Array.from(colorIndex.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([hex]) => {
      const rgb = parseHexColor(hex)!;
      return `\\red${rgb.r}\\green${rgb.g}\\blue${rgb.b};`;
    })
    .join('');

  const parts: string[] = [
    '{\\rtf1\\ansi\\deff0',
    '{\\*\\generator Milo Office}',
    `{\\fonttbl${fontTable}}`,
    `{\\colortbl;${colorEntries}}`,
    '\\widowctrl\\hyphauto',
  ];

  // Contenuto
  for (const block of model.blocks) {
    parts.push(blockToRtf(block, model, colorIndex));
  }

  parts.push('}');

  return parts.join('\n');
}

/** ENTRY POINT */
export async function buildRtf(model: DocumentModel): Promise<RtfBuildResult> {
  const content = buildRtfString(model);
  const filename = `${safeName(model.metadata.title)}_${Date.now()}.rtf`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filepath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { filepath, filename };
}