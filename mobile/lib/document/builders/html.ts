/**
 * builders/html.ts — Builder HTML dal DocumentModel.
 *
 * Produce HTML valido e autosufficiente (inline CSS, nessuna risorsa esterna).
 * È la sorgente condivisa per: PDF (via expo-print) e preview in-app (WebView).
 * Un solo builder HTML → PDF e preview mostrano lo STESSO output.
 */

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
  HeaderFooter,
} from '../model';
import {
  escHtml,
  inlineToText,
  resolveFont,
  resolveParagraphStyle,
  hexToCss,
  ptToPx,
  ptToMm,
} from './shared';

// ============================================================
// SERIALIZZAZIONE INLINE
// ============================================================

function fontToCss(font: FontStyle & { family: string; size: number }): string {
  const parts: string[] = [];
  parts.push(`font-family:${font.family};`);
  parts.push(`font-size:${ptToPx(font.size)};`);
  if (font.color) parts.push(`color:${hexToCss(font.color)};`);
  if (font.bold) parts.push('font-weight:700;');
  if (font.italic) parts.push('font-style:italic;');
  if (font.underline) parts.push('text-decoration:underline;');
  if (font.strikethrough) parts.push('text-decoration:line-through;');
  return parts.join('');
}

function paragraphToCss(style: ParagraphStyle): string {
  const parts: string[] = [];
  if (style.alignment) parts.push(`text-align:${style.alignment};`);
  if (style.spaceBefore !== undefined) parts.push(`margin-top:${ptToPx(style.spaceBefore)};`);
  if (style.spaceAfter !== undefined) parts.push(`margin-bottom:${ptToPx(style.spaceAfter)};`);
  if (style.lineSpacing !== undefined) parts.push(`line-height:${style.lineSpacing};`);
  if (style.indentLeft !== undefined) parts.push(`padding-left:${ptToPx(style.indentLeft)};`);
  if (style.indentRight !== undefined) parts.push(`padding-right:${ptToPx(style.indentRight)};`);
  if (style.indentFirstLine !== undefined) parts.push(`text-indent:${ptToPx(style.indentFirstLine)};`);
  if (style.backgroundColor) parts.push(`background-color:${hexToCss(style.backgroundColor)};`);
  if (style.keepWithNext) parts.push('page-break-after:avoid;');
  if (style.keepLinesTogether) parts.push('page-break-inside:avoid;');
  if (style.pageBreakBefore) parts.push('page-break-before:always;');
  return parts.join('');
}

function inlineToHtml(elements: InlineElement[], model: DocumentModel): string {
  return elements
    .map((el) => {
      switch (el.type) {
        case 'text': {
          const font = resolveFont(model, el.style);
          const css = fontToCss(font);
          const escaped = escHtml(el.text).replace(/\n/g, '<br/>');
          return `<span style="${css}">${escaped}</span>`;
        }
        case 'hyperlink': {
          const font = resolveFont(model, el.style ?? { color: '0066CC', underline: true });
          const css = fontToCss(font);
          return `<a href="${escHtml(el.url)}" style="${css}">${escHtml(el.text)}</a>`;
        }
        case 'image': {
          return `<img src="${escHtml(el.source)}" width="${el.width}" height="${el.height}" alt="${escHtml(el.alt ?? '')}" style="max-width:100%;"/>`;
        }
        case 'footnoteRef':
          return `<sup>${escHtml(el.id)}</sup>`;
        case 'pageNumber':
          return '<span class="page-number"></span>';
        case 'totalPages':
          return '<span class="total-pages"></span>';
        default:
          return '';
      }
    })
    .join('');
}

// ============================================================
// SERIALIZZAZIONE BLOCCHI
// ============================================================

