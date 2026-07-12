import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as Haptics from "@/lib/haptics";
import { useToast } from "@/lib/toast";
import { validatePartitaIVA } from "@/lib/validatePartitaIVA";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

interface QuickAddClientModalProps {
  visible: boolean;
  onClose: () => void;
  onClientAdded: (client: { id: string; name: string; email: string }) => void;
}

export function QuickAddClientModal({
  visible,
  onClose,
  onClientAdded,
}: QuickAddClientModalProps) {
  const { t } = useLocale();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; vat_number?: string }>({});

  const resetForm = () => {
    setName("");
    setEmail("");
    setVatNumber("");
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateField = (field: "name" | "email" | "vat_number", value: string) => {
    if (field === "name") setName(value);
    if (field === "email") setEmail(value);
    if (field === "vat_number") setVatNumber(value);

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    
    if (name.trim().length < 2) {
      newErrors.name = "Nome deve avere almeno 2 caratteri";
    }

    if (email.trim() && !/.+@.+\..+/.test(email.trim())) {
      newErrors.email = "Email non valida";
    }

    if (vatNumber.trim().length > 0) {
      const result = validatePartitaIVA(vatNumber);
      if (!result.valid) {
        newErrors.vat_number = result.error ?? "P.IVA non valida";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    const { data, error } = await apiFetch<{ id: string; name: string; email: string }>("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        vat_number: vatNumber.trim() || null,
        currency: "EUR", // Default currency for quick add
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
    onClientAdded(data);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("newClient") || "Nuovo Cliente"}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            {/* Nome */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={[styles.input, errors.name ? styles.inputError : null]}
                placeholder="Es. Mario Rossi"
                placeholderTextColor="#6b7280"
                autoCapitalize="words"
                value={name}
                onChangeText={(v) => updateField("name", v)}
                editable={!saving}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email (opzionale)</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                placeholder="Es. mario@studio.it"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(v) => updateField("email", v)}
                editable={!saving}
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* P.IVA */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Partita IVA (opzionale)</Text>
              <TextInput
                style={[styles.input, errors.vat_number ? styles.inputError : null]}
                placeholder="Es. 01234567890"
                placeholderTextColor="#6b7280"
                autoCapitalize="characters"
                value={vatNumber}
                onChangeText={(v) => updateField("vat_number", v)}
                editable={!saving}
              />
              {errors.vat_number ? <Text style={styles.errorText}>{errors.vat_number}</Text> : null}
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t("save") || "Salva"}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f0f0f2",
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 20,
    color: "#6b7280",
  },
  form: {
    flexGrow: 0,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0f1117",
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
  saveBtn: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
