import { useState, useEffect, useRef } from "react";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_INVOICES = [
  { id: "INV-2026-041", client: "Nexus Creative SRL", amount: 3800, currency: "EUR", status: "paid", issued: "2026-04-01", due: "2026-04-30", paidAt: "2026-04-18", opened: true },
  { id: "INV-2026-042", client: "Studio Archi Roma", amount: 1250, currency: "EUR", status: "overdue", issued: "2026-04-10", due: "2026-05-10", paidAt: null, opened: true },
  { id: "INV-2026-043", client: "Bloom Agency", amount: 5600, currency: "USD", status: "sent", issued: "2026-04-22", due: "2026-05-22", paidAt: null, opened: false },
  { id: "INV-2026-044", client: "TechFlow GmbH", amount: 920, currency: "CHF", status: "sent", issued: "2026-05-01", due: "2026-05-31", paidAt: null, opened: true },
  { id: "INV-2026-045", client: "Nexus Creative SRL", amount: 4200, currency: "EUR", status: "draft", issued: "2026-05-15", due: "2026-06-14", paidAt: null, opened: false },
  { id: "INV-2026-046", client: "Atelier Lumière", amount: 750, currency: "EUR", status: "paid", issued: "2026-03-28", due: "2026-04-27", paidAt: "2026-04-05", opened: true },
];

