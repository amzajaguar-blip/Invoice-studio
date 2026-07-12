/**
 * EditClientSheet — Bottom sheet animato per modificare o eliminare un cliente esistente.
 *
 * Pattern di animazione identico a InvoiceLimitModal:
 * - Apertura: spring(slideAnim → 0) + timing(fadeAnim → 1, 200ms)
 * - Chiusura: timing(slideAnim → height, 250ms) + timing(fadeAnim → 0, 200ms)
 * - reduceMotion: setValue immediato senza animazione
 *
 * Requisiti: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "@/lib/haptics";
import { useToast } from "@/lib/toast";
import { validatePartitaIVA } from "@/lib/validatePartitaIVA";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CNY", "INR", "CAD", "AUD", "BRL"];

const { height } = Dimensions.get("window");

// ─── Interfacce ───────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  currency: string;
}

interface EditClientSheetProps {
  client: Client | null;
  onClose: () => void;
  onSaved: (updated: Client) => void;
}

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

// ─── Validazione sincrona (stessa logica di add.tsx) ─────────────────────────

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

export default function EditClientSheet({
  client,
  onClose,
  onSaved,
}: EditClientSheetProps) {
  const { showToast } = useToast();
  const localeCtx = useLocale();
  const t = typeof localeCtx?.t === 'function' ? localeCtx.t : ((key: string) => key);

  // ─── Stato form ───────────────────────────────────────────────────────────
  const [form, setForm] = useState<ClientFormData>({
    name: "",
    email: "",
    vat_number: "",
    currency: "EUR",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ─── Animazione ───────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Precompila il form quando client cambia
  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        email: client.email,
        vat_number: client.vat_number ?? "",
        currency: client.currency,
      });
      setErrors({});
    }
  }, [client]);

  // Animazione apertura/chiusura
  useEffect(() => {
    const isVisible = client !== null;

    if (isVisible) {
      if (reduceMotion) {
        slideAnim.setValue(0);
        fadeAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 180,
            mass: 1,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      if (reduceMotion) {
        slideAnim.setValue(height);
        fadeAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [client, reduceMotion]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const updateField = (field: keyof ClientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    if (!client) return;

    const { isValid, errors: validationErrors } = validate(form);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    const { data, error } = await apiFetch<Client>(`/api/clients/${client.id}`, {
      method: "PUT",
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
    showToast({ message: "Cliente aggiornato ✓", type: "success" });
    onSaved(data);
    onClose();
  };

  const handleDelete = () => {
    if (!client) return;

    Alert.alert(
      t("client_delete_title"),
      t("client_delete_msg").replace("{name}", client.name),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("delete"),
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!client) return;

    setDeleting(true);

    const { error } = await apiFetch(`/api/clients/${client.id}`, {
      method: "DELETE",
    });

    setDeleting(false);

    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({ message: error ?? "Errore durante l'eliminazione", type: "error" });
      return;
    }

    onClose();
    showToast({ message: "Cliente eliminato", type: "success" });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const isVisible = client !== null;
  const isBusy = saving || deleting;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel="Modifica cliente"
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        {/* Tap fuori per chiudere */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Chiudi senza salvare"
        />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Titolo */}
          <Text style={s.title}>Modifica cliente</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Campo Nome */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Nome *</Text>
              <TextInput
                style={[s.input, errors.name ? s.inputError : null]}
                placeholder="Es. Mario Rossi"
                placeholderTextColor="#6b7280"
                autoCapitalize="words"
                value={form.name}
                onChangeText={(v) => updateField("name", v)}
                editable={!isBusy}
              />
              {errors.name ? (
                <Text style={s.errorText}>{errors.name}</Text>
              ) : null}
            </View>

            {/* Campo Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Email *</Text>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="Es. mario@studio.it"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => updateField("email", v)}
                editable={!isBusy}
              />
              {errors.email ? (
                <Text style={s.errorText}>{errors.email}</Text>
              ) : null}
            </View>

            {/* Campo P.IVA */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Partita IVA</Text>
              <TextInput
                style={[s.input, errors.vat_number ? s.inputError : null]}
                placeholder="Es. 01234567890"
                placeholderTextColor="#6b7280"
                autoCapitalize="characters"
                keyboardType="default"
                value={form.vat_number}
                onChangeText={(v) => updateField("vat_number", v)}
                editable={!isBusy}
              />
              {errors.vat_number ? (
                <Text style={s.errorText}>{errors.vat_number}</Text>
              ) : null}
            </View>

            {/* Picker Valuta */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Valuta *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.currencyRow}
              >
                {CURRENCIES.map((cur) => {
                  const isActive = form.currency === cur;
                  return (
                    <TouchableOpacity
                      key={cur}
                      style={[
                        s.currencyButton,
                        isActive ? s.currencyButtonActive : null,
                      ]}
                      onPress={() => updateField("currency", cur)}
                      accessibilityRole="button"
                      accessibilityLabel={`Seleziona valuta ${cur}`}
                      accessibilityState={{ selected: isActive }}
                      disabled={isBusy}
                    >
                      <Text
                        style={[
                          s.currencyText,
                          isActive ? s.currencyTextActive : null,
                        ]}
                      >
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {errors.currency ? (
                <Text style={s.errorText}>{errors.currency}</Text>
              ) : null}
            </View>

            {/* Bottone Salva modifiche */}
            <TouchableOpacity
              style={[s.saveButton, isBusy ? s.buttonDisabled : null]}
              onPress={handleSave}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Salva modifiche"
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveButtonText}>Salva modifiche</Text>
              )}
            </TouchableOpacity>

            {/* Bottone Elimina cliente */}
            <TouchableOpacity
              style={[s.deleteButton, isBusy ? s.buttonDisabled : null]}
              onPress={handleDelete}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Elimina cliente"
            >
              {deleting ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <Text style={s.deleteButtonText}>Elimina cliente</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#1e2029",
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#2d2f3a",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f0f2",
    marginBottom: 20,
    textAlign: "center",
  },

  // Campi form
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0a0b0f",
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
    backgroundColor: "#0a0b0f",
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
    marginBottom: 12,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Bottone elimina
  deleteButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef444444",
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },

  // Stato disabilitato condiviso
  buttonDisabled: {
    opacity: 0.5,
  },
});
