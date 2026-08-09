/**
 * document-format-engine.ts — Generazione documenti PDF, XLSX, DOCX e RTF
 *
 * Produce file reali nei formati dichiarati (non PDF rinominati).
 * Entry-point unificato: `generateDocument(data, format)` — usato da tutte le
 * schermate che offrono i pulsanti "Genera PDF / Excel / Word".
 *
 * PDF: via expo-print (Print.printToFileAsync su HTML strutturato)
 *   — magic bytes: 25 50 44 46 (%PDF)
 *
 * XLSX: via SheetJS (`xlsx` 0.18.5, JS puro, Metro compatibile)
 *   — foglio "Documento" con righe, quantità, prezzi e totali
 *   — magic bytes: 50 4B 03 04 (PK ZIP — standard OOXML/XLSX)
 *
 * DOCX: via pacchetto `docx` (8.5.0, JS puro, Metro compatibile)
 *   — include metadati: creator = 'Milo Office', company = 'Milo Office'
 *   — magic bytes: 50 4B 03 04 (PK ZIP — standard OOXML/DOCX)
 *
 * RTF: generazione testuale strutturata senza dipendenze esterne
 *   — include comment header: {\*\generator Milo Office}
 *   — magic bytes: 7B 5C 72 74 66 ({\rtf)
 *
 * ODT: rinviato al post-MVP (nessuna libreria JS pura Metro-compatibile verificata)
 *
 * Requirements: 19.1, 19.4, 19.6, 19.8, 19.9, 18.4
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import { money, qty, excelCurrencyFormat, EXCEL_QTY_FORMAT } from './format/money';
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
} from 'docx';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type OutputFormat = 'pdf' | 'xlsx' | 'doc' | 'rtf';

/**
 * Metadati per formato: estensione reale, MIME type e UTI iOS.
 * Unica fonte di verità — usata da generateDocument() e shareDocument().
 */
export const FORMAT_META: Record<
  OutputFormat,
  { ext: string; mimeType: string; uti: string; label: string }
> = {
  pdf: {
    ext: 'pdf',
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
    label: 'PDF',
  },
  xlsx: {
    ext: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'org.openxmlformats.spreadsheetml.sheet',
    label: 'Excel',
  },
  doc: {
    ext: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uti: 'org.openxmlformats.wordprocessingml.document',
    label: 'Word',
  },
  rtf: {
    ext: 'rtf',
    mimeType: 'application/rtf',
    uti: 'public.rtf',
    label: 'RTF',
  },
};

/** Normalizza un valore arbitrario (deep link, query param) in un OutputFormat. */
export function parseOutputFormat(value: unknown, fallback: OutputFormat = 'pdf'): OutputFormat {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'pdf') return 'pdf';
  if (raw === 'xlsx' || raw === 'xls' || raw === 'excel') return 'xlsx';
  if (raw === 'doc' || raw === 'docx' || raw === 'word') return 'doc';
  if (raw === 'rtf') return 'rtf';
  return fallback;
}

export interface DocumentLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface DocumentTotals {
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  grandTotal: number;
  currency: string;
}

export interface DocumentClientInfo {
  name: string;
  email?: string;
  address?: string;
  taxId?: string;
}

export interface DocumentFormatData {
  type: 'invoice' | 'quote' | 'expense_report' | 'custom';
  title: string;
  number?: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  client?: DocumentClientInfo;
  lineItems: DocumentLineItem[];
  totals: DocumentTotals;
  notes?: string;
  companyName?: string;
  // Custom document fields
  bodyMarkdown?: string;
  customTitle?: string;
}

export interface DocumentFormatOptions {
  format: OutputFormat;
  logoUrl?: string;
  translatedLabel?: string; // Label disclaimer traduzione automatica
}

// ─── DOCX Generation ─────────────────────────────────────────────────────────

