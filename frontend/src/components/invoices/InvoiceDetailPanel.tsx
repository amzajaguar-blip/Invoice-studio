"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatItalianDate } from "@/lib/utils";
import { ShareInvoice } from "@/components/promotion/ShareInvoice";
import type { Invoice, InvoiceStatus } from "@/types";

interface InvoiceDetailPanelProps {
  invoice: Invoice & {
    clients?: { name: string; email: string; vat_number?: string | null; address?: string | null } | null;
    invoice_items?: Array<{
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
    }>;
    invoice_events?: Array<{
      id: string;
      event_type: string;
      created_at: string;
    }>;
  };
  onClose: () => void;
  reminded: boolean;
  onRemind: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  created: "Fattura creata",
  sent: "Email inviata al cliente",
  opened: "Fattura visualizzata dal cliente",
  paid: "Pagamento ricevuto",
  reminder_sent: "Reminder inviato",
  cancelled: "Fattura annullata",
  viewed: "Visualizzata",
};

export function InvoiceDetailPanel({
  invoice,
  onClose,
  reminded,
  onRemind,
}: InvoiceDetailPanelProps) {
  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ── Action states ────────────────────────────────────────────────────────
  const [paymentLink, setPaymentLink] = useState<string | null>(invoice.payment_link ?? null);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = invoice.invoice_items || [];
  const events = (invoice.invoice_events || []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const client = invoice.clients;

  const currency = (invoice.currency as "EUR" | "USD" | "GBP" | "CHF") || "EUR";
  const vatRate = invoice.tax_rate ?? invoice.vatRate ?? 22;

  // ── Generate Stripe payment link ─────────────────────────────────────────
  async function handleGeneratePaymentLink() {
    setGeneratingLink(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/generate-payment-link`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Errore nella generazione del link");
      } else {
        setPaymentLink(json.data.payUrl);
        setStripeUrl(json.data.stripeUrl);
      }
    } catch {
      setActionError("Errore di rete. Riprova.");
    } finally {
      setGeneratingLink(false);
    }
  }

  // ── Copy payment link ────────────────────────────────────────────────────
  async function handleCopyLink() {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  // ── Send invoice email ───────────────────────────────────────────────────
  async function handleSendEmail() {
    setSendingEmail(true);
    setEmailError(null);

    // If no payment link yet, generate first
    let link = paymentLink;
    if (!link) {
      try {
        const linkRes = await fetch(`/api/invoices/${invoice.id}/generate-payment-link`, {
          method: "POST",
        });
        const linkJson = await linkRes.json();
        if (!linkRes.ok) {
          setEmailError(linkJson.error || "Errore nella generazione del link di pagamento");
          setSendingEmail(false);
          return;
        }
        link = linkJson.data.payUrl;
        setPaymentLink(link);
        setStripeUrl(linkJson.data.stripeUrl);
      } catch {
        setEmailError("Errore di rete. Riprova.");
        setSendingEmail(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setEmailError(json.error || "Errore nell'invio email");
      } else {
        setEmailSent(true);
      }
    } catch {
      setEmailError("Errore di rete. Riprova.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-[90]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-[min(440px,95vw)] bg-[#0d0e13] border-l border-[#1e2029] z-[100] overflow-y-auto shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Dettaglio fattura ${invoice.number}`}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 bg-[#1e2029] border-none rounded-lg text-[#9ca3af] w-8 h-8 cursor-pointer text-base flex items-center justify-center hover:bg-[#2a2d3a] transition-colors"
        >
          ✕
        </button>

        <div className="p-6 pt-4">
          {/* Status + Number */}
          <div className="flex items-center gap-3 mb-6">
            <StatusBadge status={invoice.status as InvoiceStatus} />
            <span className="text-sm text-[#6b7280]">{invoice.number}</span>
            <div className="ml-auto">
              <ShareInvoice invoiceNumber={invoice.number} />
            </div>
          </div>

          {/* Client */}
          {client && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#f0f0f2]">{client.name}</h3>
              <p className="text-xs text-[#6b7280]">{client.email}</p>
              {client.vat_number && (
                <p className="text-xs text-[#6b7280]">P.IVA: {client.vat_number}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-4 mb-6">
            <div className="text-3xl font-bold" style={{ color: "#6c63ff" }}>
              {formatCurrency(invoice.total || invoice.amount || 0, currency)}
            </div>
            <div className="text-xs text-[#6b7280] mt-1">
              {invoice.issue_date
                ? `Emessa il ${formatItalianDate(invoice.issue_date)}`
                : ""}
              {" · "}
              Scadenza:{" "}
              {invoice.due_date
                ? formatItalianDate(invoice.due_date)
                : "—"}
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-3">
                Voci in fattura
              </h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm bg-[#111318] rounded-lg px-3 py-2.5"
                  >
                    <div>
                      <span className="text-[#e5e7eb]">{item.description}</span>
                      <span className="text-[#6b7280] ml-2">
                        {item.quantity} × {formatCurrency(item.unit_price, currency)}
                      </span>
                    </div>
                    <span className="text-[#f0f0f2] font-medium">
                      {formatCurrency(item.quantity * item.unit_price, currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-[#6b7280]">
                  <span>Subtotale</span>
                  <span>
                    {formatCurrency(
                      items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
                      currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>IVA {vatRate}%</span>
                  <span>
                    {formatCurrency(
                      items.reduce((s, i) => s + i.quantity * i.unit_price, 0) *
                        (vatRate / 100),
                      currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-[#f0f0f2] pt-2 border-t border-[#1e2029]">
                  <span>Totale</span>
                  <span style={{ color: "#6c63ff" }}>
                    {formatCurrency(invoice.total || invoice.amount || 0, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tracking Timeline */}
          {events.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-3">
                Cronologia
              </h4>
              <div className="space-y-3">
                {events.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 ${
                          i === 0 ? "bg-[#6c63ff]" : "bg-[#1e2029]"
                        }`}
                      />
                      {i < events.length - 1 && (
                        <div className="w-px flex-1 bg-[#1e2029] mt-1" />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm text-[#e5e7eb]">
                        {EVENT_LABELS[event.event_type] || event.event_type}
                      </p>
                      <p className="text-xs text-[#6b7280] mt-0.5">
                        {new Date(event.created_at).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-2">
                Note
              </h4>
              <p className="text-sm text-[#9ca3af] bg-[#111318] rounded-lg p-3">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Error banner */}
          {(actionError || emailError) && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {actionError || emailError}
            </div>
          )}

          {/* ── Payment Link section (when generated) ── */}
          {paymentLink && invoice.status !== "paid" && (
            <div className="mb-4 bg-[#6c63ff]/8 border border-[#6c63ff]/20 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-[#6c63ff] uppercase tracking-wider">
                Link di pagamento generato
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2 text-xs rounded-lg bg-[#111318] border border-[#1e2029] text-[#9ca3af] hover:text-[#f0f0f2] transition-colors cursor-pointer truncate"
                >
                  {linkCopied ? "✓ Copiato!" : "📋 Copia link"}
                </button>
                {stripeUrl && (
                  <a
                    href={stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 text-xs rounded-lg bg-[#6c63ff] text-white text-center hover:bg-[#5b52e0] transition-colors no-underline"
                  >
                    🔗 Apri Stripe
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t border-[#1e2029]">

            {/* PDF download — always available */}
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center py-3 rounded-xl text-sm font-medium transition-colors no-underline cursor-pointer"
              style={{
                background: "#111318",
                border: "1px solid #1e2029",
                color: "#9ca3af",
              }}
            >
              📄 Scarica PDF
            </a>

            {/* Generate / show Stripe payment link */}
            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
              !paymentLink ? (
                <button
                  onClick={handleGeneratePaymentLink}
                  disabled={generatingLink}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer border-none"
                  style={{
                    background: generatingLink ? "rgba(108,99,255,0.3)" : "rgba(108,99,255,0.12)",
                    border: "1px solid rgba(108,99,255,0.3)",
                    color: generatingLink ? "#9ca3af" : "#6c63ff",
                  }}
                >
                  {generatingLink ? "⏳ Generazione..." : "💳 Genera Link Pagamento Stripe"}
                </button>
              ) : (
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer border-none"
                  style={{
                    background: "rgba(108,99,255,0.12)",
                    border: "1px solid rgba(108,99,255,0.3)",
                    color: linkCopied ? "#22c55e" : "#6c63ff",
                  }}
                >
                  {linkCopied ? "✓ Link copiato!" : "📋 Copia link pagamento"}
                </button>
              )
            )}

            {/* Send email (draft / sent / overdue) */}
            {(invoice.status === "draft" || invoice.status === "sent" || invoice.status === "overdue") && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || emailSent}
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer border-none"
                style={{
                  background: emailSent
                    ? "rgba(34,197,94,0.12)"
                    : sendingEmail
                    ? "#111318"
                    : "#6c63ff",
                  border: emailSent
                    ? "1px solid rgba(34,197,94,0.3)"
                    : "1px solid transparent",
                  color: emailSent ? "#22c55e" : sendingEmail ? "#9ca3af" : "#fff",
                }}
              >
                {emailSent
                  ? "✓ Email inviata al cliente"
                  : sendingEmail
                  ? "⏳ Invio in corso..."
                  : "📤 Invia fattura via email"}
              </button>
            )}

            {/* Reminder */}
            {(invoice.status === "sent" || invoice.status === "overdue") && (
              <button
                onClick={onRemind}
                disabled={reminded}
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer border-none"
                style={{
                  background: reminded ? "rgba(34,197,94,0.12)" : "#111318",
                  border: reminded ? "1px solid rgba(34,197,94,0.3)" : "1px solid #1e2029",
                  color: reminded ? "#22c55e" : "#9ca3af",
                }}
              >
                {reminded ? "✓ Reminder inviato" : "🔔 Invia Reminder"}
              </button>
            )}

            {/* Paid badge */}
            {invoice.status === "paid" && (
              <div className="w-full py-3 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] text-[#22c55e] font-medium rounded-xl text-sm text-center">
                ✓ Pagata il{" "}
                {invoice.paid_at
                  ? formatItalianDate(invoice.paid_at)
                  : invoice.paidAt
                    ? formatItalianDate(invoice.paidAt)
                    : "—"}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
