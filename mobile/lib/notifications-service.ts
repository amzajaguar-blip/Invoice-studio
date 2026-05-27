import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationType = 'payment_received' | 'invoice_sent' | 'invoice_overdue' | 'payment_reminder' | 'invoice_viewed';

export interface NotificationPayload {
  type: NotificationType;
  invoiceId: string;
  invoiceNumber: string;
  clientName?: string;
  amount?: number;
  message: string;
  deepLink?: string;
  timestamp: Date;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  paymentAlerts: boolean;
  overdueAlerts: boolean;
  reminderAlerts: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  notificationTime?: string; // HH:MM format
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const DEVICE_TOKEN_KEY = 'device_push_token';

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(): Promise<string | null> {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Get current notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    // Get device token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'invoice-studio',
    });

    // Save token
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token.data);

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      } as any),
    });

    return token.data;
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return null;
  }
}

/**
 * Send local notification
 */
export async function sendLocalNotification(payload: NotificationPayload): Promise<void> {
  try {
    const settings = await getNotificationSettings();

    // Check if notifications are enabled for this type
    if (!shouldSendNotification(payload.type, settings)) {
      return;
    }

    const title = getTitleForType(payload.type);
    const body = payload.message;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: payload.type,
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          deepLink: payload.deepLink,
        },
        sound: 'default',
        badge: 1,
      },
      trigger: { type: 'timeInterval', seconds: 1 } as any,
    });
  } catch (error) {
    console.error('Failed to send local notification:', error);
  }
}

/**
 * Send push notification to server
 */
export async function sendPushNotification(
  deviceToken: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: deviceToken,
        title: getTitleForType(payload.type),
        body: payload.message,
        data: {
          type: payload.type,
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          deepLink: payload.deepLink,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

/**
 * Schedule payment reminder notifications
 */
export async function schedulePaymentReminders(invoices: any[]): Promise<void> {
  try {
    const settings = await getNotificationSettings();

    if (!settings.reminderAlerts) {
      return;
    }

    // Schedule reminders for invoices due in 3, 7, and 14 days
    for (const invoice of invoices) {
      if (invoice.status === 'sent' || invoice.status === 'pending') {
        const dueDate = new Date(invoice.dueDate);
        const now = new Date();
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue === 3 || daysUntilDue === 7 || daysUntilDue === 14) {
          await sendLocalNotification({
            type: 'payment_reminder',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.client?.name,
            amount: invoice.total,
            message: `Invoice #${invoice.invoiceNumber} is due in ${daysUntilDue} days ($${invoice.total.toFixed(2)})`,
            deepLink: `/invoice/${invoice.id}`,
            timestamp: new Date(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to schedule payment reminders:', error);
  }
}

/**
 * Schedule overdue notifications
 */
export async function scheduleOverdueNotifications(invoices: any[]): Promise<void> {
  try {
    const settings = await getNotificationSettings();

    if (!settings.overdueAlerts) {
      return;
    }

    const now = new Date();

    for (const invoice of invoices) {
      if (invoice.status === 'sent' || invoice.status === 'pending') {
        const dueDate = new Date(invoice.dueDate);

        if (dueDate < now) {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Send overdue notification every 7 days
          if (daysOverdue % 7 === 0) {
            await sendLocalNotification({
              type: 'invoice_overdue',
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              clientName: invoice.client?.name,
              amount: invoice.total,
              message: `Invoice #${invoice.invoiceNumber} is ${daysOverdue} days overdue ($${invoice.total.toFixed(2)})`,
              deepLink: `/invoice/${invoice.id}`,
              timestamp: new Date(),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to schedule overdue notifications:', error);
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return settings
      ? JSON.parse(settings)
      : {
          pushEnabled: true,
          paymentAlerts: true,
          overdueAlerts: true,
          reminderAlerts: true,
          emailNotifications: false,
          smsNotifications: false,
        };
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    return {
      pushEnabled: true,
      paymentAlerts: true,
      overdueAlerts: true,
      reminderAlerts: true,
      emailNotifications: false,
      smsNotifications: false,
    };
  }
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  try {
    const current = await getNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update notification settings:', error);
  }
}

/**
 * Get device push token
 */
export async function getDevicePushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get device push token:', error);
    return null;
  }
}

/**
 * Send payment received notification
 */
export async function notifyPaymentReceived(invoice: any, paymentAmount: number): Promise<void> {
  await sendLocalNotification({
    type: 'payment_received',
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client?.name,
    amount: paymentAmount,
    message: `Payment of $${paymentAmount.toFixed(2)} received for Invoice #${invoice.invoiceNumber}`,
    deepLink: `/invoice/${invoice.id}`,
    timestamp: new Date(),
  });
}

/**
 * Send invoice sent notification
 */
export async function notifyInvoiceSent(invoice: any): Promise<void> {
  await sendLocalNotification({
    type: 'invoice_sent',
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client?.name,
    amount: invoice.total,
    message: `Invoice #${invoice.invoiceNumber} sent to ${invoice.client?.name}`,
    deepLink: `/invoice/${invoice.id}`,
    timestamp: new Date(),
  });
}

/**
 * Send invoice viewed notification
 */
export async function notifyInvoiceViewed(invoice: any): Promise<void> {
  await sendLocalNotification({
    type: 'invoice_viewed',
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client?.name,
    message: `Invoice #${invoice.invoiceNumber} was viewed by ${invoice.client?.name}`,
    deepLink: `/invoice/${invoice.id}`,
    timestamp: new Date(),
  });
}

/**
 * Helper: Get title for notification type
 */
function getTitleForType(type: NotificationType): string {
  const titles: Record<NotificationType, string> = {
    payment_received: '💰 Payment Received',
    invoice_sent: '📤 Invoice Sent',
    invoice_overdue: '⚠️ Invoice Overdue',
    payment_reminder: '📋 Payment Reminder',
    invoice_viewed: '👁️ Invoice Viewed',
  };
  return titles[type] || 'Notification';
}

/**
 * Helper: Check if notification should be sent
 */
function shouldSendNotification(type: NotificationType, settings: NotificationSettings): boolean {
  if (!settings.pushEnabled) return false;

  switch (type) {
    case 'payment_received':
      return settings.paymentAlerts;
    case 'invoice_overdue':
      return settings.overdueAlerts;
    case 'payment_reminder':
      return settings.reminderAlerts;
    case 'invoice_sent':
    case 'invoice_viewed':
      return true;
    default:
      return false;
  }
}