function buildDocxDocument(data: DocumentFormatData): Document {
  const company = data.companyName ?? 'Milo Office';
  const currency = data.totals.currency === 'EUR' ? '€' : data.totals.currency;

  const typeLabel =
    data.type === 'invoice'
      ? 'DOCUMENTO'
      : data.type === 'quote'
      ? 'BOZZA'
      : data.type === 'custom'
      ? (data.customTitle ?? 'DOCUMENTO')
      : 'NOTA SPESE';

  const headerParagraphs = [
    new Paragraph({
      text: typeLabel,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [new TextRun({ text: `${company}`, bold: true })],
    }),
    new Paragraph({ text: '' }),
  ];

  if (data.number) {
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'N°: ', bold: true }),
          new TextRun({ text: data.number }),
        ],
      })
    );
  }
  if (data.issueDate) {
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Data: ', bold: true }),
          new TextRun({ text: data.issueDate }),
        ],
      })
    );
  }
  if (data.dueDate) {
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Scadenza: ', bold: true }),
          new TextRun({ text: data.dueDate }),
        ],
      })
    );
  }
  if (data.validUntil) {
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Valido fino al: ', bold: true }),
          new TextRun({ text: data.validUntil }),
        ],
      })
    );
  }

  // Client section
  const clientParagraphs: Paragraph[] = [];
  if (data.client) {
    clientParagraphs.push(
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: 'CLIENTE', bold: true })] }),
      new Paragraph({ text: data.client.name })
    );
    if (data.client.email) clientParagraphs.push(new Paragraph({ text: data.client.email }));
    if (data.client.address) clientParagraphs.push(new Paragraph({ text: data.client.address }));
    if (data.client.taxId) {
      clientParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'P.IVA: ' }),
            new TextRun({ text: data.client.taxId }),
          ],
        })
      );
    }
  }

  // Line items table
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Descrizione', bold: true })] })],
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Q.tà', bold: true })] })],
          width: { size: 10, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Prezzo', bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Importo', bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
    ...data.lineItems.map(
      item =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.description })] }),
            new TableCell({
              children: [
                new Paragraph({ text: String(item.quantity), alignment: AlignmentType.RIGHT }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: `${currency}${item.rate.toFixed(2)}`,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: `${currency}${item.amount.toFixed(2)}`,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        })
    ),
  ];

  const itemsSection = [
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: 'VOCI', bold: true })] }),
    new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
  ];

  // Totals
  const totalsParagraphs = [
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Imponibile: ' }),
        new TextRun({ text: `${currency}${data.totals.subtotal.toFixed(2)}` }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
  ];

  if (data.totals.taxRate !== undefined && data.totals.taxAmount !== undefined) {
    totalsParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `IVA (${data.totals.taxRate}%): ` }),
          new TextRun({ text: `${currency}${data.totals.taxAmount.toFixed(2)}` }),
        ],
        alignment: AlignmentType.RIGHT,
      })
    );
  }

  totalsParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'TOTALE: ', bold: true }),
        new TextRun({ text: `${currency}${data.totals.grandTotal.toFixed(2)}`, bold: true }),
      ],
      alignment: AlignmentType.RIGHT,
    })
  );

  // Notes
  const notesParagraphs: Paragraph[] = [];
  if (data.notes) {
    notesParagraphs.push(
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: 'Note:', bold: true })] }),
      new Paragraph({ text: data.notes })
    );
  }

  // Footer
  const footerParagraphs = [
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [new TextRun({ text: `Generato da ${company}`, italics: true, color: '888888' })],
      alignment: AlignmentType.CENTER,
    }),
  ];

  return new Document({
    creator: 'Milo Office',
    title: data.title,
    description: `${typeLabel} generato da Milo Office`,
    sections: [
      {
        children: [
          ...headerParagraphs,
          ...clientParagraphs,
          ...itemsSection,
          ...totalsParagraphs,
          ...notesParagraphs,
          ...footerParagraphs,
        ],
      },
    ],
  });
}