const STATUS_META = {
  paid:    { label: "Pagata",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   dot: "#22c55e" },
  sent:    { label: "Inviata",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  dot: "#f59e0b" },
  overdue: { label: "Scaduta",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",   dot: "#ef4444" },
  draft:   { label: "Bozza",     color: "#6b7280", bg: "rgba(107,114,128,0.12)", dot: "#6b7280" },
};

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const SYMBOL = { EUR: "€", USD: "$", GBP: "£", CHF: "₣" };

const CLIENTS = ["Nexus Creative SRL", "Studio Archi Roma", "Bloom Agency", "TechFlow GmbH", "Atelier Lumière"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (n, cur = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: cur, minimumFractionDigits: 0 }).format(n);

const days = (d) => {
  if (!d) return "—";
  const diff = (new Date(d) - new Date()) / 86400000;
  if (Number.isNaN(diff)) return "—";
  if (diff < 0) return `${Math.abs(Math.round(diff))}gg fa`;
  return `${Math.round(diff)}gg`;
};

const uid = () => crypto.randomUUID().slice(0, 8).toUpperCase();

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const FALLBACK_META = { label: "Sconosciuto", color: "#6b7280", bg: "rgba(107,114,128,0.12)", dot: "#6b7280" };

function Badge({ status }) {
  const m = STATUS_META[status] || FALLBACK_META;
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}30`,
      borderRadius: 6, padding: "3px 10px",
      fontSize: 12, fontWeight: 600, letterSpacing: "0.03em",
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, display: "inline-block" }} />
      {m.label}
    </span>
  );
}

function KPICard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: "#111318",
      border: "1px solid #1e2029",
      borderRadius: 14,
      padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: `${accent}18`, filter: "blur(20px)",
      }} />
      <div style={{ fontSize: 22, marginBottom: 2 }}>{icon}</div>
      <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#f0f0f2", fontSize: 26, fontWeight: 700, fontFamily: "Georgia, serif", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ color: accent, fontSize: 12, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

function InvoiceRow({ inv, onSelect, selected }) {
  const [hovered, setHovered] = useState(false);
  const m = STATUS_META[inv.status] || FALLBACK_META;
  return (
    <tr
      onClick={() => onSelect(inv)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        background: selected ? "#16181f" : hovered ? "#13151b" : "transparent",
        borderBottom: "1px solid #1a1c23",
        transition: "background 0.15s",
      }}
    >
      <td style={{ padding: "13px 20px", fontFamily: "monospace", fontSize: 13, color: "#9ca3af" }}>{inv.id}</td>
      <td style={{ padding: "13px 16px", color: "#e5e7eb", fontWeight: 500 }}>{inv.client}</td>
      <td style={{ padding: "13px 16px", color: "#f0f0f2", fontWeight: 700 }}>{fmt(inv.amount, inv.currency)}</td>
      <td style={{ padding: "13px 16px" }}><Badge status={inv.status} /></td>
      <td style={{ padding: "13px 16px", color: "#6b7280", fontSize: 13 }}>{inv.due}</td>
      <td style={{ padding: "13px 16px", fontSize: 13 }}>
        {inv.opened
          ? <span style={{ color: "#22c55e" }}>👁 Aperta</span>
          : <span style={{ color: "#374151" }}>— Non vista</span>}
      </td>
      <td style={{ padding: "13px 16px" }}>
        {inv.status === "sent" || inv.status === "overdue" ? (
          <button style={{
            background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
            border: "none", borderRadius: 7,
            color: "#fff", fontSize: 12, fontWeight: 600,
            padding: "5px 12px", cursor: "pointer",
          }}>
            🔗 Link Pago
          </button>
        ) : inv.status === "paid" ? (
          <span style={{ color: "#22c55e", fontSize: 13 }}>✓ {inv.paidAt}</span>
        ) : (
          <span style={{ color: "#4b5563", fontSize: 13 }}>Bozza</span>
        )}
      </td>
    </tr>
  );
}

function NewInvoiceModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    client: CLIENTS[0], currency: "EUR", items: [{ id: `temp-${uid()}`, desc: "", qty: 1, price: 0 }],
    due: "", notes: "", vatRate: 22,
  });

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [k]: v };
    return { ...f, items };
  });

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
  const vatRate = parseFloat(form.vatRate) || 0;
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

  const handleSave = () => {
    const now = new Date().toISOString().slice(0, 10);
    onSave({
      id: `INV-2026-0${uid()}`,
      client: form.client,
      amount: total,
      currency: form.currency,
      status: "draft",
      issued: now,
      due: form.due || "2026-06-30",
      paidAt: null,
      opened: false,
      items: form.items.filter(it => it.desc || it.qty || it.price),
      vatRate,
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1117", border: "1px solid #1e2029",
        borderRadius: 18, width: "min(680px, 95vw)",
        maxHeight: "90vh", overflowY: "auto",
        padding: 32, position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "#1e2029", border: "none", borderRadius: 8,
          color: "#9ca3af", width: 32, height: 32, cursor: "pointer",
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>

        <h2 style={{ color: "#f0f0f2", fontSize: 20, fontWeight: 700, marginBottom: 24, fontFamily: "Georgia, serif" }}>
          ✦ Nuova Fattura
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>CLIENTE</label>
            <select
              value={form.client} onChange={e => set("client", e.target.value)}
              style={{ width: "100%", background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "9px 12px", fontSize: 14 }}
            >
              {CLIENTS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>VALUTA</label>
            <select
              value={form.currency} onChange={e => set("currency", e.target.value)}
              style={{ width: "100%", background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "9px 12px", fontSize: 14 }}
            >
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>SCADENZA</label>
            <input
              type="date" value={form.due} onChange={e => set("due", e.target.value)}
              style={{ width: "100%", background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>IVA %</label>
            <input
              type="number" value={form.vatRate} onChange={e => set("vatRate", e.target.value)}
              style={{ width: "100%", background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>VOCI</label>
            <button
              onClick={() => setForm(f => ({ ...f, items: [...f.items, { id: `temp-${uid()}`, desc: "", qty: 1, price: 0 }] }))}
              style={{ background: "#1e2029", border: "none", borderRadius: 6, color: "#6c63ff", fontSize: 12, padding: "4px 10px", cursor: "pointer" }}
            >+ Aggiungi voce</button>
          </div>
          {form.items.map((it, i) => (
            <div key={it.id || `item-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 28px", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Descrizione"
                value={it.desc} onChange={e => setItem(i, "desc", e.target.value)}
                style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "8px 12px", fontSize: 13 }}
              />
              <input
                type="number" placeholder="Qty"
                value={it.qty} onChange={e => setItem(i, "qty", e.target.value)}
                style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "8px 12px", fontSize: 13 }}
              />
              <input
                type="number" placeholder="Prezzo"
                value={it.price} onChange={e => setItem(i, "price", e.target.value)}
                style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 8, color: "#e5e7eb", padding: "8px 12px", fontSize: 13 }}
              />
              <button
                onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                style={{ background: "none", border: "1px solid #1e2029", borderRadius: 8, color: "#6b7280", cursor: "pointer", fontSize: 14 }}
              >✕</button>
            </div>
          ))}
        </div>

        <div style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
            <span>Subtotale</span>
            <span>{fmt(subtotal, form.currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
            <span>IVA {form.vatRate}%</span>
            <span>{fmt(vat, form.currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#f0f0f2", fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", borderTop: "1px solid #1e2029", paddingTop: 10 }}>
            <span>Totale</span>
            <span style={{ color: "#6c63ff" }}>{fmt(total, form.currency)}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "none", border: "1px solid #1e2029",
            borderRadius: 10, color: "#6b7280", padding: "11px", cursor: "pointer", fontSize: 14,
          }}>Annulla</button>
          <button onClick={handleSave} style={{
            flex: 2,
            background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
            border: "none", borderRadius: 10,
            color: "#fff", padding: "11px", cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}>✦ Salva Fattura</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ inv, onClose, reminded, onRemind }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!inv) return null;
  const m = STATUS_META[inv.status];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 90,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1117", borderLeft: "1px solid #1e2029",
        width: "min(440px, 95vw)", height: "100vh",
        overflowY: "auto", padding: 28,
        animation: "slideIn 0.25s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4, fontFamily: "monospace" }}>{inv.id}</div>
            <h3 style={{ color: "#f0f0f2", fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", margin: 0 }}>{inv.client}</h3>
          </div>
          <button onClick={onClose} style={{
            background: "#1e2029", border: "none", borderRadius: 8, color: "#9ca3af",
            width: 32, height: 32, cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #1a1333, #160f2a)",
          border: "1px solid #2d1f5a", borderRadius: 14, padding: 20, marginBottom: 20,
          textAlign: "center",
        }}>
          <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>IMPORTO FATTURA</div>
          <div style={{ color: "#f0f0f2", fontSize: 36, fontWeight: 800, fontFamily: "Georgia, serif" }}>
            {fmt(inv.amount, inv.currency)}
          </div>
          <div style={{ marginTop: 10 }}><Badge status={inv.status} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            ["Emessa", inv.issued],
            ["Scadenza", inv.due],
            ["Aperta", inv.opened ? "✓ Sì" : "— No"],
            ["Pagata", inv.paidAt || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>{k}</div>
              <div style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Tracking timeline */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 12 }}>TRACKING</div>
          {[
            { e: "Fattura creata", d: inv.issued, done: true },
            { e: "Email inviata", d: inv.issued, done: inv.status !== "draft" },
            { e: "PDF aperto dal cliente", d: inv.opened ? "✓" : null, done: inv.opened },
            { e: "Pagamento completato", d: inv.paidAt, done: inv.status === "paid" },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: step.done ? "#22c55e" : "#1e2029",
                border: step.done ? "none" : "1px solid #374151",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#fff", flexShrink: 0, marginTop: 1,
              }}>{step.done ? "✓" : ""}</div>
              <div>
                <div style={{ color: step.done ? "#e5e7eb" : "#4b5563", fontSize: 13 }}>{step.e}</div>
                {step.d && <div style={{ color: "#6b7280", fontSize: 11 }}>{step.d}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(inv.status === "sent" || inv.status === "overdue") && (
            <>
              <button style={{
                background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                border: "none", borderRadius: 10, color: "#fff",
                padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 600,
              }}>
                🔗 Copia Link Pagamento
              </button>
              <button
                onClick={onRemind}
                style={{
                  background: reminded ? "rgba(34,197,94,0.12)" : "#111318",
                  border: reminded ? "1px solid #22c55e30" : "1px solid #1e2029",
                  borderRadius: 10,
                  color: reminded ? "#22c55e" : "#9ca3af",
                  padding: "12px", cursor: "pointer", fontSize: 14,
                }}
              >
                {reminded ? "✓ Reminder inviato" : "🔔 Invia Reminder"}
              </button>
            </>
          )}
          <button style={{
            background: "#111318", border: "1px solid #1e2029",
            borderRadius: 10, color: "#9ca3af", padding: "12px", cursor: "pointer", fontSize: 14,
          }}>
            ⬇ Scarica PDF
          </button>
          <button style={{
            background: "none", border: "1px solid #1e2029",
            borderRadius: 10, color: "#6b7280", padding: "12px", cursor: "pointer", fontSize: 14,
          }}>
            ✉ Invia via Email
          </button>
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ invoices }) {
  // Build last 7 months data from actual paid invoices
  const now = new Date();
  const months = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString("it-IT", { month: "short" }));
    const monthKey = d.toISOString().slice(0, 7);
    const total = invoices
      .filter(inv => inv.status === "paid" && inv.paidAt && inv.paidAt.startsWith(monthKey))
      .reduce((s, inv) => s + inv.amount, 0);
    data.push(total);
  }
  const max = Math.max(...data, 1);
  const W = 420, H = 120;

  const pts = data.map((v, i) => ({
    x: 40 + (i * (W - 60)) / (data.length - 1),
    y: H - 20 - ((v / max) * (H - 40)),
  }));

  const path = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `C${(pts[i-1].x + p.x)/2},${pts[i-1].y} ${(pts[i-1].x + p.x)/2},${p.y} ${p.x},${p.y}`)).join(" ");
  const area = path + ` L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`;

  return (
    <div style={{ background: "#111318", border: "1px solid #1e2029", borderRadius: 14, padding: "20px 20px 12px" }}>
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 500, marginBottom: 14, letterSpacing: "0.05em" }}>FATTURATO ULTIMI 7 MESI</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaGrad)" />
        <path d={path} fill="none" stroke="#6c63ff" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#6c63ff" />
            <circle cx={p.x} cy={p.y} r="7" fill="#6c63ff" fillOpacity="0.2" />
            <text x={p.x} y={H} textAnchor="middle" fill="#4b5563" fontSize="10">{months[i]}</text>
            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#9ca3af" fontSize="9">€{(data[i]/1000).toFixed(1)}k</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function InvoiceStudio() {
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [remindedInvoices, setRemindedInvoices] = useState(new Set());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addInvoice = (inv) => {
    setInvoices(prev => [inv, ...prev]);
    showToast("Fattura creata con successo");
  };

  const filtered = invoices
    .filter(inv => filterStatus === "all" || inv.status === filterStatus)
    .filter(inv => !search || inv.client.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase()));

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const outstandingCount = invoices.filter(i => i.status === "sent" || i.status === "overdue").length;
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const paidCount = invoices.filter(i => i.status === "paid").length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0b0f",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      color: "#f0f0f2",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0b0f; }
        ::-webkit-scrollbar-thumb { background: #1e2029; border-radius: 2px; }
        select, input { outline: none; font-family: inherit; }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes toastIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* SIDEBAR */}
      <div style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 220,
        background: "#0d0e13", borderRight: "1px solid #1a1c23",
        display: "flex", flexDirection: "column", padding: "24px 0",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px", borderBottom: "1px solid #1a1c23" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#fff",
            }}>✦</div>
            <div>
              <div style={{ color: "#f0f0f2", fontWeight: 700, fontSize: 15 }}>InvoiceStudio</div>
              <div style={{ color: "#4b5563", fontSize: 11 }}>Pro Plan</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {[
            { id: "dashboard", icon: "◈", label: "Dashboard" },
            { id: "invoices", icon: "≡", label: "Fatture" },
            { id: "clients", icon: "◎", label: "Clienti" },
            { id: "analytics", icon: "∿", label: "Analytics" },
            { id: "settings", icon: "⊕", label: "Impostazioni" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 9, border: "none",
                background: tab === item.id ? "rgba(108,99,255,0.15)" : "none",
                color: tab === item.id ? "#8b7fff" : "#6b7280",
                fontSize: 14, fontWeight: tab === item.id ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s", marginBottom: 2,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.id === "invoices" && overdueCount > 0 && (
                <span style={{
                  marginLeft: "auto", background: "#ef4444", borderRadius: 10,
                  color: "#fff", fontSize: 10, padding: "2px 6px", fontWeight: 700,
                }}>{overdueCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1c23" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6c63ff, #f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>M</div>
            <div>
              <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 500 }}>Marco Bianchi</div>
              <div style={{ color: "#4b5563", fontSize: 11 }}>marco@studio.it</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: 220, padding: "28px 32px", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f2", fontFamily: "Georgia, serif" }}>
              {tab === "dashboard" ? "Dashboard" :
               tab === "invoices" ? "Fatture" :
               tab === "analytics" ? "Analytics" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </h1>
            <div style={{ color: "#4b5563", fontSize: 13, marginTop: 2 }}>
              {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
              border: "none", borderRadius: 11, color: "#fff",
              padding: "10px 20px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
              boxShadow: "0 4px 20px rgba(108,99,255,0.35)",
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> Nuova Fattura
          </button>
        </div>

        {/* KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          <KPICard label="Incassato" value={fmt(totalRevenue)} sub={`${paidCount} fatture pagate`} accent="#22c55e" icon="💰" />
          <KPICard label="In attesa" value={fmt(totalOutstanding)} sub={`${outstandingCount} fatture aperte`} accent="#f59e0b" icon="⏳" />
          <KPICard label="Scadute" value={overdueCount} sub="Richiedono azione" accent="#ef4444" icon="⚠️" />
          <KPICard label="DSO Medio" value="12gg" sub="↓ da 38gg (benchmark)" accent="#6c63ff" icon="📈" />
        </div>

        {/* CHART */}
        {(tab === "dashboard" || tab === "analytics") && (
          <div style={{ marginBottom: 24 }}>
            <RevenueChart invoices={invoices} />
          </div>
        )}

        {/* INVOICE TABLE */}
        <div style={{ background: "#0d0e13", border: "1px solid #1a1c23", borderRadius: 14, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1c23", display: "flex", gap: 10, alignItems: "center" }}>
            <input
              placeholder="Cerca per cliente o numero..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                background: "#111318", border: "1px solid #1e2029", borderRadius: 8,
                color: "#e5e7eb", padding: "8px 14px", fontSize: 13, width: 260,
              }}
            />
            <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
              {["all", "paid", "sent", "overdue", "draft"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    background: filterStatus === s ? "rgba(108,99,255,0.2)" : "none",
                    border: filterStatus === s ? "1px solid #6c63ff50" : "1px solid #1e2029",
                    borderRadius: 7, color: filterStatus === s ? "#8b7fff" : "#6b7280",
                    padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {s === "all" ? "Tutte" : STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", color: "#4b5563", fontSize: 12 }}>{filtered.length} risultati</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a1c23" }}>
                  {["Numero", "Cliente", "Importo", "Status", "Scadenza", "Tracking", "Azione"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      color: "#4b5563", fontSize: 11, fontWeight: 600,
                      letterSpacing: "0.07em", textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <InvoiceRow key={inv.id} inv={inv} onSelect={setSelected} selected={selected?.id === inv.id} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#374151" }}>
                      Nessuna fattura trovata
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* REMINDER BANNER */}
        {overdueCount > 0 && (
          <div style={{
            marginTop: 16, background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12,
            padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ color: "#fca5a5", fontSize: 14, fontWeight: 600 }}>
                {overdueCount} fattura{overdueCount > 1 ? "e" : ""} scadut{overdueCount > 1 ? "e" : "a"}
              </div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Reminder automatico programmato in base alle tue impostazioni</div>
            </div>
            <button style={{
              marginLeft: "auto",
              background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, color: "#fca5a5", padding: "6px 14px", fontSize: 13, cursor: "pointer",
            }} onClick={() => showToast("Reminder inviati a tutti i clienti con fatture scadute")}>
              Invia reminder ora
            </button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showNew && <NewInvoiceModal onClose={() => setShowNew(false)} onSave={addInvoice} />}
      {selected && <InvoiceDetail inv={selected} onClose={() => setSelected(null)} reminded={remindedInvoices.has(selected.id)} onRemind={() => setRemindedInvoices(prev => new Set(prev).add(selected.id))} />}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "success" ? "#22c55e30" : "#ef444430"}`,
          borderRadius: 10, padding: "12px 20px",
          color: toast.type === "success" ? "#22c55e" : "#fca5a5",
          fontSize: 14, fontWeight: 500, zIndex: 200,
          animation: "toastIn 0.2s ease", backdropFilter: "blur(10px)",
          whiteSpace: "nowrap",
        }}>
          {toast.type === "success" ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}
    </div>
  );
}
