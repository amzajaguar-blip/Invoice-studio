import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  const orgId = memberData?.org_id;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name), invoice_items(*)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = (invoices || []) as (Invoice & { clients?: { name: string } | null })[];

  // ── KPI computations ────────────────────────────────────────────────────
  const paid = list.filter((i) => i.status === "paid");
  const pending = list.filter((i) => i.status === "sent" || i.status === "overdue");
  const overdue = list.filter((i) => i.status === "overdue");
  const draft = list.filter((i) => i.status === "draft");

  const totalRevenue = paid.reduce((s, i) => s + (i.total || 0), 0);
  const totalOutstanding = pending.reduce((s, i) => s + (i.total || 0), 0);
  const avgInvoice = paid.length > 0 ? totalRevenue / paid.length : 0;

  // ── Monthly revenue (last 7 months) ─────────────────────────────────────
  const now = new Date();
  const months: string[] = [];
  const monthLabels: string[] = [];
  const monthlyData: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months.push(key);
    monthLabels.push(d.toLocaleDateString("it-IT", { month: "short" }));
    const total = paid
      .filter((inv) => inv.paid_at && inv.paid_at.startsWith(key))
      .reduce((s, inv) => s + (inv.total || 0), 0);
    monthlyData.push(total);
  }

  // ── Top 5 clients by revenue ────────────────────────────────────────────
  const clientRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
  for (const inv of paid) {
    const name = inv.clients?.name ?? inv.client_id ?? "—";
    if (!clientRevenue[name]) clientRevenue[name] = { name, revenue: 0, count: 0 };
    clientRevenue[name].revenue += inv.total || 0;
    clientRevenue[name].count += 1;
  }
  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Status breakdown ─────────────────────────────────────────────────────
  const statusBreakdown = [
    { label: "Pagate", count: paid.length, color: "#22c55e" },
    { label: "In attesa", count: pending.length - overdue.length, color: "#f59e0b" },
    { label: "Scadute", count: overdue.length, color: "#ef4444" },
    { label: "Bozze", count: draft.length, color: "#6b7280" },
  ].filter((s) => s.count > 0);

  const totalCount = list.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">Analytics</h2>
        <p className="text-[#6b7280] text-sm mt-1">Panoramica del tuo business</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Fatturato totale", value: formatCurrency(totalRevenue), sub: `${paid.length} pagate`, accent: "#22c55e" },
          { label: "In sospeso", value: formatCurrency(totalOutstanding), sub: `${pending.length} fatture`, accent: "#f59e0b" },
          { label: "Scadute", value: String(overdue.length), sub: "da incassare", accent: "#ef4444" },
          { label: "Media fattura", value: formatCurrency(avgInvoice), sub: "per fattura pagata", accent: "#6c63ff" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#111318] border border-[#1e2029] rounded-xl p-5">
            <p className="text-xs text-[#6b7280] mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.accent }}>{kpi.value}</p>
            <p className="text-xs text-[#6b7280] mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#6b7280] uppercase tracking-wider mb-6">
          Fatturato mensile (ultimi 7 mesi)
        </h3>
        {totalRevenue === 0 ? (
          <p className="text-center text-[#6b7280] text-sm py-8">
            I dati appariranno dopo la prima fattura pagata
          </p>
        ) : (
          <BarChart data={monthlyData} labels={monthLabels} />
        )}
      </div>

      {/* Bottom row: Top Clients + Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Clients */}
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
          <h3 className="text-sm font-medium text-[#6b7280] uppercase tracking-wider mb-4">
            Top clienti per fatturato
          </h3>
          {topClients.length === 0 ? (
            <p className="text-sm text-[#6b7280]">Nessun dato ancora</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((c, i) => {
                const maxRev = topClients[0].revenue;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#e5e7eb] truncate max-w-[60%]">
                        <span className="text-[#6b7280] mr-2">#{i + 1}</span>
                        {c.name}
                      </span>
                      <span className="text-[#f0f0f2] font-medium">{formatCurrency(c.revenue)}</span>
                    </div>
                    <div className="w-full bg-[#1e2029] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${(c.revenue / maxRev) * 100}%`, background: "#6c63ff" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6">
          <h3 className="text-sm font-medium text-[#6b7280] uppercase tracking-wider mb-4">
            Distribuzione stato ({totalCount} fatture)
          </h3>
          {totalCount === 0 ? (
            <p className="text-sm text-[#6b7280]">Nessuna fattura ancora</p>
          ) : (
            <div className="space-y-3">
              {statusBreakdown.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#e5e7eb]">{s.label}</span>
                    <span style={{ color: s.color }} className="font-medium">
                      {s.count} · {Math.round((s.count / totalCount) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1e2029] rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(s.count / totalCount) * 100}%`,
                        background: s.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bar Chart (SVG, no external deps) ───────────────────────────────────────

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  const W = 600;
  const H = 180;
  const PAD = { top: 12, right: 8, bottom: 28, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.floor(chartW / data.length) - 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => {
        const y = PAD.top + chartH - pct * chartH;
        return (
          <line key={pct} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke="#1e2029" strokeWidth={1} strokeDasharray="4 4" />
        );
      })}

      {/* Bars */}
      {data.map((v, i) => {
        const barH = Math.max((v / max) * chartH, v > 0 ? 4 : 0);
        const x = PAD.left + i * (chartW / data.length) + 4;
        const y = PAD.top + chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={4} fill={v > 0 ? "#6c63ff" : "#1e2029"}
              opacity={v > 0 ? 1 : 0.3}
            />
            {/* Value label */}
            {v > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fontSize={9} fill="#6b7280"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
              </text>
            )}
            {/* Month label */}
            <text
              x={x + barW / 2} y={H - 6}
              textAnchor="middle" fontSize={10} fill="#6b7280"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
