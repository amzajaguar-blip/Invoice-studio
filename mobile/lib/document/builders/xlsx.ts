/**
 * builders/xlsx.ts — Builder XLSX (Excel) dal DocumentModel.
 *
 * Usa SheetJS (xlsx) per produrre un foglio di calcolo reale.
 * Importi rimangono `number` con formato cella (`z`) per permettere somme.
 * Non usa stili Pro (grassetto, fill, bordi) - limitazione SheetJS Community.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import type { DocumentModel, BlockElement, Table, TableRow, TableCell } from '../model';
import { safeName, inlineToText, documentToText } from './shared';

export interface XlsxBuildResult {
  filepath: string;
  filename: string;
}

/** Formato valuta per SheetJS. */
function currencyFormat(currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  return `#,##0.00\\ ${sym}`;
}

/** Quantità formato. */
const QTY_FORMAT = '#,##0';

/** Sanitizza per formula injection. */
function sanitizeCell(value: string): string {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

/** Converte un blocco Table in righe XLSX. */
function tableToRows(table: Table): (string | number)[][] {
  const rows: (string | number)[][] = [];

  // Header
  if (table.header) {
    rows.push(table.header.cells.map((c) => sanitizeCell(inlineToText(c.blocks.flatMap((b) => b.type === 'paragraph' ? b.children : [])))));
  }

  // Data rows
  for (const row of table.rows) {
    rows.push(row.cells.map((c) => sanitizeCell(inlineToText(c.blocks.flatMap((b) => b.type === 'paragraph' ? b.children : [])))));
  }

  return rows;
}

/** Scrive metadati e contenuto nel worksheet. */
function writeModelToSheet(model: DocumentModel, worksheet: XLSX.WorkSheet): number {
  type Cell = string | number | null;
  const rows: Cell[][] = [];

  // Metadati
  rows.push([model.metadata.title]);
  if (model.metadata.subtitle) rows.push([model.metadata.subtitle]);
  rows.push([]);

  if (model.metadata.author) rows.push(['Autore', model.metadata.author]);
  if (model.metadata.company) rows.push(['Azienda', model.metadata.company]);
  if (model.metadata.createdAt) rows.push(['Creato', model.metadata.createdAt.toLocaleDateString('it-IT')]);
  rows.push([]);

  // Contenuto: itera i blocchi
  let currentRow = rows.length;
  for (const block of model.blocks) {
    if (block.type === 'table') {
      const tableRows = tableToRows(block);
      for (const tr of tableRows) rows.push(tr);
      rows.push([]); // riga vuota dopo tabella
    } else if (block.type === 'list') {
      for (const item of block.items) {
        const text = item.blocks.map((b) => inlineToText(b.type === 'paragraph' ? b.children : [])).join(' ');
        rows.push(['• ' + text]);
      }
      rows.push([]);
    } else if (block.type === 'heading') {
      rows.push([inlineToText(block.children)]);
    } else if (block.type === 'paragraph') {
      rows.push([inlineToText(block.children)]);
    } else if (block.type === 'quote') {
      rows.push(['Citazione', block.blocks.map((b) => inlineToText(b.type === 'paragraph' ? b.children : [])).join('\n')]);
    }
  }

  // Scrive nel worksheet
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      const ref = XLSX.utils.encode_cell({ r: i, c: j });
      const val = rows[i][j];
      if (val !== null && val !== undefined) {
        if (!worksheet[ref]) worksheet[ref] = { v: val };
        else worksheet[ref].v = val;
      }
    }
  }

  return currentRow;
}

/** Applica formati numerici dove rilevato. */
function applyNumberFormats(worksheet: XLSX.WorkSheet, model: DocumentModel): void {
  const currency = model.metadata.customProperties?.currency ?? 'EUR';
  const currencyFmt = currencyFormat(currency);

  // Heuristic: colonne con "importo", "prezzo", "totale", "amount", "rate" -> valuta
  // Colonne con "quantità", "qty", "quantity" -> quantità
  // Per semplicità: formatta tutte le celle numeriche dopo la riga 10
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');
  for (let r = 10; r <= range.e.r; r++) {
    for (let c = 1; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[ref];
      if (cell && typeof cell.v === 'number') {
        // Controlla header per decidere formato
        const headerRef = XLSX.utils.encode_cell({ r: 0, c });
        const headerCell = worksheet[headerRef];
        const headerText = headerCell ? String(headerCell.v).toLowerCase() : '';

        if (/importo|prezzo|totale|amount|rate|price|costo|cost|subtotale|tax|iva|imponibile/.test(headerText)) {
          cell.z = currencyFmt;
        } else if (/quantit|qty|quantity|q.t|pezzi/.test(headerText)) {
          cell.z = QTY_FORMAT;
        } else {
          cell.z = '#,##0.00';
        }
      }
    }
  }

  // Colonne auto-fit approssimativo
  worksheet['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
}

/** Costruisce il workbook XLSX dal DocumentModel (sincrono, nessun I/O). */
function buildWorkbook(model: DocumentModel): XLSX.WorkBook {
  const rows: (string | number)[][] = [];

  // Metadati
  rows.push([model.metadata.title]);
  if (model.metadata.subtitle) rows.push([model.metadata.subtitle]);
  rows.push([]);

  if (model.metadata.author) rows.push(['Autore', model.metadata.author]);
  if (model.metadata.company) rows.push(['Azienda', model.metadata.company]);
  if (model.metadata.createdAt) rows.push(['Creato', model.metadata.createdAt.toLocaleDateString('it-IT')]);
  rows.push([]);

  // Blocchi
  for (const block of model.blocks) {
    if (block.type === 'table') {
      const tableRows = tableToRows(block);
      for (const tr of tableRows) rows.push(tr);
      rows.push([]);
    } else if (block.type === 'list') {
      for (const item of block.items) {
        const text = item.blocks.map((b) => inlineToText(b.type === 'paragraph' ? b.children : [])).join(' ');
        rows.push(['• ' + text]);
      }
      rows.push([]);
    } else if (block.type === 'heading') {
      rows.push([inlineToText(block.children)]);
    } else if (block.type === 'paragraph') {
      rows.push([inlineToText(block.children)]);
    } else if (block.type === 'quote') {
      rows.push(['Citazione', block.blocks.map((b) => inlineToText(b.type === 'paragraph' ? b.children : [])).join('\n')]);
    }
  }

  // Crea worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Applica formati numerici
  applyNumberFormats(worksheet, model);

  // Merge per titolo
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  // Margini stampa
  worksheet['!margins'] = {
    left: 0.6, right: 0.6, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3,
  };

  // Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Documento');
  return workbook;
}

/** Genera XLSX come base64 (sincrono, per test/anteprima senza scrivere file). */
export function buildXlsxBase64(model: DocumentModel): string {
  const workbook = buildWorkbook(model);
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
}

/** ENTRY POINT */
export async function buildXlsx(model: DocumentModel): Promise<XlsxBuildResult> {
  const binary = buildXlsxBase64(model);

  const filename = `${safeName(model.metadata.title)}_${Date.now()}.xlsx`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(filepath, binary, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { filepath, filename };
}