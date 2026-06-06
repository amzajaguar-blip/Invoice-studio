import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "InvoiceStudio — Scanner OCR e Fatture per Freelancer Italiani",
  description: "Scansiona ricevute con OCR, crea fatture in PDF e gestisci i clienti. Semplice, veloce, pensato per i freelancer italiani.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Nav />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Pricing />
      <BottomCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--glass-bg)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 20, color: "var(--text-primary)", textDecoration: "none" }}>
          Invoice<span style={{ color: "var(--accent)" }}>Studio</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/login" style={{ padding: "8px 16px", borderRadius: 8, color: "var(--text-secondary)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>Accedi</Link>
          <Link href="/signup" className="btn-primary" style={{ padding: "10px 20px", fontSize: 14, borderRadius: 10 }}>Inizia gratis</Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden", padding: "100px 24px 80px", textAlign: "center" }}>
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, hsl(245,100%,68%,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 100, right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, hsl(280,75%,60%,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }} className="animate-slide-up">
        <p style={{ display: "inline-block", background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 24 }}>
          Scanner OCR per Partite IVA
        </p>

        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 700, lineHeight: 1.1, marginBottom: 24, color: "var(--text-primary)" }}>
          Da Ricevuta a{" "}
          <span className="gradient-text">Fattura PDF.</span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "var(--text-muted)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Scansiona una ricevuta con il telefono, l&apos;OCR estrae i dati e generi la fattura in PDF in pochi secondi. Pensato per i freelancer italiani.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup" className="btn-primary animate-pulse-glow" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 14 }}>
            Inizia gratis
          </Link>
          <a href="#funzionalita" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 14, border: "1px solid var(--border-primary)", color: "var(--text-secondary)", textDecoration: "none", fontSize: 15, fontWeight: 500, transition: "all 200ms", background: "var(--surface-secondary)" }}>
            Scopri come funziona
          </a>
        </div>

        <p style={{ marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          Nessuna carta richiesta · Setup in 2 minuti
        </p>
      </div>

      {/* Dashboard Preview Card */}
      <div className="animate-slide-up-delay-2 animate-float" style={{ maxWidth: 720, margin: "60px auto 0", borderRadius: 20, overflow: "hidden", border: "1px solid var(--border-primary)", boxShadow: "0 40px 80px rgba(0,0,0,0.3), 0 0 0 1px var(--border-primary)", background: "var(--surface-primary)" }}>
        <div style={{ padding: "12px 16px", background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
          <div style={{ flex: 1, margin: "0 16px", background: "var(--surface-tertiary)", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>app.invoicestudio.it</div>
        </div>
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Incassato questo mese", value: "€ 0", color: "var(--status-paid)", change: "Inizia ora" },
            { label: "In attesa di pagamento", value: "€ 0", color: "var(--status-pending)", change: "0 fatture" },
            { label: "Clienti attivi", value: "0", color: "var(--accent)", change: "Aggiungi il primo" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--surface-secondary)", borderRadius: 12, padding: 16, border: "1px solid var(--border-primary)" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Georgia, serif" }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: stat.color, marginTop: 4 }}>{stat.change}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { num: "#001", client: "Esempio Cliente", amount: "€ 0", status: "paid" },
          ].map((inv) => (
            <div key={inv.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-secondary)", borderRadius: 10, border: "1px solid var(--border-primary)" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{inv.num}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, marginLeft: 16 }}>{inv.client}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{inv.amount}</span>
              <span className={`status-badge status-${inv.status}`} style={{ marginLeft: 12 }}>
                {inv.status === "paid" ? "Pagata" : inv.status === "pending" ? "In attesa" : "Scaduta"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <div style={{ borderTop: "1px solid var(--border-primary)", borderBottom: "1px solid var(--border-primary)", background: "var(--surface-secondary)", padding: "20px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
        {["Made for Italy", "OCR Integrato", "PDF Professionali", "Gestione Clienti"].map((item) => (
          <span key={item} style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function Features() {
  const cards = [
    { title: "Scanner OCR", description: "Fotografa una ricevuta e l&apos;OCR estrae vendor, importo e data in automatico. Rivedi e correggi prima di salvare." },
    { title: "Fatture PDF", description: "Genera fatture professionali in PDF con il tuo logo, IVA automatica e dati cliente pre-compilati." },
    { title: "Gestione Clienti", description: "Archivia i tuoi clienti con anagrafica completa. I dati si riempiono automaticamente nelle fatture." },
    { title: "Dashboard Chiara", description: "Tieni traccia delle fatture emesse, dello stato pagamenti e dei clienti attivi in un colpo d&apos;occhio." },
  ];
  return (
    <section id="funzionalita" style={{ padding: "80px 24px", scrollMarginTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Tutto per fatturare{" "}
            <span className="gradient-text">senza sforzo</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 18, maxWidth: 500, margin: "0 auto" }}>Scansiona, crea, invia. Il flusso pi&ugrave; veloce per i freelancer italiani.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {cards.map((c) => (
            <div key={c.title} className="card-premium" style={{ padding: 24 }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{c.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Scansiona la ricevuta", desc: "Carica una foto o PDF della ricevuta. L&apos;OCR legge automaticamente importo, data e fornitore." },
    { n: "02", title: "Rivedi i dati", desc: "Controlla i dati estratti dall&apos;OCR, correggi se necessario e seleziona il cliente." },
    { n: "03", title: "Genera PDF", desc: "Crea la fattura in PDF professionale con il tuo logo e i dati pre-compilati. Pronta da archiviare o inviare." },
  ];
  return (
    <section style={{ padding: "80px 24px", background: "var(--surface-secondary)", borderTop: "1px solid var(--border-primary)", borderBottom: "1px solid var(--border-primary)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            Da ricevuta a fattura in <span className="gradient-text">3 passi</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 17 }}>Nessuna competenza tecnica richiesta. Basta scattare una foto.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ textAlign: "center", padding: "32px 24px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", fontSize: 20, fontWeight: 700, color: "var(--accent)", marginBottom: 20, fontFamily: "Georgia, serif" }}>{s.n}</div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{s.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Free", price: "€0", period: "/mese", desc: "Per iniziare.", features: ["5 fatture/mese", "Scanner OCR base", "PDF standard", "Gestione clienti"], cta: "Inizia gratis", href: "/signup", highlight: false },
    { name: "Pro", price: "€5", period: "/mese", desc: "Per freelancer attivi.", features: ["Fatture illimitate", "OCR avanzato", "PDF personalizzati con logo", "Export dati", "Supporto email"], cta: "Inizia gratis", href: "/signup", highlight: true },
  ];
  return (
    <section id="prezzi" style={{ padding: "80px 24px", scrollMarginTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Prezzi <span className="gradient-text">chiari e diretti</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 17 }}>Cambia piano in qualsiasi momento. Nessun costo nascosto.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {tiers.map((t) => (
            <div key={t.name} style={{ position: "relative", borderRadius: 20, padding: 32, display: "flex", flexDirection: "column", border: t.highlight ? "2px solid var(--accent)" : "1px solid var(--border-primary)", background: t.highlight ? "color-mix(in srgb, var(--accent) 5%, var(--surface-primary))" : "var(--surface-primary)", boxShadow: t.highlight ? "0 20px 60px color-mix(in srgb, var(--accent) 15%, transparent)" : "none", transition: "transform 200ms, box-shadow 200ms" }}>
              {t.highlight && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", borderRadius: 999, padding: "4px 16px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Piu scelto</div>
              )}
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{t.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 700, color: "var(--text-primary)" }}>{t.price}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.period}</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>{t.desc}</p>
              <ul style={{ flex: 1, listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>-</span>{f}
                  </li>
                ))}
              </ul>
              <Link href={t.href} style={{ display: "block", textAlign: "center", padding: "13px 24px", borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: "none", background: t.highlight ? "var(--accent)" : "transparent", color: t.highlight ? "#fff" : "var(--text-primary)", border: t.highlight ? "none" : "1px solid var(--border-primary)", boxShadow: t.highlight ? "0 4px 20px color-mix(in srgb, var(--accent) 30%, transparent)" : "none", transition: "all 200ms" }}>{t.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", borderRadius: 24, padding: "60px 40px", border: "1px solid var(--border-primary)", background: "var(--surface-secondary)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 0%, color-mix(in srgb, var(--accent) 8%, transparent), transparent)", pointerEvents: "none" }} />
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, position: "relative" }}>
          Scatta, genera, <span className="gradient-text">fattura.</span>
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 17, maxWidth: 480, margin: "0 auto 36px", position: "relative" }}>Prova InvoiceStudio gratis. Nessuna carta di credito richiesta.</p>
        <Link href="/signup" className="btn-primary animate-pulse-glow" style={{ padding: "15px 40px", fontSize: 17, borderRadius: 14, position: "relative" }}>
          Inizia gratis ora
        </Link>
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", position: "relative" }}>Nessuna carta richiesta · Cancella in qualsiasi momento</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border-primary)", padding: "48px 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, marginBottom: 40 }}>
          <div>
            <Link href="/" style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 18, color: "var(--text-primary)", textDecoration: "none" }}>Invoice<span style={{ color: "var(--accent)" }}>Studio</span></Link>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>Scanner OCR e fatturazione semplice per freelancer italiani.</p>
          </div>
          {[
            { title: "Prodotto", links: [["Funzionalita", "/#funzionalita"], ["Prezzi", "/#prezzi"], ["Accedi", "/login"], ["Registrati", "/signup"]] },
            { title: "Legale", links: [["Privacy Policy", "/privacy"], ["Termini di Servizio", "/terms"]] },
          ].map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>{col.title}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href} style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          &copy; {new Date().getFullYear()} InvoiceStudio. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
