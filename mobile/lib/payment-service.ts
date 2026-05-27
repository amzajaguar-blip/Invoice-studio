import { Invoice } from '@/shared/types';

export type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer' | 'cash';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  success: boolean;
  payment?: Payment;
  error?: string;
  transactionId?: string;
}

/**
 * Initialize Stripe payment
 */
export async function initializeStripePayment(invoice: Invoice): Promise<PaymentIntent | null> {
  try {
    const response = await fetch('/api/payments/stripe/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: Math.round(invoice.total * 100), // Convert to cents
        currency: 'usd',
        description: `Invoice #${invoice.invoiceNumber}`,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }

    return await response.json();
  } catch (error) {
    console.error('Stripe initialization failed:', error);
    return null;
  }
}

/**
 * Process Stripe payment
 */
export async function processStripePayment(
  invoiceId: string,
  paymentMethodId: string
): Promise<PaymentResult> {
  try {
    const response = await fetch('/api/payments/stripe/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId,
        paymentMethodId,
      }),
    });

    if (!response.ok) {
      throw new Error('Payment processing failed');
    }

    const result = await response.json();

    return {
      success: result.success,
      payment: result.payment,
      transactionId: result.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Initialize PayPal payment
 */
export async function initializePayPalPayment(invoice: Invoice): Promise<string | null> {
  try {
    const response = await fetch('/api/payments/paypal/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: invoice.total.toFixed(2),
        currency: 'USD',
        description: `Invoice #${invoice.invoiceNumber}`,
        items: invoice.lineItems.map(item => ({
          name: item.description,
          quantity: item.quantity,
          unit_amount: {
            currency_code: 'USD',
            value: item.rate.toFixed(2),
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create PayPal order');
    }

    const result = await response.json();
    return result.orderId;
  } catch (error) {
    console.error('PayPal initialization failed:', error);
    return null;
  }
}

/**
 * Capture PayPal payment
 */
export async function capturePayPalPayment(orderId: string, invoiceId: string): Promise<PaymentResult> {
  try {
    const response = await fetch('/api/payments/paypal/capture-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        invoiceId,
      }),
    });

    if (!response.ok) {
      throw new Error('Payment capture failed');
    }

    const result = await response.json();

    return {
      success: result.success,
      payment: result.payment,
      transactionId: result.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment capture failed',
    };
  }
}

/**
 * Create bank transfer payment request
 */
export async function createBankTransferRequest(invoice: Invoice): Promise<PaymentResult> {
  try {
    const response = await fetch('/api/payments/bank-transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: invoice.total,
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create bank transfer request');
    }

    const result = await response.json();

    return {
      success: true,
      payment: result.payment,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bank transfer request failed',
    };
  }
}

/**
 * Record cash payment
 */
export async function recordCashPayment(invoiceId: string, amount: number): Promise<PaymentResult> {
  try {
    const response = await fetch('/api/payments/cash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId,
        amount,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to record cash payment');
    }

    const result = await response.json();

    return {
      success: true,
      payment: result.payment,
      transactionId: result.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cash payment recording failed',
    };
  }
}

/**
 * Get payment history for invoice
 */
export async function getPaymentHistory(invoiceId: string): Promise<Payment[]> {
  try {
    const response = await fetch(`/api/payments/invoice/${invoiceId}`);

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get payment history:', error);
    return [];
  }
}

/**
 * Refund payment
 */
export async function refundPayment(paymentId: string, amount?: number): Promise<PaymentResult> {
  try {
    const response = await fetch(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
      }),
    });

    if (!response.ok) {
      throw new Error('Refund failed');
    }

    const result = await response.json();

    return {
      success: true,
      payment: result.payment,
      transactionId: result.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Refund failed',
    };
  }
}

/**
 * Get payment methods
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return ['stripe', 'paypal', 'bank_transfer', 'cash'];
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(amount: number, invoiceTotal: number): boolean {
  return amount > 0 && amount <= invoiceTotal;
}

/**
 * Format payment status for display
 */
export function formatPaymentStatus(status: PaymentStatus): string {
  const statusMap: Record<PaymentStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded',
  };
  return statusMap[status] || status;
}

/**
 * Get payment method icon
 */
export function getPaymentMethodIcon(method: PaymentMethod): string {
  const iconMap: Record<PaymentMethod, string> = {
    stripe: '💳',
    paypal: '🅿️',
    bank_transfer: '🏦',
    cash: '💵',
  };
  return iconMap[method] || '💰';
}

/**
 * Calculate payment progress
 */
export function calculatePaymentProgress(payments: Payment[], invoiceTotal: number): number {
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return Math.min(100, Math.round((totalPaid / invoiceTotal) * 100));
}
