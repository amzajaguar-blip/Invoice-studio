// ─── DashboardView — client component using the new architecture ───

"use client";

import { createClient } from "@/lib/supabase/client";
import { createDashboardRepositorySupabase } from "@/repositories/supabase/dashboard-repository.supabase";
import { useDashboardState } from "@/hooks/state/useDashboardState";
import { UiStateRenderer } from "@/components/ui-states";
import { KPICard } from "@/components/dashboard/KPICard";
import { PromoCard } from "@/components/promotion/PromoCard";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/types/states/dashboard";

interface DashboardViewProps {
  orgId: string;
  userName: string;
  invoiceCount: number;
}

/** Main dashboard content — connected via useDashboardState + UiStateRenderer. */
function DashboardContent({ data, userName, invoiceCount }: { data: DashboardData; userName: string; invoiceCount: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Dashboard
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {new Date().toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href="/scanner"
            className="px-5 py-2.5 text-sm no-underline rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium transition-colors flex items-center gap-2"
          >
            ⚡ Importa Documento (OCR)
          </a>
          <a
            href="/invoices"
            className="btn-primary px-5 py-2.5 text-sm no-underline"
          >
            ✦ Nuova Fattura
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kpis.map((kpi, i) => (
          <KPICard
            key={i}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            accent={
              kpi.accent === "positive" ? "paid"
                : kpi.accent === "negative" ? "overdue"
                : kpi.icon === "pending" ? "pending"
                : "default"
            }
            icon={kpiIconMap[kpi.icon]}
            href={kpiHrefMap[kpi.icon]}
            id={`kpi-${kpi.icon}`}
          />
        ))}
      </div>

      {/* Revenue Chart */}
      {data.revenueTrend && (
        <div className="card-premium p-6">
          <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Fatturato ultimi 6 mesi
          </h3>
          <MiniRevenueChart months={data.revenueTrend.months} />
        </div>
      )}

      {/* Welcome / Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {invoiceCount === 0 ? (
          <div className="md:col-span-2">
            <PromoCard visible={true} />
          </div>
        ) : (
          <div className="card-premium p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
              👋 Benvenuto{userName ? `, ${userName}` : ""}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Hai {invoiceCount} fatture. Continua così!
            </p>
          </div>
        )}

        <div className="card-premium p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            🚀 Azioni rapide
          </h3>
          <div className="flex flex-wrap gap-2">
            <a
              href="/scanner"
              className="text-xs no-underline text-white bg-[#6c63ff] hover:bg-[#5b52e0] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              ⚡ OCR
            </a>
            <a
              href="/invoices"
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-light)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-3 py-1.5 rounded-lg transition-colors no-underline"
            >
              Vedi fatture
            </a>
            <a
              href="/clients"
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-light)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-3 py-1.5 rounded-lg transition-colors no-underline"
            >
              Gestisci clienti
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const kpiIconMap: Record<string, string> = {
  revenue: "💰",
  invoices: "📄",
  pending: "⏳",
  recovery: "⚠️",
  clients: "👥",
};

const kpiHrefMap: Record<string, string> = {
  revenue: "/invoices?status=paid",
  invoices: "/invoices",
  pending: "/invoices?status=sent",
  recovery: "/invoices?status=overdue",
  clients: "/clients",
};

// ─── Mini Revenue Chart ───

function MiniRevenueChart({ months }: { months: { month: string; revenue: number }[] }) {
  const data = months.map((m) => m.revenue);
  const labels = months.map((m) => {
    const d = new Date(m.month);
    return d.toLocaleDateString("it-IT", { month: "short" });
  });
  const max = Math.max(...data, 1);
  const width = 600;
  const height = 180;
  const pad = { t: 10, r: 10, b: 25, l: 10 };
  const cw = width - pad.l - pad.r;
  const ch = height - pad.t - pad.b;

  const points = data
    .map(
      (v, i) =>
        `${pad.l + (i / Math.max(data.length - 1, 1)) * cw},${pad.t + ch - (v / max) * ch}`,
    )
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={pad.l}
          y1={pad.t + ch - pct * ch}
          x2={width - pad.r}
          y2={pad.t + ch - pct * ch}
          stroke="var(--border-primary)"
          strokeWidth={1}
        />
      ))}
      <defs>
        <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad.l},${pad.t + ch} ${points} ${width - pad.r},${pad.t + ch}`}
        fill="url(#areaGrad2)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const x = pad.l + (i / Math.max(data.length - 1, 1)) * cw;
        const y = pad.t + ch - (v / max) * ch;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={v > 0 ? 4 : 3}
            fill={v > 0 ? "var(--accent)" : "var(--surface-secondary)"}
            stroke={v > 0 ? "var(--background)" : "none"}
            strokeWidth={2}
          />
        );
      })}
      {labels.map((l, i) => (
        <text
          key={i}
          x={pad.l + (i / Math.max(data.length - 1, 1)) * cw}
          y={height - 5}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={10}
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

// ─── Wrapper (connects hook to renderer) ───

export function DashboardView({ orgId, userName, invoiceCount }: DashboardViewProps) {
  const supabase = createClient();
  const repo = createDashboardRepositorySupabase(supabase, orgId);
  const { state, refresh } = useDashboardState(repo, orgId);

  return (
    <UiStateRenderer state={state} loadingVariant="dashboard" emptyIcon="invoice">
      {(data) => (
        <DashboardContent data={data} userName={userName} invoiceCount={invoiceCount} />
      )}
    </UiStateRenderer>
  );
}
