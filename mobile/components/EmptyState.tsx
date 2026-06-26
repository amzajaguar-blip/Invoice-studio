import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  cta?: string;
  onCTA?: () => void;
}

export function EmptyState({ icon, title, hint, cta, onCTA }: EmptyStateProps) {
  return (
    <View
      style={styles.container}
      accessibilityLabel={title}
    >
      <Ionicons name={icon} size={56} color="#6c63ff" style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      {cta && onCTA && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={onCTA}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Text style={styles.ctaText}>{cta}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0b0f",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  icon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f0f0f2",
    textAlign: "center",
    marginBottom: 10,
  },
  hint: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaButton: {
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  ctaText: {
    color: "#f0f0f2",
    fontSize: 15,
    fontWeight: "600",
  },
});
