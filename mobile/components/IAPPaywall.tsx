/**
 * IAPPaywall.tsx — Paywall IAP riutilizzabile per i 4 prodotti one-time.
 *
 * Mostra un bottom sheet con:
 *  - Nome e descrizione della feature
 *  - Prezzo caricato da RevenueCat (con fallback "—")
 *  - Pulsante Acquista → purchaseProduct() → onPurchaseSuccess()
 *  - Pulsante Ripristina acquisti → restorePurchases() → onPurchaseSuccess()
 *    o Alert se nessun acquisto trovato
 *  - Banner non bloccante per errore di rete entitlement
 *  - Pulsante X per onDismiss()
 *
 * VINCOLI CRITICI:
 *  - ZERO import da rate-limit-engine.ts o PlanContext.tsx
 *  - Usa esclusivamente funzioni da @/lib/iap-engine
 *
 * Requirements: 9.1, 9.3, 9.5, 9.6
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
  Alert,
  AccessibilityInfo,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/components/LocaleProvider';
import {
  purchaseProduct,
  restorePurchases,
  type IAPProductId,
} from '@/lib/iap-engine';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IAPPaywallProps {
  productId: IAPProductId;
  featureName: string;        // es. "Export Excel"
  featureDescription: string; // copy contestuale
  onPurchaseSuccess: () => void;
  onDismiss: () => void;
}

// ─── Icone per product ────────────────────────────────────────────────────────

const PRODUCT_ICON: Record<IAPProductId, keyof typeof Ionicons.glyphMap> = {
  'vela.template.premium': 'layers-outline',
  'vela.logo.custom':      'image-outline',
  'vela.export.excel':     'document-text-outline',
  'vela.backup.cloud':     'cloud-upload-outline',
};

// ─── Componente ───────────────────────────────────────────────────────────────

const { height } = Dimensions.get('window');

export default function IAPPaywall({
  productId,
  featureName,
  featureDescription,
  onPurchaseSuccess,
  onDismiss,
}: IAPPaywallProps) {
  const { t } = useLocale();

  // ─── Stato interno ─────────────────────────────────────────────────────
  const [priceString, setPriceString]     = useState<string | null>(null);
  const [priceLoading, setPriceLoading]   = useState(true);
  const [purchasing, setPurchasing]       = useState(false);
  const [restoring, setRestoring]         = useState(false);
  const [networkError, setNetworkError]   = useState(false);

  // ─── Animazioni (pattern identico a BusinessBoostModal) ────────────────
  const slideAnim  = useRef(new Animated.Value(height)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Animazione entrata al mount (il componente viene montato già visibile)
  useEffect(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // ─── Carica prezzo da RevenueCat al mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const allPackages = Object.values(offerings.all ?? {}).flatMap(
          (o) => o.availablePackages,
        );
        const pkg = allPackages.find(
          (p) =>
            p.product.identifier === productId ||
            p.product.identifier?.startsWith(productId),
        );
        if (!cancelled) {
          setPriceString(pkg?.product.priceString ?? null);
          setNetworkError(false);
        }
      } catch {
        if (!cancelled) {
          setNetworkError(true);
          setPriceString(null);
        }
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  // ─── Chiudi con animazione uscita ──────────────────────────────────────
  const handleDismiss = () => {
    if (reduceMotion) {
      onDismiss();
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  // ─── Acquisto ──────────────────────────────────────────────────────────
  const handlePurchase = async () => {
    if (purchasing || restoring) return;
    setPurchasing(true);
    try {
      const entitlement = await purchaseProduct(productId);
      if (entitlement.isActive) {
        onPurchaseSuccess();
      } else {
        // Acquisto completato ma entitlement non attivo (raro — errore RevenueCat)
        Alert.alert(
          t('modal.pro_upgrade.error.subscription_not_detected') ||
            "Acquisto completato ma entitlement non rilevato. Riavvia l'app.",
        );
      }
    } catch (err: unknown) {
      // Errore o cancellazione dell'acquisto
      const message =
        err instanceof Error ? err.message : t('modal.pro_upgrade.error.unknown');
      Alert.alert(message);
    } finally {
      setPurchasing(false);
    }
  };

  // ─── Ripristino acquisti ───────────────────────────────────────────────
  const handleRestore = async () => {
    if (purchasing || restoring) return;
    setRestoring(true);
    try {
      const state = await restorePurchases();
      const entitlement = state.entitlements[productId];
      if (entitlement?.isActive) {
        onPurchaseSuccess();
      } else {
        Alert.alert(
          t('modal.pro_upgrade.restore.not_found') ||
            'Nessun acquisto da ripristinare su questo account.',
        );
      }
    } catch {
      Alert.alert(
        t('modal.pro_upgrade.restore.error') ||
          'Errore durante il ripristino. Riprova.',
      );
    } finally {
      setRestoring(false);
    }
  };

  const iconName = PRODUCT_ICON[productId] ?? 'star-outline';
  const isLoading = purchasing || restoring;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={handleDismiss}
      accessibilityViewIsModal
      accessibilityLabel={featureName}
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        {/* Tap sull'overlay per chiudere */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityLabel={t('cancel') ?? 'Chiudi'}
        />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Pulsante X chiudi */}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('cancel') ?? 'Chiudi'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>

          {/* Icona feature */}
          <View style={s.iconWrap}>
            <View style={s.iconCircle}>
              <Ionicons
                name={iconName}
                size={36}
                color="#6c63ff"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </View>
          </View>

          {/* Titolo + descrizione */}
          <Text style={s.title}>{featureName}</Text>
          <Text style={s.subtitle}>{featureDescription}</Text>

          {/* Banner errore di rete — non bloccante */}
          {networkError && (
            <View style={s.networkBanner}>
              <Ionicons
                name="cloud-offline-outline"
                size={14}
                color="#9ca3af"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={s.networkBannerText}>
                Verifica acquisti non disponibile — dati locali in uso
              </Text>
            </View>
          )}

          <View style={s.divider} />

          {/* Pulsante Acquista */}
          <TouchableOpacity
            style={[s.purchaseBtn, isLoading && s.btnDisabled]}
            onPress={handlePurchase}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              priceLoading
                ? `Acquista ${featureName}`
                : `Acquista ${featureName} — ${priceString ?? '—'}`
            }
            accessibilityState={{ disabled: isLoading }}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={s.purchaseBtnContent}>
                <Text style={s.purchaseBtnText}>
                  Acquista
                </Text>
                {priceLoading ? (
                  <ActivityIndicator size="small" color="#c4bcff" />
                ) : (
                  <View style={s.priceBadge}>
                    <Text style={s.priceBadgeText}>
                      {priceString ?? '—'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Pulsante Ripristina acquisti */}
          <TouchableOpacity
            style={[s.restoreBtn, isLoading && s.btnDisabled]}
            onPress={handleRestore}
            disabled={isLoading}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              t('modal.pro_upgrade.restore.a11y') ?? 'Ripristina acquisti precedenti'
            }
            accessibilityState={{ disabled: isLoading }}
          >
            {restoring ? (
              <ActivityIndicator size="small" color="#6c63ff" />
            ) : (
              <Text style={s.restoreBtnText}>
                {t('modal.pro_upgrade.restore.text') ?? 'Ripristina acquisti'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Nota sicurezza */}
          <View style={s.trustRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={12}
              color="#6b7280"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text style={s.trustText}>
              {t('modal.pro_upgrade.trust.secure') ?? 'Pagamento sicuro via Google Play'}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

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
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 4,
  },

  // ── Icona feature ─────────────────────────────────────────────────────
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6c63ff18',
    borderWidth: 1,
    borderColor: '#6c63ff33',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Testo ─────────────────────────────────────────────────────────────
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
    marginBottom: 16,
  },

  // ── Banner errore rete ────────────────────────────────────────────────
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e2029',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2f3a',
  },
  networkBannerText: {
    fontSize: 12,
    color: '#9ca3af',
    flex: 1,
    lineHeight: 16,
  },

  divider: {
    height: 1,
    backgroundColor: '#1e2029',
    marginBottom: 20,
  },

  // ── Pulsante Acquista ─────────────────────────────────────────────────
  purchaseBtn: {
    backgroundColor: '#6c63ff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 54,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  purchaseBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  purchaseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  priceBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // ── Pulsante Ripristina ───────────────────────────────────────────────
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
  restoreBtnText: {
    fontSize: 14,
    color: '#6c63ff',
    fontWeight: '500',
  },

  // ── Nota sicurezza ────────────────────────────────────────────────────
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  trustText: {
    fontSize: 11,
    color: '#6b7280',
  },
});
