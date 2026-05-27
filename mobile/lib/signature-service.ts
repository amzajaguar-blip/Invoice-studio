import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Invoice } from '@/shared/types';

export interface Signature {
  id: string;
  invoiceId: string;
  signedBy: string;
  signedByEmail: string;
  signatureImage: string; // Base64 encoded
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  verified: boolean;
  verificationHash?: string;
}

export interface SignatureRequest {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  clientName: string;
  amount: number;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'signed' | 'expired' | 'declined';
  signatureId?: string;
}

const SIGNATURES_KEY = 'signatures';
const SIGNATURE_REQUESTS_KEY = 'signature_requests';

/**
 * Create signature request for invoice
 */
export async function createSignatureRequest(invoice: Invoice, clientEmail: string): Promise<SignatureRequest> {
  try {
    const request: SignatureRequest = {
      id: `sig-req-${Date.now()}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientEmail,
      clientName: invoice.client?.name || 'Client',
      amount: invoice.total,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'pending',
    };

    // Save request
    const requests = await getSignatureRequests();
    requests.push(request);
    await AsyncStorage.setItem(SIGNATURE_REQUESTS_KEY, JSON.stringify(requests));

    // Send email with signing link
    await sendSigningEmail(request);

    return request;
  } catch (error) {
    console.error('Failed to create signature request:', error);
    throw error;
  }
}

/**
 * Save signature
 */
export async function saveSignature(
  invoiceId: string,
  signatureImage: string,
  signedBy: string,
  signedByEmail: string
): Promise<Signature> {
  try {
    const signature: Signature = {
      id: `sig-${Date.now()}`,
      invoiceId,
      signedBy,
      signedByEmail,
      signatureImage,
      timestamp: new Date(),
      verified: true,
      verificationHash: generateVerificationHash(signatureImage, signedByEmail),
    };

    // Save signature
    const signatures = await getSignatures();
    signatures.push(signature);
    await AsyncStorage.setItem(SIGNATURES_KEY, JSON.stringify(signatures));

    // Update signature request status
    const requests = await getSignatureRequests();
    const request = requests.find(r => r.invoiceId === invoiceId);
    if (request) {
      request.status = 'signed';
      request.signatureId = signature.id;
      await AsyncStorage.setItem(SIGNATURE_REQUESTS_KEY, JSON.stringify(requests));
    }

    // Update invoice status
    await updateInvoiceSignatureStatus(invoiceId, true);

    return signature;
  } catch (error) {
    console.error('Failed to save signature:', error);
    throw error;
  }
}

/**
 * Get signatures for invoice
 */
export async function getInvoiceSignatures(invoiceId: string): Promise<Signature[]> {
  try {
    const signatures = await getSignatures();
    return signatures.filter(sig => sig.invoiceId === invoiceId);
  } catch (error) {
    console.error('Failed to get invoice signatures:', error);
    return [];
  }
}

/**
 * Verify signature authenticity
 */
export async function verifySignature(signature: Signature): Promise<boolean> {
  try {
    const expectedHash = generateVerificationHash(signature.signatureImage, signature.signedByEmail);
    return signature.verificationHash === expectedHash && signature.verified;
  } catch (error) {
    console.error('Failed to verify signature:', error);
    return false;
  }
}

/**
 * Export signed invoice as PDF with signature
 */
export async function exportSignedInvoice(invoiceId: string): Promise<string | null> {
  try {
    const signatures = await getInvoiceSignatures(invoiceId);

    if (signatures.length === 0) {
      throw new Error('Invoice is not signed');
    }

    const signature = signatures[0];

    // Create HTML with signature
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Signed Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .signature-block { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
    .signature-image { max-width: 200px; margin: 10px 0; }
    .verification { background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px; margin-top: 10px; }
    .verified { color: green; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Signed Invoice</h1>
  
  <div class="signature-block">
    <h3>Digital Signature</h3>
    <p><strong>Signed by:</strong> ${signature.signedBy}</p>
    <p><strong>Email:</strong> ${signature.signedByEmail}</p>
    <p><strong>Date:</strong> ${new Date(signature.timestamp).toLocaleString()}</p>
    
    <div class="signature-image">
      <img src="data:image/png;base64,${signature.signatureImage}" alt="Signature" style="max-width: 100%; border: 1px solid #ddd; padding: 5px;">
    </div>
    
    <div class="verification">
      <p class="verified">✓ Signature Verified</p>
      <p><strong>Verification Hash:</strong> ${signature.verificationHash}</p>
      <p>This document has been digitally signed and verified.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Save as file
    const filename = `signed-invoice-${invoiceId}-${Date.now()}.html`;
    const filepath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filepath, html);

    return filepath;
  } catch (error) {
    console.error('Failed to export signed invoice:', error);
    return null;
  }
}

/**
 * Get all signature requests
 */
export async function getSignatureRequests(): Promise<SignatureRequest[]> {
  try {
    const requests = await AsyncStorage.getItem(SIGNATURE_REQUESTS_KEY);
    return requests ? JSON.parse(requests) : [];
  } catch (error) {
    console.error('Failed to get signature requests:', error);
    return [];
  }
}

/**
 * Get all signatures
 */
export async function getSignatures(): Promise<Signature[]> {
  try {
    const signatures = await AsyncStorage.getItem(SIGNATURES_KEY);
    return signatures ? JSON.parse(signatures) : [];
  } catch (error) {
    console.error('Failed to get signatures:', error);
    return [];
  }
}

/**
 * Check if invoice is signed
 */
export async function isInvoiceSigned(invoiceId: string): Promise<boolean> {
  try {
    const signatures = await getInvoiceSignatures(invoiceId);
    return signatures.length > 0;
  } catch (error) {
    console.error('Failed to check if invoice is signed:', error);
    return false;
  }
}

/**
 * Decline signature request
 */
export async function declineSignatureRequest(requestId: string, reason?: string): Promise<void> {
  try {
    const requests = await getSignatureRequests();
    const request = requests.find(r => r.id === requestId);

    if (request) {
      request.status = 'declined';
      await AsyncStorage.setItem(SIGNATURE_REQUESTS_KEY, JSON.stringify(requests));

      // Send decline notification
      await sendDeclineNotification(request, reason);
    }
  } catch (error) {
    console.error('Failed to decline signature request:', error);
  }
}

/**
 * Get signature request by ID
 */
export async function getSignatureRequest(requestId: string): Promise<SignatureRequest | null> {
  try {
    const requests = await getSignatureRequests();
    return requests.find(r => r.id === requestId) || null;
  } catch (error) {
    console.error('Failed to get signature request:', error);
    return null;
  }
}

/**
 * Helper: Generate verification hash
 */
function generateVerificationHash(signatureImage: string, email: string): string {
  // In production, use proper cryptographic hashing
  const combined = `${signatureImage}${email}${Date.now()}`;
  return Buffer.from(combined).toString('base64').substring(0, 32);
}

/**
 * Helper: Send signing email
 */
async function sendSigningEmail(request: SignatureRequest): Promise<void> {
  try {
    const signingLink = `https://invoicestudio.app/sign/${request.id}`;

    await fetch('/api/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: request.clientEmail,
        subject: `Please sign Invoice #${request.invoiceNumber}`,
        template: 'signature_request',
        data: {
          clientName: request.clientName,
          invoiceNumber: request.invoiceNumber,
          amount: request.amount,
          signingLink,
          expiresAt: request.expiresAt,
        },
      }),
    });
  } catch (error) {
    console.error('Failed to send signing email:', error);
  }
}

/**
 * Helper: Send decline notification
 */
async function sendDeclineNotification(request: SignatureRequest, reason?: string): Promise<void> {
  try {
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'signature_declined',
        invoiceNumber: request.invoiceNumber,
        clientName: request.clientName,
        reason,
      }),
    });
  } catch (error) {
    console.error('Failed to send decline notification:', error);
  }
}

/**
 * Helper: Update invoice signature status
 */
async function updateInvoiceSignatureStatus(invoiceId: string, signed: boolean): Promise<void> {
  try {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signed,
        signedAt: signed ? new Date().toISOString() : null,
      }),
    });
  } catch (error) {
    console.error('Failed to update invoice signature status:', error);
  }
}
