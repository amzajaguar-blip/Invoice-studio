/**
 * builders/docx.ts — Builder DOCX dal DocumentModel.
 *
 * Usa il pacchetto `docx` (8.5.0) per produrre un file OOXML reale.
 * Supporta: heading H1-H6, paragrafi, liste, tabelle, immagini, page break,
 * header/footer con numerazione pagine, metadati documento.
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  ExternalHyperlink,
  FootnoteReference,
} from 'docx';
import type { IParagraphPropertiesOptions, ParagraphChild } from 'docx';
import type {
  DocumentModel,
  BlockElement,
  InlineElement,
  FontStyle,
  ParagraphStyle,
  Table as ModelTable,
  TableRow as ModelTableRow,
  TableCell as ModelTableCell,
  HeaderFooter,
  PageNumbering,
  HorizontalAlignment,
  VerticalAlignment,
} from '../model';
import {
  inlineToText,
  resolveFont,
  resolveParagraphStyle,
  hexToDocx,
  ptToHalfPoints,
  ptToTwips,
  ptToTwipsMargin,
  ptToEmu,
  safeName,
} from './shared';

/** Dimensioni pagina standard in punti (72pt = 1in). docx vuole misure assolute, non nomi ISO/ANSI. */
const PAGE_SIZES_PT: Record<string, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  A3: { width: 842, height: 1191 },
  A5: { width: 420, height: 595 },
};

// ============================================================
// MAPPING STILI
// ============================================================

/** Sottoinsieme minimo di IRunPropertiesOptions: evita di spargere l'intera interfaccia (troppo
 * ampia, es. 'border') dentro new Paragraph({...}), che genera conflitti di tipo col border
 * a livello di paragrafo (forma diversa da quello a livello di run). */
interface DocxRunFontStyle {
  font?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  italics?: boolean;
  underline?: { type: 'single' };
  strike?: boolean;
}

function fontToDocxRunStyle(font: FontStyle & { family: string; size: number }): DocxRunFontStyle {
  const style: DocxRunFontStyle = {
    font: font.family,
    size: ptToHalfPoints(font.size),
    color: hexToDocx(font.color),
    bold: font.bold,
    italics: font.italic,
    underline: font.underline ? { type: 'single' as const } : undefined,
    strike: font.strikethrough,
  };
  return style;
}

function alignmentToDocx(align?: HorizontalAlignment): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.BOTH;
    default:
      return AlignmentType.LEFT;
  }
}

function paragraphSpacingToDocx(style: ParagraphStyle): IParagraphPropertiesOptions {
  return {
    spacing: {
      before: style.spaceBefore ? ptToTwips(style.spaceBefore) : 0,
      after: style.spaceAfter ? ptToTwips(style.spaceAfter) : 0,
      line: style.lineSpacing ? Math.round(style.lineSpacing * 240) : 276, // 1.15 * 240
      lineRule: style.lineSpacing ? 'auto' : 'atLeast',
    },
    indent: {
      left: style.indentLeft ? ptToTwips(style.indentLeft) : 0,
      right: style.indentRight ? ptToTwips(style.indentRight) : 0,
      firstLine: style.indentFirstLine ? ptToTwips(style.indentFirstLine) : undefined,
      hanging: style.indentFirstLine && style.indentFirstLine < 0 ? ptToTwips(-style.indentFirstLine) : undefined,
    },
    keepNext: style.keepWithNext,
    keepLines: style.keepLinesTogether,
    pageBreakBefore: style.pageBreakBefore,
  };
}

// ============================================================
// SERIALIZZAZIONE INLINE → TextRun[]
// ============================================================

