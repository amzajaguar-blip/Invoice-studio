/**
 * InvoiceLimitModal — Bottom sheet che appare quando l'utente raggiunge il
 * limite di 5 fatture gratuite mensili.
 *
 * Offre due percorsi:
 * - Passa a Pro (primario, €4,99/mese) — fatture illimitate + tutte le funzioni
 * - Guarda un video (secondario) — sblocca 1 fattura extra gratis via Rewarded Ad
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import type { InvoiceQuota } from '@/lib/useRewardedInvoice';
import { useLocale } from '@/components/LocaleProvider';

interface InvoiceLimitModalProps {
  visible: boolean;
  adLoaded: boolean;
  adLoading: boolean;
  adError: string | null;
  quota?: InvoiceQuota;
  onWatchAd: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}

const { height } = Dimensions.get('window');
const AD_LOAD_TIMEOUT_MS = 5000;

export default function InvoiceLimitModal({
  visible,
  adLoaded,
  adLoading,
  adError,
  quota,
  onWatchAd,
  onUpgrade,
  onClose,
}: InvoiceLimitModalProps) {
  const isDailyLimitHit = quota?.reason === 'daily_limit_reached';
  const dailyUsed = quota?.dailyCreditsUsed ?? 0;
  const dailyMax = quota?.dailyMax ?? 10;
  const dailyProgress = Math.min(dailyUsed / dailyMax, 1);
  const dailyResetIn = quota?.dailyResetIn ?? '';
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [adLoadTimedOut, setAdLoadTimedOut] = useState(false);
  const { t } = useLocale();

  // Check accessibility preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Ad loading timeout
  useEffect(() => {
    if (adLoading && visible) {
      setAdLoadTimedOut(false);
      const t = setTimeout(() => setAdLoadTimedOut(true), AD_LOAD_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    if (!adLoading) setAdLoadTimedOut(false);
  }, [adLoading, visible]);

  // Entrance/exit animation
  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        slideAnim.setValue(0);
        fadeAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 180,
            mass: 1,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      const dur = reduceMotion ? 0 : 250;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: reduceMotion ? 0 : 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, reduceMotion]);

  // ── Ad button right-side element ──────────────────────────────────────────

  const AdState = () => {
    if (adError || (adLoadTimedOut && !adLoaded)) {
      return (
        <View style={s.adStateWrap}>
          <Text style={s.adStateError}>{t("modal.invoice_limit.ad.state.error")}</Text>
          <TouchableOpacity
            onPress={onWatchAd}
            style={s.retryPill}
            accessibilityRole="button"
            accessibilityLabel={t("modal.invoice_limit.ad.retry.a11y")}
          >
            <Text style={s.retryPillText}>{t("modal.invoice_limit.ad.retry.text")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (adLoading) {
      return (
        <View style={s.adStateWrap}>
          <ActivityIndicator size="small" color="#6c63ff" />
          <Text style={s.adStateLoading}>{t("modal.invoice_limit.ad.state.loading")}</Text>
        </View>
      );
    }

    if (!adLoaded) {
      return (
        <View style={s.adStateWrap}>
          <Text style={s.adStateUnavailable}>{t("modal.invoice_limit.ad.state.unavailable_primary")}</Text>
          <Text style={s.adStateHint}>{t("modal.invoice_limit.ad.state.unavailable_hint")}</Text>
        </View>
      );
    }

    return (
      <View style={s.freeBadge}>
        <Text style={s.freeBadgeText}>{t("modal.invoice_limit.free_badge")}</Text>
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={t("modal.invoice_limit.a11y_title")}
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t("modal.invoice_limit.overlay.close.a11y")}
        />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Icon */}
          <View style={s.iconWrap}>
            <Text style={s.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              📄
            </Text>
            <View style={s.badgeWrap}>
              <Text style={s.badgeIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                🔒
              </Text>
            </View>
          </View>

          {/* Titolo + sottotitolo */}
          <Text style={s.title}>{t("modal.invoice_limit.title")}</Text>
          <Text style={s.subtitle}>{t("modal.invoice_limit.subtitle")}</Text>

          <View style={s.divider} />

          {/* ── Opzione PRIMARIA: Upgrade Pro ──────────────────────────── */}
          <TouchableOpacity
            style={s.proBtn}
            onPress={onUpgrade}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("modal.invoice_limit.pro_a11y_prefix") + " " + t("modal.invoice_limit.pro_a11y_body")}
            accessibilityHint={t("modal.invoice_limit.pro_a11y_hint")}
          >
            <Text
              style={s.proBtnIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              🚀
            </Text>
            <View style={s.proBtnText}>
              <Text style={s.proBtnTitle}>{t("modal.invoice_limit.pro_button_title")}</Text>
              <View style={s.proFeatureList}>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>{t("modal.invoice_limit.pro_feature.unlimited")}</Text>
                </View>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>{t("modal.invoice_limit.pro_feature.email_pdf")}</Text>
                </View>
                <View style={s.proFeatureRow}>
                  <Text style={s.proFeatureCheck}>✓</Text>
                  <Text style={s.proFeatureItem}>{t("modal.invoice_limit.pro_feature.cancel_anytime")}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Daily progress bar ──────────────────────────────────── */}
          <View style={s.dailyRow}>
            <Text style={s.dailyLabel}>
              {t("modal.invoice_limit.daily.label").replace("{used}", String(dailyUsed)).replace("{max}", String(dailyMax))}
            </Text>
            {isDailyLimitHit && dailyResetIn ? (
              <Text style={s.dailyReset}>{t("modal.invoice_limit.daily.reset_in").replace("{time}", dailyResetIn)}</Text>
            ) : null}
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressBar, { width: `${dailyProgress * 100}%` as unknown as number }]} />
          </View>

          {/* ── Opzione SECONDARIA: Guarda video ───────────────────────── */}
          <TouchableOpacity
            style={[s.adBtn, (isDailyLimitHit || (!adLoaded && !adLoading)) && s.btnDisabled]}
            onPress={onWatchAd}
            disabled={isDailyLimitHit || !adLoaded}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isDailyLimitHit
                ? t("modal.invoice_limit.ad.a11y_limit_template").replace("{time}", dailyResetIn)
                : adLoaded
                  ? t("modal.invoice_limit.ad.a11y_loaded")
                  : t("modal.invoice_limit.ad.a11y_unavailable")
            }
            accessibilityState={{ disabled: isDailyLimitHit || !adLoaded }}
          >
            <View style={s.adBtnContent}>
              <View style={s.adBtnLeft}>
                <Text
                  style={s.adBtnIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  🎬
                </Text>
                <View>
                  <Text style={s.adBtnTitle}>{t("modal.invoice_limit.ad.title")}</Text>
                  {isDailyLimitHit ? (
                    <Text style={[s.adBtnSub, s.adBtnSubWarn]}>
                      {t("modal.invoice_limit.ad.sub_limit_template").replace("{time}", dailyResetIn)}
                    </Text>
                  ) : (
                    <Text style={s.adBtnSub}>{t("modal.invoice_limit.ad.sub_loaded")}</Text>
                  )}
                </View>
              </View>
              {isDailyLimitHit ? (
                <View style={s.limitBadge}>
                  <Text style={s.limitBadgeText}>{t("modal.invoice_limit.limit_badge")}</Text>
                </View>
              ) : (
                <AdState />
              )}
            </View>
          </TouchableOpacity>

          {/* ── Chiudi (conseguenza trasparente) ──────────────────────── */}
          <TouchableOpacity
            onPress={onClose}
            style={s.closeLink}
            accessibilityRole="button"
            accessibilityLabel={t("modal.invoice_limit.close.a11y")}
          >
            <Text style={s.closeLinkText}>
              {t("modal.invoice_limit.close.text")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1e2029',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2d2f3a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  icon: { fontSize: 52 },
  badgeWrap: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: '#1e2029',
    borderRadius: 12,
    padding: 2,
  },
  badgeIcon: { fontSize: 18 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0f0f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e2029',
    marginBottom: 16,
  },

  // ── Pro button (PRIMARY) ──────────────────────────────────────────────
  proBtn: {
    backgroundColor: '#f59e0b18',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b55',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  proBtnIcon: { fontSize: 28, marginTop: 2 },
  proBtnText: { flex: 1 },
  proBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 10,
  },
  proFeatureList: {
    gap: 6,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proFeatureCheck: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  proFeatureItem: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },

  // ── Ad button (SECONDARY) ─────────────────────────────────────────────
  adBtn: {
    backgroundColor: '#1a1030',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6c63ff33',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  adBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adBtnIcon: { fontSize: 28 },
  adBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f0f2',
    marginBottom: 2,
  },
  adBtnSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  freeBadge: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c63ff',
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c63ff',
    letterSpacing: 0.5,
  },

  // ── Ad state components ───────────────────────────────────────────────
  adStateWrap: {
    alignItems: 'center',
    gap: 4,
  },
  adStateLoading: {
    fontSize: 11,
    color: '#6c63ff',
  },
  adStateUnavailable: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  adStateHint: {
    fontSize: 10,
    color: '#6b7280',
  },
  adStateError: {
    fontSize: 12,
    color: '#fca5a5',
    fontWeight: '600',
  },
  retryPill: {
    backgroundColor: '#6c63ff22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c63ff44',
  },
  retryPillText: {
    fontSize: 11,
    color: '#6c63ff',
    fontWeight: '600',
  },

  // ── Daily progress ─────────────────────────────────────────────────────
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dailyLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dailyReset: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1e2029',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#6c63ff',
    borderRadius: 2,
  },

  // ── Limit badge ────────────────────────────────────────────────────────
  limitBadge: {
    backgroundColor: '#ef444422',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  limitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  adBtnSubWarn: {
    color: '#f59e0b',
  },

  // ── Close link ────────────────────────────────────────────────────────
  closeLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeLinkText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
