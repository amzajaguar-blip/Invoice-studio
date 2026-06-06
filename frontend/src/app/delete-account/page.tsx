"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertTriangle } from "lucide-react";

/**
 * DeleteAccountPage — Google Play Store Data Safety required page.
 * URL: https://invoicestudio.app/delete-account
 *
 * Provides two deletion paths:
 * 1. In-app: Settings → Elimina account (authenticated)
 * 2. Email: mailto:privacy@invoicestudio.it (from registered email)
 */
export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    // Open the user's email client with a pre-filled deletion request
    const subject = encodeURIComponent("Richiesta cancellazione account InvoiceStudio");
    const body = encodeURIComponent(
      `Gentile team InvoiceStudio,\n\n` +
        `Richiedo la cancellazione permanente del mio account e di tutti i dati personali associati.\n\n` +
        `Email account: ${email}\n\n` +
        `Ai sensi dell'art. 17 GDPR (diritto all'oblio), chiedo che vengano eliminati tutti i miei dati personali, ` +
        `fatti salvi gli obblighi di conservazione fiscale previsti dalla legge italiana (10 anni per le fatture emesse).\n\n` +
        `Cordiali saluti`
    );
    window.location.href = `mailto:privacy@invoicestudio.it?subject=${subject}&body=${body}`;
    setStatus("sent");
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#d1d5db]">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-[#6c63ff] hover:text-[#8b5cf6] no-underline transition-colors inline-block mb-8"
        >
          ← Torna alla home
        </Link>

        <h1 className="text-3xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
          Elimina il tuo account InvoiceStudio
        </h1>
        <p className="text-sm text-[#9ca3af] mb-10">
          Scegli uno dei metodi qui sotto per richiedere la cancellazione
          permanente del tuo account e dei dati associati.
        </p>

        {/* FORM: Richiesta via email (non autenticata) */}
        <section className="mb-10 p-6 bg-[#111318] rounded-lg border border-[#1e2029]">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-2">
            Richiedi via email
          </h2>
          <p className="text-sm text-[#9ca3af] mb-4">
            Inserisci l&apos;indirizzo email del tuo account. Ti verrà aperto il
            client email con una richiesta pre-compilata da inviare a{" "}
            <a
              href="mailto:privacy@invoicestudio.it"
              className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
            >
              privacy@invoicestudio.it
            </a>
            .
          </p>

          {status === "sent" ? (
            <div className="p-4 bg-[#065f46]/20 border border-[#065f46] rounded-md text-sm text-[#a7f3d0]">
              <CheckCircle className="w-4 h-4 inline-block align-text-bottom mr-1" /> Email aperta. Invia la richiesta dal tuo client email. Ti
              risponderemo entro 30 giorni.
            </div>
          ) : status === "error" ? (
            <div className="p-4 bg-[#7f1d1d]/20 border border-[#7f1d1d] rounded-md text-sm text-[#fecaca]">
              <AlertTriangle className="w-4 h-4 inline-block align-text-bottom mr-1" /> Si è verificato un errore. Prova a scrivere direttamente a{" "}
              <span className="text-[#f0f0f2]">privacy@invoicestudio.it</span>.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="la.tua.email@esempio.com"
                className="flex-1 px-4 py-3 bg-[#0a0b0f] border border-[#2d2f3a] rounded-md text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold rounded-md transition-colors whitespace-nowrap"
              >
                Apri email di richiesta
              </button>
            </form>
          )}
        </section>

        {/* Metodo 2: In-app (autenticato) */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-4">
            Elimina dall&apos;app (consigliato)
          </h2>
          <ol className="list-decimal list-inside text-sm text-[#9ca3af] space-y-3 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Accedi</strong> al tuo account
              su{" "}
              <Link
                href="/login"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                invoicestudio.app/login
              </Link>
            </li>
            <li>
              <strong className="text-[#d1d5db]">Impostazioni</strong> — Dalla
              dashboard, clicca sull&apos;icona profilo in alto a destra e
              seleziona &ldquo;Impostazioni&rdquo;.
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                &ldquo;Elimina account&rdquo;
              </strong>{" "}
              — In fondo alla pagina, premi il pulsante rosso.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Conferma</strong> — Digita
              &ldquo;ELIMINA&rdquo; per confermare. L&apos;operazione è
              irreversibile.
            </li>
          </ol>
        </section>

        {/* Cosa viene eliminato */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-4">
            Dati eliminati
          </h2>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-2 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Account:</strong> nome, email,
              password (hash), preferenze, sessioni.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Clienti:</strong> anagrafica
              clienti, contatti.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Pagamenti:</strong> dati
              Stripe associati (cancellati anche lato Stripe).
            </li>
            <li>
              <strong className="text-[#d1d5db]">Tecnici:</strong> log,
              sessioni, dati diagnostici (Sentry).
            </li>
            <li>
              <strong className="text-[#d1d5db]">Crediti:</strong> rewarded ad
              credits non utilizzati.
            </li>
          </ul>
        </section>

        {/* Cosa resta */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-4">
            Dati conservati (obbligo di legge — 10 anni)
          </h2>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-2 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Fatture emesse</strong> — Art.
              2220 c.c., conservazione fiscale 10 anni.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Registri contabili</strong> —
              obbligo civilistico e fiscale italiano.
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Transazioni anonimizzate
              </strong>{" "}
              — ID e importi, senza riferimento all&apos;account.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-[#9ca3af] mt-3">
            Allo scadere dei 10 anni, i dati residui vengono eliminati
            definitivamente.
          </p>
        </section>

        {/* Tempistiche */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            Tempistiche
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            I dati vengono cancellati entro{" "}
            <strong className="text-[#d1d5db]">30 giorni</strong> dalla
            richiesta. Riceverai una email di conferma a completamento.
          </p>
        </section>

        {/* Contatti */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            Contatti
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Titolare del Trattamento: InvoiceStudio —{" "}
            <a
              href="mailto:privacy@invoicestudio.it"
              className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
            >
              privacy@invoicestudio.it
            </a>
            . Diritto di reclamo al{" "}
            <a
              href="https://www.garanteprivacy.it"
              className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
            >
              Garante Privacy
            </a>
            .
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            InvoiceStudio — Piattaforma SaaS per fatturazione professionale.
            Sviluppatore: InvoiceStudio. Sede operativa in Italia.
          </p>
        </div>
      </div>
    </div>
  );
}
