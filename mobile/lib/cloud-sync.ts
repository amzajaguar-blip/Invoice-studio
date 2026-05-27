import AsyncStorage from '@react-native-async-storage/async-storage';
import { Invoice, Client } from '@/shared/types';

export interface SyncStatus {
  isOnline: boolean;
  lastSync?: Date;
  pendingChanges: number;
  syncInProgress: boolean;
}

export interface SyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  type: 'invoice' | 'client';
  data: any;
  timestamp: number;
  retries: number;
}

const SYNC_QUEUE_KEY = 'sync_queue';
const LAST_SYNC_KEY = 'last_sync';
const INVOICES_KEY = 'invoices';
const CLIENTS_KEY = 'clients';
const MAX_RETRIES = 3;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize cloud sync service
 */
export async function initializeCloudSync(): Promise<void> {
  // Start periodic sync
  setInterval(() => {
    syncPendingChanges();
  }, SYNC_INTERVAL);

  // Perform initial sync
  await syncPendingChanges();
}

/**
 * Add invoice to sync queue
 */
export async function queueInvoiceChange(
  invoice: Invoice,
  action: 'create' | 'update' | 'delete'
): Promise<void> {
  const queue = await getSyncQueue();

  const queueItem: SyncQueue = {
    id: `${action}-${invoice.id}-${Date.now()}`,
    action,
    type: 'invoice',
    data: invoice,
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(queueItem);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add client to sync queue
 */
export async function queueClientChange(
  client: Client,
  action: 'create' | 'update' | 'delete'
): Promise<void> {
  const queue = await getSyncQueue();

  const queueItem: SyncQueue = {
    id: `${action}-${client.id}-${Date.now()}`,
    action,
    type: 'client',
    data: client,
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(queueItem);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get sync queue
 */
export async function getSyncQueue(): Promise<SyncQueue[]> {
  try {
    const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
}

/**
 * Sync pending changes to cloud
 */
export async function syncPendingChanges(): Promise<SyncStatus> {
  const queue = await getSyncQueue();
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      const success = await syncQueueItem(item);

      if (success) {
        syncedCount++;
        // Remove from queue
        await removeFromQueue(item.id);
      } else {
        failedCount++;
        // Increment retries
        if (item.retries < MAX_RETRIES) {
          item.retries++;
          await updateQueueItem(item);
        } else {
          // Max retries exceeded, remove from queue
          await removeFromQueue(item.id);
        }
      }
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      failedCount++;
    }
  }

  // Update last sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return {
    isOnline: true,
    lastSync: new Date(),
    pendingChanges: queue.length - syncedCount,
    syncInProgress: false,
  };
}

/**
 * Sync individual queue item
 */
async function syncQueueItem(item: SyncQueue): Promise<boolean> {
  try {
    const endpoint = item.type === 'invoice' ? '/api/invoices' : '/api/clients';

    let method = 'POST';
    let url = endpoint;

    if (item.action === 'update') {
      method = 'PUT';
      url = `${endpoint}/${item.data.id}`;
    } else if (item.action === 'delete') {
      method = 'DELETE';
      url = `${endpoint}/${item.data.id}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined,
    });

    return response.ok;
  } catch (error) {
    console.error('Sync item failed:', error);
    return false;
  }
}

/**
 * Remove item from sync queue
 */
async function removeFromQueue(id: string): Promise<void> {
  const queue = await getSyncQueue();
  const filtered = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
}

/**
 * Update queue item
 */
async function updateQueueItem(item: SyncQueue): Promise<void> {
  const queue = await getSyncQueue();
  const index = queue.findIndex(q => q.id === item.id);
  if (index !== -1) {
    queue[index] = item;
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const queue = await getSyncQueue();
  const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

  return {
    isOnline: true,
    lastSync: lastSync ? new Date(lastSync) : undefined,
    pendingChanges: queue.length,
    syncInProgress: false,
  };
}

/**
 * Force manual sync
 */
export async function forceSyncNow(): Promise<SyncStatus> {
  return syncPendingChanges();
}

/**
 * Clear sync queue (use with caution)
 */
export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Backup all data to cloud
 */
export async function backupAllData(): Promise<boolean> {
  try {
    const invoices = await AsyncStorage.getItem(INVOICES_KEY);
    const clients = await AsyncStorage.getItem(CLIENTS_KEY);

    const backup = {
      invoices: invoices ? JSON.parse(invoices) : [],
      clients: clients ? JSON.parse(clients) : [],
      timestamp: new Date().toISOString(),
    };

    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backup),
    });

    return response.ok;
  } catch (error) {
    console.error('Backup failed:', error);
    return false;
  }
}

/**
 * Restore data from cloud backup
 */
export async function restoreFromBackup(backupId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/backup/${backupId}`);

    if (!response.ok) {
      return false;
    }

    const backup = await response.json();

    // Restore invoices
    if (backup.invoices) {
      await AsyncStorage.setItem(INVOICES_KEY, JSON.stringify(backup.invoices));
    }

    // Restore clients
    if (backup.clients) {
      await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(backup.clients));
    }

    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    return false;
  }
}

/**
 * Get backup history
 */
export async function getBackupHistory(): Promise<any[]> {
  try {
    const response = await fetch('/api/backups');

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get backup history:', error);
    return [];
  }
}

/**
 * Enable offline mode
 */
export async function enableOfflineMode(): Promise<void> {
  // All changes will be queued automatically
  console.log('Offline mode enabled - changes will sync when connection is restored');
}

/**
 * Disable offline mode
 */
export async function disableOfflineMode(): Promise<void> {
  // Attempt to sync all pending changes
  await syncPendingChanges();
  console.log('Offline mode disabled - syncing pending changes');
}
