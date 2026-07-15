"use client";

interface LanguageSelectorProps {
  current: string;
  itPath: string;
  enPath: string;
}

export function LanguageSelector({ current, itPath, enPath }: LanguageSelectorProps) {
  return (
    <select
      className="bg-[#1e2029] text-[#d1d5db] border border-[#374151] rounded px-3 py-1 text-sm"
      onChange={(e) => { if (e.target.value) window.location.href = e.target.value; }}
      defaultValue={current}
    >
      <option value={itPath}>🇮🇹 Italiano</option>
      <option value={enPath}>🇬🇧 English</option>
    </select>
  );
}
