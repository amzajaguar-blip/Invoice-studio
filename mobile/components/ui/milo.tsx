/**
 * Milo Design System — React Native Primitive Components
 * =======================================================
 * MiloButton      — primary, secondary, ghost variants
 * MiloCard        — premium surface card
 * MiloStatusBadge — token-driven status pill
 * MiloDivider     — horizontal separator
 * MiloSpinner     — loading indicator
 * MiloEmptyState  — empty screen placeholder
 *
 * All components consume useTheme() for colours —
 * they automatically adapt to dark/light mode.
 *
 * Rules:
 *  - Never use DARK_COLORS/LIGHT_COLORS directly — always useTheme().colors
 *  - Never use hardcoded hex strings
 *  - Use SIZES / MOTION from theme for consistent spacing/motion
 */

import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../hooks/ThemeContext";
import { useLocale } from "../LocaleProvider";

// ── TYPES ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize    = "sm" | "md" | "lg";
type BadgeVariant  = "paid" | "pending" | "overdue" | "draft" | "pro" | "default";

// ── MILO BUTTON ────────────────────────────────────────────────────────────

interface MiloButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  id?: string;
}

export function MiloButton({
  variant = "primary",
  size = "md",
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
}: MiloButtonProps) {
  const { colors, sizes, motion } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: motion.duration.micro,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, motion]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  // Resolve colours per variant
  const bgColor = {
    primary:     colors.accent,
    secondary:   colors.surfaceSecondary,
    ghost:       "transparent",
    destructive: colors.statusOverdue,
  }[variant];

  const textColor = {
    primary:     "#ffffff",
    secondary:   colors.textPrimary,
    ghost:       colors.textSecondary,
    destructive: "#ffffff",
  }[variant];

  const borderColor = {
    primary:     "transparent",
    secondary:   colors.borderPrimary,
    ghost:       "transparent",
    destructive: "transparent",
  }[variant];

  const HEIGHT = { sm: 36, md: 48, lg: 56 }[size];
  const FONT   = { sm: 13, md: 15, lg: 17 }[size];
  const PH     = { sm: 12, md: 20, lg: 24 }[size];

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && { width: "100%" },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.buttonBase,
          {
            height: HEIGHT,
            paddingHorizontal: PH,
            backgroundColor: bgColor,
            borderColor,
            borderRadius: sizes.radiusMd,
            opacity: disabled ? 0.5 : 1,
          },
          fullWidth && { width: "100%" },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
            <Text
              style={[styles.buttonText, { color: textColor, fontSize: FONT }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── MILO CARD ──────────────────────────────────────────────────────────────

interface MiloCardProps {
  children: React.ReactNode;
  padding?: number;
  style?: object;
  glass?: boolean;
}

export function MiloCard({
  children,
  padding = 20,
  style,
  glass = false,
}: MiloCardProps) {
  const { colors, sizes, shadows } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: glass
            ? colors.surfaceOverlay
            : colors.surfacePrimary,
          borderRadius: sizes.radiusLg,
          borderWidth: 1,
          borderColor: glass ? colors.accentSubtle : colors.borderPrimary,
          padding,
          ...shadows.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── MILO STATUS BADGE ─────────────────────────────────────────────────────

interface MiloStatusBadgeProps {
  variant: BadgeVariant;
  label: string;
}

export function MiloStatusBadge({ variant, label }: MiloStatusBadgeProps) {
  const { colors } = useTheme();

  const COLOR_MAP: Record<BadgeVariant, { text: string; bg: string }> = {
    paid:        { text: colors.statusPaid,    bg: colors.statusPaidBg },
    pending:     { text: colors.statusPending, bg: colors.statusPendingBg },
    overdue:     { text: colors.statusOverdue, bg: colors.statusOverdueBg },
    draft:       { text: colors.statusDraft,   bg: colors.statusDraftBg },
    default:     { text: colors.textMuted,     bg: colors.surfaceSecondary },
    pro:         { text: colors.accent,        bg: colors.accentSubtle },
  };

  const { text, bg } = COLOR_MAP[variant];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: text,
        }}
      />
      <Text
        style={{ color: text, fontSize: 12, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── MILO DIVIDER ──────────────────────────────────────────────────────────

export function MiloDivider({
  label,
  style,
}: {
  label?: string;
  style?: object;
}) {
  const { colors } = useTheme();

  if (!label) {
    return (
      <View
        style={[{ height: 1, backgroundColor: colors.borderPrimary }, style]}
      />
    );
  }

  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 12 },
        style,
      ]}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderPrimary }} />
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderPrimary }} />
    </View>
  );
}

// ── MILO SPINNER ──────────────────────────────────────────────────────────

export function MiloSpinner({
  size = 24,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  return (
    <ActivityIndicator
      size={size > 30 ? "large" : "small"}
      color={color ?? colors.accent}
      accessibilityLabel={t("milo.spinner.a11y")}
    />
  );
}

// ── MILO EMPTY STATE ──────────────────────────────────────────────────────

interface MiloEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: object;
}

export function MiloEmptyState({
  icon = "📄",
  title,
  description,
  action,
  style,
}: MiloEmptyStateProps) {
  const { colors, sizes } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 64,
          paddingHorizontal: 24,
          gap: 12,
        },
        style,
      ]}
    >
      {/* Icon bubble */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: sizes.radiusLg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.borderPrimary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
        accessibilityElementsHidden
      >
        <Text style={{ fontSize: 32 }}>{icon}</Text>
      </View>

      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.textPrimary,
          textAlign: "center",
        }}
      >
        {title}
      </Text>

      {description && (
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: "center",
            lineHeight: 20,
            maxWidth: 280,
          }}
        >
          {description}
        </Text>
      )}

      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </View>
  );
}

// ── Shared internal styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonText: {
    fontWeight: "700",
    includeFontPadding: false,
  },
});
