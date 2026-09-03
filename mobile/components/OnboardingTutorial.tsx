/**
 * OnboardingTutorial.tsx — breve tutorial a 3 passi mostrato una sola volta,
 * al primo avvio dopo il login, per rendere l'app più immersiva per chi la
 * apre per la prima volta.
 *
 * Auto-contenuto: legge/scrive da solo il flag AsyncStorage
 * `onboarding_tutorial_seen_v1` e decide da solo se mostrarsi — il
 * chiamante lo monta e basta (stesso pattern di mount-and-forget di
 * lib/review-prompt.ts in app/(app)/_layout.tsx). Il suffisso `_v1`
 * permette di far ricomparire il tutorial per tutti in futuro incrementando
 * la versione, senza toccare la logica.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocale } from "@/components/LocaleProvider";

const SEEN_KEY = "onboarding_tutorial_seen_v1";

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const STEPS: Step[] = [
  { icon: "scan-outline", titleKey: "onboarding_tour.step1.title", bodyKey: "onboarding_tour.step1.body" },
  { icon: "sparkles-outline", titleKey: "onboarding_tour.step2.title", bodyKey: "onboarding_tour.step2.body" },
  { icon: "share-outline", titleKey: "onboarding_tour.step3.title", bodyKey: "onboarding_tour.step3.body" },
];

export function OnboardingTutorial() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={s.card}>
          <TouchableOpacity
            style={s.skipBtn}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding_tour.skip")}
          >
            <Text style={s.skipText}>{t("onboarding_tour.skip")}</Text>
          </TouchableOpacity>

          <View style={s.iconContainer}>
            <Ionicons name={current.icon} size={32} color="#6c63ff" />
          </View>

          <Text style={s.title}>{t(current.titleKey)}</Text>
          <Text style={s.body}>{t(current.bodyKey)}</Text>

          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          <TouchableOpacity
            style={s.nextBtn}
            onPress={() => (isLast ? close() : setStep((n) => n + 1))}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t("onboarding_tour.start") : t("onboarding_tour.next")}
          >
            <Text style={s.nextBtnText}>{isLast ? t("onboarding_tour.start") : t("onboarding_tour.next")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#111318",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e2029",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  skipText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#6c63ff18",
    borderWidth: 1,
    borderColor: "#6c63ff30",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f0f2",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 22,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2e3040",
  },
  dotActive: {
    backgroundColor: "#6c63ff",
    width: 18,
  },
  nextBtn: {
    width: "100%",
    backgroundColor: "#6c63ff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
