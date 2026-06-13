import { Invoice, Client } from '@/shared/types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
      companyName = 'Invoice Studio',
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
        <p>Generated by Invoice Studio</p>
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
