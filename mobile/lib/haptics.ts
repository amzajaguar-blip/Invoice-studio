import { Vibration, Platform } from 'react-native';

/**
 * Haptics wrapper using React Native Vibration API
 * No expo dependencies required
 */

export const ImpactFeedbackStyle = {
  Light: 0,
  Medium: 1,
  Heavy: 2,
} as const;

export const NotificationFeedbackType = {
  Success: 0,
  Warning: 1,
  Error: 2,
} as const;

export async function impactAsync(style?: number): Promise<void> {
  const duration = Platform.OS === 'ios' ? 20 : [10, 20, 30][style ?? 1];
  Vibration.vibrate(duration);
}

export async function notificationAsync(type?: number): Promise<void> {
  const duration = Platform.OS === 'ios' ? 40 : [20, 30, 40][type ?? 0];
  Vibration.vibrate(duration);
}

export async function selectionAsync(): Promise<void> {
  Vibration.vibrate(Platform.OS === 'ios' ? 15 : 10);
}

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
};
