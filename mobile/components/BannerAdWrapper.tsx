/**
 * BannerAdWrapper.tsx — placeholder after removing the ad network (Play Store prep).
 *
 * Banner ads are disabled. The component keeps its public API so call sites
 * (dashboard, customers, settings) remain unchanged and simply render nothing.
 */

import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

export interface BannerAdWrapperProps {
  screen: 'dashboard' | 'customers' | 'settings' | 'reports';
  style?: StyleProp<ViewStyle>;
}

export function BannerAdWrapper(_props: BannerAdWrapperProps) {
  return null;
}
