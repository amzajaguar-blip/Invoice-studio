import { Invoice, Client, LineItem, ClientSnapshot } from '@/shared/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Escapa caratteri HTML nei dati utente prima di inserirli nei template.
 * Previene HTML injection che rompe la struttura del documento.
 * Applicare a TUTTI i campi provenienti da input utente, OCR, o Supabase.
 */
function escHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PDFGenerationOptions {
  includeQRCode?: boolean;
  logoUrl?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
}

/**
 * Generate a professional invoice PDF
 * Note: This is a placeholder for PDF generation
 * In production, use react-native-pdf or similar library
 */
export async function generateInvoicePDF(
  invoice: Invoice,
  client: Client | undefined,
  options: PDFGenerationOptions = {}
): Promise<string | null> {
  try {
    const {
      includeQRCode = true,
      companyName = 'Milo Office',
      companyEmail = 'info@invoicestudio.app',
      companyPhone = '+1 (555) 000-0000',
      companyAddress = '123 Business St, City, State 12345',
    } = options;

    // Generate HTML content for PDF
    const htmlContent = generateInvoiceHTML(invoice, client, {
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      includeQRCode,
    });

    // Save HTML as temporary file
    const filename = `invoice_${invoice.invoiceNumber}_${Date.now()}.html`;
    const filepath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filepath, htmlContent);

    return filepath;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return null;
  }
}

/**
 * Generate HTML content for invoice
 */