function inlineToTextRuns(elements: InlineElement[], model: DocumentModel): ParagraphChild[] {
  return elements.flatMap((el): ParagraphChild => {
    switch (el.type) {
      case 'text': {
        const font = resolveFont(model, el.style);
        return new TextRun({ text: el.text, ...fontToDocxRunStyle(font) });
      }
      case 'hyperlink': {
        const font = resolveFont(model, el.style ?? { color: '0066CC', underline: true });
        return new ExternalHyperlink({
          children: [new TextRun({ text: el.text, ...fontToDocxRunStyle(font) })],
          link: el.url,
        });
      }
      case 'image': {
        // L'immagine deve essere base64 o URL accessibile
        // Qui assumiamo data URI o URL; se locale va convertito a base64 prima
        return new ImageRun({
          data: el.source.startsWith('data:') ? el.source.split(',')[1] : el.source,
          transformation: { width: ptToEmu(el.width), height: ptToEmu(el.height) },
          altText: el.alt ? { name: 'image', title: el.alt, description: el.alt } : undefined,
        });
      }
      case 'footnoteRef':
        return new FootnoteReference(parseInt(el.id) || 1);
      case 'pageNumber':
        return new TextRun({ children: [PageNumber.CURRENT] });
      case 'totalPages':
        return new TextRun({ children: [PageNumber.TOTAL_PAGES] });
      default:
        return new TextRun({ text: '' });
    }
  });
}

// ============================================================
// SERIALIZZAZIONE BLOCCHI
// ============================================================

