import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Informativa sulla privacy di VELA — GDPR compliant.",
  alternates: {
    languages: {
      it: "/privacy",
      en: "/en/privacy",
    },
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#d1d5db]">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="text-sm text-[#6c63ff] hover:text-[#8b5cf6] no-underline transition-colors"
          >
            ← Torna alla home
          </Link>
          <LanguageSelector current="/privacy" itPath="/privacy" enPath="/en/privacy" />
        </div>

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
            VELA, con sede operativa in Italia, è il titolare del
            trattamento dei dati personali raccolti attraverso questa
            applicazione mobile. Per qualsiasi richiesta relativa alla privacy, puoi
            contattarci all&apos;indirizzo email:{" "}
            <span className="text-[#6c63ff]">privacy@vela.app</span>.
          </p>
        </section>

        {/* 2. Dati raccolti */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Dati Raccolti e Finalità del Trattamento
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-4">
            Raccogliamo le seguenti categorie di dati personali:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-2 mb-4">
            <li>
              <strong>Dati di registrazione e profilo:</strong> nome, email,
              password (hash), lingua preferita, fuso orario.
            </li>
            <li>
              <strong>Dati fiscali e aziendali (opzionali):</strong> ragione
              sociale, partita IVA/CF, indirizzo, CAP, città, nazione,
              codice SDI/PEC per fatturazione elettronica.
            </li>
            <li>
              <strong>Dati dei documenti:</strong> fatture, preventivi, clienti,
              prodotti/servizi, importi, IVA, date, numerazione.
            </li>
            <li>
              <strong>Dati di pagamento (gestiti da Google Play Billing):</strong>
              l&apos;app non raccoglie né conserva numeri di carta di credito,
              coordinate bancarie o dati sensibili di pagamento. Gli abbonamenti
              sono processati tramite <strong>Google Play Billing</strong> su
              Android. <strong>RevenueCat</strong> funge da layer di gestione
              abbonamenti/entitlements e non memorizza dati di carte.
            </li>
            <li>
              <strong>Dati di utilizzo e diagnostici (Sentry):</strong> errori,
              performance, crash report, session replay (testo/mascherato).
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Base giuridica: esecuzione contratto (art. 6.1.b GDPR), consenso
            (art. 6.1.a per analytics), interesse legittimo (art. 6.1.f per
            sicurezza/antifrode).
          </p>
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
                Erogazione del servizio (Art. 6.1.b GDPR):
              </strong>{" "}
              gestione account, fatture, preventivi, clienti, sincronizzazione
              cloud, backup.
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Obblighi di legge (Art. 6.1.c GDPR):
              </strong>{" "}
              conservazione 10 anni documenti fiscali (Art. 2220 c.c.),
              fatturazione elettronica (SDI).
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Consenso (Art. 6.1.a GDPR):
              </strong>{" "}
              analisi crash/performance (Sentry).
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Interesse legittimo (Art. 6.1.f GDPR):
              </strong>{" "}
              sicurezza, antifrode, prevenzione abuso, miglioramento servizio.
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
            <span className="text-[#6c63ff]">privacy@vela.app</span>.
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

        {/* 6. Cookie e tecnologie simili */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Cookie e Tecnologie Simili
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            L&apos;app mobile VELA (Android) non utilizza cookie web
            tradizionali. Impiega identificatori di dispositivo per:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2 mt-2">
            <li>Autenticazione e sessione (token sicuri, httpOnly).</li>
            <li>Diagnostica crash/performance (Sentry) — testo mascherato.</li>
          </ul>
        </section>

        {/* 7. Terze parti (Responsabili del Trattamento) */}
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
              <strong className="text-[#d1d5db]">RevenueCat:</strong> gestione
              abbonamenti, entitlements, validazione receipt Google Play.
              Non conserva dati di carte di credito.{" "}
              <a
                href="https://www.revenuecat.com/privacy/"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Google Play Billing:</strong>
              elaborazione pagamenti abbonamenti in-app Android.{" "}
              <a
                href="https://policies.google.com/privacy"
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
            VELA — App mobile per fatturazione e preventivi professionali.
            Sede operativa in Italia.
          </p>
        </div>
      </div>
    </div>
  );
}
