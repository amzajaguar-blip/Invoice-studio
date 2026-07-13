/**
 * PremiumPreview.tsx — Premium Preview screen
 *
 * Mostra i benefici del piano Premium con una UI professionale e convincente.
 * Nessun fake urgency, nessun countdown, nessun dark pattern (Requirements 20.3, 20.4, 20.5).
 *
 * - Lista benefici Premium chiari e completi
 * - Feature locked preview: card con overlay dim/blurred visuale
 * - Primary CTA "Upgrade Now" → naviga a ProUpgrade, traccia `premium_clicked`
 * - Non blocca navigazione: dismiss/back torna alla schermata precedente
 * - Pulsante "Chiudi" / back navigation
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trackEvent } from "@/lib/analytics-events";
import { useLocale } from "@/components/LocaleProvider";

// ─── Dati benefici Premium ────────────────────────────────────────────────────

interface Benefit {
  emoji: string;
  title: string;
  description: string;
}

// ─── Dati feature locked preview ─────────────────────────────────────────────

interface LockedFeature {
  emoji: string;
  label: string;
}

// ─── Componenti ───────────────────────────────────────────────────────────────

function BenefitRow({ benefit, a11yLabel }: { benefit: Benefit; a11yLabel: string }) {
  return (
    <View
      style={s.benefitRow}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      <View style={s.benefitIconContainer}>
        <Text style={s.benefitEmoji}>{benefit.emoji}</Text>
      </View>
      <View style={s.benefitTextContainer}>
        <Text style={s.benefitTitle}>{benefit.title}</Text>
        <Text style={s.benefitDescription}>{benefit.description}</Text>
      </View>
      <Text style={s.checkMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        ✓
      </Text>
    </View>
  );
}

function LockedFeatureCard({ feature, a11yLabel }: { feature: LockedFeature; a11yLabel: string }) {
  return (
    <View style={s.lockedCard} accessibilityLabel={a11yLabel}>
      {/* Contenuto della card (sfumato/dimmed) */}
      <View style={s.lockedCardContent}>
        <Text style={s.lockedEmoji}>{feature.emoji}</Text>
        <Text style={s.lockedLabel}>{feature.label}</Text>
      </View>
      {/* Overlay dim */}
      <View style={s.lockedOverlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={s.lockIcon}>🔒</Text>
      </View>
    </View>
  );
}

// ─── Schermata principale ─────────────────────────────────────────────────────

