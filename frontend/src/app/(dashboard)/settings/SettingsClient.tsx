"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserQuota } from "@/types/rewards";
import { User, Gem, Bell, AlertTriangle, Check } from "lucide-react";

interface SettingsClientProps {
  user: { id: string; email: string; fullName: string };
  org: { id: string; name: string; plan: string; iban?: string | null; brand_color?: string | null } | null;
  quota: UserQuota | null;
  role: string;
}

const TABS = [
  { id: "profilo", label: "Profilo", icon: User },
  { id: "piano", label: "Piano", icon: Gem },
  { id: "notifiche", label: "Notifiche", icon: Bell },
  { id: "pericolo", label: "Zona Pericolosa", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free: { label: "Free", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  pro: { label: "Pro", color: "#6c63ff", bg: "rgba(108,99,255,0.12)" },
  agency: { label: "Agency", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  enterprise: { label: "Enterprise", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

export function SettingsClient({ user, org, quota, role }: SettingsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profilo");

  // Profile form state
  const [fullName, setFullName] = useState(user.fullName);
  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Notifications state
  const [emailReminders, setEmailReminders] = useState(true);
  const [emailPaid, setEmailPaid] = useState(true);
  const [notifSaved, setNotifSaved] = useState(false);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const planMeta = PLAN_LABELS[org?.plan ?? "free"] ?? PLAN_LABELS.free;

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, orgName: org?.id ? orgName : undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Errore nel salvataggio");
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "ELIMINA") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Errore durante l'eliminazione dell'account");
      }
      router.push("/login?deleted=true");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore durante l'eliminazione");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          Impostazioni
        </h2>
        <p className="text-[#6b7280] text-sm mt-1">
          Gestisci il tuo account e le preferenze
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-[#1e2029] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-none border-b-2 rounded-none -mb-px ${
              activeTab === tab.id
                ? "border-b-[#6c63ff] text-[#6c63ff]"
                : "border-b-transparent text-[#6b7280] hover:text-[#e5e7eb]"
            }`}
            style={{
              borderBottom: activeTab === tab.id ? "2px solid #6c63ff" : "2px solid transparent",
              background: "transparent",
            }}
          >
            <tab.icon className="w-4 h-4 inline-block align-text-bottom mr-1" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PROFILO ──────────────────────────────────────────────────── */}
      {activeTab === "profilo" && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#f0f0f2] uppercase tracking-wider">
              Informazioni personali
            </h3>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[#6b7280] mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                className="w-full bg-[#0d0e13] border border-[#1e2029] rounded-lg px-4 py-2.5 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-medium text-[#6b7280] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full bg-[#0d0e13] border border-[#1e2029] rounded-lg px-4 py-2.5 text-sm text-[#6b7280] cursor-not-allowed"
              />
              <p className="text-xs text-[#4b5563] mt-1">
                Per cambiare email contatta il supporto
              </p>
            </div>

            {/* Org name */}
            {org && (
              <div>
                <label className="block text-xs font-medium text-[#6b7280] mb-1.5">
                  Nome studio / azienda
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Il tuo studio"
                  className="w-full bg-[#0d0e13] border border-[#1e2029] rounded-lg px-4 py-2.5 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
                />
              </div>
            )}

            {profileError && (
              <p className="text-sm text-red-400">{profileError}</p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer border-none transition-colors"
              style={{ background: profileSaved ? "#22c55e" : "#6c63ff" }}
            >
              {profileSaved ? <span className="flex items-center gap-1 justify-center"><Check className="w-4 h-4" /> Salvato!</span> : savingProfile ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>

          {/* Role badge */}
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-[#6b7280]">Ruolo nell&apos;organizzazione</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20 capitalize">
              {role}
            </span>
          </div>
        </div>
      )}

      {/* ── TAB: PIANO ────────────────────────────────────────────────────── */}
      {activeTab === "piano" && (
        <div className="space-y-4 max-w-lg">
          {/* Current plan */}
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#f0f0f2] uppercase tracking-wider">
                Piano attuale
              </h3>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ color: planMeta.color, background: planMeta.bg, border: `1px solid ${planMeta.color}33` }}
              >
                {planMeta.label}
              </span>
            </div>

            {quota && (
              <div className="space-y-3">
                {/* Invoice usage */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#6b7280]">Fatture questo mese</span>
                    <span className="text-[#f0f0f2]">
                      {quota.currentMonthInvoices} / {quota.unlimited ? "∞" : quota.planLimit + quota.rewardedCredits}
                    </span>
                  </div>
                  {!quota.unlimited && (
                    <div className="w-full bg-[#1e2029] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (quota.currentMonthInvoices / (quota.planLimit + quota.rewardedCredits)) * 100)}%`,
                          background: quota.canCreateInvoice ? "#6c63ff" : "#ef4444",
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Upgrade CTA */}
          {org?.plan === "free" && (
            <div className="bg-gradient-to-br from-[#6c63ff]/10 to-[#8b5cf6]/10 border border-[#6c63ff]/20 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#f0f0f2]">
                  <Gem className="w-4 h-4 inline-block align-text-bottom mr-1" /> Passa a InvoiceStudio Pro
                </h3>
                <p className="text-sm text-[#9ca3af] mt-1">
                  Fatture illimitate, AI avanzata, analytics completi
                </p>
              </div>
              <ul className="space-y-2">
                {[
                  "Fatture illimitate al mese",
                  "PDF personalizzati con logo",
                  "Firma digitale (E-Sign)",
                  "Analytics avanzati",
                  "Supporto prioritario",
                ].map((f) => (
                  <li key={f} className="text-sm text-[#e5e7eb] flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#22c55e]" />{f}</li>
                ))}
              </ul>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[#f0f0f2]">€4,99</span>
                <span className="text-sm text-[#6b7280]">/mese · Disdici quando vuoi</span>
              </div>
              <a
                href="#"
                className="block w-full py-3 text-center text-sm font-semibold text-white rounded-xl no-underline transition-colors"
                style={{ background: "linear-gradient(135deg, #6c63ff 0%, #8b5cf6 100%)" }}
              >
                Upgrade a Pro →
              </a>
            </div>
          )}

          {org?.plan !== "free" && (
            <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#f0f0f2]">Gestisci abbonamento</p>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  Fatture, cancellazione, cambio piano
                </p>
              </div>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#6c63ff] no-underline hover:text-[#8b5cf6] transition-colors"
              >
                Portale Stripe →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: NOTIFICHE ────────────────────────────────────────────────── */}
      {activeTab === "notifiche" && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#f0f0f2] uppercase tracking-wider">
              Preferenze notifiche email
            </h3>

            {[
              {
                id: "reminders",
                label: "Reminder scadenze",
                sub: "Email automatica 7 giorni prima della scadenza",
                value: emailReminders,
                set: setEmailReminders,
              },
              {
                id: "paid",
                label: "Conferma pagamento",
                sub: "Email quando una fattura viene saldata",
                value: emailPaid,
                set: setEmailPaid,
              },
            ].map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#f0f0f2]">{item.label}</p>
                  <p className="text-xs text-[#6b7280] mt-0.5">{item.sub}</p>
                </div>
                <button
                  onClick={() => { item.set(!item.value); setNotifSaved(false); }}
                  role="switch"
                  aria-checked={item.value}
                  className="flex-shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer border-none relative"
                  style={{ background: item.value ? "#6c63ff" : "#1e2029" }}
                >
                  <span
                    className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                    style={{ left: item.value ? "calc(100% - 20px)" : "4px" }}
                  />
                </button>
              </div>
            ))}

            <button
              onClick={() => { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2500); }}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer border-none transition-colors"
              style={{ background: notifSaved ? "#22c55e" : "#6c63ff" }}
            >
              {notifSaved ? <span className="flex items-center gap-1 justify-center"><Check className="w-4 h-4" /> Preferenze salvate</span> : "Salva preferenze"}
            </button>
          </div>

        </div>
      )}

      {/* ── TAB: ZONA PERICOLOSA ──────────────────────────────────────────── */}
      {activeTab === "pericolo" && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 inline-block align-text-bottom mr-1" /> Zona Pericolosa
              </h3>
              <p className="text-xs text-[#6b7280] mt-1">
                Le azioni in questa sezione sono irreversibili
              </p>
            </div>

            <div className="border-t border-red-500/10 pt-4">
              <h4 className="text-sm font-medium text-[#f0f0f2] mb-1">
                Elimina account
              </h4>
              <p className="text-xs text-[#6b7280] mb-4">
                Tutti i tuoi dati, fatture, clienti e impostazioni verranno eliminati
                permanentemente. Questa azione non può essere annullata.
              </p>

              <label className="block text-xs font-medium text-[#6b7280] mb-1.5">
                Scrivi <strong className="text-red-400">ELIMINA</strong> per confermare
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="ELIMINA"
                className="w-full bg-[#0d0e13] border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-[#f0f0f2] placeholder-[#4b5563] focus:outline-none focus:border-red-500/50 transition-colors mb-3"
              />

              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "ELIMINA" || deleting}
                className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-all"
                style={{
                  background: deleteConfirm === "ELIMINA" ? "#ef4444" : "#1e2029",
                  color: deleteConfirm === "ELIMINA" ? "#fff" : "#4b5563",
                  cursor: deleteConfirm === "ELIMINA" ? "pointer" : "not-allowed",
                }}
              >
                {deleting ? "Eliminazione..." : "Elimina il mio account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
