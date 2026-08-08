/**
 * document-format-engine.ts — Generazione documenti DOCX e RTF
 *
 * Produce file reali nei formati dichiarati (non PDF rinominati).
 * PDF è gestito da pdf-utils.ts. Questo modulo copre DOCX e RTF.
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

export type OutputFormat = 'pdf' | 'doc' | 'rtf';

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
  await Sharing.shareAsync(filepath, {
    mimeType: filename.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/rtf',
    dialogTitle: 'Condividi documento',
    UTI: filename.endsWith('.docx')
      ? 'org.openxmlformats.wordprocessingml.document'
      : 'public.rtf',
  });
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
