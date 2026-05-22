"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, generateTempId } from "@/lib/utils";
import { useAISuggest } from "@/hooks/useAISuggest";
import type { Currency } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
  email: string;
}

interface LineItemData {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface DraftData {
  clientId: string;
  currency: Currency;
  vatRate: number;
  withholdingTaxRate: number;
  dueDate: string;
  notes: string;
  items: LineItemData[];
}

// ─── Autosave key ──────────────────────────────────────────────────────────────

const AUTOSAVE_KEY = "invoice-studio:draft:form";

interface FormData {
  clientId: string;
  currency: Currency;
  vatRate: number;
  dueDate: string;
  notes: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InvoiceForm({ onClose, onSave, triggerRef }: { onClose: () => void; onSave?: () => void; triggerRef?: React.RefObject<HTMLElement | null> }) {
  const router = useRouter();

  // Clients from Supabase
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form state
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [vatRate, setVatRate] = useState(22);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState(20);
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  // Line items
  const [items, setItems] = useState<LineItemData[]>([
    { id: generateTempId(), description: "", quantity: 1, unitPrice: 0 },
  ]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [autosaveIndicator, setAutosaveIndicator] = useState<string | null>(null);
  const firstItemRef = useRef<HTMLInputElement>(null);

  // Autosave tracking
  const isDirtyRef = useRef(false);
  const loadedFromStorageRef = useRef(false);

  // AI suggestions
  const { suggest, loading: aiLoading } = useAISuggest();
  const [aiSuggestingIndex, setAiSuggestingIndex] = useState<number | null>(null);
  const [aiSuggestingNotes, setAiSuggestingNotes] = useState(false);

  // ─── Load clients ──────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clients")
      .select("id, name, email")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const clientsData = data as ClientOption[];
          setClients(clientsData);
          if (!clientId) {
            setClientId(clientsData[0].id);
          }
        }
        setLoadingClients(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Focus first input ─────────────────────────────────────────────────────

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  // ─── Return focus on close ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Delay to let the parent state update before focusing
      requestAnimationFrame(() => {
        triggerRef?.current?.focus();
      });
    };
  }, [triggerRef]);

  // ─── Escape key ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ─── Restore draft from localStorage ──────────────────────────────────────

  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect */
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const draft: DraftData = JSON.parse(raw);
      if (draft.clientId) setClientId(draft.clientId);
      if (draft.currency) setCurrency(draft.currency);
      if (typeof draft.vatRate === "number") setVatRate(draft.vatRate);
      if (typeof draft.withholdingTaxRate === "number")
        setWithholdingTaxRate(draft.withholdingTaxRate);
      if (draft.dueDate) setDueDate(draft.dueDate);
      if (draft.notes) setNotes(draft.notes);
      if (draft.items?.length) {
        setItems(draft.items);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
      setAutosaveIndicator("Bozza ripristinata");
      setTimeout(() => setAutosaveIndicator(null), 3000);
      loadedFromStorageRef.current = true;
    } catch {
      // corrupt storage — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Autosave to localStorage every 5s when dirty ─────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDirtyRef.current) return;
      try {
        const draft: DraftData = {
          clientId,
          currency,
          vatRate,
          withholdingTaxRate,
          dueDate,
          notes,
          items,
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
        setAutosaveIndicator("Salvato come bozza");
        setTimeout(() => setAutosaveIndicator(null), 3000);
        isDirtyRef.current = false;
      } catch {
        // storage full — ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [clientId, currency, vatRate, withholdingTaxRate, dueDate, notes, items]);

  // Mark dirty on any form change (skip initial load)
  useEffect(() => {
    if (!loadedFromStorageRef.current) return;
    isDirtyRef.current = true;
  }, [clientId, currency, vatRate, withholdingTaxRate, dueDate, notes, items]);

  // ─── Computed totals ───────────────────────────────────────────────────────

  const { subtotal, vat, withholding, total, netTotal } = useMemo(() => {
    const sub = items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
    const v = sub * ((vatRate || 0) / 100);
    const gross = sub + v;
    const w = gross * ((withholdingTaxRate || 0) / 100);
    return { subtotal: sub, vat: v, withholding: w, total: gross, netTotal: gross - w };
  }, [items, vatRate, withholdingTaxRate]);

  // ─── Item handlers ─────────────────────────────────────────────────────────

  const updateItem = useCallback(
    (index: number, field: keyof LineItemData, value: string | number) => {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                [field]:
                  field === "description"
                    ? value
                    : field === "quantity"
                      ? Math.max(0, Number(value) || 0)
                      : Math.max(0, Number(value) || 0),
              }
            : it
        )
      );
    },
    []
  );

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: generateTempId(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!clientId) errors.clientId = "Seleziona un cliente";
    if (items.every((it) => !it.description.trim())) {
      errors.items = "Inserisci almeno una voce con descrizione";
    }
    if (items.some((it) => it.description && (it.quantity <= 0 || it.unitPrice <= 0))) {
      errors.prices = "Quantità e prezzo devono essere > 0";
    }
    if (!dueDate) errors.dueDate = "Seleziona una data di scadenza";
    if (vatRate < 0 || vatRate > 100) errors.vatRate = "IVA tra 0 e 100";
    if (withholdingTaxRate < 0 || withholdingTaxRate > 100)
      errors.withholdingTaxRate = "Ritenuta tra 0 e 100";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── AI handlers ────────────────────────────────────────────────────────────

