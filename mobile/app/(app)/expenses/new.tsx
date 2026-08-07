/**
 * expenses/new.tsx — Crea una nuova nota spese
 * Nessun gate di piano — il gate è nel tab list (expenses.tsx).
 */

import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/ai";
import { useLocale } from "@/components/LocaleProvider";

interface ExpenseItem {
  id: string;
  date: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
}

const CATEGORIES = [
  "Trasporti", "Pasti", "Alloggio", "Ufficio",
  "Software", "Marketing", "Altro",
];

const genId = () => Math.random().toString(36).slice(2);
const todayISO = () => new Date().toISOString().split("T")[0];

export default function NewExpenseScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [periodFrom, setPeriodFrom] = useState(todayISO());
  const [periodTo, setPeriodTo] = useState(todayISO());
  const [currency, setCurrency] = useState("EUR");
  const [items, setItems] = useState<ExpenseItem[]>([
    { id: genId(), date: todayISO(), category: "Altro", amount: "", currency: "EUR", description: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState<string | null>(null);

  const updateItem = useCallback((id: string, field: keyof ExpenseItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [
      ...prev,
      { id: genId(), date: todayISO(), category: "Altro", amount: "", currency, description: "" },
    ]);
  }, [currency]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);

  const computedTotalByCategory = items.reduce<Record<string, number>>((acc, item) => {
    const amt = parseFloat(item.amount) || 0;
    if (amt > 0) acc[item.category] = (acc[item.category] ?? 0) + amt;
    return acc;
  }, {});

  const grandTotal = Object.values(computedTotalByCategory).reduce((s, v) => s + v, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Titolo obbligatorio", "Inserisci un titolo per la nota spese.");
      return;
    }
    const validItems = items.filter(i => parseFloat(i.amount) > 0);
    if (validItems.length === 0) {
      Alert.alert("Voci mancanti", "Aggiungi almeno una voce con importo.");
      return;
    }

    setLoading(true);
    const payload = {
      title: title.trim(),
      period_from: periodFrom,
      period_to: periodTo,
      currency,
      items: validItems.map(i => ({
        id: i.id,
        date: i.date,
        category: i.category,
        amount: parseFloat(i.amount) || 0,
        currency: i.currency || currency,
        description: i.description.trim(),
      })),
      total_by_category: computedTotalByCategory,
      grand_total: grandTotal,
    };

    const { error } = await apiFetch("/api/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (error) {
      Alert.alert("Errore", error);
      return;
    }

    Alert.alert("Nota spese salvata", "La nota spese è stata creata con successo.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← {t("back")}</Text>
          </TouchableOpacity>
          <Text style={s.title}>Nuova nota spese</Text>
        </View>

        {/* Titolo */}
        <Text style={s.label}>TITOLO *</Text>
        <TextInput
          style={s.input}
          placeholder="es. Viaggio Milano ottobre"
          placeholderTextColor="#4b5563"
          value={title}
          onChangeText={setTitle}
        />

        {/* Periodo */}
        <Text style={s.label}>PERIODO</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.sublabel}>Dal</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4b5563"
              value={periodFrom}
              onChangeText={setPeriodFrom}
              autoCapitalize="none"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.sublabel}>Al</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4b5563"
              value={periodTo}
              onChangeText={setPeriodTo}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Voci */}
        <Text style={s.label}>VOCI SPESA</Text>
        {items.map((item, idx) => (
          <View key={item.id} style={s.itemCard}>
            <View style={s.itemHeader}>
              <Text style={s.itemNum}>Voce {idx + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={s.removeText}>Rimuovi</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Data */}
            <Text style={s.sublabel}>Data</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4b5563"
              value={item.date}
              onChangeText={v => updateItem(item.id, "date", v)}
              autoCapitalize="none"
            />

            {/* Categoria */}
            <Text style={s.sublabel}>Categoria</Text>
            <TouchableOpacity
              style={[s.input, s.picker]}
              onPress={() => setShowCategoryPicker(showCategoryPicker === item.id ? null : item.id)}
            >
              <Text style={s.pickerText}>{item.category}</Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>
            {showCategoryPicker === item.id && (
              <View style={s.dropdownList}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.dropdownItem, item.category === cat && s.dropdownItemActive]}
                    onPress={() => {
                      updateItem(item.id, "category", cat);
                      setShowCategoryPicker(null);
                    }}
                  >
                    <Text style={[s.dropdownText, item.category === cat && s.dropdownTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Importo */}
            <View style={s.row}>
              <View style={{ flex: 2 }}>
                <Text style={s.sublabel}>Importo</Text>
                <TextInput
                  style={s.input}
                  placeholder="0,00"
                  placeholderTextColor="#4b5563"
                  keyboardType="decimal-pad"
                  value={item.amount}
                  onChangeText={v => updateItem(item.id, "amount", v)}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.sublabel}>Valuta</Text>
                <TextInput
                  style={s.input}
                  placeholder="EUR"
                  placeholderTextColor="#4b5563"
                  value={item.currency}
                  onChangeText={v => updateItem(item.id, "currency", v.toUpperCase())}
                  maxLength={3}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Descrizione */}
            <Text style={s.sublabel}>Descrizione (opzionale)</Text>
            <TextInput
              style={s.input}
              placeholder="Dettagli aggiuntivi…"
              placeholderTextColor="#4b5563"
              value={item.description}
              onChangeText={v => updateItem(item.id, "description", v)}
            />
          </View>
        ))}

        <TouchableOpacity style={s.addItemBtn} onPress={addItem}>
          <Text style={s.addItemText}>+ Aggiungi voce</Text>
        </TouchableOpacity>

        {/* Riepilogo */}
        {grandTotal > 0 && (
          <View style={s.summaryCard}>
            {Object.entries(computedTotalByCategory).map(([cat, amt]) => (
              <View key={cat} style={s.summaryRow}>
                <Text style={s.summaryLabel}>{cat}</Text>
                <Text style={s.summaryValue}>{fmt(amt)}</Text>
              </View>
            ))}
            <View style={[s.summaryRow, s.summaryTotal]}>
              <Text style={s.summaryTotalLabel}>TOTALE</Text>
              <Text style={s.summaryTotalValue}>{fmt(grandTotal)}</Text>
            </View>
          </View>
        )}

        {/* Salva */}
        <TouchableOpacity
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveBtnText}>Salva nota spese</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 28 },
  backBtn: { marginBottom: 12 },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  label: {
    fontSize: 11, fontWeight: "700", color: "#6b7280",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },
  sublabel: { fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: "#0f1117", borderRadius: 10, padding: 12,
    color: "#f0f0f2", fontSize: 15, borderWidth: 1, borderColor: "#1e2029", marginBottom: 4,
  },
  picker: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { color: "#f0f0f2", fontSize: 15 },
  row: { flexDirection: "row" },
  dropdownList: {
    backgroundColor: "#111318", borderRadius: 10, borderWidth: 1, borderColor: "#1e2029",
    marginBottom: 8, overflow: "hidden",
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  dropdownItemActive: { backgroundColor: "#6c63ff15" },
  dropdownText: { fontSize: 14, color: "#f0f0f2" },
  dropdownTextActive: { color: "#6c63ff", fontWeight: "600" },
  itemCard: {
    backgroundColor: "#111318", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#1e2029", marginBottom: 10,
  },
  itemHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
  },
  itemNum: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  removeText: { color: "#ef4444", fontSize: 13 },
  addItemBtn: {
    borderRadius: 12, padding: 14, borderWidth: 1,
    borderColor: "#6c63ff44", borderStyle: "dashed", alignItems: "center", marginBottom: 4,
  },
  addItemText: { color: "#6c63ff", fontSize: 14, fontWeight: "600" },
  summaryCard: {
    backgroundColor: "#111318", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#1e2029", marginTop: 24,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: "#9ca3af" },
  summaryValue: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  summaryTotal: {
    borderTopWidth: 1, borderTopColor: "#1e2029", marginTop: 6, paddingTop: 12,
  },
  summaryTotalLabel: { fontSize: 16, color: "#f0f0f2", fontWeight: "700" },
  summaryTotalValue: { fontSize: 18, color: "#6c63ff", fontWeight: "700" },
  saveBtn: {
    backgroundColor: "#6c63ff", borderRadius: 12, padding: 15,
    alignItems: "center", marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
