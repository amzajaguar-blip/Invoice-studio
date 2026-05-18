import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termini di Servizio",
  description: "Termini e condizioni di utilizzo di InvoiceStudio.",
};

export default function TermsPage() {
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
          Termini di Servizio
        </h1>
        <p className="text-sm text-[#9ca3af] mb-10">
          Ultimo aggiornamento: 18 maggio 2026
        </p>

        {/* 1. Descrizione del servizio */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            1. Descrizione del Servizio
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio (&ldquo;la Piattaforma&rdquo;) è un servizio SaaS
            (Software as a Service) che consente a freelancer, professionisti e
            piccole agenzie con partita IVA di creare, inviare e gestire fatture
            professionali, accettare pagamenti online tramite Stripe e
            automatizzare i reminder di pagamento. Il servizio è accessibile via
            web all&apos;indirizzo{" "}
            <span className="text-[#6c63ff]">invoicestudio.it</span>.
          </p>
        </section>

        {/* 2. Registrazione e account */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Registrazione e Account
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Per utilizzare la Piattaforma è necessario creare un account
            fornendo un indirizzo email valido e una password. L&apos;utente è
            responsabile della riservatezza delle proprie credenziali e di tutte
            le attività che avvengono tramite il proprio account. È vietato
            condividere le credenziali con terzi o utilizzare l&apos;account per
            attività illegali. InvoiceStudio si riserva il diritto di
            sospendere o chiudere account che violino i presenti termini.
          </p>
        </section>

        {/* 3. Obblighi dell'utente */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            3. Obblighi dell&apos;Utente
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            Utilizzando InvoiceStudio, l&apos;utente si impegna a:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>Fornire informazioni accurate e aggiornate.</li>
            <li>
              Non utilizzare la Piattaforma per attività fraudolente, illegali o
              non autorizzate.
            </li>
            <li>
              Non violare i diritti di proprietà intellettuale di InvoiceStudio
              o di terzi.
            </li>
            <li>
              Rispettare la normativa fiscale italiana in materia di
              fatturazione elettronica e conservazione dei documenti.
            </li>
            <li>
              Non tentare di accedere a dati o account di altri utenti senza
              autorizzazione.
            </li>
          </ul>
        </section>

        {/* 4. Pagamenti e abbonamenti */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            4. Pagamenti e Abbonamenti
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio offre piani gratuiti e a pagamento. I prezzi e le
            funzionalità di ciascun piano sono pubblicati sulla pagina dei
            prezzi. I pagamenti sono elaborati tramite Stripe, in conformità con
            gli standard PCI-DSS. L&apos;utente è responsabile del pagamento
            puntuale delle fatture di abbonamento. Il mancato pagamento può
            comportare la sospensione o degradazione del servizio. I rinnovi
            sono automatici salvo disdetta. Le commissioni di transazione sui
            pagamenti ricevuti dai clienti sono a carico dell&apos;utente e sono
            calcolate in base alle tariffe Stripe vigenti.
          </p>
        </section>

        {/* 5. Proprietà intellettuale */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            5. Proprietà Intellettuale
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Il software, il design, i loghi e i contenuti della Piattaforma sono
            di proprietà esclusiva di InvoiceStudio e sono protetti dalle leggi
            italiane e internazionali sul diritto d&apos;autore. I contenuti
            inseriti dall&apos;utente (dati dei clienti, fatture, note) rimangono
            di proprietà dell&apos;utente stesso. L&apos;utente concede a
            InvoiceStudio una licenza limitata per trattare tali dati al solo
            fine di erogare il servizio.
          </p>
        </section>

        {/* 6. Limitazione di responsabilità */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Limitazione di Responsabilità
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio fornisce il servizio &ldquo;così com&apos;è&rdquo;
            (&ldquo;as is&rdquo;) e non garantisce che il servizio sia privo di
            errori o interruzioni. Nei limiti consentiti dalla legge,
            InvoiceStudio non sarà responsabile per danni diretti o indiretti
            derivanti dall&apos;uso o dall&apos;impossibilità di usare la
            Piattaforma, inclusi ma non limitati a perdita di dati, mancati
            guadagni o interruzioni di attività. La responsabilità complessiva
            di InvoiceStudio non supererà in ogni caso l&apos;importo pagato
            dall&apos;utente negli ultimi 12 mesi.
          </p>
        </section>

        {/* 7. Risoluzione */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            7. Durata e Risoluzione
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            I presenti termini restano in vigore fino a quando l&apos;utente
            mantiene un account attivo sulla Piattaforma. L&apos;utente può
            chiudere il proprio account in qualsiasi momento dalle impostazioni.
            InvoiceStudio può terminare o sospendere l&apos;accesso per
            violazione dei presenti termini, con preavviso di 7 giorni (o
            immediatamente in caso di violazioni gravi). Alla cessazione,
            l&apos;utente avrà 30 giorni per esportare i propri dati. Trascorso
            tale termine, i dati saranno cancellati, salvo obblighi di
            conservazione fiscale.
          </p>
        </section>

        {/* 8. Legge applicabile */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            8. Legge Applicabile e Foro Competente
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            I presenti Termini di Servizio sono regolati dalla legge italiana.
            Per qualsiasi controversia derivante dall&apos;interpretazione o
            esecuzione dei presenti termini, sarà competente in via esclusiva il
            foro del tribunale nella cui circoscrizione ha sede InvoiceStudio,
            salvo quanto previsto dal Codice del Consumo (D.Lgs. 206/2005) per i
            consumatori.
          </p>
        </section>

        {/* 9. Modifiche */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            9. Modifiche ai Termini
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            InvoiceStudio si riserva il diritto di modificare i presenti termini
            in qualsiasi momento. Le modifiche saranno comunicate via email con
            almeno 15 giorni di preavviso. L&apos;uso continuato della
            Piattaforma dopo l&apos;entrata in vigore delle modifiche costituisce
            accettazione dei nuovi termini.
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            InvoiceStudio — Piattaforma SaaS per fatturazione professionale.
            Per domande sui termini:{" "}
            <span className="text-[#6c63ff]">supporto@invoicestudio.it</span>
          </p>
        </div>
      </div>
    </div>
  );
}
