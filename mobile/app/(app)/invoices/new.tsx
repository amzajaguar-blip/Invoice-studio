import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/ai";

interface Client {
  id: string;
  name: string;
  email: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

const generateId = () => Math.random().toString(36).slice(2);

export default function NewInvoiceScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: "", quantity: "1", rate: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("22");
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);

  // Carica clienti
  useEffect(() => {
    apiFetch<{ data: Client[] }>("/api/clients").then(({ data }) => {
      if (data) {
        const list = Array.isArray(data) ? data : (data as { data: Client[] }).data || [];
        setClients(list);
        if (list.length > 0) setSelectedClientId(list[0].id);
      }
      setLoadingClients(false);
    });
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Calcoli
  const subtotal = lineItems.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const r = parseFloat(item.rate) || 0;
    return sum + q * r;
  }, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) / 100 || 0);
  const total = subtotal + taxAmount;

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  const addItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: "", quantity: "1", rate: "" },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleSave = async (status: "draft" | "sent") => {
    if (!selectedClientId) {
      Alert.alert("Cliente mancante", "Seleziona un cliente prima di salvare.");
      return;
    }
    const validItems = lineItems.filter(
      (i) => i.description.trim() && parseFloat(i.rate) > 0
    );
    if (validItems.length === 0) {
      Alert.alert("Voci mancanti", "Aggiungi almeno una voce con descrizione e importo.");
      return;
    }

    setLoading(true);
    const payload = {
      client_id: selectedClientId,
      status,
      tax_rate: parseFloat(taxRate) || 0,
      notes: notes.trim() || null,
      line_items: validItems.map((i) => ({
        description: i.description.trim(),
        quantity: parseFloat(i.quantity) || 1,
        rate: parseFloat(i.rate) || 0,
        amount: (parseFloat(i.quantity) || 1) * (parseFloat(i.rate) || 0),
      })),
    };

    const { data, error } = await apiFetch("/api/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (error) {
      Alert.alert("Errore", error);
      return;
    }

    Alert.alert(
      status === "draft" ? "Bozza salvata ✓" : "Fattura creata ✓",
      status === "draft"
        ? "La fattura è stata salvata come bozza."
        : "La fattura è stata creata e contrassegnata come inviata.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  if (loadingClients) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← Indietro</Text>
          </TouchableOpacity>
          <Text style={s.title}>Nuova Fattura</Text>
        </View>

        {/* Cliente */}
        <Text style={s.sectionLabel}>CLIENTE</Text>
        <TouchableOpacity
          style={s.clientSelector}
          onPress={() => setShowClientPicker(!showClientPicker)}
        >
          <Text style={s.clientName}>
            {selectedClient ? selectedClient.name : "Seleziona un cliente"}
          </Text>
          <Text style={s.chevron}>{showClientPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showClientPicker && (
          <View style={s.clientList}>
            {clients.length === 0 ? (
              <Text style={s.noClientsText}>
                Nessun cliente. Aggiungili dalla versione web.
              </Text>
            ) : (
              clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.clientOption, selectedClientId === c.id && s.clientOptionActive]}
                  onPress={() => {
                    setSelectedClientId(c.id);
                    setShowClientPicker(false);
                  }}
                >
                  <Text style={[s.clientOptionName, selectedClientId === c.id && s.clientOptionNameActive]}>
                    {c.name}
                  </Text>
                  <Text style={s.clientOptionEmail}>{c.email}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Voci */}
        <Text style={s.sectionLabel}>VOCI</Text>
        {lineItems.map((item, index) => (
          <View key={item.id} style={s.lineItemCard}>
            <View style={s.lineItemHeader}>
              <Text style={s.lineItemNum}>Voce {index + 1}</Text>
              {lineItems.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={s.removeText}>Rimuovi</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={s.input}
              placeholder="Descrizione del servizio"
              placeholderTextColor="#4b5563"
              value={item.description}
              onChangeText={(v) => updateItem(item.id, "description", v)}
            />
            <View style={s.lineItemRow}>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>Quantità</Text>
                <TextInput
                  style={s.input}
                  placeholder="1"
                  placeholderTextColor="#4b5563"
                  keyboardType="decimal-pad"
                  value={item.quantity}
                  onChangeText={(v) => updateItem(item.id, "quantity", v)}
                />
              </View>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>Prezzo (€)</Text>
                <TextInput
                  style={s.input}
                  placeholder="0,00"
                  placeholderTextColor="#4b5563"
                  keyboardType="decimal-pad"
                  value={item.rate}
                  onChangeText={(v) => updateItem(item.id, "rate", v)}
                />
              </View>
            </View>
            {parseFloat(item.rate) > 0 && (
              <Text style={s.lineTotal}>
                Totale voce: {fmt((parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0))}
              </Text>
            )}
          </View>
        ))}

        <TouchableOpacity style={s.addItemBtn} onPress={addItem}>
          <Text style={s.addItemText}>+ Aggiungi voce</Text>
        </TouchableOpacity>

        {/* IVA */}
        <Text style={s.sectionLabel}>IVA (%)</Text>
        <TextInput
          style={s.input}
          placeholder="22"
          placeholderTextColor="#4b5563"
          keyboardType="decimal-pad"
          value={taxRate}
          onChangeText={setTaxRate}
        />

        {/* Note */}
        <Text style={s.sectionLabel}>NOTE (opzionale)</Text>
        <TextInput
          style={[s.input, s.notesInput]}
          placeholder="Condizioni di pagamento, note aggiuntive…"
          placeholderTextColor="#4b5563"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {/* Riepilogo */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Imponibile</Text>
            <Text style={s.summaryValue}>{fmt(subtotal)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>IVA ({taxRate}%)</Text>
            <Text style={s.summaryValue}>{fmt(taxAmount)}</Text>
          </View>
          <View style={[s.summaryRow, s.summaryTotal]}>
            <Text style={s.summaryTotalLabel}>TOTALE</Text>
            <Text style={s.summaryTotalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Azioni */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btn, s.btnDraft, loading && s.btnDisabled]}
            onPress={() => handleSave("draft")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Salva bozza</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnSend, loading && s.btnDisabled]}
            onPress={() => handleSave("sent")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Crea e invia</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: "#0a0b0f", justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 28 },
  backBtn: { marginBottom: 12 },
  backText: { color: "#6c63ff", fontSize: 15 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f0f0f2", fontFamily: "serif" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20 },

  clientSelector: {
    backgroundColor: "#111318", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#1e2029",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  clientName: { fontSize: 15, color: "#f0f0f2", fontWeight: "500" },
  chevron: { color: "#6b7280", fontSize: 12 },
  clientList: {
    backgroundColor: "#111318", borderRadius: 12, borderWidth: 1,
    borderColor: "#1e2029", marginTop: 4, overflow: "hidden",
  },
  clientOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#1e2029" },
  clientOptionActive: { backgroundColor: "#6c63ff15" },
  clientOptionName: { fontSize: 15, color: "#f0f0f2", fontWeight: "500" },
  clientOptionNameActive: { color: "#6c63ff" },
  clientOptionEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  noClientsText: { padding: 14, color: "#6b7280", fontSize: 14 },

  lineItemCard: {
    backgroundColor: "#111318", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#1e2029", marginBottom: 10,
  },
  lineItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  lineItemNum: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  removeText: { color: "#ef4444", fontSize: 13 },
  lineItemRow: { flexDirection: "row", gap: 10 },
  inputHalf: { flex: 1 },
  inputLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: "600" },
  lineTotal: { fontSize: 13, color: "#6c63ff", fontWeight: "600", marginTop: 8, textAlign: "right" },

  input: {
    backgroundColor: "#0f1117", borderRadius: 10, padding: 12,
    color: "#f0f0f2", fontSize: 15, borderWidth: 1, borderColor: "#1e2029",
    marginBottom: 4,
  },
  notesInput: { height: 80, textAlignVertical: "top" },

  addItemBtn: {
    borderRadius: 12, padding: 14, borderWidth: 1,
    borderColor: "#6c63ff44", borderStyle: "dashed",
    alignItems: "center", marginBottom: 4,
  },
  addItemText: { color: "#6c63ff", fontSize: 14, fontWeight: "600" },

  summaryCard: {
    backgroundColor: "#111318", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#1e2029", marginTop: 24,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: "#9ca3af" },
  summaryValue: { fontSize: 14, color: "#f0f0f2", fontWeight: "500" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: "#1e2029", marginTop: 6, paddingTop: 12 },
  summaryTotalLabel: { fontSize: 16, color: "#f0f0f2", fontWeight: "700" },
  summaryTotalValue: { fontSize: 18, color: "#6c63ff", fontWeight: "700" },

  actions: { flexDirection: "row", gap: 12, marginTop: 24 },
  btn: { flex: 1, borderRadius: 12, padding: 15, alignItems: "center" },
  btnDraft: { backgroundColor: "#1e2029" },
  btnSend: { backgroundColor: "#6c63ff" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
