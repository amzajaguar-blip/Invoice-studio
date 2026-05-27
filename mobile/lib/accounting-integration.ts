import AsyncStorage from '@react-native-async-storage/async-storage';
import { Invoice } from '@/shared/types';

export type AccountingPlatform = 'quickbooks' | 'xero' | 'wave' | 'freshbooks' | 'zoho';

export interface AccountingCredentials {
  platform: AccountingPlatform;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
  businessId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface SyncLog {
  id: string;
  platform: AccountingPlatform;
  invoiceId: string;
  invoiceNumber: string;
  status: 'success' | 'failed' | 'pending';
  syncedAt: Date;
  externalId?: string;
  error?: string;
}

const CREDENTIALS_KEY = 'accounting_credentials';
const SYNC_LOGS_KEY = 'accounting_sync_logs';

/**
 * Save accounting credentials
 */
export async function saveAccountingCredentials(credentials: AccountingCredentials): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
    const allCredentials: AccountingCredentials[] = stored ? JSON.parse(stored) : [];

    // Remove existing credentials for this platform
    const filtered = allCredentials.filter(c => c.platform !== credentials.platform);
    filtered.push(credentials);

    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to save accounting credentials:', error);
    throw error;
  }
}

/**
 * Get accounting credentials
 */
export async function getAccountingCredentials(platform: AccountingPlatform): Promise<AccountingCredentials | null> {
  try {
    const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
    const allCredentials: AccountingCredentials[] = stored ? JSON.parse(stored) : [];
    return allCredentials.find(c => c.platform === platform) || null;
  } catch (error) {
    console.error('Failed to get accounting credentials:', error);
    return null;
  }
}

/**
 * Sync invoice to accounting software
 */
export async function syncInvoiceToAccounting(invoice: Invoice, platform: AccountingPlatform): Promise<boolean> {
  try {
    const credentials = await getAccountingCredentials(platform);

    if (!credentials) {
      throw new Error(`No credentials found for ${platform}`);
    }

    let externalId: string | undefined;

    switch (platform) {
      case 'quickbooks':
        externalId = await syncToQuickBooks(invoice, credentials);
        break;
      case 'xero':
        externalId = await syncToXero(invoice, credentials);
        break;
      case 'wave':
        externalId = await syncToWave(invoice, credentials);
        break;
      case 'freshbooks':
        externalId = await syncToFreshBooks(invoice, credentials);
        break;
      case 'zoho':
        externalId = await syncToZoho(invoice, credentials);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Log successful sync
    await logSync({
      id: `sync-${Date.now()}`,
      platform,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: 'success',
      syncedAt: new Date(),
      externalId,
    });

    return true;
  } catch (error) {
    console.error(`Failed to sync invoice to ${platform}:`, error);

    // Log failed sync
    await logSync({
      id: `sync-${Date.now()}`,
      platform,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: 'failed',
      syncedAt: new Date(),
      error: String(error),
    });

    return false;
  }
}

/**
 * Sync multiple invoices to accounting software
 */
export async function syncMultipleInvoices(invoices: Invoice[], platform: AccountingPlatform): Promise<number> {
  let successCount = 0;

  for (const invoice of invoices) {
    const success = await syncInvoiceToAccounting(invoice, platform);
    if (success) {
      successCount++;
    }
  }

  return successCount;
}

/**
 * Get sync logs
 */
export async function getSyncLogs(platform?: AccountingPlatform): Promise<SyncLog[]> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_LOGS_KEY);
    const logs: SyncLog[] = stored ? JSON.parse(stored) : [];

    if (platform) {
      return logs.filter(log => log.platform === platform);
    }

    return logs;
  } catch (error) {
    console.error('Failed to get sync logs:', error);
    return [];
  }
}

/**
 * Helper: Sync to QuickBooks
 */
async function syncToQuickBooks(invoice: Invoice, credentials: AccountingCredentials): Promise<string> {
  try {
    const response = await fetch('https://quickbooks.api.intuit.com/v2/company/123456789/invoice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docNumber: invoice.invoiceNumber,
        customerRef: { value: credentials.accountId },
        line: invoice.lineItems.map(item => ({
          description: item.description,
          amount: item.amount,
          detailType: 'SalesItemLineDetail',
          salesItemLineDetail: {
            qty: item.quantity,
            unitPrice: item.rate,
            itemRef: { value: '1' },
          },
        })),
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        totalAmt: invoice.total,
      }),
    });

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('QuickBooks sync error:', error);
    throw error;
  }
}

