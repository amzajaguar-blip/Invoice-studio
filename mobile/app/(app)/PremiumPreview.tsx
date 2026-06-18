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

// ─── Dati benefici Premium ────────────────────────────────────────────────────

interface Benefit {
  emoji: string;
  title: string;
  description: string;
}

const PREMIUM_BENEFITS: Benefit[] = [
  {
    emoji: "📄",
    title: "Fatture illimitate",
    description: "Crea tutte le fatture che vuoi, ogni mese, senza limiti.",
  },
  {
    emoji: "👥",
    title: "Clienti illimitati",
    description: "Gestisci un portfolio clienti senza restrizioni.",
  },
  {
    emoji: "📝",
    title: "Preventivi illimitati",
    description: "Prepara e invia tutti i preventivi che ti servono.",
  },
  {
    emoji: "🎨",
    title: "Template PDF illimitati",
    description: "Accedi a tutti i template professionali per i tuoi documenti.",
  },
  {
    emoji: "☁️",
    title: "Cloud sync",
    description: "I tuoi dati sincronizzati su tutti i tuoi dispositivi.",
  },
  {
    emoji: "🎯",
    title: "Supporto prioritario",
    description: "Risposte rapide quando hai bisogno di aiuto.",
  },
  {
    emoji: "🚫",
    title: "Nessuna pubblicità",
    description: "Un'esperienza pulita, senza interruzioni pubblicitarie.",
  },
];

// ─── Dati feature locked preview ─────────────────────────────────────────────

interface LockedFeature {
  emoji: string;
  label: string;
}

const LOCKED_FEATURES: LockedFeature[] = [
  { emoji: "📊", label: "Analytics avanzate" },
  { emoji: "🔄", label: "Esportazione dati" },
  { emoji: "📬", label: "Invio email diretto" },
  { emoji: "🏷️", label: "Template personalizzati" },
];

// ─── Componenti ───────────────────────────────────────────────────────────────

function BenefitRow({ benefit }: { benefit: Benefit }) {
  return (
    <View
      style={s.benefitRow}
      accessibilityRole="text"
      accessibilityLabel={`${benefit.title}: ${benefit.description}`}
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

function LockedFeatureCard({ feature }: { feature: LockedFeature }) {
  return (
    <View style={s.lockedCard} accessibilityLabel={`Funzione bloccata: ${feature.label}`}>
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
        <Text style={s.headerTitle}>✨ Premium</Text>
        <TouchableOpacity
          style={s.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Chiudi anteprima Premium"
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
          <Text style={s.heroEmoji}>🚀</Text>
          <Text style={s.heroTitle}>Porta il tuo business al livello successivo</Text>
          <Text style={s.heroSubtitle}>
            Tutte le funzionalità di cui hai bisogno per fatturare senza limiti e gestire il tuo business da professionista.
          </Text>
        </View>

        {/* Feature locked preview */}
        <View style={s.lockedSection}>
          <Text style={s.sectionLabel}>FUNZIONI PREMIUM</Text>
          <View style={s.lockedGrid} accessibilityRole="list" accessibilityLabel="Funzioni Premium bloccate">
            {LOCKED_FEATURES.map((feature) => (
              <LockedFeatureCard key={feature.label} feature={feature} />
            ))}
          </View>
        </View>

        {/* Lista benefici */}
        <View style={s.benefitsSection}>
          <Text style={s.sectionLabel}>COSA INCLUDE PREMIUM</Text>
          <View
            style={s.benefitsCard}
            accessibilityRole="list"
            accessibilityLabel="Lista completa dei benefici Premium"
          >
            {PREMIUM_BENEFITS.map((benefit, index) => (
              <React.Fragment key={benefit.title}>
                <BenefitRow benefit={benefit} />
                {index < PREMIUM_BENEFITS.length - 1 && (
                  <View style={s.benefitDivider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Trust signals */}
        <View style={s.trustSection}>
          <Text style={s.trustText}>🔒 Pagamento sicuro via Google Play</Text>
          <Text style={s.trustText}>Annulla quando vuoi</Text>
          <Text style={s.trustText}>Nessun vincolo a lungo termine</Text>
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
          accessibilityLabel="Passa a Premium"
          accessibilityHint="Apre la schermata di acquisto del piano Premium"
        >
          <Text style={s.ctaText}>Upgrade Now ✨</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.dismissButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Continua con il piano gratuito"
        >
          <Text style={s.dismissText}>Continua con il piano gratuito</Text>
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