  const handleAIDescription = useCallback(
    async (index: number) => {
      setAiSuggestingIndex(index);
      const item = items[index];
      const selectedClient = clients.find((c) => c.id === clientId);
      const suggestion = await suggest({
        type: "description",
        context: {
          client_name: selectedClient?.name || "",
          other_items: items
            .filter((_, i) => i !== index)
            .map((it) => it.description)
            .filter(Boolean),
          notes: notes || "",
        },
        prompt: item.description || undefined,
      });
      if (suggestion) {
        updateItem(index, "description", suggestion);
      }
      setAiSuggestingIndex(null);
    },
    [items, clientId, clients, notes, suggest, updateItem]
  );

  const handleAINotes = useCallback(async () => {
    setAiSuggestingNotes(true);
    const selectedClient = clients.find((c) => c.id === clientId);
    const suggestion = await suggest({
      type: "notes",
      context: {
        client_name: selectedClient?.name || "",
        total: formatCurrency(netTotal, currency),
        items: items.filter((it) => it.description.trim()).map((it) => it.description),
        vat_rate: vatRate,
        withholding_tax_rate: withholdingTaxRate,
      },
      prompt: notes || undefined,
    });
    if (suggestion) {
      setNotes(suggestion);
    }
    setAiSuggestingNotes(false);
  }, [clients, clientId, suggest, notes, setNotes, items, netTotal, currency, vatRate, withholdingTaxRate]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setError(null);

    const validItems = items.filter((it) => it.description.trim());

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        currency,
        tax_rate: vatRate,
        withholding_tax_rate: withholdingTaxRate,
        due_date: dueDate,
        notes: notes || undefined,
        items: validItems.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unitPrice,
        })),
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      // Plan limit reached (402) — parent InvoicesClient handles this
      if (res.status === 402) {
        setError(json.error || "Limite fatture raggiunto");
        setSaving(false);
        // Dispatch a custom event so the parent can show the limit modal
        window.dispatchEvent(new CustomEvent("invoice:plan-limit", { detail: json }));
        return;
      }
      setError(json?.error || "Errore durante il salvataggio");
      setSaving(false);
      return;
    }

    // Clear draft on successful save
    localStorage.removeItem(AUTOSAVE_KEY);
    setSaving(false);
    onSave?.();
    onClose();
    router.refresh();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 w-[min(680px,95vw)] max-h-[90vh] overflow-y-auto z-[101] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
            ✦ Nuova Fattura
          </h2>
          <div className="flex items-center gap-3">
            {autosaveIndicator && (
              <span className="text-xs text-[#22c55e] bg-[rgba(34,197,94,0.08)] px-2.5 py-1 rounded-full animate-pulse">
                {autosaveIndicator}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Chiudi"
              className="bg-[#1e2029] border-none rounded-lg text-[#9ca3af] w-8 h-8 cursor-pointer text-base flex items-center justify-center hover:bg-[#2a2d3a] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Client + Currency */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5 uppercase tracking-wider">
              Cliente
            </label>
            {loadingClients ? (
              <div className="h-10 bg-[#111318] border border-[#1e2029] rounded-lg animate-pulse" />
            ) : clients.length === 0 ? (
              <div className="text-sm text-[#6b7280] p-2 border border-dashed border-[#1e2029] rounded-lg">
                Nessun cliente —{" "}
                <a href="/clients" className="text-[#6c63ff]">
                  creane uno
                </a>
              </div>
            ) : (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-[#f0f0f2] text-sm focus:outline-none focus:border-[#6c63ff] transition-colors"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            )}
            {validationErrors.clientId && (
              <p className="text-xs text-[#ef4444] mt-1">{validationErrors.clientId}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5 uppercase tracking-wider">
              Valuta
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-[#f0f0f2] text-sm focus:outline-none focus:border-[#6c63ff] transition-colors"
            >
              {(["EUR", "USD", "GBP", "CHF"] as Currency[]).map((c) => (
                <option key={c} value={c}>
                  {c === "EUR" ? "€ EUR" : c === "USD" ? "$ USD" : c === "GBP" ? "£ GBP" : "₣ CHF"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-[#6b7280] mb-2 uppercase tracking-wider">
            Voci in fattura
          </label>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={it.id}
                className="grid grid-cols-[1fr_80px_100px_28px_28px] gap-2 items-start"
              >
                <div className="relative">
                  <input
                    ref={i === 0 ? firstItemRef : undefined}
                    type="text"
                    placeholder="Descrizione"
                    value={it.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2 pr-8 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleAIDescription(i)}
                    disabled={aiSuggestingIndex === i}
                    title="Suggerisci descrizione con AI"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs text-[#6b7280] hover:text-[#6c63ff] disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer transition-colors"
                  >
                    {aiSuggestingIndex === i ? "⏳" : "✨"}
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Qtà"
                  value={it.quantity || ""}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Prezzo"
                  value={it.unitPrice || ""}
                  onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                  className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1e2029] border-none text-[#6b7280] hover:text-[#ef4444] hover:bg-[#2a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-2 text-xs text-[#6c63ff] hover:text-[#8b5cf6] bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
          >
            + Aggiungi voce
          </button>

          {validationErrors.items && (
            <p className="text-xs text-[#ef4444] mt-1">{validationErrors.items}</p>
          )}
          {validationErrors.prices && (
            <p className="text-xs text-[#ef4444] mt-1">{validationErrors.prices}</p>
          )}
        </div>

        {/* VAT + Withholding Tax + Due Date */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5 uppercase tracking-wider">
              IVA %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={vatRate}
              onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-sm text-[#f0f0f2] focus:outline-none focus:border-[#6c63ff] transition-colors"
            />
            {validationErrors.vatRate && (
              <p className="text-xs text-[#ef4444] mt-1">{validationErrors.vatRate}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5 uppercase tracking-wider">
              Rit. d&apos;acconto %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={withholdingTaxRate}
              onChange={(e) => setWithholdingTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-sm text-[#f0f0f2] focus:outline-none focus:border-[#6c63ff] transition-colors"
            />
            {validationErrors.withholdingTaxRate && (
              <p className="text-xs text-[#ef4444] mt-1">{validationErrors.withholdingTaxRate}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5 uppercase tracking-wider">
              Scadenza
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-sm text-[#f0f0f2] focus:outline-none focus:border-[#6c63ff] transition-colors"
            />
            {validationErrors.dueDate && (
              <p className="text-xs text-[#ef4444] mt-1">{validationErrors.dueDate}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">
              Note (opzionali)
            </label>
            <button
              type="button"
              onClick={handleAINotes}
              disabled={aiSuggestingNotes}
              title="Suggerisci note con AI"
              className="text-xs text-[#6c63ff] hover:text-[#8b5cf6] disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer transition-colors flex items-center gap-1"
            >
              {aiSuggestingNotes ? "⏳ AI sta scrivendo..." : "✨ AI suggerisci"}
            </button>
          </div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note aggiuntive visibili in fattura"
            className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-2.5 text-sm text-[#f0f0f2] placeholder-[#6b7280] resize-none focus:outline-none focus:border-[#6c63ff] transition-colors"
          />
        </div>

        {/* Totals */}
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-4 mb-6 space-y-1.5">
          <div className="flex justify-between text-sm text-[#6b7280]">
            <span>Subtotale</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#6b7280]">
            <span>IVA {vatRate}%</span>
            <span>{formatCurrency(vat, currency)}</span>
          </div>
          {withholdingTaxRate > 0 && (
            <div className="flex justify-between text-sm text-[#6b7280]">
              <span>Rit. d&apos;acconto {withholdingTaxRate}%</span>
              <span className="text-[#f59e0b]">-{formatCurrency(withholding, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-[#6b7280] pt-2 border-t border-[#1e2029]">
            <span>Totale lordo</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-[#f0f0f2]">
            <span>Netto a pagare</span>
            <span style={{ color: "#6c63ff" }}>{formatCurrency(netTotal, currency)}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-lg px-4 py-3 text-sm text-[#ef4444] mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-[#6b7280] hover:text-[#e5e7eb] bg-transparent border border-[#1e2029] cursor-pointer transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer transition-colors"
          >
            {saving ? "Salvataggio..." : "✦ Crea fattura"}
          </button>
        </div>
      </div>
    </>
  );
}