const HEADING_LEVEL_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function headingToDocx(block: Extract<BlockElement, { type: 'heading' }>, model: DocumentModel): Paragraph {
  const level = block.level;
  const headingLevel = HEADING_LEVEL_MAP[level] ?? HeadingLevel.HEADING_6;
  const style = block.style ?? {};
  const font = resolveFont(model, style.font ?? { size: headingSize(level), bold: true });
  const paraStyle = resolveParagraphStyle(model, style);

  return new Paragraph({
    children: inlineToTextRuns(block.children, model),
    heading: headingLevel,
    alignment: alignmentToDocx(paraStyle.alignment),
    ...paragraphSpacingToDocx(paraStyle),
    ...fontToDocxRunStyle(font),
  });
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

function paragraphToDocx(block: Extract<BlockElement, { type: 'paragraph' }>, model: DocumentModel): Paragraph {
  const style = resolveParagraphStyle(model, block.style);
  const defaultRunStyle = block.defaultRunStyle ? fontToDocxRunStyle(resolveFont(model, block.defaultRunStyle)) : {};

  return new Paragraph({
    children: inlineToTextRuns(block.children, model),
    alignment: alignmentToDocx(style.alignment),
    ...paragraphSpacingToDocx(style),
    ...defaultRunStyle,
  });
}

/** Elenco puntato/numerato: il marker va iniettato nel primo paragrafo di ogni item, non c'e' un
 * riferimento a una definizione di numerazione registrata nel Document (fuori scope qui). */
function listToDocx(block: Extract<BlockElement, { type: 'list' }>, model: DocumentModel): Paragraph[] {
  return block.items.flatMap((item, index) => {
    const marker = block.ordered ? `${item.ordinal ?? index + 1}. ` : `${block.bulletMarker ?? '•'} `;
    const [firstBlock, ...restBlocks] = item.blocks;
    const markedBlocks: BlockElement[] =
      firstBlock && firstBlock.type === 'paragraph'
        ? [{ ...firstBlock, children: [{ type: 'text', text: marker }, ...firstBlock.children] }, ...restBlocks]
        : item.blocks;
    return markedBlocks
      .flatMap((b) => blockToDocx(b, model))
      .filter((p): p is Paragraph => p instanceof Paragraph);
  });
}

function tableCellToDocx(
  cell: ModelTableCell,
  model: DocumentModel,
  isHeader: boolean,
  columnWidthPercent: number | undefined,
  rowBackgroundColor: string | undefined
): TableCell {
  const children = cell.blocks.flatMap((b) => blockToDocx(b, model));
  const borders: Record<string, { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }> = {};
  if (cell.style?.border) {
    const b = cell.style.border;
    if (b.top) borders.top = { style: b.top.style, size: b.top.width * 4, color: hexToDocx(b.top.color) ?? 'CCCCCC' };
    if (b.bottom) borders.bottom = { style: b.bottom.style, size: b.bottom.width * 4, color: hexToDocx(b.bottom.color) ?? 'CCCCCC' };
    if (b.left) borders.left = { style: b.left.style, size: b.left.width * 4, color: hexToDocx(b.left.color) ?? 'CCCCCC' };
    if (b.right) borders.right = { style: b.right.style, size: b.right.width * 4, color: hexToDocx(b.right.color) ?? 'CCCCCC' };
  }
  const backgroundColor = cell.style?.backgroundColor ?? rowBackgroundColor;
  return new TableCell({
    children,
    columnSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    verticalAlign: cell.verticalAlignment === 'top' ? 'top' : cell.verticalAlignment === 'middle' ? 'center' : 'bottom',
    width:
      cell.width === 'auto'
        ? { size: 0, type: WidthType.AUTO }
        : { size: cell.width ?? columnWidthPercent ?? 0, type: WidthType.PERCENTAGE },
    shading: backgroundColor ? { fill: hexToDocx(backgroundColor) ?? 'FFFFFF' } : undefined,
    borders: Object.keys(borders).length > 0 ? borders : undefined,
  });
}

function tableRowToDocx(row: ModelTableRow, model: DocumentModel, isHeader: boolean, columnWidths: ModelTable['columnWidths']): TableRow {
  return new TableRow({
    children: row.cells.map((c, i) => {
      const w = columnWidths?.[i];
      return tableCellToDocx(c, model, isHeader, w === 'auto' || w === undefined ? undefined : w, row.backgroundColor);
    }),
    tableHeader: isHeader,
    height: row.height ? { value: ptToTwips(row.height), rule: 'atLeast' } : undefined,
  });
}

function tableToDocx(block: ModelTable, model: DocumentModel): Table {
  const style = block.style ?? model.styles?.tableStyles?.default;
  const width = style?.width === 'auto' ? { size: 0, type: WidthType.AUTO } : { size: 100, type: WidthType.PERCENTAGE };

  const rows: TableRow[] = [];
  if (block.header) rows.push(tableRowToDocx(block.header, model, true, block.columnWidths));
  for (const row of block.rows) rows.push(tableRowToDocx(row, model, false, block.columnWidths));

  // Le proporzioni di colonna sono gia' applicate per-cella (width percentuale in tableCellToDocx);
  // Table.columnWidths della libreria vuole DXA assoluti, incompatibili con un modello a percentuali.
  return new Table({
    rows,
    width,
  });
}

function imageBlockToDocx(block: Extract<BlockElement, { type: 'imageBlock' }>, model: DocumentModel): Paragraph[] {
  const align = block.alignment ?? 'center';
  const imgPara = new Paragraph({
    children: [
      new ImageRun({
        data: block.source.startsWith('data:') ? block.source.split(',')[1] : block.source,
        transformation: { width: ptToEmu(block.width), height: ptToEmu(block.height) },
      }),
    ],
    alignment: alignmentToDocx(align),
  });
  const captions = block.caption
    ? [new Paragraph({ children: inlineToTextRuns(block.caption, model), alignment: alignmentToDocx(align), style: 'caption' })]
    : [];
  return [imgPara, ...captions];
}

function quoteToDocx(block: Extract<BlockElement, { type: 'quote' }>, model: DocumentModel): Paragraph[] {
  // Applica lo stile citazione (indent + spaziatura) a livello di modello, PRIMA della
  // costruzione: un Paragraph gia' costruito non espone piu' i propri children/style.
  const quoted: BlockElement[] = block.blocks.map((b) => {
    if (b.type !== 'paragraph') return b;
    return {
      ...b,
      style: {
        ...b.style,
        indentLeft: 36 + (b.style?.indentLeft ?? 0),
        spaceBefore: b.style?.spaceBefore ?? 6,
        spaceAfter: b.style?.spaceAfter ?? 6,
      },
    };
  });
  return quoted
    .flatMap((b) => blockToDocx(b, model))
    .filter((p): p is Paragraph => p instanceof Paragraph);
}

function signatureToDocx(block: Extract<BlockElement, { type: 'signatureBlock' }>, model: DocumentModel): Paragraph[] {
  const align = block.alignment ?? 'left';
  const lineWidth = block.lineWidth ?? 200;
  const parts: Paragraph[] = [];

  if (block.signerName) {
    parts.push(new Paragraph({ children: [new TextRun({ text: block.signerName, bold: true })], alignment: alignmentToDocx(align) }));
  }
  if (block.signerRole) {
    parts.push(new Paragraph({ children: [new TextRun({ text: block.signerRole, color: '999999' })], alignment: alignmentToDocx(align) }));
  }
  parts.push(new Paragraph({
    children: [new TextRun({ text: '_'.repeat(Math.floor(lineWidth / 5)) })],
    alignment: alignmentToDocx(align),
    spacing: { before: ptToTwips(block.lineHeight ?? 40) },
  }));
  parts.push(new Paragraph({
    children: [new TextRun({ text: block.label, size: ptToHalfPoints(9), color: '999999' })],
    alignment: alignmentToDocx(align),
    spacing: { before: 80 },
  }));
  if (block.showDateLine !== false) {
    const date = block.date === 'auto' ? new Date().toLocaleDateString('it-IT') : block.date;
    if (date) {
      parts.push(new Paragraph({
        children: [new TextRun({ text: date, size: ptToHalfPoints(9), color: '999999' })],
        alignment: alignmentToDocx(align),
        spacing: { before: 80 },
      }));
    }
  }
  return parts;
}

function checklistToDocx(block: Extract<BlockElement, { type: 'checklist' }>, model: DocumentModel): Paragraph[] {
  const paras: Paragraph[] = [];
  if (block.title) {
    paras.push(new Paragraph({ children: inlineToTextRuns(block.title, model), spacing: { after: 120 } }));
  }
  for (const item of block.items) {
    const box = item.checked ? '☑ ' : '☐ ';
    const indent = (item.level ?? 0) * 360;
    paras.push(new Paragraph({
      children: [new TextRun({ text: box + inlineToText(item.text) })],
      indent: { left: indent },
      spacing: { before: 80, after: 80 },
    }));
  }
  return paras;
}

function codeBlockToDocx(block: Extract<BlockElement, { type: 'codeBlock' }>, model: DocumentModel): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: block.code, font: 'Courier New', size: ptToHalfPoints(10) })],
    spacing: { before: 120, after: 120 },
    shading: { fill: 'F5F5F5' },
  });
}

