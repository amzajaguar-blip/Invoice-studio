// Generate Play Store screenshot mockups (1080×1920)
// These are placeholder mockups — replace with real screenshots before publishing.
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const path = require("path");

const W = 1080;
const H = 1920;
const OUT = path.join(__dirname, "..", "public", "playstore");

// Colors
const BG = "#0a0b0f";
const CARD_BG = "#111318";
const BORDER = "#1f2128";
const ACCENT = "#6c63ff";
const TEXT = "#f0f0f2";
const MUTED = "#6b7280";
const GREEN = "#22c55e";
const YELLOW = "#f59e0b";
const RED = "#ef4444";

function h1(text) {
  return `<text x="72" y="120" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="${TEXT}">${text}</text>`;
}
function subtitle(text, y) {
  return `<text x="72" y="${y}" font-family="Arial, sans-serif" font-size="36" fill="${MUTED}">${text}</text>`;
}
function card(y, height = 200) {
  return `<rect x="48" y="${y}" width="${W - 96}" height="${height}" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/>`;
}
function kpi(x, y, label, value, color = TEXT) {
  return `
    <rect x="${x}" y="${y}" width="220" height="160" rx="20" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1.5"/>
    <text x="${x + 110}" y="${y + 55}" font-family="Arial" font-size="28" fill="${MUTED}" text-anchor="middle">${label}</text>
    <text x="${x + 110}" y="${y + 105}" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="${color}" text-anchor="middle">${value}</text>
  `;
}
function brandHeader() {
  return `<text x="540" y="70" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="${TEXT}" text-anchor="middle">Invoice<tspan fill="${ACCENT}">Studio</tspan></text>`;
}
function ctaButton(y, text) {
  return `
    <rect x="48" y="${y}" width="${W - 96}" height="80" rx="20" fill="${ACCENT}"/>
    <text x="540" y="${y + 52}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">${text}</text>
  `;
}

// ─── Screenshot 1: Dashboard ────────────────────────────────────────────────

const s1 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${brandHeader()}
  <text x="72" y="180" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="${TEXT}">Dashboard</text>
  <text x="72" y="230" font-family="Arial" font-size="34" fill="${MUTED}">Panoramica del tuo studio</text>
  ${kpi(48, 300, "Fatture emesse", "12", TEXT)}
  ${kpi(290, 300, "In attesa", "€ 3.450", YELLOW)}
  ${kpi(532, 300, "Pagate", "€ 8.200", GREEN)}
  ${kpi(774, 300, "Scadute", "2", RED)}
  <text x="72" y="530" font-family="Georgia, serif" font-size="38" font-weight="bold" fill="${TEXT}">Ultime fatture</text>
  ${card(580, 130)}
  <text x="88" y="630" font-family="Arial" font-size="30" fill="${TEXT}">INV-2026-001  Web Solutions Srl</text>
  <text x="88" y="670" font-family="Arial" font-size="26" fill="${GREEN}">€ 1.200,00  ·  Pagata</text>
  ${card(740, 130)}
  <text x="88" y="790" font-family="Arial" font-size="30" fill="${TEXT}">INV-2026-002  Studio Rossi</text>
  <text x="88" y="830" font-family="Arial" font-size="26" fill="${YELLOW}">€ 850,00  ·  In attesa</text>
</svg>`;

// ─── Screenshot 2: Invoice Creation ─────────────────────────────────────────

const s2 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${brandHeader()}
  <text x="72" y="170" font-family="Georgia, serif" font-size="48" font-weight="bold" fill="${TEXT}">Nuova Fattura</text>
  ${card(230, 380)}
  <text x="88" y="290" font-family="Arial" font-size="28" fill="${MUTED}">Cliente</text>
  <rect x="88" y="310" width="904" height="56" rx="14" fill="#0a0b0f" stroke="${BORDER}" stroke-width="2"/>
  <text x="108" y="346" font-family="Arial" font-size="28" fill="${TEXT}">Web Solutions Srl</text>

  <text x="88" y="420" font-family="Arial" font-size="28" fill="${MUTED}">Descrizione</text>
  <rect x="88" y="440" width="904" height="56" rx="14" fill="#0a0b0f" stroke="${BORDER}" stroke-width="2"/>
  <text x="108" y="476" font-family="Arial" font-size="28" fill="${TEXT}">Sviluppo landing page</text>

  <text x="88" y="545" font-family="Arial" font-size="28" fill="${MUTED}">Importo (€)</text>
  <rect x="88" y="565" width="440" height="56" rx="14" fill="#0a0b0f" stroke="${BORDER}" stroke-width="2"/>
  <text x="108" y="601" font-family="Arial" font-size="28" fill="${TEXT}">1.200</text>

  <text x="88" y="670" font-family="Arial" font-size="28" fill="${MUTED}">Ritenuta d'acconto</text>
  <rect x="88" y="690" width="200" height="56" rx="14" fill="#0a0b0f" stroke="${ACCENT}" stroke-width="2"/>
  <text x="108" y="726" font-family="Arial" font-size="28" font-weight="bold" fill="${ACCENT}">20%</text>
  <text x="310" y="726" font-family="Arial" font-size="28" fill="${MUTED}">Netto a pagare: € 960,00</text>

  ${ctaButton(810, "Crea fattura")}
</svg>`;

