"use client";

import { useState } from "react";

interface ClientFormProps {
  onClose: () => void;
  onSave: (client: { name: string; email: string; vatNumber?: string; phone?: string }) => void;
}

export function ClientForm({ onClose, onSave }: ClientFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Il nome è obbligatorio"); return; }
    if (!email.trim()) { setError("L'email è obbligatoria"); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          vat_number: vatNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          currency: "EUR",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Errore creazione cliente");
      }
      const data = await res.json();
      onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Nuovo Cliente</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Studio Legale Rossi"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@esempio.it"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">P. IVA / CF</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="IT12345678901"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefono</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 02 1234567"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">
          Annulla
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim() || !email.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Crea Cliente"}
        </button>
      </div>
    </div>
  );
}