function blockToDocx(block: BlockElement, model: DocumentModel): Paragraph | Paragraph[] | Table {
  switch (block.type) {
    case 'heading':
      return headingToDocx(block, model);
    case 'paragraph':
      return paragraphToDocx(block, model);
    case 'list':
      return listToDocx(block, model);
    case 'table':
      return tableToDocx(block, model);
    case 'imageBlock':
      return imageBlockToDocx(block, model);
    case 'quote':
      return quoteToDocx(block, model);
    case 'pageBreak':
      return new Paragraph({ children: [new TextRun({ text: '', break: 1 })] });
    case 'sectionBreak':
      return new Paragraph({ children: [new TextRun({ text: '', break: 1 })] });
    case 'horizontalRule':
      return new Paragraph({ children: [new TextRun({ text: '─'.repeat(50), color: 'CCCCCC' })], alignment: AlignmentType.CENTER });
    case 'signatureBlock':
      return signatureToDocx(block, model);
    case 'checklist':
      return checklistToDocx(block, model);
    case 'codeBlock':
      return codeBlockToDocx(block, model);
    default:
      return new Paragraph({ children: [new TextRun({ text: '' })] });
  }
}

// ============================================================
// HEADER / FOOTER
// ============================================================

function headerFooterToDocx(hf: HeaderFooter | undefined, model: DocumentModel): (Header | Footer) | undefined {
  if (!hf) return undefined;
  const children = hf.blocks.flatMap((b) => blockToDocx(b, model));
  // docx richiede Header/Footer separati; qui restituiamo il contenuto come Paragraph[]
  return children as any;
}

