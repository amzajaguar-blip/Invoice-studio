interface KPICardProps {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon: string;
  href?: string;
}

export function KPICard({ label, value, sub, accent, icon, href }: KPICardProps) {
  const card = (
    <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-5 hover:border-[#6c63ff]/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs text-[#6b7280] mt-1">{sub}</div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="no-underline">
        {card}
      </a>
    );
  }

  return card;
}
