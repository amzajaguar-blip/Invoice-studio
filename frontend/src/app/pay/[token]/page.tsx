import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import { PayClient } from "./PayClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paga la tua fattura — InvoiceStudio",
  description: "Pagamento sicuro tramite Stripe",
  robots: { index: false, follow: false },
};

interface InvoiceWithClient {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  withholding_tax_rate: number;
  total: number;
  currency: string;
  notes: string | null;
  clients: {
    name: string;
    email: string;
  } | null;
  invoice_items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
}

interface PaymentTokenRecord {
  id: string;
  invoice_id: string;
  token_hash: string;
  stripe_pi_id: string | null;
  expires_at: string;
  used_at: string | null;
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status: paymentStatus } = await searchParams;

  // Hash the token to look it up
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const supabase = createAdminClient();

  // Look up payment token
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("payment_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single() as { data: PaymentTokenRecord | null; error: unknown };

  if (tokenError || !tokenRecord) {
    notFound();
  }

  // Check if already used
  if (tokenRecord.used_at) {
    return (
      <PayPageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-6">✅</div>
          <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
            Fattura già pagata
          </h1>
          <p className="text-[#6b7280] max-w-md mx-auto">
            Questa fattura è stata saldata. Se hai domande, contatta chi ti ha inviato la fattura.
          </p>
        </div>
      </PayPageShell>
    );
  }

  // Check if expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return (
      <PayPageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-6">⏰</div>
          <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
            Link scaduto
          </h1>
          <p className="text-[#6b7280] max-w-md mx-auto">
            Questo link di pagamento non è più valido. Chiedi a chi ti ha inviato la fattura di generarne uno nuovo.
          </p>
        </div>
      </PayPageShell>
    );
  }

  // Fetch invoice with client and items
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*, clients(name, email), invoice_items(*)")
    .eq("id", tokenRecord.invoice_id)
    .single() as { data: InvoiceWithClient | null; error: unknown };

  if (invoiceError || !invoice) {
    notFound();
  }

  // If payment was successful, show confirmation
  if (paymentStatus === "success") {
    return (
      <PayPageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
            Pagamento completato!
          </h1>
          <p className="text-[#6b7280] max-w-md mx-auto mb-2">
            La fattura <span className="text-[#d1d5db] font-medium">{invoice.number}</span> è stata saldata con successo.
          </p>
          <p className="text-[#6b7280] max-w-md mx-auto">
            Riceverai una conferma via email a breve.
          </p>
        </div>
      </PayPageShell>
    );
  }

  // Show invoice summary with Pay button
  const currencySymbol: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    CHF: "Fr.",
  };
  const sym = currencySymbol[invoice.currency] || invoice.currency;

  const formatCurrency = (amount: number) =>
    `${sym} ${amount.toFixed(2)}`;

  const vatAmount = invoice.subtotal * (invoice.tax_rate / 100);
  const withholdingAmount = invoice.subtotal * (invoice.withholding_tax_rate / 100);

  return (
    <PayPageShell>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#6c63ff]/10 mb-4">
            <svg className="w-8 h-8 text-[#6c63ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-2">
            Fattura {invoice.number}
          </h1>
          <p className="text-[#6b7280]">
            Da: <span className="text-[#d1d5db]">{invoice.clients?.name || "—"}</span>
          </p>
        </div>

        {/* Invoice details */}
        <div className="bg-[#111318] rounded-xl border border-[#1f2128] p-6 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#6b7280]">Data emissione</span>
            <span className="text-[#d1d5db]">{invoice.issue_date}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-[#6b7280]">Scadenza</span>
            <span className="text-[#d1d5db]">{invoice.due_date}</span>
          </div>

          <div className="border-t border-[#1f2128] pt-4 space-y-3">
            {invoice.invoice_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-[#d1d5db] flex-1">
                  {item.description}
                  <span className="text-[#6b7280] ml-1">×{item.quantity}</span>
                </span>
                <span className="text-[#d1d5db] font-medium ml-4">
                  {formatCurrency(item.unit_price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1f2128] mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6b7280]">Imponibile</span>
              <span className="text-[#d1d5db]">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">IVA {invoice.tax_rate}%</span>
                <span className="text-[#d1d5db]">{formatCurrency(vatAmount)}</span>
              </div>
            )}
            {invoice.withholding_tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Rit. d&apos;acconto {invoice.withholding_tax_rate}%</span>
                <span className="text-[#ef4444]">-{formatCurrency(withholdingAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-[#1f2128]">
              <span className="text-[#f0f0f2]">Totale da pagare</span>
              <span className="text-[#f0f0f2]">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-[#111318] rounded-xl border border-[#1f2128] p-4 mb-6">
            <p className="text-sm text-[#6b7280]">
              <span className="text-[#d1d5db] font-medium">Note:</span> {invoice.notes}
            </p>
          </div>
        )}

        <PayClient
          token={token}
          invoiceNumber={invoice.number}
        />

        <p className="text-center text-xs text-[#6b7280] mt-6">
          Pagamento sicuro tramite{" "}
          <span className="text-[#d1d5db]">Stripe</span>. I tuoi dati sono crittografati.
        </p>
      </div>
    </PayPageShell>
  );
}

/** Shared layout wrapper for the payment page */
function PayPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#d1d5db] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="text-center mb-8">
          <span className="text-lg font-bold text-[#f0f0f2] font-[Georgia,serif] tracking-tight">
            Invoice<span className="text-[#6c63ff]">Studio</span>
          </span>
        </div>

        {children}

        {/* Footer */}
        <div className="text-center mt-12 text-xs text-[#6b7280] space-x-4">
          <a href="/privacy" className="hover:text-[#d1d5db] transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-[#d1d5db] transition-colors">Termini</a>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
