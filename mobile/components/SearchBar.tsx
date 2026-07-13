import { View, TextInput, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useLocale } from "@/components/LocaleProvider";

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
}: SearchBarProps) {
  const { t } = useLocale();
  const placeholder = t("search.placeholder_default");
  return (
    <View style={styles.container}>
      <Text style={styles.searchIcon} accessibilityElementsHidden>
        🔍
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        keyboardType="default"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={onClear}
          style={styles.clearButton}
          accessibilityLabel={t("search.clear.a11y")}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderColor: "#1e2029",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#f0f0f2",
    paddingVertical: 0, // neutralizza padding verticale nativo su Android
  },
  clearButton: {
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  clearIcon: {
    fontSize: 14,
    color: "#6b7280",
  },
});