// ─── RTF Generation ───────────────────────────────────────────────────────────

function buildRtfDocument(data: DocumentFormatData): string {
  const company = data.companyName ?? 'Milo Office';
  const currency = data.totals.currency === 'EUR' ? '€' : data.totals.currency;

  const typeLabel =
    data.type === 'invoice'
      ? 'DOCUMENTO'
      : data.type === 'quote'
      ? 'BOZZA'
      : data.type === 'custom'
      ? (data.customTitle ?? 'DOCUMENTO')
      : 'NOTA SPESE';

  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\par\n');

  const lines: string[] = [
    // RTF header — magic bytes {\rtf guaranteed here
    `{\\rtf1\\ansi\\deff0`,
    `{\\*\\generator Milo Office}`,
    `{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fswiss\\fcharset0 Arial;}}`,
    `{\\colortbl;\\red0\\green0\\blue0;\\red128\\green128\\blue128;}`,
    `\\widowctrl\\hyphauto`,
    `\\pard\\b\\fs32 ${esc(typeLabel)}\\b0\\par`,
    `\\pard\\b\\fs24 ${esc(company)}\\b0\\par`,
    `\\par`,
  ];

  if (data.number) lines.push(`\\pard {\\b N°: }${esc(data.number)}\\par`);
  if (data.issueDate) lines.push(`\\pard {\\b Data: }${esc(data.issueDate)}\\par`);
  if (data.dueDate) lines.push(`\\pard {\\b Scadenza: }${esc(data.dueDate)}\\par`);
  if (data.validUntil) lines.push(`\\pard {\\b Valido fino al: }${esc(data.validUntil)}\\par`);

  if (data.client) {
    lines.push(`\\par`, `\\pard\\b CLIENTE\\b0\\par`, `\\pard ${esc(data.client.name)}\\par`);
    if (data.client.email) lines.push(`\\pard ${esc(data.client.email)}\\par`);
    if (data.client.address) lines.push(`\\pard ${esc(data.client.address)}\\par`);
    if (data.client.taxId) lines.push(`\\pard {\\b P.IVA: }${esc(data.client.taxId)}\\par`);
  }

  lines.push(`\\par`, `\\pard\\b VOCI\\b0\\par`);
  lines.push(`\\pard {\\b Descrizione}\\tab {\\b Q.tà}\\tab {\\b Prezzo}\\tab {\\b Importo}\\par`);

  for (const item of data.lineItems) {
    lines.push(
      `\\pard ${esc(item.description)}\\tab ${item.quantity}\\tab ${currency}${item.rate.toFixed(2)}\\tab ${currency}${item.amount.toFixed(2)}\\par`
    );
  }

  lines.push(`\\par`);
  lines.push(`\\pard\\qr Imponibile: ${currency}${data.totals.subtotal.toFixed(2)}\\par`);
  if (data.totals.taxRate !== undefined && data.totals.taxAmount !== undefined) {
    lines.push(
      `\\pard\\qr IVA (${data.totals.taxRate}%): ${currency}${data.totals.taxAmount.toFixed(2)}\\par`
    );
  }
  lines.push(
    `\\pard\\qr {\\b TOTALE: ${currency}${data.totals.grandTotal.toFixed(2)}}\\par`
  );

  if (data.notes) {
    lines.push(`\\par`, `\\pard\\b Note:\\b0\\par`, `\\pard ${esc(data.notes)}\\par`);
  }

  lines.push(
    `\\par`,
    `\\pard\\qc\\cf2\\i Generato da ${esc(company)}\\cf1\\i0\\par`,
    `}` // RTF closing brace
  );

  return lines.join('\n');
}

// ─── Entry points pubblici ────────────────────────────────────────────────────

/**
 * Genera un file DOCX reale e restituisce il path assoluto.
 * Il file contiene metadati creator/company = 'Milo Office'.
 * Magic bytes: 50 4B 03 04 (PK ZIP / OOXML).
 */