// ─── Screenshot 3: Payment Page ─────────────────────────────────────────────

const s3 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${brandHeader()}
  <circle cx="540" cy="230" r="60" fill="${ACCENT}" opacity="0.15"/>
  <text x="540" y="250" font-family="Georgia, serif" font-size="64" fill="${ACCENT}" text-anchor="middle">€</text>
  <text x="540" y="370" font-family="Georgia, serif" font-size="48" font-weight="bold" fill="${TEXT}" text-anchor="middle">Fattura INV-2026-001</text>
  <text x="540" y="430" font-family="Arial" font-size="34" fill="${MUTED}" text-anchor="middle">Da: Web Solutions Srl</text>

  ${card(520, 460)}
  <text x="88" y="580" font-family="Arial" font-size="30" fill="${MUTED}">Imponibile</text>
  <text x="960" y="580" font-family="Arial" font-size="30" fill="${TEXT}" text-anchor="end">€ 1.200,00</text>
  <text x="88" y="650" font-family="Arial" font-size="30" fill="${MUTED}">IVA 22%</text>
  <text x="960" y="650" font-family="Arial" font-size="30" fill="${TEXT}" text-anchor="end">€ 264,00</text>
  <text x="88" y="720" font-family="Arial" font-size="30" fill="${MUTED}">Rit. d'acconto 20%</text>
  <text x="960" y="720" font-family="Arial" font-size="30" fill="${RED}" text-anchor="end">-€ 240,00</text>
  <line x1="88" y1="760" x2="992" y2="760" stroke="${BORDER}" stroke-width="2"/>
  <text x="88" y="820" font-family="Georgia, serif" font-size="38" font-weight="bold" fill="${TEXT}">Totale da pagare</text>
  <text x="960" y="820" font-family="Georgia, serif" font-size="38" font-weight="bold" fill="${GREEN}" text-anchor="end">€ 1.224,00</text>

  ${ctaButton(1040, "Paga con Carta  →")}
  <text x="540" y="1160" font-family="Arial" font-size="28" fill="${MUTED}" text-anchor="middle">Pagamento sicuro tramite Stripe</text>
</svg>`;

// ─── Screenshot 4: Landging page (marketing) ────────────────────────────────

const s4 = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="540" y="300" font-family="Georgia, serif" font-size="80" font-weight="bold" fill="${TEXT}" text-anchor="middle">Fatture</text>
  <text x="540" y="390" font-family="Georgia, serif" font-size="76" font-weight="bold" fill="${ACCENT}" text-anchor="middle">Professional</text>
  <text x="540" y="470" font-family="Georgia, serif" font-size="76" font-weight="bold" fill="${TEXT}" text-anchor="middle">per Freelancer</text>
  <text x="540" y="560" font-family="Arial" font-size="40" fill="${MUTED}" text-anchor="middle">Crea, invia e fatti pagare in ore, non settimane</text>

  <rect x="120" y="700" width="840" height="140" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/>
  <text x="180" y="780" font-family="Arial" font-size="32" fill="${TEXT}">📄 Crea fatture in 2 minuti</text>
  <rect x="120" y="870" width="840" height="140" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/>
  <text x="180" y="950" font-family="Arial" font-size="32" fill="${TEXT}">💳 Pagamenti integrati con Stripe</text>
  <rect x="120" y="1040" width="840" height="140" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/>
  <text x="180" y="1120" font-family="Arial" font-size="32" fill="${TEXT}">📊 Dashboard con KPI e analytics</text>

  ${ctaButton(1280, "Inizia Gratis")}
  <text x="540" y="1400" font-family="Arial" font-size="28" fill="${MUTED}" text-anchor="middle">Nessuna carta di credito richiesta</text>
</svg>`;

// ─── Generate all ───────────────────────────────────────────────────────────

async function generate() {
  const screenshots = [
    { name: "screenshot-1.png", svg: s1, label: "Dashboard con KPI e ultime fatture" },
    { name: "screenshot-2.png", svg: s2, label: "Creazione fattura con ritenuta d'acconto" },
    { name: "screenshot-3.png", svg: s3, label: "Pagina di pagamento pubblica" },
    { name: "screenshot-4.png", svg: s4, label: "Landing page e feature principali" },
  ];

  for (const shot of screenshots) {
    await sharp(Buffer.from(shot.svg))
      .resize(1080, 1920)
      .png()
      .toFile(path.join(OUT, shot.name));
    console.log(`✅ ${shot.name} (${shot.label})`);
  }
}

generate().catch(console.error);
