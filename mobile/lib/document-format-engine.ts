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
 * Il foglio "Documento" contiene intestazione, righe e totali.
 * Magic bytes: 50 4B 03 04 (PK ZIP / OOXML).
 */
export async function generateDocumentXLSX(
  data: DocumentFormatData,
  options: Omit<DocumentFormatOptions, 'format'> = {}
): Promise<string> {
  const company = data.companyName ?? 'Milo Office';
  const currency = data.totals.currency || 'EUR';

  const rows: (string | number)[][] = [
    [company],
    [data.customTitle ?? data.title ?? 'Documento'],
  ];

  if (data.number) rows.push(['Numero', data.number]);
  if (data.issueDate) rows.push(['Data', data.issueDate]);
  if (data.dueDate) rows.push(['Scadenza', data.dueDate]);
  if (data.validUntil) rows.push(['Valido fino al', data.validUntil]);
  if (data.client?.name) rows.push(['Cliente', data.client.name]);
  if (data.client?.email) rows.push(['Email', data.client.email]);
  if (data.client?.address) rows.push(['Indirizzo', data.client.address]);
  if (data.client?.taxId) rows.push(['P.IVA / CF', data.client.taxId]);

  rows.push([]);
  rows.push(['Descrizione', 'Quantità', `Prezzo (${currency})`, `Importo (${currency})`]);

  for (const item of data.lineItems) {
    rows.push([
      _sanitizeCell(item.description),
      item.quantity,
      item.rate,
      item.amount,
    ]);
  }

  rows.push([]);
  rows.push(['', '', 'Subtotale', data.totals.subtotal]);
  if (typeof data.totals.taxAmount === 'number') {
    rows.push([
      '',
      '',
      `IVA${typeof data.totals.taxRate === 'number' ? ` ${data.totals.taxRate}%` : ''}`,
      data.totals.taxAmount,
    ]);
  }
  rows.push(['', '', 'TOTALE', data.totals.grandTotal]);

  if (data.notes) {
    rows.push([]);
    rows.push(['Note', _sanitizeCell(data.notes)]);
  }
  if (options.translatedLabel) {
    rows.push([]);
    rows.push([options.translatedLabel]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 44 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];

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
  const company = data.companyName ?? 'Milo Office';
  const symbol = data.totals.currency === 'EUR' ? '€' : data.totals.currency;
  const money = (n: number) => `${symbol} ${n.toFixed(2)}`;
  const title = data.customTitle ?? data.title ?? 'Documento';

  const metaRows = [
    data.number ? ['Numero', data.number] : null,
    data.issueDate ? ['Data', data.issueDate] : null,
    data.dueDate ? ['Scadenza', data.dueDate] : null,
    data.validUntil ? ['Valido fino al', data.validUntil] : null,
  ].filter(Boolean) as string[][];

  const clientRows = [
    data.client?.name ? ['Cliente', data.client.name] : null,
    data.client?.email ? ['Email', data.client.email] : null,
    data.client?.address ? ['Indirizzo', data.client.address] : null,
    data.client?.taxId ? ['P.IVA / CF', data.client.taxId] : null,
  ].filter(Boolean) as string[][];

  const logoHtml = options.logoUrl
    ? `<img class="logo" src="${_escHtml(options.logoUrl)}" alt="Logo" />`
    : '';

  const itemsHtml = data.lineItems
    .map(
      (item) => `<tr>
        <td>${_escHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${money(item.rate)}</td>
        <td class="num">${money(item.amount)}</td>
      </tr>`
    )
    .join('');

  const taxHtml =
    typeof data.totals.taxAmount === 'number'
      ? `<tr><td>IVA${
          typeof data.totals.taxRate === 'number' ? ` ${data.totals.taxRate}%` : ''
        }</td><td class="num">${money(data.totals.taxAmount)}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>${_escHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
         color: #1a1a1a; margin: 0; padding: 40px; font-size: 13px; }
  .logo { max-height: 60px; max-width: 160px; margin-bottom: 10px; display: block; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: .5px; }
  .company { font-size: 15px; font-weight: 600; color: #6c63ff; margin-bottom: 24px; }
  .meta { width: 100%; margin-bottom: 24px; }
  .meta td { padding: 3px 0; }
  .meta td:first-child { color: #666; width: 140px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.items th { text-align: left; background: #f3f3f7; padding: 8px;
                   border-bottom: 2px solid #6c63ff; font-size: 12px; }
  table.items td { padding: 8px; border-bottom: 1px solid #e6e6ec; }
  .num { text-align: right; white-space: nowrap; }
  table.totals { margin-left: auto; min-width: 240px; border-collapse: collapse; }
  table.totals td { padding: 5px 0; }
  table.totals tr:last-child td { font-size: 16px; font-weight: 700;
                                  border-top: 2px solid #1a1a1a; padding-top: 8px; }
  .notes { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e6e6ec;
           white-space: pre-wrap; color: #444; }
  .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
</style>
</head>
<body>
  ${logoHtml}
  <div class="company">${_escHtml(company)}</div>
  <h1>${_escHtml(title)}</h1>
  <table class="meta">
    ${[...metaRows, ...clientRows]
      .map(([k, v]) => `<tr><td>${_escHtml(k)}</td><td>${_escHtml(v)}</td></tr>`)
      .join('')}
  </table>
  <table class="items">
    <thead>
      <tr><th>Descrizione</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">Importo</th></tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotale</td><td class="num">${money(data.totals.subtotal)}</td></tr>
    ${taxHtml}
    <tr><td>TOTALE</td><td class="num">${money(data.totals.grandTotal)}</td></tr>
  </table>
  ${data.notes ? `<div class="notes">${_escHtml(data.notes)}</div>` : ''}
  <div class="footer">${_escHtml(company)}${
    options.translatedLabel ? ` — ${_escHtml(options.translatedLabel)}` : ''
  }</div>
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