export async function generateDocumentDOC(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const doc = buildDocxDocument({ ...data, companyName: data.companyName ?? 'Milo Office' });

  let buffer: ArrayBuffer;
  try {
    const blob = await Packer.toBlob(doc);
    buffer = await blob.arrayBuffer();
  } catch (err) {
    throw new Error(`DOCX generation failed: ${String(err)}`);
  }

  const base64 = _arrayBufferToBase64(buffer);
  const safeTitle = (data.title ?? 'documento').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_${Date.now()}.docx`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filepath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filepath;
}

/**
 * Genera un file RTF reale e restituisce il path assoluto.
 * Il file inizia con {\rtf — magic bytes: 7B 5C 72 74 66.
 * Include header {\*\generator Milo Office}.
 */
export async function generateDocumentRTF(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const rtfContent = buildRtfDocument({
    ...data,
    companyName: data.companyName ?? 'Milo Office',
  });

  const safeTitle = (data.title ?? 'documento').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_${Date.now()}.rtf`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filepath, rtfContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filepath;
}

/**
 * Condivide un documento generato tramite il sistema di condivisione nativo.
 * Se la condivisione fallisce, il file rimane accessibile nel documentDirectory.
 */
export async function shareDocument(filepath: string, filename: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    console.warn(`shareDocument: sharing not available. File accessible at: ${filepath}`);
    return;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const meta =
    Object.values(FORMAT_META).find((m) => m.ext === ext) ?? FORMAT_META.pdf;

  await Sharing.shareAsync(filepath, {
    mimeType: meta.mimeType,
    dialogTitle: 'Condividi documento',
    UTI: meta.uti,
  });
}

/**
 * Genera un file PDF reale via expo-print e restituisce il path assoluto.
 * Magic bytes: 25 50 44 46 (%PDF).
 */
export async function generateDocumentPdfFile(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const html = buildDocumentHtml(
    { ...data, companyName: data.companyName ?? 'Milo Office' },
    options
  );

  let sourceUri: string;
  try {
    const printed = await Print.printToFileAsync({ html });
    sourceUri = printed.uri;
  } catch (err) {
    throw new Error(`PDF generation failed: ${String(err)}`);
  }

  const filename = `${_safeName(data.title)}_${Date.now()}.pdf`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: sourceUri, to: filepath });

  return filepath;
}

/**
 * Genera un file XLSX reale via SheetJS e restituisce il path assoluto.
 *
 * Un foglio di calcolo non e' un layout: gli importi restano `number` e la
 * valuta la applica il formato cella (`z`), altrimenti l'utente non puo'
 * sommarli. Per lo stesso motivo qui NON si usa il formatter money().
 *
 * SheetJS Community scrive i formati numerici e le larghezze di colonna, ma
 * non gli stili di cella (grassetto, fill, bordi): quelli sono riservati alla
 * versione Pro. La gerarchia visiva si ottiene quindi con struttura e
 * spaziatura, non con il colore.
 *
 * Magic bytes: 50 4B 03 04 (PK ZIP / OOXML).
 */
