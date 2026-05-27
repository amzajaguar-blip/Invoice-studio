import * as FileSystem from 'expo-file-system/legacy';
import { Invoice, LineItem } from '@/shared/types';

export interface ReceiptData {
  vendorName?: string;
  date?: string;
  items: LineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  confidence: number;
  rawText?: string;
}

export interface OCRResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
  confidence?: number;
}

/**
 * Extract receipt data from image using Manus LLM API
 * This uses the built-in multimodal AI capabilities
 */
export async function extractReceiptData(imageUri: string): Promise<OCRResult> {
  try {
    // Read image file and convert to base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Call Manus LLM API for receipt recognition
    const response = await fetch('/api/llm/vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: `data:image/jpeg;base64,${base64Image}`,
        prompt: `Analyze this receipt image and extract the following information in JSON format:
{
  "vendorName": "store name",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "description": "item name",
      "quantity": 1,
      "rate": 0.00,
      "amount": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "confidence": 0.95
}

Be precise with numbers. If you cannot read a value clearly, set confidence lower. Return ONLY valid JSON.`,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Parse the LLM response
    let extractedData: ReceiptData;
    try {
      // Try to parse if it's a JSON string
      const jsonStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      extractedData = JSON.parse(jsonStr);
    } catch {
      // Fallback: extract JSON from text
      const jsonMatch = result.content?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    }

    // Validate and normalize the data
    const normalizedData = normalizeReceiptData(extractedData);

    return {
      success: true,
      data: normalizedData,
      confidence: normalizedData.confidence,
    };
  } catch (error) {
    console.error('OCR extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract receipt data',
    };
  }
}

/**
 * Normalize and validate extracted receipt data
 */
function normalizeReceiptData(data: any): ReceiptData {
  const items: LineItem[] = (data.items || []).map((item: any, index: number) => ({
    id: `item-${index}`,
    description: item.description || 'Item',
    quantity: Math.max(1, parseInt(item.quantity) || 1),
    rate: parseFloat(item.rate) || 0,
    amount: parseFloat(item.amount) || parseFloat(item.rate) * (parseInt(item.quantity) || 1),
  }));

  const subtotal = parseFloat(data.subtotal) || items.reduce((sum, item) => sum + item.amount, 0);
  const tax = parseFloat(data.tax) || 0;
  const total = parseFloat(data.total) || subtotal + tax;
  const confidence = Math.min(1, Math.max(0, parseFloat(data.confidence) || 0.7));

  return {
    vendorName: data.vendorName || 'Unknown Vendor',
    date: data.date || new Date().toISOString().split('T')[0],
    items,
    subtotal: subtotal || 0,
    tax: tax || 0,
    total: total || 0,
    confidence,
    rawText: data.rawText,
  };
}

/**
 * Convert receipt data to invoice
 */
export function receiptToInvoice(receipt: ReceiptData, clientId?: string): Partial<Invoice> {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    invoiceNumber: `INV-${Date.now()}`,
    clientId,
    issueDate: now,
    dueDate: dueDate,
    lineItems: receipt.items,
    subtotal: receipt.subtotal || 0,
    taxRate: receipt.tax && receipt.subtotal ? (receipt.tax / receipt.subtotal) * 100 : 10,
    taxAmount: receipt.tax || 0,
    discountAmount: 0,
    total: receipt.total || 0,
    status: 'draft',
    paymentTerms: 'Net 30',
    notes: `Created from receipt: ${receipt.vendorName} - ${receipt.date}`,
  };
}

/**
 * Batch process multiple receipts
 */
export async function batchExtractReceipts(imageUris: string[]): Promise<OCRResult[]> {
  const results = await Promise.all(
    imageUris.map(uri => extractReceiptData(uri))
  );
  return results;
}

/**
 * Calculate confidence score for extracted data
 */
export function calculateConfidenceScore(data: ReceiptData): number {
  let score = data.confidence || 0.7;

  // Reduce confidence if critical fields are missing
  if (!data.vendorName || data.vendorName === 'Unknown Vendor') score *= 0.9;
  if (!data.date) score *= 0.9;
  if (data.items.length === 0) score *= 0.5;
  if ((data.total || 0) === 0) score *= 0.8;

  // Increase confidence if all fields are present
  if (data.vendorName && data.date && data.items.length > 0 && (data.total || 0) > 0) {
    score = Math.min(1, score * 1.1);
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Format receipt data for display
 */
export function formatReceiptForDisplay(data: ReceiptData): string {
  const itemsText = data.items
    .map(item => `  • ${item.description}: ${item.quantity}x $${item.rate.toFixed(2)} = $${item.amount.toFixed(2)}`)
    .join('\n');

  return `
Receipt from: ${data.vendorName}
Date: ${data.date}

Items:
${itemsText}

Subtotal: $${(data.subtotal || 0).toFixed(2)}
Tax: $${(data.tax || 0).toFixed(2)}
---
Total: $${(data.total || 0).toFixed(2)}

Confidence: ${(data.confidence * 100).toFixed(0)}%
  `.trim();
}
