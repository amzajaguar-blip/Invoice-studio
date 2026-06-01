/**
 * Milo Design System — Mobile ThemeContext
 * ==========================================
 * Provides a React context that:
 *  1. Detects the system colour scheme via Appearance API
 *  2. Allows manual override, persisted via AsyncStorage
 *  3. Injects the resolved COLORS object into the component tree
 *  4. Listens for OS-level theme changes while the app is active
 *
 * Usage:
 *   const { colors, resolvedTheme, toggleTheme } = useTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DARK_COLORS,
  LIGHT_COLORS,
  MOTION,
  SIZES,
  makeShadows,
  getSystemColorScheme,
} from "../constants/theme";

// ── Widened colour union type ──────────────────────────────────────────────
// Using `typeof DARK_COLORS | typeof LIGHT_COLORS` would cause literal-type
// mismatch errors when assigning either object. We widen to a string-indexed
// version so TS accepts either palette without complaints.

type Colors = {
  [K in keyof typeof DARK_COLORS]: string;
};

// ── Public types ───────────────────────────────────────────────────────────

export type ThemeMode    = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

interface ThemeContextValue {
  /** Stored preference ("dark" | "light" | "system") */
  theme: ThemeMode;
  /** Resolved value applied to the UI */
  resolvedTheme: ResolvedTheme;
  /** Colour token set for the current resolved theme */
  colors: Colors;
  /** Design constants — avoids importing constants/theme directly */
  sizes: typeof SIZES;
  motion: typeof MOTION;
  shadows: ReturnType<typeof makeShadows>;
  /** Set a specific preference */
  setTheme: (mode: ThemeMode) => void;
  /** Flip between dark and light */
  toggleTheme: () => void;
}

// ── Storage key ────────────────────────────────────────────────────────────

const STORAGE_KEY = "milo-theme-preference";

// ── Context ────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const mode = (stored as ThemeMode | null) ?? "dark";
      const resolved: ResolvedTheme =
        mode === "system" ? getSystemColorScheme() : mode;
      setThemeState(mode);
      setResolvedTheme(resolved);
    });
  }, []);

  // Listen for OS theme changes (system mode only)
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === "system") {
        setResolvedTheme(colorScheme === "light" ? "light" : "dark");
      }
    });
    return () => sub.remove();
  }, [theme]);

  // Setters
  const setTheme = useCallback((mode: ThemeMode) => {
    const resolved: ResolvedTheme =
      mode === "system" ? getSystemColorScheme() : mode;
    setThemeState(mode);
    setResolvedTheme(resolved);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Resolved token set
  const colors: Colors =
    resolvedTheme === "light"
      ? (LIGHT_COLORS as unknown as Colors)
      : (DARK_COLORS as unknown as Colors);
  const shadows = makeShadows(
    resolvedTheme === "light" ? LIGHT_COLORS : DARK_COLORS
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        colors,
        sizes: SIZES,
        motion: MOTION,
        shadows,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
