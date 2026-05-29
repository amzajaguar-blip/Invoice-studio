import { Share, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Invoice, Client } from '@/shared/types';

export interface ShareResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Format invoice for email body
 */
export function formatInvoiceForEmail(invoice: Invoice, client?: Client): string {
  const lineItems = invoice.lineItems
    .map(item => `${item.description}: ${item.quantity} x $${item.rate.toFixed(2)} = $${item.amount.toFixed(2)}`)
    .join('\n');

  return `
Invoice #${invoice.invoiceNumber}
Date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

Client: ${client?.name || 'N/A'}
${client?.email ? `Email: ${client.email}` : ''}
${client?.phone ? `Phone: ${client.phone}` : ''}

Items:
${lineItems}

Subtotal: $${invoice.subtotal.toFixed(2)}
Tax (${invoice.taxRate}%): $${invoice.taxAmount.toFixed(2)}
Discount: -$${invoice.discountAmount.toFixed(2)}
---
Total: $${invoice.total.toFixed(2)}

${invoice.notes ? `Notes:\n${invoice.notes}` : ''}

Payment Terms: ${invoice.paymentTerms || 'Net 30'}
  `.trim();
}

/**
 * Share invoice via email
 */
export async function shareViaEmail(
  invoice: Invoice,
  client?: Client,
  attachmentPath?: string
): Promise<ShareResult> {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        error: 'Mail composer is not available on this device',
      };
    }

    const emailBody = formatInvoiceForEmail(invoice, client);
    const attachments = attachmentPath ? [attachmentPath] : [];

    await MailComposer.composeAsync({
      recipients: client?.email ? [client.email] : [],
      subject: `Invoice #${invoice.invoiceNumber}`,
      body: emailBody,
      attachments,
      isHtml: false,
    });

    return {
      success: true,
      message: 'Email sent successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Share invoice via native share sheet
 */
export async function shareInvoice(
  invoice: Invoice,
  client?: Client,
  message?: string
): Promise<ShareResult> {
  try {
    const defaultMessage = `Invoice #${invoice.invoiceNumber} - Total: $${invoice.total.toFixed(2)}`;
    const shareMessage = message || defaultMessage;

    await Share.share({
      message: shareMessage,
      title: `Invoice #${invoice.invoiceNumber}`,
      url: Platform.OS === 'ios' ? undefined : undefined,
    });

    return {
      success: true,
      message: 'Invoice shared successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to share invoice',
    };
  }
}

/**
 * Generate shareable invoice link (for future cloud integration)
 */
export function generateInvoiceLink(invoiceId: string): string {
  // This will be used when cloud sync is implemented
  return `https://invoicestudio.app/invoice/${invoiceId}`;
}

/**
 * Copy invoice details to clipboard
 */
export async function copyToClipboard(text: string): Promise<ShareResult> {
  try {
    await Clipboard.setStringAsync(text);
    return {
      success: true,
      message: 'Copied to clipboard',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to copy to clipboard',
    };
  }
}

/**
 * Format invoice as CSV for export
 */
export function formatInvoiceAsCSV(invoice: Invoice, client?: Client): string {
  const headers = ['Description', 'Quantity', 'Rate', 'Amount'];
  const rows = invoice.lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    `$${item.rate.toFixed(2)}`,
    `$${item.amount.toFixed(2)}`,
  ]);

  const csvContent = [
    `Invoice #${invoice.invoiceNumber}`,
    `Date: ${new Date(invoice.issueDate).toLocaleDateString()}`,
    `Client: ${client?.name || 'N/A'}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(',')),
    '',
    `Subtotal,$${invoice.subtotal.toFixed(2)}`,
    `Tax (${invoice.taxRate}%),$${invoice.taxAmount.toFixed(2)}`,
    `Discount,-$${invoice.discountAmount.toFixed(2)}`,
    `Total,$${invoice.total.toFixed(2)}`,
  ].join('\n');

  return csvContent;
}

/**
 * Save invoice as text file
 */
export async function saveInvoiceAsFile(
  invoice: Invoice,
  client?: Client,
  format: 'txt' | 'csv' = 'txt'
): Promise<ShareResult> {
  try {
    const filename = `invoice_${invoice.invoiceNumber}_${Date.now()}.${format}`;
    const filepath = `${FileSystem.documentDirectory}${filename}`;

    const content = format === 'csv'
      ? formatInvoiceAsCSV(invoice, client)
      : formatInvoiceForEmail(invoice, client);

    await FileSystem.writeAsStringAsync(filepath, content);

    return {
      success: true,
      message: `Invoice saved as ${filename}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save invoice',
    };
  }
}
