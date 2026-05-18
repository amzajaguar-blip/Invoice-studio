"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { ReferralBanner } from "@/components/promotion/ReferralBanner";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "📊", path: "/dashboard" },
  { label: "Fatture", icon: "📄", path: "/invoices" },
  { label: "Clienti", icon: "👥", path: "/clients" },
  { label: "Analytics", icon: "📈", path: "/analytics" },
  { label: "Impostazioni", icon: "⚙️", path: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user for referral banner (non-blocking)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex bg-[#0a0b0f]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 bottom-0 w-[220px] bg-[#0d0e13] border-r border-[#1e2029] flex flex-col z-50 transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-5 pb-7 pt-3">
          <h1 className="text-[#f0f0f2] text-xl font-bold font-[Georgia,serif]">
            ✦ InvoiceStudio
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[#6c63ff]/10 text-[#6c63ff] font-medium border border-[#6c63ff]/20"
                    : "text-[#6b7280] hover:text-[#e5e7eb] hover:bg-[#111318]"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[#1a1c23]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#6b7280] hover:text-[#ef4444] hover:bg-[#111318] rounded-lg transition-colors"
          >
            <span>🚪</span> Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0a0b0f] border-b border-[#1e2029] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#e5e7eb] p-1"
            aria-label="Apri menu"
          >
            ☰
          </button>
          <span className="text-[#f0f0f2] font-bold font-[Georgia,serif] text-lg">
            InvoiceStudio
          </span>
        </header>

        <main id="main-content" className="flex-1 px-4 md:px-8 py-6">
          {/* Referral Banner */}
          <div className="mb-4">
            <ReferralBanner userId={userId} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
