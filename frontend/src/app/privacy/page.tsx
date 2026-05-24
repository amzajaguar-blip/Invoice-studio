import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Informativa sulla privacy di InvoiceStudio — GDPR compliant.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-[#9ca3af] mb-10">
          Ultimo aggiornamento: 25 maggio 2026
        </p>

        {/* 1. Titolare del trattamento */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            1. Titolare del Trattamento
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio, con sede operativa in Italia, è il titolare del
            trattamento dei dati personali raccolti attraverso questa
            piattaforma SaaS. Per qualsiasi richiesta relativa alla privacy, puoi
            contattarci all&apos;indirizzo email:{" "}
            <span className="text-[#6c63ff]">privacy@invoicestudio.it</span>.
          </p>
        </section>

        {/* 2. Dati raccolti */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Dati Personali Raccolti
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            Raccogliamo le seguenti categorie di dati personali:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Dati dell&apos;account:</strong>{" "}
              nome completo, indirizzo email, password (hash crittografato).
            </li>
            <li>
              <strong className="text-[#d1d5db]">Dati di fatturazione:</strong>{" "}
              informazioni relative ai clienti (nome, email, partita IVA,
              indirizzo), dettagli delle fatture emesse.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Dati di pagamento:</strong>{" "}
              gestiti esclusivamente tramite Stripe. InvoiceStudio non memorizza
              dati di carte di credito o debito.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Dati tecnici:</strong>{" "}
              indirizzo IP, tipo di browser, sistema operativo, pagine visitate
              (solo cookie tecnici essenziali).
            </li>
            <li>
              <strong className="text-[#d1d5db]">Dati pubblicitari:</strong>{" "}
              ID dispositivo (Advertising ID / AD_ID) e dati di interazione con
              gli annunci (visualizzazioni video rewarded), raccolti tramite
              Google AdMob per erogare annunci premiali facoltativi all&apos;interno
              dell&apos;app mobile.
            </li>
          </ul>
        </section>

        {/* 3. Finalità e base giuridica */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            3. Finalità e Base Giuridica
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            Trattiamo i tuoi dati personali per le seguenti finalità:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">
                Esecuzione del contratto (Art. 6.1.b GDPR):
              </strong>{" "}
              fornire il servizio SaaS di fatturazione, gestire il tuo account,
              elaborare le fatture.
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Obblighi di legge (Art. 6.1.c GDPR):
              </strong>{" "}
              conservazione dei dati fiscali e contabili come richiesto dalla
              normativa italiana (10 anni per le fatture).
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Legittimo interesse (Art. 6.1.f GDPR):
              </strong>{" "}
              garantire la sicurezza della piattaforma, prevenire frodi,
              migliorare il servizio.
            </li>
          </ul>
        </section>

        {/* 4. Conservazione */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            4. Periodo di Conservazione
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            I dati del tuo account sono conservati fino alla richiesta di
            cancellazione. I dati fiscali e le fatture sono conservati per 10
            anni come previsto dalla normativa italiana (Art. 2220 c.c.). I log
            tecnici sono conservati per un massimo di 12 mesi.
          </p>
        </section>

        {/* 5. Diritti dell'utente */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            5. I Tuoi Diritti (Artt. 15-22 GDPR)
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            In qualità di interessato, hai i seguenti diritti:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Accesso:</strong> ottenere
              conferma dell&apos;esistenza di dati che ti riguardano e riceverne
              copia.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Rettifica:</strong> correggere
              dati inesatti o incompleti.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Cancellazione:</strong>{" "}
              richiedere la cancellazione dei dati (diritto all&apos;oblio), nei
              limiti di legge.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Portabilità:</strong> ricevere
              i tuoi dati in formato strutturato e trasferirli ad altro
              titolare.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Limitazione:</strong> ottenere
              la limitazione del trattamento in determinate circostanze.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Opposizione:</strong> opporti
              al trattamento basato sul legittimo interesse.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-[#9ca3af] mt-2">
            Per esercitare i tuoi diritti, scrivi a{" "}
            <span className="text-[#6c63ff]">privacy@invoicestudio.it</span>.
            Risponderemo entro 30 giorni. Hai inoltre il diritto di presentare
            reclamo al Garante per la Protezione dei Dati Personali (
            <a
              href="https://www.garanteprivacy.it"
              className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
            >
              www.garanteprivacy.it
            </a>
            ).
          </p>
        </section>

        {/* 6. Cookie */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Cookie Policy
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio utilizza esclusivamente cookie tecnici essenziali per
            il funzionamento della piattaforma (autenticazione, sicurezza,
            preferenze di sessione). Non utilizziamo cookie di profilazione sul
            sito web.
          </p>
          <p className="text-sm leading-relaxed text-[#9ca3af] mt-2">
            L&apos;app mobile (Android) integra Google AdMob per la pubblicità
            rewarded. AdMob può utilizzare l&apos;ID pubblicità del dispositivo
            (AD_ID) per erogare annunci. Gli utenti possono reimpostare o
            disattivare l&apos;ID pubblicità dalle impostazioni Android:
            Impostazioni → Google → Annunci → &ldquo;Ripristina ID
            pubblicità&rdquo; o &ldquo;Disattiva personalizzazione annunci&rdquo;.
          </p>
        </section>

        {/* 7. Terze parti */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            7. Terze Parti (Responsabili del Trattamento)
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            Per erogare il servizio, ci avvaliamo dei seguenti responsabili del
            trattamento, tutti conformi al GDPR:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Supabase:</strong> hosting del
              database e autenticazione. Server in UE (Francoforte).{" "}
              <a
                href="https://supabase.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Stripe:</strong> elaborazione
              dei pagamenti online. Certificato PCI-DSS Level 1.{" "}
              <a
                href="https://stripe.com/it/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Resend:</strong> invio di email
              transazionali (fatture, reminder).{" "}
              <a
                href="https://resend.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Google AdMob:</strong>{" "}
              erogazione di annunci video rewarded nell&apos;app mobile. AdMob
              raccoglie l&apos;ID dispositivo (AD_ID) e i dati di interazione con
              gli annunci.{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Sentry:</strong> monitoraggio
              errori e diagnostica.{" "}
              <a
                href="https://sentry.io/privacy/"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
          </ul>
        </section>

        {/* 8. Modifiche */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            8. Modifiche alla Privacy Policy
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Eventuali modifiche alla presente informativa saranno pubblicate su
            questa pagina e, se sostanziali, notificate via email. Ti invitiamo
            a consultare periodicamente questa pagina.
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            InvoiceStudio — Piattaforma SaaS per fatturazione professionale.
            Sede operativa in Italia.
          </p>
        </div>
      </div>
    </div>
  );
}
