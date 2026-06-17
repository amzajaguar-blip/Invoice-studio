import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ToastConfig, ToastContext } from "@/lib/toast";

// ─── Colori per tipo ───────────────────────────────────────────────────────────

const TOAST_COLORS = {
  success: {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.3)",
    text: "#22c55e",
  },
  error: {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    text: "#ef4444",
  },
  info: {
    bg: "rgba(108,99,255,0.12)",
    border: "rgba(108,99,255,0.3)",
    text: "#6c63ff",
  },
} as const;

// ─── Costanti animazione ───────────────────────────────────────────────────────

const SLIDE_HIDDEN = -60;
const SLIDE_VISIBLE = 0;
const ANIMATION_DURATION = 250;

// ─── Componente ───────────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();

  // Toast corrente (null = nessun toast visibile)
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);

  // Animated values per slide + fade
  const translateY = useRef(new Animated.Value(SLIDE_HIDDEN)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Ref per il timeout di auto-dismiss
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref per tracciare se reduce motion è attivo
  const reduceMotionRef = useRef(false);

  // Controlla reduce motion all'avvio
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
  }, []);

  // ─── Animazione entrata ────────────────────────────────────────────────────

  const animateIn = useCallback(() => {
    if (reduceMotionRef.current) {
      // Senza animazione: mostra direttamente
      translateY.setValue(SLIDE_VISIBLE);
      opacity.setValue(1);
      return;
    }

    translateY.setValue(SLIDE_HIDDEN);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SLIDE_VISIBLE,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  // ─── Animazione uscita ─────────────────────────────────────────────────────

  const animateOut = useCallback(
    (onComplete?: () => void) => {
      if (reduceMotionRef.current) {
        // Senza animazione: nasconde direttamente
        translateY.setValue(SLIDE_HIDDEN);
        opacity.setValue(0);
        onComplete?.();
        return;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SLIDE_HIDDEN,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onComplete?.();
      });
    },
    [translateY, opacity]
  );

  // ─── showToast ─────────────────────────────────────────────────────────────

  const showToast = useCallback(
    (config: ToastConfig) => {
      // Cancella il timer di dismiss precedente
      if (dismissTimer.current !== null) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }

      // Se c'è già un toast visibile, lo sostituisce immediatamente
      setCurrentToast(config);
      animateIn();

      // Programma l'auto-dismiss
      const duration = config.duration ?? 3000;
      dismissTimer.current = setTimeout(() => {
        animateOut(() => {
          setCurrentToast(null);
        });
        dismissTimer.current = null;
      }, duration);
    },
    [animateIn, animateOut]
  );

  // Cleanup al dismount
  useEffect(() => {
    return () => {
      if (dismissTimer.current !== null) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  // ─── Colori del toast corrente ─────────────────────────────────────────────

  const colors = currentToast
    ? TOAST_COLORS[currentToast.type]
    : TOAST_COLORS.info;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {currentToast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: insets.top + 10,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={currentToast.message}
          pointerEvents="none"
        >
          <Text style={[styles.toastText, { color: colors.text }]}>
            {currentToast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ─── Stili ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // Ombra sottile per dare profondità
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
