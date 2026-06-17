import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

export interface SkeletonCardProps {
  lines?: number;       // default 2 — numero di righe di testo simulate
  height?: number;      // default 80 — altezza totale della card
  showAvatar?: boolean; // default false
}

export function SkeletonCard({
  lines = 2,
  height = 80,
  showAvatar = false,
}: SkeletonCardProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
      if (!enabled) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmer, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(shimmer, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    });
  }, []);

  const opacity = reduceMotion
    ? 0.5
    : shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
      });

  return (
    <Animated.View
      style={[styles.card, { height, opacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Caricamento in corso"
    >
      <View style={styles.row}>
        {showAvatar && <View style={styles.avatar} />}
        <View style={styles.lines}>
          {Array.from({ length: lines }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.line,
                i === lines - 1 && { width: "60%" },
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e2029",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2d2f3a",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2d2f3a",
    marginRight: 12,
    flexShrink: 0,
  },
  lines: {
    flex: 1,
  },
  line: {
    backgroundColor: "#2d2f3a",
    borderRadius: 6,
    height: 12,
    marginBottom: 8,
    width: "100%",
  },
});