/**
 * Helper: Sync to Xero
 */
async function syncToXero(invoice: Invoice, credentials: AccountingCredentials): Promise<string> {
  try {
    const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Type: 'ACCREC',
        InvoiceNumber: invoice.invoiceNumber,
        Contact: {
          Name: invoice.client?.name,
        },
        LineItems: {
          LineItem: invoice.lineItems.map(item => ({
            Description: item.description,
            Quantity: item.quantity,
            UnitAmount: item.rate,
            LineAmount: item.amount,
          })),
        },
        DueDate: invoice.dueDate.toISOString().split('T')[0],
        Total: invoice.total,
      }),
    });

    if (!response.ok) {
      throw new Error(`Xero API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.Invoices[0].InvoiceID;
  } catch (error) {
    console.error('Xero sync error:', error);
    throw error;
  }
}

/**
 * Helper: Sync to Wave
 */
async function syncToWave(invoice: Invoice, credentials: AccountingCredentials): Promise<string> {
  try {
    const query = `
      mutation {
        invoiceCreate(input: {
          customerId: "${credentials.businessId}"
          invoiceNumber: "${invoice.invoiceNumber}"
          dueDate: "${invoice.dueDate.toISOString().split('T')[0]}"
          lineItems: [
            ${invoice.lineItems
              .map(
                item => `{
              description: "${item.description}"
              quantity: ${item.quantity}
              unitPrice: "${item.rate}"
            }`
              )
              .join(',')}
          ]
        }) {
          invoice {
            id
            invoiceNumber
          }
        }
      }
    `;

    const response = await fetch('https://gql.waveapps.com/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Wave API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.invoiceCreate.invoice.id;
  } catch (error) {
    console.error('Wave sync error:', error);
    throw error;
  }
}

/**
 * Helper: Sync to FreshBooks
 */
async function syncToFreshBooks(invoice: Invoice, credentials: AccountingCredentials): Promise<string> {
  try {
    const response = await fetch('https://api.freshbooks.com/accounting_account/account/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice: {
          accountid: credentials.accountId,
          customerid: credentials.businessId,
          invoicenumber: invoice.invoiceNumber,
          lines: invoice.lineItems.map(item => ({
            name: item.description,
            qty: item.quantity,
            unitcost: item.rate,
            amount: item.amount,
          })),
          duedate: invoice.dueDate.toISOString().split('T')[0],
          total: invoice.total,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`FreshBooks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.invoice.id;
  } catch (error) {
    console.error('FreshBooks sync error:', error);
    throw error;
  }
}

/**
 * Helper: Sync to Zoho
 */
async function syncToZoho(invoice: Invoice, credentials: AccountingCredentials): Promise<string> {
  try {
    const response = await fetch(`https://www.zohoapis.com/books/v3/invoices?organization_id=${credentials.accountId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_number: invoice.invoiceNumber,
        customer_id: credentials.businessId,
        line_items: invoice.lineItems.map(item => ({
          item_name: item.description,
          quantity: item.quantity,
          rate: item.rate,
        })),
        due_date: invoice.dueDate.toISOString().split('T')[0],
        total: invoice.total,
      }),
    });

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.invoice.invoice_id;
  } catch (error) {
    console.error('Zoho sync error:', error);
    throw error;
  }
}

/**
 * Helper: Log sync
 */
async function logSync(log: SyncLog): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_LOGS_KEY);
    const logs: SyncLog[] = stored ? JSON.parse(stored) : [];
    logs.push(log);

    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    await AsyncStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to log sync:', error);
  }
}

/**
 * Delete accounting credentials
 */
export async function deleteAccountingCredentials(platform: AccountingPlatform): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
    const allCredentials: AccountingCredentials[] = stored ? JSON.parse(stored) : [];

    const filtered = allCredentials.filter(c => c.platform !== platform);
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete accounting credentials:', error);
    throw error;
  }
}

/**
 * Get all connected platforms
 */
export async function getConnectedPlatforms(): Promise<AccountingPlatform[]> {
  try {
    const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
    const allCredentials: AccountingCredentials[] = stored ? JSON.parse(stored) : [];
    return allCredentials.map(c => c.platform);
  } catch (error) {
    console.error('Failed to get connected platforms:', error);
    return [];
  }
}