export async function generateDocumentXLSX(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const company = data.companyName ?? 'Milo Office';
  const currency = data.totals.currency || 'EUR';
  const currencyFmt = excelCurrencyFormat(currency);

  type Cell = string | number | null;
  const rows: Cell[][] = [];

  // ── Blocco meta ───────────────────────────────────────────────────────────
  rows.push([company]);
  rows.push([data.customTitle ?? data.title ?? 'Documento']);
  rows.push([]);
  if (data.number) rows.push(['Numero', data.number]);
  if (data.issueDate) rows.push(['Data', data.issueDate]);
  if (data.dueDate) rows.push(['Scadenza', data.dueDate]);
  if (data.validUntil) rows.push(['Valido fino al', data.validUntil]);
  if (data.client?.name) rows.push(['Destinatario', data.client.name]);
  if (data.client?.address) rows.push(['Indirizzo', data.client.address]);
  if (data.client?.email) rows.push(['Email', data.client.email]);
  rows.push([]);

  // ── Intestazione tabella ──────────────────────────────────────────────────
  rows.push(['Descrizione', 'Quantità', `Prezzo unit.`, `Totale`]);

  // ── Righe ─────────────────────────────────────────────────────────────────
  const firstDataRow = rows.length;
  for (const item of data.lineItems) {
    rows.push([_sanitizeCell(item.description), item.quantity, item.rate, item.amount]);
  }
  const lastDataRow = rows.length - 1;

  // ── Totali ────────────────────────────────────────────────────────────────
  rows.push([]);
  const totalRows: number[] = [];
  if (data.totals.subtotal !== data.totals.grandTotal) {
    totalRows.push(rows.length);
    rows.push([null, null, 'Subtotale', data.totals.subtotal]);
  }
  if (data.totals.taxAmount && data.totals.taxAmount > 0) {
    totalRows.push(rows.length);
    rows.push([
      null,
      null,
      `Imposta${data.totals.taxRate ? ` ${data.totals.taxRate}%` : ''}`,
      data.totals.taxAmount,
    ]);
  }
  totalRows.push(rows.length);
  rows.push([null, null, 'TOTALE', data.totals.grandTotal]);

  if (data.notes) {
    rows.push([]);
    rows.push(['Note', _sanitizeCell(data.notes)]);
  }
  if (options.translatedLabel) {
    rows.push([]);
    rows.push([options.translatedLabel]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // ── Formati numerici: la valuta e' un formato, non testo ──────────────────
  const setFormat = (row: number, col: number, z: string) => {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = worksheet[ref];
    if (cell && typeof cell.v === 'number') cell.z = z;
  };
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    setFormat(r, 1, EXCEL_QTY_FORMAT);
    setFormat(r, 2, currencyFmt);
    setFormat(r, 3, currencyFmt);
  }
  for (const r of totalRows) setFormat(r, 3, currencyFmt);

  worksheet['!cols'] = [{ wch: 48 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },   // ragione sociale
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },   // titolo documento
  ];
  // Nota: il freeze pane NON e' scrivibile con SheetJS Community — impostare
  // worksheet['!freeze'] non produce alcun <pane> nel foglio (verificato
  // ispezionando xl/worksheets/sheet1.xml). Niente codice che finge di
  // funzionare: se servira', va con una libreria diversa.
  // Margini di stampa in pollici: anche stampando da Excel il risultato regge.
  worksheet['!margins'] = {
    left: 0.6, right: 0.6, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3,
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Documento');

  const binary: string = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

  const filename = `${_safeName(data.title)}_${Date.now()}.xlsx`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(filepath, binary, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filepath;
}
/**
 * Entry-point unificato: genera il documento nel formato richiesto.
 * È la funzione che le schermate devono chiamare — evita che un pulsante
 * "Genera Excel" produca in realtà un altro formato.
 */
export async function generateDocument(
  data: DocumentFormatData,
  format: OutputFormat,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<{ filepath: string; filename: string; format: OutputFormat }> {
  let filepath: string;
  switch (format) {
    case 'pdf':
      filepath = await generateDocumentPdfFile(data, options);
      break;
    case 'xlsx':
      filepath = await generateDocumentXLSX(data, options);
      break;
    case 'doc':
      filepath = await generateDocumentDOC(data, options);
      break;
    case 'rtf':
      filepath = await generateDocumentRTF(data, options);
      break;
    default: {
      const exhaustive: never = format;
      throw new Error(`Formato non supportato: ${String(exhaustive)}`);
    }
  }
  const filename = filepath.split('/').pop() ?? `documento.${FORMAT_META[format].ext}`;
  return { filepath, filename, format };
}

/**
 * Genera il documento nel formato richiesto e apre subito il foglio di
 * condivisione nativo. Ritorna il filename prodotto.
 */
export async function generateAndShareDocument(
  data: DocumentFormatData,
  format: OutputFormat,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const { filepath, filename } = await generateDocument(data, format, options);
  await shareDocument(filepath, filename);
  return filename;
}

// ─── HTML condiviso (sorgente del PDF) ───────────────────────────────────────

function buildDocumentHtml(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'>
): string {
  const currency = data.totals.currency || 'EUR';
  const company = data.companyName ?? 'Milo Office';
  const title = data.customTitle ?? data.title ?? 'Documento';
  const fmt = (n: number) => money(n, currency);

  const metaPairs: [string, string][] = [];
  if (data.number) metaPairs.push(['Numero', data.number]);
  if (data.issueDate) metaPairs.push(['Data', data.issueDate]);
  if (data.dueDate) metaPairs.push(['Scadenza', data.dueDate]);
  if (data.validUntil) metaPairs.push(['Valido fino al', data.validUntil]);

  const recipientLines = [
    data.client?.name,
    data.client?.address,
    data.client?.email,
    data.client?.taxId,
  ].filter(Boolean) as string[];

  const logoHtml = options.logoUrl
    ? `<img class="logo" src="${_escHtml(options.logoUrl)}" alt="" />`
    : '';

  const rowsHtml = data.lineItems
    .map(
      (item) => `<tr>
      <td class="desc">${_escHtml(item.description)}</td>
      <td class="num">${qty(item.quantity)}</td>
      <td class="num">${fmt(item.rate)}</td>
      <td class="num strong">${fmt(item.amount)}</td>
    </tr>`
    )
    .join('');

  // La riga imposta sopravvive solo per i documenti vecchi che la contengono.
  // Milo Office non chiede piu' aliquote: sui documenti nuovi taxAmount e' 0
  // e questa riga non compare.
  const taxRow =
    data.totals.taxAmount && data.totals.taxAmount > 0
      ? `<tr><td>Imposta${
          data.totals.taxRate ? ` ${data.totals.taxRate}%` : ''
        }</td><td class="num">${fmt(data.totals.taxAmount)}</td></tr>`
      : '';

  const showSubtotal = taxRow !== '' || data.totals.subtotal !== data.totals.grandTotal;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>${_escHtml(title)}</title>
<style>
  /* Pagina reale, non finestra del browser: A4 con margini di stampa da 15mm.
     expo-print passa l'HTML a WebView -> PDF, quindi @page e' l'unico posto in
     cui si dichiara la geometria della carta. */
  @page { size: A4 portrait; margin: 15mm 14mm 16mm 14mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    color: #222;
    /* Cifre tabulari: le colonne numeriche restano incolonnate anche con
       glifi di larghezza diversa. */
    font-variant-numeric: tabular-nums;
    -webkit-font-feature-settings: "tnum";
  }

  .sheet { width: 100%; }

  /* ── Intestazione: emittente a sinistra, dati documento a destra ── */
  .head { display: table; width: 100%; margin-bottom: 22pt; }
  .head-left, .head-right { display: table-cell; vertical-align: top; }
  .head-left { width: 58%; }
  .head-right { width: 42%; text-align: right; }
  .logo { max-height: 48pt; max-width: 120pt; display: block; margin-bottom: 8pt; }
  .issuer { font-size: 11pt; font-weight: 700; color: #111; }

  .doc-title {
    font-size: 22pt; font-weight: 700; color: #111;
    letter-spacing: -0.5pt; line-height: 1.1; margin: 0 0 8pt;
  }
  .meta { display: inline-block; text-align: right; }
  .meta div { margin-bottom: 4pt; }
  .label {
    font-size: 8pt; text-transform: uppercase; letter-spacing: 1pt;
    color: #666; display: block;
  }
  .value { font-size: 10pt; color: #222; }

  /* ── Destinatario: blocco a se', mai in linea con l'emittente ── */
  .recipient { margin: 0 0 20pt; }
  .recipient .name { font-weight: 700; color: #111; }

  /* ── Tabella righe ── */
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 14pt; }
  table.items thead { display: table-header-group; }   /* header ripetuto a ogni pagina */
  table.items tr { page-break-inside: avoid; }          /* nessuna riga spezzata */
  table.items th {
    font-size: 9pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: .4pt; background: #f4f4f5; color: #333;
    padding: 6pt 8pt; text-align: left; border-bottom: 1pt solid #111;
  }
  table.items td { padding: 6pt 8pt; border-bottom: .5pt solid #e5e5e5; vertical-align: top; }
  table.items td.desc { width: 55%; }
  .num { text-align: right; white-space: nowrap; }
  .strong { font-weight: 700; color: #111; }

  /* ── Totali: colonna destra, allineata al bordo della tabella ── */
  .totals-wrap { width: 100%; page-break-inside: avoid; }
  table.totals { width: 42%; margin-left: auto; border-collapse: collapse; }
  table.totals td { padding: 4pt 8pt; }
  table.totals td:last-child { text-align: right; white-space: nowrap; }
  table.totals tr.grand td {
    background: #111; color: #fff; font-size: 12pt; font-weight: 700;
    padding: 8pt; border-top: 1pt solid #111;
  }

  .notes { margin-top: 22pt; padding-top: 10pt; border-top: .5pt solid #e5e5e5;
           white-space: pre-wrap; color: #444; page-break-inside: avoid; }
  .notes .label { margin-bottom: 4pt; }

  .foot { margin-top: 24pt; padding-top: 8pt; border-top: .5pt solid #e5e5e5;
          font-size: 8pt; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="sheet">

  <div class="head">
    <div class="head-left">
      ${logoHtml}
      <div class="issuer">${_escHtml(company)}</div>
    </div>
    <div class="head-right">
      <h1 class="doc-title">${_escHtml(title)}</h1>
      <div class="meta">
        ${metaPairs
          .map(
            ([k, v]) =>
              `<div><span class="label">${_escHtml(k)}</span><span class="value">${_escHtml(
                v
              )}</span></div>`
          )
          .join('')}
      </div>
    </div>
  </div>

  ${
    recipientLines.length
      ? `<div class="recipient">
    <span class="label">Destinatario</span>
    <div class="name">${_escHtml(recipientLines[0])}</div>
    ${recipientLines
      .slice(1)
      .map((line) => `<div>${_escHtml(line)}</div>`)
      .join('')}
  </div>`
      : ''
  }

  <table class="items">
    <thead>
      <tr>
        <th class="desc">Descrizione</th>
        <th class="num">Q.tà</th>
        <th class="num">Prezzo unit.</th>
        <th class="num">Totale</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals">
      ${showSubtotal ? `<tr><td>Subtotale</td><td>${fmt(data.totals.subtotal)}</td></tr>` : ''}
      ${taxRow}
      <tr class="grand"><td>TOTALE</td><td>${fmt(data.totals.grandTotal)}</td></tr>
    </table>
  </div>

  ${
    data.notes
      ? `<div class="notes"><span class="label">Note</span>${_escHtml(data.notes)}</div>`
      : ''
  }

  <div class="foot">${_escHtml(company)}${
    options.translatedLabel ? ` · ${_escHtml(options.translatedLabel)}` : ''
  }</div>

</div>
</body>
</html>`;
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function _escHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _safeName(value?: string): string {
  return (value ?? 'documento').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'documento';
}

/**
 * Previene la formula injection nei fogli di calcolo: un valore che inizia con
 * = + - @ verrebbe interpretato come formula da Excel/LibreOffice/Sheets.
 */
function _sanitizeCell(value: string): string {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