function headingToHtml(block: Extract<BlockElement, { type: 'heading' }>, model: DocumentModel): string {
  const level = block.level;
  const style = block.style ?? {};
  const font = resolveFont(model, style.font ?? { size: headingSize(level), bold: true });
  const css = `${fontToCss(font)};${paragraphToCss(style)}`;
  const content = inlineToHtml(block.children, model);
  return `<h${level} style="${css}">${content}</h${level}>`;
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

function paragraphToHtml(block: Extract<BlockElement, { type: 'paragraph' }>, model: DocumentModel): string {
  const style = resolveParagraphStyle(model, block.style);
  const css = paragraphToCss(style);
  const content = inlineToHtml(block.children, model);
  return `<p style="${css}">${content}</p>`;
}

function listToHtml(block: List, model: DocumentModel): string {
  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items.map((item) => listItemToHtml(item, model)).join('');
  const style = block.ordered
    ? `list-style-type:${block.numberingStyle?.format === 'upperRoman' ? 'upper-roman' : block.numberingStyle?.format === 'lowerRoman' ? 'lower-roman' : block.numberingStyle?.format === 'upperLetter' ? 'upper-alpha' : block.numberingStyle?.format === 'lowerLetter' ? 'lower-alpha' : 'decimal'};`
    : `list-style-type:disc;`;
  return `<${tag} style="${style}margin:0;padding-left:24px;">${items}</${tag}>`;
}

function listItemToHtml(item: ListItem, model: DocumentModel): string {
  const inner = item.blocks.map((b) => blockToHtml(b, model)).join('');
  return `<li>${inner}</li>`;
}

function tableToHtml(block: Table, model: DocumentModel): string {
  const style = block.style ?? model.styles?.tableStyles?.default;
  const width = style?.width === 'auto' ? 'auto' : `${style?.width ?? 100}%`;
  const border = style?.cellBorder
    ? `border:${style.cellBorder.width}px solid ${hexToCss(style.cellBorder.color ?? 'CCCCCC')};`
    : '';

  const headerHtml = block.header
    ? `<thead>${tableRowToHtml(block.header, model, true, style?.headerColor)}</thead>`
    : '';

  const bodyHtml = block.rows.map((r) => tableRowToHtml(r, model, false, undefined)).join('');

  return `<table style="width:${width};border-collapse:collapse;${border}">${headerHtml}<tbody>${bodyHtml}</tbody></table>`;
}

function tableRowToHtml(row: TableRow, model: DocumentModel, isHeader: boolean, headerColor?: string): string {
  const cells = row.cells.map((c) => tableCellToHtml(c, model, isHeader, headerColor)).join('');
  return `<tr>${cells}</tr>`;
}

function tableCellToHtml(cell: TableCell, model: DocumentModel, isHeader: boolean, headerColor?: string): string {
  const tag = isHeader ? 'th' : 'td';
  const padding = cell.style?.padding ?? { top: 4, right: 6, bottom: 4, left: 6 };
  const bg = cell.style?.backgroundColor ?? (isHeader ? headerColor : undefined);
  const align = cell.alignment ?? 'left';
  const valign = cell.verticalAlignment ?? 'top';
  const colSpan = cell.colSpan ? ` colspan="${cell.colSpan}"` : '';
  const rowSpan = cell.rowSpan ? ` rowspan="${cell.rowSpan}"` : '';
  const content = cell.blocks.map((b) => blockToHtml(b, model)).join('');
  return `<${tag}${colSpan}${rowSpan} style="padding:${ptToPx(padding.top)} ${ptToPx(padding.right)} ${ptToPx(padding.bottom)} ${ptToPx(padding.left)};text-align:${align};vertical-align:${valign};${bg ? `background-color:${hexToCss(bg)};` : ''}">${content}</${tag}>`;
}

function imageBlockToHtml(block: Extract<BlockElement, { type: 'imageBlock' }>, model: DocumentModel): string {
  const align = block.alignment ?? 'center';
  const img = `<img src="${escHtml(block.source)}" width="${block.width}" height="${block.height}" alt="" style="max-width:100%;"/>`;
  const caption = block.caption
    ? `<div style="text-align:center;font-size:${ptToPx(9)};color:#666;margin-top:4px;">${inlineToHtml(block.caption, model)}</div>`
    : '';
  return `<div style="text-align:${align};margin:8px 0;">${img}${caption}</div>`;
}

function quoteToHtml(block: Extract<BlockElement, { type: 'quote' }>, model: DocumentModel): string {
  const inner = block.blocks.map((b) => blockToHtml(b, model)).join('');
  const attribution = block.attribution
    ? `<div style="text-align:right;font-style:italic;color:#666;">— ${inlineToHtml(block.attribution, model)}</div>`
    : '';
  const borderLeft = block.style?.borderLeft
    ? `border-left:${block.style.borderLeft.width}px solid ${hexToCss(block.style.borderLeft.color ?? 'CCCCCC')};`
    : 'border-left:3px solid #CCCCCC;';
  const bg = block.style?.backgroundColor ? `background-color:${hexToCss(block.style.backgroundColor)};` : '';
  const padding = block.style?.padding ?? 12;
  return `<blockquote style="${borderLeft}${bg}padding:${ptToPx(padding)};margin:8px 0;">${inner}${attribution}</blockquote>`;
}

function signatureToHtml(block: Extract<BlockElement, { type: 'signatureBlock' }>, model: DocumentModel): string {
  const align = block.alignment ?? 'left';
  const lineWidth = block.lineWidth ?? 200;
  const lineHeight = block.lineHeight ?? 40;
  const parts: string[] = [];
  if (block.signerName) parts.push(`<div style="font-weight:700;">${escHtml(block.signerName)}</div>`);
  if (block.signerRole) parts.push(`<div style="color:#666;">${escHtml(block.signerRole)}</div>`);
  parts.push(`<div style="margin-top:${ptToPx(lineHeight)};border-bottom:1px solid #000;width:${lineWidth}px;"></div>`);
  parts.push(`<div style="font-size:${ptToPx(9)};color:#666;margin-top:4px;">${escHtml(block.label)}</div>`);
  if (block.showDateLine !== false) {
    const date = block.date === 'auto' ? new Date().toLocaleDateString('it-IT') : block.date;
    if (date) parts.push(`<div style="font-size:${ptToPx(9)};color:#666;margin-top:4px;">${escHtml(date)}</div>`);
  }
  return `<div style="text-align:${align};margin:16px 0;">${parts.join('')}</div>`;
}

function checklistToHtml(block: Extract<BlockElement, { type: 'checklist' }>, model: DocumentModel): string {
  const title = block.title ? `<div style="font-weight:700;margin-bottom:8px;">${inlineToHtml(block.title, model)}</div>` : '';
  const items = block.items
    .map((item) => {
      const box = item.checked ? '☑' : '☐';
      const indent = (item.level ?? 0) * 20;
      return `<div style="padding-left:${indent}px;margin:4px 0;">${box} ${inlineToHtml(item.text, model)}</div>`;
    })
    .join('');
  return `<div>${title}${items}</div>`;
}

function codeBlockToHtml(block: Extract<BlockElement, { type: 'codeBlock' }>, model: DocumentModel): string {
  const bg = block.theme === 'dark' ? '#1e1e1e' : '#f5f5f5';
  const color = block.theme === 'dark' ? '#d4d4d4' : '#111';
  return `<pre style="background-color:${bg};color:${color};padding:12px;border-radius:4px;overflow-x:auto;font-family:Monospace;font-size:${ptToPx(10)};line-height:1.4;">${escHtml(block.code)}</pre>`;
}

function blockToHtml(block: BlockElement, model: DocumentModel): string {
  switch (block.type) {
    case 'heading':
      return headingToHtml(block, model);
    case 'paragraph':
      return paragraphToHtml(block, model);
    case 'list':
      return listToHtml(block, model);
    case 'table':
      return tableToHtml(block, model);
    case 'imageBlock':
      return imageBlockToHtml(block, model);
    case 'quote':
      return quoteToHtml(block, model);
    case 'pageBreak':
      return '<div style="page-break-after:always;"></div>';
    case 'sectionBreak':
      return '<div style="page-break-after:always;"></div>';
    case 'horizontalRule': {
      const border = block.border ?? { style: 'single', width: 1, color: 'CCCCCC' };
      const width = block.width ?? 100;
      const align = block.alignment ?? 'center';
      return `<hr style="border:none;border-top:${border.width}px solid ${hexToCss(border.color ?? 'CCCCCC')};width:${width}%;margin:12px auto;"/>`;
    }
    case 'signatureBlock':
      return signatureToHtml(block, model);
    case 'checklist':
      return checklistToHtml(block, model);
    case 'codeBlock':
      return codeBlockToHtml(block, model);
    default:
      return '';
  }
}

// ============================================================
// HEADER / FOOTER
// ============================================================

function headerFooterToHtml(hf: HeaderFooter | undefined, model: DocumentModel): string {
  if (!hf) return '';
  return hf.blocks.map((b) => blockToHtml(b, model)).join('');
}

// ============================================================
// ENTRY POINT
// ============================================================

export interface HtmlBuildOptions {
  /** true = include @page CSS per stampa PDF; false = solo HTML per preview */
  forPrint?: boolean;
  /** Titolo pagina (tag <title>) */
  pageTitle?: string;
}

/**
 * Costruisce l'HTML completo dal DocumentModel.
 * Autosufficiente: nessuna risorsa esterna, tutto inline.
 */
export function buildHtml(model: DocumentModel, options: HtmlBuildOptions = {}): string {
  const { forPrint = true, pageTitle } = options;
  const setup = model.pageSetup;
  const margins = setup.margins;

  const sizeCss =
    typeof setup.size === 'string'
      ? setup.size
      : `${ptToMm(setup.size.width)} ${ptToMm(setup.size.height)}`;

  const orientation = setup.orientation;

  const pageCss = forPrint
    ? `@page { size: ${sizeCss} ${orientation}; margin: ${ptToMm(margins.top)} ${ptToMm(margins.right)} ${ptToMm(margins.bottom)} ${ptToMm(margins.left)}; }`
    : '';

  const body = model.blocks.map((b) => blockToHtml(b, model)).join('\n');

  const headerHtml = headerFooterToHtml(model.header, model);
  const footerHtml = headerFooterToHtml(model.footer, model);

  // Numerazione pagine: per PDF usiamo CSS counters; per preview mostriamo placeholder
  const pageNumberHtml = model.pageNumbering
    ? `<div class="page-numbering" style="text-align:${model.pageNumbering.alignment};font-size:${ptToPx(model.pageNumbering.font?.size ?? 8)};color:${hexToCss(model.pageNumbering.font?.color ?? '9CA3AF')};">
        ${model.pageNumbering.prefix ?? ''}<span class="pn"></span>${model.pageNumbering.suffix ?? ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${model.metadata.language ?? 'it'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(pageTitle ?? model.metadata.title ?? 'Documento')}</title>
<style>
  ${pageCss}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${model.styles?.defaultFont?.family ?? 'Helvetica'}, sans-serif;
    font-size: ${ptToPx(model.styles?.defaultFont?.size ?? 11)};
    color: ${hexToCss(model.styles?.defaultFont?.color ?? '11181C')};
    line-height: ${model.styles?.defaultParagraph?.lineSpacing ?? 1.15};
  }
  .doc-header { margin-bottom: 16px; }
  .doc-footer { margin-top: 16px; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
  img { max-width: 100%; }
</style>
</head>
<body>
  ${headerHtml ? `<div class="doc-header">${headerHtml}</div>` : ''}
  ${body}
  ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ''}
  ${pageNumberHtml}
</body>
</html>`;
}

// Riesporta per comodità
export { inlineToText, documentToText } from './shared';