function generateInvoiceHTML(
  invoice: Invoice,
  client: Client | undefined,
  options: {
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: string;
    includeQRCode: boolean;
  }
): string {
  const invoiceLink = `https://invoicestudio.app/invoice/${invoice.id}`;
  const lineItemsHTML = invoice.lineItems
    .map(
      item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.rate.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.amount.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #11181c; background: #f5f5f5; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #0066cc; padding-bottom: 20px; }
    .company-info h1 { font-size: 28px; color: #0066cc; margin-bottom: 8px; }
    .company-details { font-size: 14px; color: #687076; line-height: 1.6; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 24px; color: #0066cc; margin-bottom: 12px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .meta-label { font-weight: 600; color: #11181c; min-width: 100px; }
    .meta-value { color: #687076; }
    .client-section { margin-bottom: 40px; }
    .section-title { font-size: 12px; font-weight: 700; color: #687076; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .client-info { font-size: 14px; line-height: 1.8; }
    .client-info strong { color: #11181c; }
    .items-table { width: 100%; margin-bottom: 40px; border-collapse: collapse; }
    .items-table th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #687076; border-bottom: 2px solid #e5e7eb; }
    .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .items-table tr:last-child td { border-bottom: 2px solid #0066cc; }
    .amount-right { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .totals-table { width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #e5e7eb; }
    .total-row.final { border-bottom: none; border-top: 2px solid #0066cc; padding-top: 12px; font-size: 18px; font-weight: 700; color: #0066cc; }
    .total-label { color: #687076; }
    .total-value { text-align: right; color: #11181c; }
    .notes-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 40px; }
    .notes-section h3 { font-size: 13px; font-weight: 600; color: #687076; margin-bottom: 8px; text-transform: uppercase; }
    .notes-section p { font-size: 13px; color: #11181c; line-height: 1.6; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #687076; }
    .qr-code { text-align: center; }
    .qr-code img { max-width: 120px; height: 120px; }
    .payment-terms { background: #e6f4fe; padding: 12px; border-radius: 6px; border-left: 4px solid #0066cc; }
    .payment-terms strong { color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <h1>${options.companyName}</h1>
        <div class="company-details">
          <div>${options.companyAddress}</div>
          <div>${options.companyEmail}</div>
          <div>${options.companyPhone}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <div class="meta-row">
          <span class="meta-label">Invoice #:</span>
          <span class="meta-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date:</span>
          <span class="meta-value">${new Date(invoice.issueDate).toLocaleDateString()}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Due Date:</span>
          <span class="meta-value">${new Date(invoice.dueDate).toLocaleDateString()}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status:</span>
          <span class="meta-value" style="text-transform: capitalize; font-weight: 600;">${invoice.status}</span>
        </div>
      </div>
    </div>

    <!-- Client Info -->
    <div class="client-section">
      <div class="section-title">Bill To</div>
      <div class="client-info">
        <strong>${client?.name || 'Client Name'}</strong><br>
        ${client?.email ? `${client.email}<br>` : ''}
        ${client?.phone ? `${client.phone}<br>` : ''}
        ${client?.address ? `${client.address}` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-table">
        <div class="total-row">
          <span class="total-label">Subtotal:</span>
          <span class="total-value">€${invoice.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">IVA (${invoice.taxRate}%):</span>
          <span class="total-value">€${invoice.taxAmount.toFixed(2)}</span>
        </div>
        ${invoice.discountAmount > 0 ? `
        <div class="total-row">
          <span class="total-label">Sconto:</span>
          <span class="total-value">-€${invoice.discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final">
          <span class="total-label">TOTALE:</span>
          <span class="total-value">€${invoice.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    ${invoice.notes ? `
    <div class="notes-section">
      <h3>Notes</h3>
      <p>${invoice.notes}</p>
    </div>
    ` : ''}

    <!-- Payment Terms -->
    <div class="payment-terms">
      <strong>Payment Terms:</strong> ${invoice.paymentTerms || 'Net 30'}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>
        <p><strong>Thank you for your business!</strong></p>
        <p>Generated by Milo Office</p>
      </div>
      ${options.includeQRCode ? `
      <div class="qr-code">
        <p style="font-size: 11px; margin-bottom: 8px;">Scan to view invoice</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(invoiceLink)}" alt="QR Code">
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Share invoice PDF
 */
export async function shareInvoicePDF(filepath: string, invoiceNumber: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      console.warn('Sharing is not available on this device');
      return false;
    }

    await Sharing.shareAsync(filepath, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Invoice #${invoiceNumber}`,
    });

    return true;
  } catch (error) {
    console.error('Failed to share PDF:', error);
    return false;
  }
}

/**
 * Export invoice as HTML file
 */
export async function exportInvoiceHTML(
  invoice: Invoice,
  client: Client | undefined,
  options?: PDFGenerationOptions
): Promise<string | null> {
  return generateInvoicePDF(invoice, client, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// VELA Pivot — Tipi per generateDocumentPDF (aggiunti in append)
// generateInvoicePDF e shareInvoicePDF NON vengono modificati
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentType = 'invoice' | 'quote' | 'expense_report' | 'custom';

export interface PDFGenerationOptionsExtended extends PDFGenerationOptions {
  documentType?: DocumentType; // default: 'invoice' se omesso
  templateId?: string;
}

export interface QuoteData {
  id: string;
  quoteNumber: string;
  clientSnapshot: ClientSnapshot;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'invoiced';
  issueDate: Date;
  validUntil: Date;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  templateId?: string;
}

export interface ExpenseItemPDF {
  id: string;
  date: Date;
  category: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface ExpenseReportData {
  id: string;
  reportNumber: string;
  title: string;
  period: { from: Date; to: Date };
  items: ExpenseItemPDF[];
  totalByCategory: Record<string, number>;
  grandTotal: number;
  currency: string;
}

export type DocumentData = Invoice | QuoteData | ExpenseReportData;

// ─────────────────────────────────────────────────────────────────────────────
// VELA Pivot — generateDocumentPDF (task 3.2)
// Nuovo entry-point unificato. NON chiama generateInvoicePDF internamente.
// generateInvoicePDF e shareInvoicePDF restano invariati sopra.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard: verifica che data sia un Invoice valido (ha invoiceNumber)
 */
function isInvoice(data: DocumentData): data is Invoice {
  return (
    typeof (data as Invoice).invoiceNumber === 'string' &&
    (data as Invoice).invoiceNumber.length > 0 &&
    typeof (data as Invoice).total === 'number' &&
    Array.isArray((data as Invoice).lineItems)
  );
}

/**
 * Type guard: verifica che data sia un QuoteData valido (ha quoteNumber e validUntil)
 */
function isQuoteData(data: DocumentData): data is QuoteData {
  return (
    typeof (data as QuoteData).quoteNumber === 'string' &&
    (data as QuoteData).quoteNumber.length > 0 &&
    (data as QuoteData).validUntil instanceof Date &&
    Array.isArray((data as QuoteData).lineItems)
  );
}

/**
 * Type guard: verifica che data sia un ExpenseReportData valido (ha reportNumber e items)
 */
function isExpenseReportData(data: DocumentData): data is ExpenseReportData {
  return (
    typeof (data as ExpenseReportData).reportNumber === 'string' &&
    (data as ExpenseReportData).reportNumber.length > 0 &&
    Array.isArray((data as ExpenseReportData).items) &&
    typeof (data as ExpenseReportData).grandTotal === 'number'
  );
}

/**
 * Genera l'HTML comune per l'header dei documenti (header azienda + meta documento)
 */
function buildDocumentHeader(params: {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  docTypeLabel: string;
  docNumber: string;
  dateLabel1: string;
  dateValue1: string;
  dateLabel2: string;
  dateValue2: string;
  statusLabel?: string;
  logoUrl?: string;
}): string {
  const logoHtml = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; margin-bottom: 8px; display: block;" />`
    : '';

  return `
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <h1>${escHtml(params.companyName)}</h1>
        <div class="company-details">
          <div>${escHtml(params.companyAddress)}</div>
          <div>${escHtml(params.companyEmail)}</div>
          <div>${escHtml(params.companyPhone)}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>${escHtml(params.docTypeLabel)}</h2>
        <div class="meta-row">
          <span class="meta-label">N°:</span>
          <span class="meta-value">${escHtml(params.docNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${escHtml(params.dateLabel1)}:</span>
          <span class="meta-value">${escHtml(params.dateValue1)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${escHtml(params.dateLabel2)}:</span>
          <span class="meta-value">${escHtml(params.dateValue2)}</span>
        </div>
        ${params.statusLabel
          ? `<div class="meta-row">
              <span class="meta-label">Stato:</span>
              <span class="meta-value" style="text-transform: capitalize; font-weight: 600;">${escHtml(params.statusLabel)}</span>
            </div>`
          : ''}
      </div>
    </div>`;
}

/**
 * CSS comune condiviso da tutti i tipi di documento
 */
const DOCUMENT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #11181c; background: #f5f5f5; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #0066cc; padding-bottom: 20px; }
  .company-info h1 { font-size: 28px; color: #0066cc; margin-bottom: 8px; }
  .company-details { font-size: 14px; color: #687076; line-height: 1.6; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 24px; color: #0066cc; margin-bottom: 12px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
  .meta-label { font-weight: 600; color: #11181c; min-width: 120px; }
  .meta-value { color: #687076; }
  .client-section { margin-bottom: 40px; }
  .section-title { font-size: 12px; font-weight: 700; color: #687076; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .client-info { font-size: 14px; line-height: 1.8; }
  .client-info strong { color: #11181c; }
  .items-table { width: 100%; margin-bottom: 40px; border-collapse: collapse; }
  .items-table th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #687076; border-bottom: 2px solid #e5e7eb; }
  .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  .items-table tr:last-child td { border-bottom: 2px solid #0066cc; }
  .subtotal-row td { background: #f9fafb; font-weight: 600; color: #687076; }
  .grand-total-row td { background: #e6f4fe; font-weight: 700; color: #0066cc; border-top: 2px solid #0066cc; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .totals-table { width: 300px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #e5e7eb; }
  .total-row.final { border-bottom: none; border-top: 2px solid #0066cc; padding-top: 12px; font-size: 18px; font-weight: 700; color: #0066cc; }
  .total-label { color: #687076; }
  .total-value { text-align: right; color: #11181c; }
  .notes-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 40px; }
  .notes-section h3 { font-size: 13px; font-weight: 600; color: #687076; margin-bottom: 8px; text-transform: uppercase; }
  .notes-section p { font-size: 13px; color: #11181c; line-height: 1.6; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #687076; }
  .period-badge { background: #e6f4fe; padding: 12px; border-radius: 6px; border-left: 4px solid #0066cc; margin-bottom: 24px; font-size: 14px; color: #0066cc; font-weight: 600; }
`;

/**
 * Genera HTML per documentType='invoice' — replica strutturale di generateInvoiceHTML,
 * implementazione indipendente (non chiama generateInvoicePDF).
 */
function generateInvoiceDocumentHTML(
  invoice: Invoice,
  options: PDFGenerationOptionsExtended & { documentType: DocumentType }
): string {
  const companyName = options.companyName ?? 'Milo Office';
  const companyEmail = options.companyEmail ?? 'info@invoicestudio.app';
  const companyPhone = options.companyPhone ?? '+1 (555) 000-0000';
  const companyAddress = options.companyAddress ?? '123 Business St, City, State 12345';

  const clientName = invoice.clientSnapshot
    ? invoice.clientSnapshot.name
    : (invoice.client?.name ?? 'Cliente');

  const clientDetail = invoice.clientSnapshot ?? invoice.client;

  const lineItemsHTML = invoice.lineItems
    .map(
      (item: LineItem) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.rate.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.amount.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const logoHtml = options.logoUrl
    ? `<img src="${options.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; margin-bottom: 8px; display: block;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documento #${escHtml(invoice.invoiceNumber)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="company-details">
          <div>${companyAddress}</div>
          <div>${companyEmail}</div>
          <div>${companyPhone}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>DOCUMENTO</h2>
        <div class="meta-row">
          <span class="meta-label">Documento N°:</span>
          <span class="meta-value">${escHtml(invoice.invoiceNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Data:</span>
          <span class="meta-value">${new Date(invoice.issueDate).toLocaleDateString('it-IT')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Scadenza:</span>
          <span class="meta-value">${new Date(invoice.dueDate).toLocaleDateString('it-IT')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Stato:</span>
          <span class="meta-value" style="text-transform: capitalize; font-weight: 600;">${escHtml(invoice.status)}</span>
        </div>
      </div>
    </div>

    <div class="client-section">
      <div class="section-title">Intestato a</div>
      <div class="client-info">
        <strong>${escHtml(clientName)}</strong><br>
        ${clientDetail?.email ? `${escHtml(clientDetail.email)}<br>` : ''}
        ${clientDetail?.phone ? `${escHtml(clientDetail.phone)}<br>` : ''}
        ${clientDetail?.address ? `${escHtml(clientDetail.address)}` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Descrizione</th>
          <th style="text-align: right;">Q.tà</th>
          <th style="text-align: right;">Prezzo unit.</th>
          <th style="text-align: right;">Importo</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-table">
        <div class="total-row">
          <span class="total-label">Imponibile:</span>
          <span class="total-value">€${invoice.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">IVA (${invoice.taxRate}%):</span>
          <span class="total-value">€${invoice.taxAmount.toFixed(2)}</span>
        </div>
        ${invoice.discountAmount > 0
          ? `<div class="total-row">
              <span class="total-label">Sconto:</span>
              <span class="total-value">-€${invoice.discountAmount.toFixed(2)}</span>
            </div>`
          : ''}
        <div class="total-row final">
          <span class="total-label">TOTALE:</span>
          <span class="total-value">€${invoice.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${invoice.notes
      ? `<div class="notes-section">
          <h3>Note</h3>
          <p>${escHtml(invoice.notes)}</p>
        </div>`
      : ''}

    <div class="footer">
      <div>
        <p><strong>Grazie per la fiducia!</strong></p>
        <p>Generato da Milo Office</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera HTML per documentType='quote'
 */
function generateQuoteDocumentHTML(
  quote: QuoteData,
  options: PDFGenerationOptionsExtended & { documentType: DocumentType }
): string {
  const companyName = options.companyName ?? 'Milo Office';
  const companyEmail = options.companyEmail ?? 'info@invoicestudio.app';
  const companyPhone = options.companyPhone ?? '+1 (555) 000-0000';
  const companyAddress = options.companyAddress ?? '123 Business St, City, State 12345';

  const clientSnapshot = quote.clientSnapshot;

  const lineItemsHTML = quote.lineItems
    .map(
      (item: LineItem) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.rate.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.amount.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const logoHtml = options.logoUrl
    ? `<img src="${options.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; margin-bottom: 8px; display: block;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bozza #${escHtml(quote.quoteNumber)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="company-details">
          <div>${companyAddress}</div>
          <div>${companyEmail}</div>
          <div>${companyPhone}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>BOZZA</h2>
        <div class="meta-row">
          <span class="meta-label">Bozza N°:</span>
          <span class="meta-value">${escHtml(quote.quoteNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Data emissione:</span>
          <span class="meta-value">${new Date(quote.issueDate).toLocaleDateString('it-IT')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Valido fino al:</span>
          <span class="meta-value">${new Date(quote.validUntil).toLocaleDateString('it-IT')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Stato:</span>
          <span class="meta-value" style="text-transform: capitalize; font-weight: 600;">${escHtml(quote.status)}</span>
        </div>
      </div>
    </div>

    <div class="client-section">
      <div class="section-title">Intestato a</div>
      <div class="client-info">
        <strong>${escHtml(clientSnapshot.name)}</strong><br>
        ${clientSnapshot.email ? `${escHtml(clientSnapshot.email)}<br>` : ''}
        ${clientSnapshot.phone ? `${escHtml(clientSnapshot.phone)}<br>` : ''}
        ${clientSnapshot.address ? `${escHtml(clientSnapshot.address)}` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Descrizione</th>
          <th style="text-align: right;">Q.tà</th>
          <th style="text-align: right;">Prezzo unit.</th>
          <th style="text-align: right;">Importo</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-table">
        <div class="total-row">
          <span class="total-label">Imponibile:</span>
          <span class="total-value">€${quote.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">IVA (${quote.taxRate}%):</span>
          <span class="total-value">€${quote.taxAmount.toFixed(2)}</span>
        </div>
        ${quote.discountAmount > 0
          ? `<div class="total-row">
              <span class="total-label">Sconto:</span>
              <span class="total-value">-€${quote.discountAmount.toFixed(2)}</span>
            </div>`
          : ''}
        <div class="total-row final">
          <span class="total-label">TOTALE:</span>
          <span class="total-value">€${quote.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${quote.notes
      ? `<div class="notes-section">
          <h3>Note</h3>
          <p>${escHtml(quote.notes)}</p>
        </div>`
      : ''}

    <div class="footer">
      <div>
        <p><strong>Grazie per la fiducia!</strong></p>
        <p>Generato da Milo Office</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera HTML per documentType='expense_report'
 */
function generateExpenseReportDocumentHTML(
  report: ExpenseReportData,
  options: PDFGenerationOptionsExtended & { documentType: DocumentType }
): string {
  const companyName = options.companyName ?? 'Milo Office';
  const companyEmail = options.companyEmail ?? 'info@invoicestudio.app';
  const companyPhone = options.companyPhone ?? '+1 (555) 000-0000';
  const companyAddress = options.companyAddress ?? '123 Business St, City, State 12345';

  const currency = report.currency ?? 'EUR';
  const currencySymbol = currency === 'EUR' ? '€' : currency;

  // Calcola subtotali per categoria (dalla somma effettiva degli items)
  const categoryTotals: Record<string, number> = {};
  for (const item of report.items) {
    categoryTotals[item.category] = (categoryTotals[item.category] ?? 0) + item.amount;
  }

  // Righe dati
  const dataRowsHTML = report.items
    .map(
      (item: ExpenseItemPDF) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${new Date(item.date).toLocaleDateString('it-IT')}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escHtml(item.category)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${currencySymbol}${item.amount.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escHtml(item.description ?? '')}</td>
    </tr>`
    )
    .join('');

  // Righe subtotale per categoria
  const subtotalRowsHTML = Object.entries(categoryTotals)
    .map(
      ([cat, total]) => `
    <tr class="subtotal-row">
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;" colspan="2">Subtotale — ${escHtml(cat)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${currencySymbol}${total.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;"></td>
    </tr>`
    )
    .join('');

  // Calcola grandTotal dalla somma degli items (garantisce coerenza per Property 3)
  const computedGrandTotal = report.items.reduce((sum, item) => sum + item.amount, 0);

  const logoHtml = options.logoUrl
    ? `<img src="${options.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; margin-bottom: 8px; display: block;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota Spese — ${escHtml(report.title)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="company-details">
          <div>${companyAddress}</div>
          <div>${companyEmail}</div>
          <div>${companyPhone}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>NOTA SPESE</h2>
        <div class="meta-row">
          <span class="meta-label">N° Report:</span>
          <span class="meta-value">${escHtml(report.reportNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Titolo:</span>
          <span class="meta-value">${escHtml(report.title)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Periodo:</span>
          <span class="meta-value">${new Date(report.period.from).toLocaleDateString('it-IT')} – ${new Date(report.period.to).toLocaleDateString('it-IT')}</span>
        </div>
      </div>
    </div>

    <div class="period-badge">
      Periodo: ${new Date(report.period.from).toLocaleDateString('it-IT')} – ${new Date(report.period.to).toLocaleDateString('it-IT')}
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Categoria</th>
          <th style="text-align: right;">Importo</th>
          <th>Descrizione</th>
        </tr>
      </thead>
      <tbody>
        ${dataRowsHTML}
        ${subtotalRowsHTML}
        <tr class="grand-total-row">
          <td style="padding: 12px; font-weight: 700; font-size: 15px;" colspan="2">TOTALE COMPLESSIVO</td>
          <td style="padding: 12px; text-align: right; font-weight: 700; font-size: 15px;" data-grand-total="${computedGrandTotal.toFixed(2)}">${currencySymbol}${computedGrandTotal.toFixed(2)}</td>
          <td style="padding: 12px;"></td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>
        <p><strong>Generato da Milo Office</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera HTML per documentType='custom' — documento generico senza struttura fiscale.
 */
function generateCustomDocumentHTML(
  data: any,
  options: PDFGenerationOptionsExtended & { documentType: DocumentType }
): string {
  const companyName = options.companyName ?? data.companyName ?? 'Milo Office';
  const companyAddress = options.companyAddress ?? data.companyAddress ?? '';
  const companyEmail = options.companyEmail ?? data.companyEmail ?? '';
  const companyPhone = options.companyPhone ?? data.companyPhone ?? '';
  const customTitle = data.customTitle ?? data.title ?? 'Documento';
  const bodyText = data.bodyMarkdown ?? data.notes ?? '';
  const number = data.number ?? data.id?.slice(0, 8) ?? '';
  const issueDate = data.issueDate ? new Date(data.issueDate).toLocaleDateString('it-IT') : '';

  const logoHtml = options.logoUrl
    ? `<img src="${options.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; margin-bottom: 8px; display: block;" />`
    : '';

  // Simple Markdown-to-HTML conversion for body text
  const bodyHtml = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p style="margin: 8px 0;">')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escHtml(customTitle)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="company-details">
          <div>${companyAddress}</div>
          <div>${companyEmail}</div>
          <div>${companyPhone}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>${escHtml(customTitle)}</h2>
        ${number ? `<div class="meta-row"><span class="meta-label">N°:</span><span class="meta-value">${escHtml(number)}</span></div>` : ''}
        ${issueDate ? `<div class="meta-row"><span class="meta-label">Data:</span><span class="meta-value">${issueDate}</span></div>` : ''}
      </div>
    </div>
    <div class="content">
      <p style="margin: 8px 0;">${bodyHtml}</p>
    </div>
    <div class="footer">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 32px;">Generato da ${companyName}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Entry-point unificato per la generazione di PDF multi-documento.
 *
 * NON chiama generateInvoicePDF internamente (retrocompatibilità isolata).
 * Ritorna il filepath del file HTML salvato, oppure null in caso di errore.
 */
export async function generateDocumentPDF(
  data: DocumentData,
  options: PDFGenerationOptionsExtended & { documentType: DocumentType }
): Promise<string | null> {
  try {
    const { documentType } = options;
    let htmlContent: string;
    let filename: string;

    if (documentType === 'invoice') {
      if (!isInvoice(data)) {
        throw new Error('Unsupported documentType: invoice requires Invoice data');
      }
      htmlContent = generateInvoiceDocumentHTML(data, options);
      filename = `invoice_${data.invoiceNumber}_${Date.now()}.pdf`;
    } else if (documentType === 'quote') {
      if (!isQuoteData(data)) {
        throw new Error('Unsupported documentType: quote requires QuoteData');
      }
      htmlContent = generateQuoteDocumentHTML(data, options);
      filename = `quote_${data.quoteNumber}_${Date.now()}.pdf`;
    } else if (documentType === 'expense_report') {
      if (!isExpenseReportData(data)) {
        throw new Error('Unsupported documentType: expense_report requires ExpenseReportData');
      }
      htmlContent = generateExpenseReportDocumentHTML(data, options);
      filename = `expense_report_${data.reportNumber}_${Date.now()}.pdf`;
    } else if (documentType === 'custom') {
      htmlContent = generateCustomDocumentHTML(data as any, options);
      filename = `document_${Date.now()}.pdf`;
    } else {
      throw new Error(`Unsupported documentType: ${documentType}`);
    }

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    const filepath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.moveAsync({ from: uri, to: filepath });

    return filepath;
  } catch (error) {
    console.error('Failed to generate document PDF:', error);
    return null;
  }
}
