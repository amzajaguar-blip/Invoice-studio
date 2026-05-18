import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { PromoCard } from "@/components/promotion/PromoCard";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Fetch org_id for defense-in-depth
  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  const orgId = memberData?.org_id;

  // Fetch invoices (with org_id filter as defense-in-depth on top of RLS)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  // Fetch clients count
  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const invoiceList = (invoices || []) as Invoice[];

  // KPIs
  const paidInvoices = invoiceList.filter((i) => i.status === "paid");
  const pendingInvoices = invoiceList.filter(
    (i) => i.status === "sent" || i.status === "overdue"
  );
  const overdueInvoices = invoiceList.filter((i) => i.status === "overdue");
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total || i.amount || 0), 0);
  const totalOutstanding = pendingInvoices.reduce((s, i) => s + (i.total || i.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
            Dashboard
          </h2>
          <p className="text-[#6b7280] text-sm mt-1">
            {new Date().toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <a
          href="/invoices"
          className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors no-underline"
        >
          ✦ Nuova Fattura
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Incassato"
          value={formatCurrency(totalRevenue)}
          sub={`${paidInvoices.length} fatture pagate`}
          accent="#22c55e"
          icon="💰"
          href="/invoices?status=paid"
        />
        <KPICard
          label="In attesa"
          value={formatCurrency(totalOutstanding)}
          sub={`${pendingInvoices.length} fatture aperte`}
          accent="#f59e0b"
          icon="⏳"
          href="/invoices?status=sent"
        />
        <KPICard
          label="Scadute"
          value={String(overdueInvoices.length)}
          sub={overdueInvoices.length === 1 ? "1 fattura scaduta" : `${overdueInvoices.length} fatture scadute`}
          accent="#ef4444"
          icon="⚠️"
          href="/invoices?status=overdue"
        />
        <KPICard
          label="Clienti"
          value={String(clientCount || 0)}
          sub={clientCount === 1 ? "1 cliente" : `${clientCount || 0} clienti`}
          accent="#6c63ff"
          icon="👥"
          href="/clients"
        />
      </div>

      {/* Revenue Chart (placeholder for now) */}
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#6b7280] uppercase tracking-wider mb-4">
          Fatturato ultimi 7 mesi
        </h3>
        <RevenueChart invoices={invoiceList} />
      </div>

      {/* Welcome / Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Show PromoCard when no invoices, otherwise standard welcome */}
        {invoiceList.length === 0 ? (
          <div className="md:col-span-2">
            <PromoCard visible={true} />
          </div>
        ) : (
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f0f0f2] mb-2">
              👋 Benvenuto{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
            </h3>
            <p className="text-xs text-[#6b7280]">
              Hai {invoiceList.length} fatture. Continua così!
            </p>
          </div>
        )}

        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f0f0f2] mb-2">
            🚀 Azioni rapide
          </h3>
          <div className="flex gap-2">
            <a
              href="/invoices"
              className="text-xs text-[#6c63ff] hover:text-[#8b5cf6] bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 px-3 py-1.5 rounded-lg transition-colors no-underline"
            >
              Vedi fatture
            </a>
            <a
              href="/clients"
              className="text-xs text-[#6c63ff] hover:text-[#8b5cf6] bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 px-3 py-1.5 rounded-lg transition-colors no-underline"
            >
              Gestisci clienti
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Chart (inline for now — will be extracted later) ────────────────

function RevenueChart({ invoices }: { invoices: Invoice[] }) {
  const now = new Date();
  const months: string[] = [];
  const data: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString("it-IT", { month: "short" }));
    const monthKey = d.toISOString().slice(0, 7);
    const total = invoices
      .filter(
        (inv) =>
          inv.status === "paid" && inv.paid_at && inv.paid_at.startsWith(monthKey)
      )
      .reduce((s, inv) => s + (inv.total || inv.amount || 0), 0);
    data.push(total);
  }

  const max = Math.max(...data, 1);
  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 25, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map(
    (v, i) =>
      `${padding.left + (i / Math.max(data.length - 1, 1)) * chartW},${
        padding.top + chartH - (v / max) * chartH
      }`
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padding.top + chartH - pct * chartH;
        return (
          <g key={pct}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#1e2029"
              strokeWidth={1}
            />
          </g>
        );
      })}

      {/* Area */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#6c63ff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding.left},${padding.top + chartH} ${points.join(" ")} ${width - padding.right},${padding.top + chartH}`}
        fill="url(#areaGrad)"
      />

      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#6c63ff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {data.map((v, i) => {
        const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = padding.top + chartH - (v / max) * chartH;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={v > 0 ? 4 : 3}
            fill={v > 0 ? "#6c63ff" : "#1e2029"}
            stroke={v > 0 ? "#0a0b0f" : "none"}
            strokeWidth={2}
          />
        );
      })}

      {/* Month labels */}
      {months.map((m, i) => (
        <text
          key={i}
          x={padding.left + (i / Math.max(data.length - 1, 1)) * chartW}
          y={height - 5}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
        >
          {m}
        </text>
      ))}
    </svg>
  );
}
