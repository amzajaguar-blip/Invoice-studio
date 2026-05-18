import { getCurrentUser } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  await getCurrentUser();

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-6">
        Analytics
      </h2>
      <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8 text-center">
        <p className="text-[#6b7280]">I dati analitici appariranno qui dopo aver creato le prime fatture.</p>
      </div>
    </div>
  );
}
