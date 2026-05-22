import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "InvoiceStudio — Fatture Professionali per Freelancer Italiani",
  description:
    "Crea fatture, accetta pagamenti con Stripe e automatizza i reminder. Risparmia 3-5 ore a settimana. Provalo gratis.",
  openGraph: {
    title: "InvoiceStudio — Fatture Professionali per Freelancer Italiani",
    description:
      "Crea fatture, accetta pagamenti con Stripe e automatizza i reminder. Risparmia 3-5 ore a settimana. Provalo gratis.",
    type: "website",
    locale: "it_IT",
  },
};

/*
 * ─── DESIGN RATIONALE ───────────────────────────────────────────
 * Dark theme (#0a0b0f background) applied directly via Tailwind
 * classes matching the app's .dark design tokens. The layout does
 * not inject .dark on <html>, so we self-contain the dark theme.
 *
 * Georgia serif for headings conveys professionalism and trust —
 * essential for financial products targeting Italian freelancers.
 *
 * Purple accent (#6c63ff) is used sparingly on CTAs and key
 * highlights to draw the eye through the conversion funnel.
 *
 * The page is a pure Server Component — zero client JS.
 * Internal links use next/link for SPA transitions; anchor
 * scrolls use native <a href="#id"> for zero-cost navigation.
 * ────────────────────────────────────────────────────────────────
 */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#f0f0f2] antialiased">
      {/* ══════════════════════════════════════════════════════════
          NAVIGATION
          ══════════════════════════════════════════════════════════ */}
      <Nav />

      {/* ══════════════════════════════════════════════════════════
          HERO — Primary conversion entry point
          UVP: "Fatture professionali, pagamenti veloci"
          Objection handled: "Non ho tempo" → "Risparmia 3-5 ore"
          ══════════════════════════════════════════════════════════ */}
      <Hero />

      {/* ══════════════════════════════════════════════════════════
          FEATURES — Benefits-first (not feature-first) copy
          id="funzionalita" is the anchor target from Hero CTA #2
          ══════════════════════════════════════════════════════════ */}
      <Features />

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS — Reduces cognitive friction
          3 simple steps = low commitment perception
          ══════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ══════════════════════════════════════════════════════════
          PRICING — 3 tiers with clear value progression
          Free tier anchors the Pro tier as the obvious choice
          (decoy effect / center-stage effect)
          ══════════════════════════════════════════════════════════ */}
      <Pricing />

      {/* ══════════════════════════════════════════════════════════
          BOTTOM CTA — Final conversion push before footer
          ══════════════════════════════════════════════════════════ */}
      <BottomCTA />

      {/* ══════════════════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════════════════ */}
      <Footer />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   NAV — Sticky, minimal. Login + Signup CTA.
   Rationale: Always-visible signup reduces drop-off.
   ─────────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#1e2029] bg-[#0a0b0f]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="font-[family-name:Georgia,serif] text-xl font-bold tracking-tight text-[#f0f0f2]"
        >
          Invoice<span className="text-[#6c63ff]">Studio</span>
        </Link>

        {/* Auth links */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#e5e7eb] transition-colors hover:text-[#f0f0f2]"
          >
            Accedi
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#6c63ff] px-5 py-2 text-sm font-semibold text-white transition-all hover:scale-105 hover:bg-[#8b5cf6] hover:shadow-lg hover:shadow-[#6c63ff]/25 active:scale-[0.98]"
          >
            Inizia gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ───────────────────────────────────────────────────────────────
   HERO
   - Headline: 8 words, communicates UVP
   - Subheadline: addresses #1 objection (time)
   - Dual CTA: primary (signup), secondary (learn more → anchor)
   ─────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-20 sm:pt-28 lg:pt-36">
      {/* Subtle radial gradient for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 0%, #6c63ff15 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Eyebrow / trust signal */}
        <p className="mb-6 inline-block rounded-full border border-[#1e2029] bg-[#0f1117] px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-[#6c63ff]">
          Per Freelancer e Agenzie Italiane
        </p>

        {/* Headline — Georgia serif for gravitas */}
        <h1 className="font-[family-name:Georgia,serif] text-4xl font-bold leading-tight tracking-tight text-[#f0f0f2] sm:text-5xl lg:text-6xl">
          Fatture professionali,
          <br />
          pagamenti veloci
        </h1>

        {/* Subheadline — addresses pain point directly */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6b7280] sm:text-xl">
          Risparmia da <strong className="font-semibold text-[#e5e7eb]">3 a 5 ore</strong>{" "}
          a settimana sulla gestione delle fatture. Crea, invia e ricevi pagamenti{" "}
          <strong className="font-semibold text-[#e5e7eb]">in pochi minuti</strong>{" "}
          — senza complicazioni.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {/* Primary CTA — high contrast purple, action verb + benefit */}
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#6c63ff] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#6c63ff]/25 transition-all hover:scale-105 hover:bg-[#8b5cf6] hover:shadow-xl hover:shadow-[#6c63ff]/30 active:scale-[0.98] sm:w-auto"
          >
            Inizia gratis
            <svg
              className="ml-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>

          {/* Secondary CTA — less visually dominant */}
          <a
            href="#funzionalita"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#1e2029] bg-[#0f1117] px-8 py-4 text-base font-medium text-[#e5e7eb] transition-all hover:border-[#6c63ff]/50 hover:text-[#f0f0f2] sm:w-auto"
          >
            Scopri di più
            <svg
              className="ml-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>
        </div>

        {/* Social proof micro-trust below CTAs */}
        <p className="mt-8 text-sm text-[#6b7280]">
          <span className="font-semibold text-[#e5e7eb]">Nessuna carta di credito</span>{" "}
          richiesta · Setup in 2 minuti · Disdici quando vuoi
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   FEATURES — 4 cards, benefits-first copy.
   Each card maps a feature → user benefit.
   Grid adapts: 1 col (mobile) → 2 col (tablet) → 4 col (desktop).
   ─────────────────────────────────────────────────────────────── */
function Features() {
  const cards: FeatureCard[] = [
    {
      icon: "💳",
      title: "Pagamento diretto integrato",
      description:
        "I tuoi clienti pagano con un clic tramite Stripe o PayPal, direttamente dalla fattura. Ricevi i soldi più velocemente — senza inseguire bonifici.",
    },
    {
      icon: "🔔",
      title: "Reminder automatici",
      description:
        "Non perdere tempo a sollecitare pagamenti. InvoiceStudio invia promemoria automatici ai clienti in ritardo, così tu resti concentrato sul lavoro.",
    },
    {
      icon: "📊",
      title: "Export per il commercialista",
      description:
        "Esporta tutto in formati compatibili con il tuo commercialista. Bilanci, scadenze IVA e report pronti in un click. Meno stress a fine trimestre.",
    },
    {
      icon: "🎨",
      title: "Branding personalizzato",
      description:
        "Aggiungi il tuo logo, colori e font alle fatture. Ogni documento che invii rafforza la tua identità professionale — non quella di un software anonimo.",
    },
  ];

  return (
    <section
      id="funzionalita"
      className="scroll-mt-24 px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:Georgia,serif] text-3xl font-bold text-[#f0f0f2] sm:text-4xl">
            Tutto ciò che ti serve per{" "}
            <span className="text-[#6c63ff]">fatturare senza stress</span>
          </h2>
          <p className="mt-4 text-lg text-[#6b7280]">
            Strumenti pensati per chi lavora in proprio. Niente funzioni inutili,
            solo ciò che ti fa risparmiare tempo.
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="group rounded-2xl border border-[#1e2029] bg-[#0f1117] p-6 transition-all hover:scale-[1.02] hover:border-[#6c63ff]/30 hover:shadow-lg hover:shadow-[#6c63ff]/5"
            >
              {/* Icon */}
              <div className="mb-4 text-3xl" aria-hidden="true">
                {card.icon}
              </div>

              {/* Title */}
              <h3 className="font-[family-name:Georgia,serif] text-lg font-bold text-[#f0f0f2]">
                {card.title}
              </h3>

              {/* Description */}
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

/* ───────────────────────────────────────────────────────────────
   HOW IT WORKS — 3 steps, linear flow.
   Reduces perceived effort: "wait, it's only 3 steps?"
   ─────────────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps: Step[] = [
    {
      step: 1,
      title: "Crea la fattura",
      description:
        "Compila i dati del cliente, aggiungi le voci e personalizza il layout. Ci vogliono meno di 60 secondi.",
    },
    {
      step: 2,
      title: "Invia con link di pagamento",
      description:
        "La fattura arriva via email con un link per pagare subito con carta, Stripe o PayPal. Zero attriti.",
    },
    {
      step: 3,
      title: "Ricevi il pagamento",
      description:
        "I soldi arrivano direttamente sul tuo conto. InvoiceStudio riconcilia tutto automaticamente. Fine.",
    },
  ];

  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:Georgia,serif] text-3xl font-bold text-[#f0f0f2] sm:text-4xl">
            Come funziona{" "}
            <span className="text-[#6c63ff]">in 3 passaggi</span>
          </h2>
          <p className="mt-4 text-lg text-[#6b7280]">
            Da zero alla prima fattura pagata in meno di 5 minuti.
          </p>
        </div>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="relative text-center">
              {/* Step number */}
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#6c63ff]/10 text-xl font-bold text-[#6c63ff] ring-1 ring-[#6c63ff]/30">
                {s.step}
              </div>

              {/* Title */}
              <h3 className="font-[family-name:Georgia,serif] text-lg font-bold text-[#f0f0f2]">
                {s.title}
              </h3>

              {/* Description */}
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                {s.description}
              </p>

              {/* Connector arrow (between steps, hidden on mobile) */}
              {s.step < 3 && (
                <div
                  className="absolute right-0 top-7 hidden h-px w-8 translate-x-full bg-gradient-to-r from-[#1e2029] to-transparent sm:block"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Step {
  step: number;
  title: string;
  description: string;
}

/* ───────────────────────────────────────────────────────────────
   PRICING — 3 tiers. Pro is the recommended (center-stage effect).
   Free anchors the bottom; Agency captures the high-end.
   ─────────────────────────────────────────────────────────────── */
function Pricing() {
  const tiers: PricingTier[] = [
    {
      name: "Free",
      price: "0€",
      period: "al mese",
      description: "Per chi inizia e fattura poco.",
      features: [
        "Fino a 5 fatture al mese",
        "Fatture extra gratis con video sponsorizzati",
        "Link di pagamento Stripe",
        "Template base",
        "Export CSV",
        "Email di cortesia",
      ],
      cta: "Inizia gratis",
      href: "/signup",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "19€",
      period: "al mese",
      description: "Per freelancer e professionisti attivi.",
      features: [
        "Fatture illimitate",
        "Pagamenti Stripe + PayPal",
        "Reminder automatici",
        "Export commercialista",
        "Branding personalizzato",
        "Statistiche e report",
        "Supporto prioritario",
      ],
      cta: "Prova gratis",
      href: "/signup",
      highlighted: true,
    },
    {
      name: "Agency",
      price: "79€",
      period: "al mese",
      description: "Per agenzie, studi e team.",
      features: [
        "Tutto del piano Pro",
        "White-label completo",
        "Multi-utente (fino a 10)",
        "API e webhook",
        "Onboarding dedicato",
        "Fatturazione centralizzata",
        "SLA garantito",
      ],
      cta: "Contattaci",
      href: "/signup",
      highlighted: false,
    },
  ];

  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:Georgia,serif] text-3xl font-bold text-[#f0f0f2] sm:text-4xl">
            Scegli il{" "}
            <span className="text-[#6c63ff]">piano giusto per te</span>
          </h2>
          <p className="mt-4 text-lg text-[#6b7280]">
            Passa al piano superiore in qualsiasi momento. Nessun costo nascosto.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all hover:scale-[1.02] ${
                tier.highlighted
                  ? "border-[#6c63ff] bg-[#0f1117] shadow-lg shadow-[#6c63ff]/10"
                  : "border-[#1e2029] bg-[#0f1117]"
              }`}
            >
              {/* "Consigliato" badge on Pro tier */}
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6c63ff] px-4 py-1 text-xs font-semibold text-white">
                  Consigliato
                </div>
              )}

              {/* Tier name */}
              <h3 className="font-[family-name:Georgia,serif] text-xl font-bold text-[#f0f0f2]">
                {tier.name}
              </h3>

              {/* Price */}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-[family-name:Georgia,serif] text-4xl font-bold text-[#f0f0f2]">
                  {tier.price}
                </span>
                <span className="text-sm text-[#6b7280]">{tier.period}</span>
              </div>

              {/* Description */}
              <p className="mt-2 text-sm text-[#6b7280]">{tier.description}</p>

              {/* Feature list */}
              <ul className="mt-8 flex-1 space-y-3">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-sm text-[#e5e7eb]">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#6c63ff]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={tier.href}
                className={`mt-8 block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all hover:scale-105 active:scale-[0.98] ${
                  tier.highlighted
                    ? "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:bg-[#8b5cf6] hover:shadow-xl hover:shadow-[#6c63ff]/30"
                    : "border border-[#1e2029] text-[#e5e7eb] hover:border-[#6c63ff]/50 hover:text-[#f0f0f2]"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

/* ───────────────────────────────────────────────────────────────
   BOTTOM CTA — Final conversion opportunity.
   Social proof reinforces the ask.
   ─────────────────────────────────────────────────────────────── */
function BottomCTA() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#1e2029] bg-[#0f1117] px-8 py-14 text-center sm:px-14">
        <h2 className="font-[family-name:Georgia,serif] text-3xl font-bold text-[#f0f0f2] sm:text-4xl">
          Pronto a{" "}
          <span className="text-[#6c63ff]">smettere di rincorrere</span> i
          pagamenti?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-lg text-[#6b7280]">
          Unisciti a oltre 2.000 freelancer italiani che hanno già semplificato
          la loro fatturazione.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-flex items-center rounded-xl bg-[#6c63ff] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#6c63ff]/25 transition-all hover:scale-105 hover:bg-[#8b5cf6] hover:shadow-xl hover:shadow-[#6c63ff]/30 active:scale-[0.98]"
        >
          Inizia gratis
          <svg
            className="ml-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>

        {/* Micro-trust */}
        <p className="mt-6 text-xs text-[#6b7280]">
          Nessuna carta di credito richiesta · Cancella in qualsiasi momento
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   FOOTER — Legal links, contact, mini-sitemap.
   ─────────────────────────────────────────────────────────────── */
function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#1e2029] bg-[#0a0b0f] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="font-[family-name:Georgia,serif] text-lg font-bold text-[#f0f0f2]"
            >
              Invoice<span className="text-[#6c63ff]">Studio</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
              La piattaforma di fatturazione per freelancer e agenzie italiane.
              Fatture professionali, pagamenti integrati, zero stress.
            </p>
          </div>

          {/* Prodotto */}
          <div>
            <h4 className="text-sm font-semibold text-[#f0f0f2]">Prodotto</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/#funzionalita"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Funzionalità
                </Link>
              </li>
              <li>
                <Link
                  href="/#prezzi"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Prezzi
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Accedi
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Registrati
                </Link>
              </li>
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="text-sm font-semibold text-[#f0f0f2]">Legale</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-[#6b7280] transition-colors hover:text-[#e5e7eb]"
                >
                  Termini di Servizio
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-[#1e2029] pt-6 text-center text-xs text-[#6b7280]">
          &copy; {currentYear} InvoiceStudio. Tutti i diritti riservati. P. IVA
          IT00000000000
        </div>
      </div>
    </footer>
  );
}
