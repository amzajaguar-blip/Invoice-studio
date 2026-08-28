/**
 * builders/index.ts — Esporta tutti i builder di formato.
 *
 * Entry point unificato per generare qualsiasi formato dal DocumentModel.
 */

export { buildHtml } from './html';
export { buildPdf, buildPdfHtml } from './pdf';
export { buildDocx } from './docx';
export { buildTxt, buildTxtString } from './txt';
export { buildRtf, buildRtfString } from './rtf';
export { buildXlsx, buildXlsxBase64 } from './xlsx';

// Tipi risultato
export type { PdfBuildResult } from './pdf';
export type { DocxBuildResult } from './docx';
export type { TxtBuildResult } from './txt';
export type { RtfBuildResult } from './rtf';
export type { XlsxBuildResult } from './xlsx';
export type { HtmlBuildOptions } from './html';

// Formati supportati
export type OutputFormat = 'pdf' | 'docx' | 'xlsx' | 'rtf' | 'txt' | 'html';

/** Mappa formato -> builder function */
export const BUILDERS: Record<OutputFormat, (model: any) => Promise<any>> = {
  pdf: (model) => import('./pdf').then((m) => m.buildPdf(model)),
  docx: (model) => import('./docx').then((m) => m.buildDocx(model)),
  xlsx: (model) => import('./xlsx').then((m) => m.buildXlsx(model)),
  rtf: (model) => import('./rtf').then((m) => m.buildRtf(model)),
  txt: (model) => import('./txt').then((m) => m.buildTxt(model)),
  html: (model) => import('./html').then((m) => m.buildHtml(model)),
};

/** Estensioni file per formato */
export const FORMAT_EXT: Record<OutputFormat, string> = {
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
  rtf: 'rtf',
  txt: 'txt',
  html: 'html',
};

/** MIME types per formato */
export const FORMAT_MIME: Record<OutputFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  rtf: 'application/rtf',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
};

/** Verifica formato supportato */
export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && value in BUILDERS;
}