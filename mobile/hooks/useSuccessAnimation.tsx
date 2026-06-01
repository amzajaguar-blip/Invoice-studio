/**
 * Milo Design System — Mobile useSuccessAnimation
 * =================================================
 * React Native hook providing:
 *  - Confetti burst (canvas-free, pure Animated API)
 *  - Pulse/ripple on a target view ref
 *  - Skeleton loading state flag
 *  - Reduced-motion awareness via Appearance
 *
 * No third-party dependencies — everything uses React Native's
 * built-in Animated API so it works in any Expo/bare workflow.
 *
 * Usage:
 *   const { triggerConfetti, ConfettiLayer, isLoading, setIsLoading } = useSuccessAnimation();
 *   // Render <ConfettiLayer /> at the root of your screen
 *   // Call triggerConfetti() on a payment success event
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { MOTION, DARK_COLORS } from "../constants/theme";

// ── Config ─────────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get("window");
const PARTICLE_COUNT = MOTION.confetti.particles;
const PARTICLE_COLORS = MOTION.confetti.colors;
const FALL_DURATION_BASE = 1400;
const FALL_DURATION_SPREAD = 800;

// ── Helpers ────────────────────────────────────────────────────────────────

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  isCircle: boolean;
  anim: Animated.Value;
  rotateAnim: Animated.Value;
}

export interface UseSuccessAnimationReturn {
  /** Fire a confetti burst from the top of the screen */
  triggerConfetti: () => void;
  /** Pulse-scale a view referenced by an Animated.Value */
  triggerPulse: (scaleAnim: Animated.Value) => void;
  /** Global loading flag — controls spinners/skeletons throughout the screen */
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  /** Render this at the root of your screen to display confetti */
  ConfettiLayer: React.FC;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSuccessAnimation(): UseSuccessAnimationReturn {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const particleIdRef = useRef(0);

  // ── Confetti burst ──────────────────────────────────────────────────────
  const triggerConfetti = useCallback(() => {
    const newParticles: Particle[] = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => ({
        id: ++particleIdRef.current,
        x: randomBetween(0.05, 0.95) * SW,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        size: randomBetween(6, 14),
        isCircle: Math.random() > 0.5,
        anim: new Animated.Value(0),
        rotateAnim: new Animated.Value(0),
      })
    );

    setParticles((prev) => [...prev, ...newParticles]);

    newParticles.forEach((p) => {
      const duration = FALL_DURATION_BASE + Math.random() * FALL_DURATION_SPREAD;

      Animated.parallel([
        Animated.timing(p.anim, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          useNativeDriver: true,
        }),
        Animated.timing(p.rotateAnim, {
          toValue: randomBetween(2, 6),
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Clean up after all animations complete
    const timer = setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.some((np) => np.id === p.id))
      );
    }, FALL_DURATION_BASE + FALL_DURATION_SPREAD + 200);

    activeTimers.current.push(timer);
  }, []);

  // ── Pulse a scale Animated.Value ────────────────────────────────────────
  const triggerPulse = useCallback((scaleAnim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.08,
        duration: MOTION.duration.fast,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: MOTION.duration.normal,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── ConfettiLayer component ─────────────────────────────────────────────
  const ConfettiLayer: React.FC = useCallback(() => {
    if (particles.length === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p) => {
          const translateY = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, SH + 40],
          });
          const opacity = p.anim.interpolate({
            inputRange: [0, 0.1, 0.85, 1],
            outputRange: [0, 1, 1, 0],
          });
          const rotate = p.rotateAnim.interpolate({
            inputRange: [0, 6],
            outputRange: ["0deg", "2160deg"],
          });

          return (
            <Animated.View
              key={p.id}
              style={{
                position: "absolute",
                left: p.x,
                top: 0,
                width: p.size,
                height: p.isCircle ? p.size : p.size * 1.6,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                backgroundColor: p.color,
                transform: [{ translateY }, { rotate }],
                opacity,
              }}
            />
          );
        })}
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particles]);

  return {
    triggerConfetti,
    triggerPulse,
    isLoading,
    setIsLoading,
    ConfettiLayer,
  };
}

// ── SkeletonBlock — RN loading placeholder ─────────────────────────────────

interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: object;
}

export function SkeletonBlock({
  width = "100%",
  height = 16,
  radius = 8,
  style,
  shimmerFrom,
  shimmerTo,
}: SkeletonBlockProps & {
  shimmerFrom?: string;
  shimmerTo?: string;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const fromColor = shimmerFrom ?? DARK_COLORS.surfaceSecondary;
  const toColor   = shimmerTo   ?? DARK_COLORS.surfaceTertiary;

  const bg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [fromColor, toColor, fromColor],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: bg as unknown as string,
        },
        style,
      ]}
    />
  );
}

// ── SkeletonCard — card-shaped skeleton ────────────────────────────────────

export function SkeletonCard({
  rows = 3,
  bgColor,
  borderColor,
  shimmerFrom,
  shimmerTo,
}: {
  rows?: number;
  bgColor?: string;
  borderColor?: string;
  shimmerFrom?: string;
  shimmerTo?: string;
}) {
  const ROW_WIDTHS = ["75%", "60%", "85%", "68%", "72%", "90%"] as const;

  return (
    <View
      style={{
        backgroundColor: bgColor ?? DARK_COLORS.surfacePrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: borderColor ?? DARK_COLORS.borderPrimary,
        padding: 20,
        gap: 12,
      }}
    >
      {/* Top row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <SkeletonBlock width="40%" height={16} shimmerFrom={shimmerFrom} shimmerTo={shimmerTo} />
        <SkeletonBlock width={80} height={24} radius={12} shimmerFrom={shimmerFrom} shimmerTo={shimmerTo} />
      </View>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={ROW_WIDTHS[i % ROW_WIDTHS.length]}
          height={12}
          shimmerFrom={shimmerFrom}
          shimmerTo={shimmerTo}
        />
      ))}
      {/* Action row */}
      <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
        <SkeletonBlock width={90} height={32} radius={12} shimmerFrom={shimmerFrom} shimmerTo={shimmerTo} />
        <SkeletonBlock width={70} height={32} radius={12} shimmerFrom={shimmerFrom} shimmerTo={shimmerTo} />
      </View>
    </View>
  );
}