function buildPageNumbering(model: DocumentModel): { header?: Header; footer?: Footer } {
  const pn = model.pageNumbering;
  if (!pn) return {};

  const format = pn.format;
  const prefix = pn.prefix ?? '';
  const suffix = pn.suffix ?? '';
  const font = pn.font ? fontToDocxRunStyle(resolveFont(model, pn.font)) : { size: ptToHalfPoints(8), color: '999999' };

  const pageNumPara = new Paragraph({
    children: [
      new TextRun({ text: prefix, ...font }),
      new TextRun({ children: [PageNumber.CURRENT], ...font }),
      new TextRun({ text: suffix, ...font }),
    ],
    alignment: alignmentToDocx(pn.alignment),
  });

  if (pn.position === 'header') {
    return { header: new Header({ children: [pageNumPara] }) };
  }
  return { footer: new Footer({ children: [pageNumPara] }) };
}

// ============================================================
// ENTRY POINT
// ============================================================

export interface DocxBuildResult {
  filepath: string;
  filename: string;
}

export async function buildDocx(model: DocumentModel): Promise<DocxBuildResult> {
  // Paragrafi principali
  const children: (Paragraph | Table)[] = [];
  for (const block of model.blocks) {
    const result = blockToDocx(block, model);
    if (Array.isArray(result)) {
      children.push(...result);
    } else {
      children.push(result);
    }
  }

  // Page setup
  const margins = model.pageSetup.margins;

  // Header / Footer con numerazione
  const { header, footer } = buildPageNumbering(model);
  // Nota: header/footer custom dai template vengono applicati via blockToDocx se presenti
  // Qui usiamo solo la numerazione standard; per header/footer custom serve logica avanzata

  const doc = new Document({
    creator: model.metadata.creator ?? 'Milo Office',
    title: model.metadata.title,
    description: model.metadata.description,
    subject: model.metadata.subject,
    keywords: model.metadata.keywords?.join(', '),
    // category/createdAt/modifiedAt: la libreria docx (8.5.0) non espone questi campi OOXML
    // nel costruttore di Document (le date di creazione/modifica sono gestite internamente).
    lastModifiedBy: model.metadata.author,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: ptToTwipsMargin(margins.top),
              right: ptToTwipsMargin(margins.right),
              bottom: ptToTwipsMargin(margins.bottom),
              left: ptToTwipsMargin(margins.left),
              header: margins.header ? ptToTwipsMargin(margins.header) : undefined,
              footer: margins.footer ? ptToTwipsMargin(margins.footer) : undefined,
              gutter: margins.gutter ? ptToTwipsMargin(margins.gutter) : undefined,
            },
            size: {
              orientation: model.pageSetup.orientation,
              ...(typeof model.pageSetup.size === 'string'
                ? {
                    width: ptToTwips((PAGE_SIZES_PT[model.pageSetup.size] ?? PAGE_SIZES_PT.A4).width),
                    height: ptToTwips((PAGE_SIZES_PT[model.pageSetup.size] ?? PAGE_SIZES_PT.A4).height),
                  }
                : { width: ptToTwips(model.pageSetup.size.width), height: ptToTwips(model.pageSetup.size.height) }),
            },
          },
        },
        headers: header ? { default: header } : undefined,
        footers: footer ? { default: footer } : undefined,
        children: children.filter((c): c is Paragraph | Table => c instanceof Paragraph || c instanceof Table),
      },
    ],
  });

  let buffer: ArrayBuffer;
  try {
    const blob = await Packer.toBlob(doc);
    buffer = await blob.arrayBuffer();
  } catch (err) {
    throw new Error(`DOCX generation failed: ${String(err)}`);
  }

  const base64 = _arrayBufferToBase64(buffer);
  const filename = `${safeName(model.metadata.title)}_${Date.now()}.docx`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filepath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { filepath, filename };
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}