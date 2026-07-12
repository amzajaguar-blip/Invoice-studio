import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";

export const metadata: Metadata = {
  title: "Termini di Servizio",
  description: "Termini e condizioni di utilizzo di VELA.",
  alternates: {
    languages: {
      it: "/terms",
      en: "/en/terms",
    },
  },
};

export default function TermsPage() {
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
          <LanguageSelector current="/terms" itPath="/terms" enPath="/en/terms" />
        </div>

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
            VELA (&ldquo;l&apos;App&rdquo;) è un&apos;applicazione mobile Android
            che consente a freelance, professionisti e piccole imprese con
            partita IVA di creare, inviare e gestire fatture e preventivi
            professionali. L&apos;app funziona offline-first con sincronizzazione
            cloud opzionale e gestisce abbonamenti premium tramite Google Play
            Billing.
          </p>
        </section>

        {/* 2. Registrazione e account */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Registrazione e Account
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Per utilizzare l&apos;App è necessario creare un account
            fornendo un indirizzo email valido e una password. L&apos;utente è
            responsabile della riservatezza delle proprie credenziali e di tutte
            le attività che avvengono tramite il proprio account. È vietato
            condividere le credenziali con terzi o utilizzare l&apos;account per
            attività illegali. VELA si riserva il diritto di
            sospendere o chiudere account che violino i presenti termini.
          </p>
        </section>

        {/* 3. Obblighi dell'utente */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            3. Obblighi dell&apos;Utente
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            Utilizzando VELA, l&apos;utente si impegna a:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>Fornire informazioni accurate e aggiornate.</li>
            <li>
              Non utilizzare l&apos;App per attività fraudolente, illegali o
              non autorizzate.
            </li>
            <li>
              Non violare i diritti di proprietà intellettuale di VELA
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
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            VELA offre un piano gratuito e due piani premium a pagamento
            (mensile e annuale). I prezzi sono pubblicati nell&apos;app e su
            Google Play Store. Gli abbonamenti sono gestiti tramite
            <strong>Google Play Billing</strong> su Android.
            <strong>RevenueCat</strong> funge da layer di gestione
            abbonamenti/entitlements e non memorizza dati di carte.
            L&apos;utente è responsabile del pagamento puntuale tramite il proprio
            account Google. Il mancato pagamento comporta la sospensione delle
            funzionalità premium. I rinnovi sono automatici salvo disdetta
            (gestita da Google Play). Le commissioni di transazione sui pagamenti
            ricevuti dai clienti (es. fatture pagate via bonifico) sono a carico
            dell&apos;utente.
          </p>
        </section>

        {/* 5. Proprietà intellettuale */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            5. Proprietà Intellettuale
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Il software, il design, i loghi e i contenuti dell&apos;App sono
            di proprietà esclusiva di VELA e sono protetti dalle leggi
            italiane e internazionali sul diritto d&apos;autore. I contenuti
            inseriti dall&apos;utente (dati dei clienti, fatture, preventivi, note) rimangono
            di proprietà dell&apos;utente stesso. L&apos;utente concede a
            VELA una licenza limitata per trattare tali dati al solo
            fine di erogare il servizio.
          </p>
        </section>

        {/* 6. Limitazione di responsabilità */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Limitazione di Responsabilità
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            VELA fornisce il servizio &ldquo;così com&apos;è&rdquo;
            (&ldquo;as is&rdquo;) e non garantisce che il servizio sia privo di
            errori o interruzioni. Nei limiti consentiti dalla legge,
            VELA non sarà responsabile per danni diretti o indiretti
            derivanti dall&apos;uso o dall&apos;impossibilità di usare l&apos;App,
            inclusi ma non limitati a perdita di dati, mancati
            guadagni o interruzioni di attività. La responsabilità complessiva
            di VELA non supererà in ogni caso l&apos;importo pagato
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
            mantiene un account attivo sull&apos;App. L&apos;utente può
            chiudere il proprio account in qualsiasi momento dalle impostazioni.
            VELA può terminare o sospendere l&apos;accesso per
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
            foro del tribunale nella cui circoscrizione ha sede VELA,
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
            VELA si riserva il diritto di modificare i presenti termini
            in qualsiasi momento. Le modifiche saranno comunicate via email con
            almeno 15 giorni di preavviso. L&apos;uso continuato dell&apos;App
            dopo l&apos;entrata in vigore delle modifiche costituisce
            accettazione dei nuovi termini.
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            VELA — App mobile per fatturazione e preventivi professionali.
            Per domande sui termini:{" "}
            <span className="text-[#6c63ff]">supporto@vela.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