export default function PremiumPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  const PREMIUM_BENEFITS: Benefit[] = [
    {
      emoji: "📄",
      title: t("modal.premium_preview.benefit.unlimited_invoices.title"),
      description: t("modal.premium_preview.benefit.unlimited_invoices.desc"),
    },
    {
      emoji: "👥",
      title: t("modal.premium_preview.benefit.unlimited_clients.title"),
      description: t("modal.premium_preview.benefit.unlimited_clients.desc"),
    },
    {
      emoji: "📝",
      title: t("modal.premium_preview.benefit.unlimited_quotes.title"),
      description: t("modal.premium_preview.benefit.unlimited_quotes.desc"),
    },
    {
      emoji: "🎨",
      title: t("modal.premium_preview.benefit.pdf_templates.title"),
      description: t("modal.premium_preview.benefit.pdf_templates.desc"),
    },
    {
      emoji: "☁️",
      title: t("modal.premium_preview.benefit.cloud_sync.title"),
      description: t("modal.premium_preview.benefit.cloud_sync.desc"),
    },
    {
      emoji: "🎯",
      title: t("modal.premium_preview.benefit.support.title"),
      description: t("modal.premium_preview.benefit.support.desc"),
    },
    {
      emoji: "🚫",
      title: t("modal.premium_preview.benefit.no_ads.title"),
      description: t("modal.premium_preview.benefit.no_ads.desc"),
    },
  ];

  const LOCKED_FEATURES: LockedFeature[] = [
    { emoji: "📊", label: t("modal.premium_preview.locked.analytics") },
    { emoji: "🔄", label: t("modal.premium_preview.locked.export") },
    { emoji: "📬", label: t("modal.premium_preview.locked.email") },
    { emoji: "🏷️", label: t("modal.premium_preview.locked.templates") },
  ];

  // Nessun tracking al mount — questa schermata è informativa, non aggressiva.
  // Il tracking avviene solo quando l'utente sceglie di fare upgrade.

  const handleUpgrade = () => {
    // Requirement 15.3: traccia `premium_clicked` prima di navigare
    trackEvent({ event: "premium_clicked", properties: { source: "premium_preview" } });
    // Requirement 15.3: naviga a ProUpgrade
    router.push("/(app)/ProUpgrade");
  };

  const handleClose = () => {
    // Requirement 15.4: il dismiss/back torna alla schermata precedente, non blocca
    router.back();
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header con pulsante Chiudi */}
      <View style={s.header}>
        <View style={s.headerLeft} />
        <Text style={s.headerTitle}>{t("modal.premium_preview.header_title")}</Text>
        <TouchableOpacity
          style={s.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("modal.premium_preview.close.a11y")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.heroSection}>
          <Text style={s.heroEmoji}>{t("modal.premium_preview.hero.emoji")}</Text>
          <Text style={s.heroTitle}>{t("modal.premium_preview.hero.title")}</Text>
          <Text style={s.heroSubtitle}>
            {t("modal.premium_preview.hero.subtitle")}
          </Text>
        </View>

        {/* Feature locked preview */}
        <View style={s.lockedSection}>
          <Text style={s.sectionLabel}>{t("modal.premium_preview.section.locked")}</Text>
          <View style={s.lockedGrid} accessibilityRole="list" accessibilityLabel={t("modal.premium_preview.locked.a11y")}>
            {LOCKED_FEATURES.map((feature) => (
              <LockedFeatureCard
                key={feature.label}
                feature={feature}
                a11yLabel={t("modal.premium_preview.lock_a11y_template").replace("{label}", feature.label)}
              />
            ))}
          </View>
        </View>

        {/* Lista benefici */}
        <View style={s.benefitsSection}>
          <Text style={s.sectionLabel}>{t("modal.premium_preview.section.benefits")}</Text>
          <View
            style={s.benefitsCard}
            accessibilityRole="list"
            accessibilityLabel={t("modal.premium_preview.benefits.a11y")}
          >
            {PREMIUM_BENEFITS.map((benefit, index) => (
              <React.Fragment key={benefit.title}>
                <BenefitRow
                  benefit={benefit}
                  a11yLabel={t("modal.premium_preview.benefit_a11y_template").replace("{title}", benefit.title).replace("{description}", benefit.description)}
                />
                {index < PREMIUM_BENEFITS.length - 1 && (
                  <View style={s.benefitDivider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Trust signals */}
        <View style={s.trustSection}>
          <Text style={s.trustText}>{t("modal.premium_preview.trust.secure")}</Text>
          <Text style={s.trustText}>{t("modal.premium_preview.trust.cancel_anytime")}</Text>
          <Text style={s.trustText}>{t("modal.premium_preview.trust.no_lockin")}</Text>
        </View>

        {/* Spazio extra per il CTA fisso */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CTA fisso in basso */}
      <View style={[s.ctaContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={s.ctaButton}
          onPress={handleUpgrade}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("modal.premium_preview.cta.a11y")}
          accessibilityHint={t("modal.premium_preview.cta.a11y_hint")}
        >
          <Text style={s.ctaText}>{t("modal.premium_preview.cta.text")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.dismissButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("modal.premium_preview.dismiss.text")}
        >
          <Text style={s.dismissText}>{t("modal.premium_preview.dismiss.text")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2029",
  },
  headerLeft: {
    width: 32, // Bilancia il pulsante chiudi per centrare il titolo
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f0f0f2",
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e2029",
    borderRadius: 16,
  },
  closeButtonText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: "serif",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Locked features grid
  lockedSection: {
    marginBottom: 28,
  },
  lockedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  lockedCard: {
    width: "47%",
    backgroundColor: "#111318",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e2029",
    padding: 16,
    position: "relative",
    overflow: "hidden",
    minHeight: 80,
  },
  lockedCardContent: {
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.25, // Effetto dim — contenuto bloccato
  },
  lockedEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  lockedLabel: {
    fontSize: 13,
    color: "#f0f0f2",
    fontWeight: "600",
    flex: 1,
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 22,
  },

  // Benefits list
  benefitsSection: {
    marginBottom: 24,
  },
  benefitsCard: {
    backgroundColor: "#111318",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e2029",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1e2029",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  benefitEmoji: {
    fontSize: 18,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f0f0f2",
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 17,
  },
  checkMark: {
    color: "#a78bfa",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  benefitDivider: {
    height: 1,
    backgroundColor: "#1e2029",
    marginHorizontal: 0,
  },

  // Trust signals
  trustSection: {
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  trustText: {
    color: "#6b7280",
    fontSize: 13,
  },

  // CTA fisso in basso
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0a0b0f",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1e2029",
  },
  ctaButton: {
    backgroundColor: "#a78bfa",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  ctaText: {
    color: "#0a0b0f",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dismissText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
