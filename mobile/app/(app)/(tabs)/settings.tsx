/**
 * settings.tsx — Schermata Impostazioni
 *
 * Phase 2 V34 integration:
 *  - Sezione "Piano": badge Premium Attivo o link Passa a Premium (Req 3.7)
 *  - InAppContextualCard per context 'settings_review_ask' (Req 9.8)
 *  - BannerAdWrapper in fondo alla schermata solo se !isPremium (Req 9.8, 4.1)
 *  - Tip card onboarding per nuovi utenti (Req 17.4)
 *
 * Requirements: 3.7, 9.8, 17.4
 */

import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications-service";
import { apiFetch } from "@/lib/ai";
import { useLocale, AVAILABLE_LOCALES } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// V34 — plan, smart cards, banner
import { usePlan } from "@/context/PlanContext";
import { BannerAdWrapper } from "@/components/BannerAdWrapper";
import InAppContextualCard from "@/components/InAppContextualCard";
import { useSmartCards } from "@/hooks/useSmartCards";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const { locale, setLocale, t } = useLocale();
  const { showToast } = useToast();

  // V34 — piano corrente
  const { isPremium, limits } = usePlan();

  // V34 — contextual card 'settings_review_ask' (Req 9.8)
  const { card: contextCard, dismiss: dismissCard } = useSmartCards("settings_review_ask");

  // V34 — tip card onboarding: mostrata solo se l'utente è nuovo (Req 17.4)
  // "Nuovo utente" = non ha ancora creato fatture (totalInvoices === 0)
  const isNewUser = limits.invoices.used === 0 && !limits.isLoading;

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  const toggle = async (key: keyof NotificationSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await updateNotificationSettings({ [key]: !settings[key] });
  };

  const handleSignOut = () => {
    Alert.alert("Esci?", "Vuoi disconnetterti da InvoiceStudio?", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: signOut },
    ]);
  };

  const executeDeleteAccount = async () => {
    try {
      const { error } = await apiFetch("/api/profile", {
        method: "DELETE",
      });

      if (error) {
        Alert.alert("Errore", error || "Impossibile eliminare l'account in questo momento.");
        return;
      }

      await signOut();
      Alert.alert("Account eliminato", "Il tuo account è stato eliminato con successo.");
    } catch (err) {
      Alert.alert("Errore", "Si è verificato un errore di rete.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Elimina account",
      "Sei sicuro di voler eliminare permanentemente il tuo account? Tutti i tuoi dati, fatture e clienti verranno cancellati in modo irreversibile.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Procedi",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Conferma finale",
              "Questa è l'ultima conferma. Se procedi, il tuo account verrà eliminato definitivamente e verrai disconnesso.",
              [
                { text: "Annulla", style: "cancel" },
                {
                  text: "Sì, elimina",
                  style: "destructive",
                  onPress: executeDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

  // V34 — contextual card CTA handler (settings_review_ask → open review)
  const handleCardCTA = useCallback(() => {
    // La CTA 'open_review' è gestita dalla card; per ora naviga a ProUpgrade
    // se il context fosse 'show_upgrade', altrimenti è già nel design dismissible
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top }}
    >
      <Text style={styles.title}>{t("settings_title")}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {/* V34 — Tip card onboarding per nuovi utenti (Req 17.4) */}
      {isNewUser && (
        <View style={styles.onboardingTip}>
          <Ionicons name="bulb-outline" size={22} color="#6c63ff" style={styles.onboardingTipIcon} />
          <View style={styles.onboardingTipText}>
            <Text style={styles.onboardingTipTitle}>{t("configure_profile")}</Text>
            <Text style={styles.onboardingTipBody}>
              {t("personalize_studio")}
            </Text>
          </View>
        </View>
      )}

      {/* V34 — Sezione Piano (Req 3.7) */}
      <Text style={styles.sectionTitle}>{t("plan")}</Text>
      <View style={styles.card}>
        {isPremium ? (
          /* Piano Premium attivo: badge e supporto prioritario */
          <View style={styles.premiumContainer}>
            <View style={styles.premiumBadgeRow}>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>{t("premium_active")}</Text>
              </View>
            </View>
            <View style={styles.premiumFeatureRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#6c63ff" style={styles.premiumFeatureIcon} />
              <Text style={styles.premiumFeatureText}>{t("priority_support")}</Text>
            </View>
          </View>
        ) : (
          /* Piano gratuito: link Passa a Premium */
          <TouchableOpacity
            style={styles.upgradeRow}
            onPress={() => router.push("/(app)/ProUpgrade" as never)}
            accessibilityRole="button"
            accessibilityLabel="Passa a Premium — Rimuovi tutti i limiti"
          >
            <View style={styles.upgradeTextBlock}>
              <Text style={styles.upgradeTitle}>{t("upgrade_premium")}</Text>
              <Text style={styles.upgradeSubtitle}>{t("remove_limits")}</Text>
            </View>
            <View style={styles.upgradeBadge}>
              <Text style={styles.upgradeBadgeText}>{t("free")}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* V34 — InAppContextualCard per settings_review_ask (Req 9.8) */}
      {contextCard !== null && (
        <View style={styles.contextCardWrapper}>
          <InAppContextualCard
            card={contextCard}
            onDismiss={dismissCard}
            onCTA={handleCardCTA}
          />
        </View>
      )}

      {/* Notifiche */}
      <Text style={styles.sectionTitle}>{t("notifications")}</Text>
      <View style={styles.card}>
        <ToggleRow
          label={t("push_notifications")}
          value={settings?.pushEnabled ?? true}
          onToggle={() => toggle("pushEnabled")}
        />
        <ToggleRow
          label={t("payment_reminders")}
          value={settings?.reminderAlerts ?? true}
          onToggle={() => toggle("reminderAlerts")}
        />
        <ToggleRow
          label={t("overdue_alerts")}
          value={settings?.overdueAlerts ?? true}
          onToggle={() => toggle("overdueAlerts")}
        />
        <ToggleRow
          label={t("payment_alerts")}
          value={settings?.paymentAlerts ?? true}
          onToggle={() => toggle("paymentAlerts")}
        />
      </View>

      {/* Lingua */}
      <Text style={styles.sectionTitle}>{t("language")}</Text>
      <View style={styles.card}>
        {AVAILABLE_LOCALES.map((loc, index) => (
          <TouchableOpacity
            key={loc.code}
            style={[
              styles.localeRow,
              index < AVAILABLE_LOCALES.length - 1 && styles.localeRowBorder,
            ]}
            onPress={async () => {
              await setLocale(loc.code);
              showToast({ message: "Lingua aggiornata ✓", type: "success" });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Seleziona lingua ${loc.name}`}
          >
            <Text style={styles.localeText}>
              {loc.flag} {loc.name}
            </Text>
            {locale === loc.code && (
              <Text style={styles.localeCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>{t("account")}</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>{t("logout")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.deleteButton]}
        onPress={handleDeleteAccount}
      >
        <Text style={[styles.buttonText, styles.deleteText]}>{t("deleteAccount")}</Text>
      </TouchableOpacity>

      {/* V34 — BannerAdWrapper in fondo, solo se !isPremium (Req 9.8, 4.1) */}
      {!isPremium && (
        <BannerAdWrapper screen="settings" style={styles.bannerAd} />
      )}
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#1e2029", true: "#6c63ff" }}
        thumbColor={value ? "#fff" : "#9ca3af"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  email: { fontSize: 14, color: "#9ca3af", marginTop: 4, marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e2029",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14, color: "#f0f0f2" },
  button: {
    backgroundColor: "#1e2029",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#f0f0f2" },
  deleteButton: {
    backgroundColor: "rgba(220,38,38,0.1)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
  },
  deleteText: { color: "#dc2626" },
  localeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  localeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#1e2029",
  },
  localeText: { fontSize: 15, color: "#f0f0f2" },
  localeCheck: { fontSize: 15, color: "#6c63ff", fontWeight: "700" },

  // ─── V34 — Onboarding Tip (Req 17.4) ──────────────────────────────────────
  onboardingTip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e2029",
    borderLeftWidth: 3,
    borderLeftColor: "#6c63ff",
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  onboardingTipIcon: {
    marginRight: 12,
  },
  onboardingTipText: {
    flex: 1,
    gap: 2,
  },
  onboardingTipTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f0f0f2",
    lineHeight: 18,
  },
  onboardingTipBody: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 16,
  },

  // ─── V34 — Piano Section (Req 3.7) ────────────────────────────────────────
  premiumContainer: {
    gap: 10,
  },
  premiumBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  premiumBadge: {
    backgroundColor: "#6c63ff20",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#6c63ff50",
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#a78bfa",
  },
  premiumFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  premiumFeatureIcon: {
    marginRight: 8,
  },
  premiumFeatureText: {
    fontSize: 14,
    color: "#f0f0f2",
    fontWeight: "500",
  },

  upgradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  upgradeTextBlock: {
    gap: 2,
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6c63ff",
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
  },
  upgradeBadge: {
    backgroundColor: "#1e2029",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2d2f3a",
  },
  upgradeBadgeText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },

  // ─── V34 — Contextual Card wrapper ────────────────────────────────────────
  contextCardWrapper: {
    marginBottom: 8,
  },

  // ─── V34 — Banner Ad ──────────────────────────────────────────────────────
  bannerAd: {
    marginTop: 8,
    marginBottom: 4,
  },
});
