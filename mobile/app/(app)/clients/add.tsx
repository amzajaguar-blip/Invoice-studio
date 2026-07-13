import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import { useToast } from "@/lib/toast";
import { validatePartitaIVA } from "@/lib/validatePartitaIVA";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CNY", "INR", "CAD", "AUD", "BRL"];

// ─── Interfacce ───────────────────────────────────────────────────────────────

interface ClientFormData {
  name: string;
  email: string;
  vat_number: string;
  currency: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ClientFormData, string>>;
}

// ─── Validazione sincrona ─────────────────────────────────────────────────────

function validate(data: ClientFormData): ValidationResult {
  const errors: Partial<Record<keyof ClientFormData, string>> = {};

  // nome: min 2, max 100
  const name = data.name.trim();
  if (name.length < 2) {
    errors.name = "Nome deve avere almeno 2 caratteri";
  } else if (name.length > 100) {
    errors.name = "Nome troppo lungo (max 100 caratteri)";
  }

  // email: regex base dopo trim
  const email = data.email.trim();
  if (!/.+@.+\..+/.test(email)) {
    errors.email = "Email non valida";
  }

  // P.IVA: opzionale — usa validatePartitaIVA
  if (data.vat_number.trim().length > 0) {
    const result = validatePartitaIVA(data.vat_number);
    if (!result.valid) {
      errors.vat_number = result.error ?? "P.IVA non valida";
    }
  }

  // currency: deve essere nella lista chiusa
  if (!CURRENCIES.includes(data.currency)) {
    errors.currency = "Valuta non valida";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AddClientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { t } = useLocale();

  const [form, setForm] = useState<ClientFormData>({
    name: "",
    email: "",
    vat_number: "",
    currency: "EUR",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [saving, setSaving] = useState(false);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const updateField = (field: keyof ClientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Cancella l'errore del campo non appena l'utente modifica
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    const { isValid, errors: validationErrors } = validate(form);

    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    const { data, error } = await apiFetch<{ id: string; name: string }>("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        vat_number: form.vat_number.trim() || null,
        currency: form.currency,
      }),
    });

    setSaving(false);

    if (error || !data) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({ message: error ?? "Errore durante il salvataggio", type: "error" });
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ message: "Cliente aggiunto ✓", type: "success" });
    router.back();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuovo cliente</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Form */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Campo Nome */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Es. Mario Rossi"
              placeholderTextColor="#6b7280"
              autoCapitalize="words"
              value={form.name}
              onChangeText={(v) => updateField("name", v)}
              editable={!saving}
            />
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

          {/* Campo Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="Es. mario@studio.it"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => updateField("email", v)}
              editable={!saving}
            />
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}
          </View>

          {/* Campo P.IVA */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Partita IVA</Text>
            <TextInput
              style={[styles.input, errors.vat_number ? styles.inputError : null]}
              placeholder="Es. 01234567890"
              placeholderTextColor="#6b7280"
              autoCapitalize="characters"
              keyboardType="default"
              value={form.vat_number}
              onChangeText={(v) => updateField("vat_number", v)}
              editable={!saving}
            />
            {errors.vat_number ? (
              <Text style={styles.errorText}>{errors.vat_number}</Text>
            ) : null}
          </View>

          {/* Picker Valuta */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Valuta *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.currencyRow}
            >
              {CURRENCIES.map((cur) => {
                const isActive = form.currency === cur;
                return (
                  <TouchableOpacity
                    key={cur}
                    style={[
                      styles.currencyButton,
                      isActive ? styles.currencyButtonActive : null,
                    ]}
                    onPress={() => updateField("currency", cur)}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleziona valuta ${cur}`}
                    accessibilityState={{ selected: isActive }}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.currencyText,
                        isActive ? styles.currencyTextActive : null,
                      ]}
                    >
                      {cur}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {errors.currency ? (
              <Text style={styles.errorText}>{errors.currency}</Text>
            ) : null}
          </View>

          {/* Bottone Salva */}
          <TouchableOpacity
            style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Salva cliente"
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Salva cliente</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2029",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 28,
    color: "#6c63ff",
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    color: "#f0f0f2",
  },
  headerSpacer: {
    width: 36,
  },

  // Scroll
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Campi form
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#f0f0f2",
    fontSize: 15,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 6,
  },

  // Picker valuta
  currencyRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  currencyButton: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  currencyButtonActive: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  currencyText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
  },
  currencyTextActive: {
    color: "#ffffff",
  },

  // Bottone salva
  saveButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
