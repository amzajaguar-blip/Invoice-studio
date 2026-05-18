"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Client {
  id: string;
  name: string;
  email: string;
  vat_number?: string | null;
  address?: string | null;
  currency: string;
  created_at?: string;
}

export function ClientsClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (initialClients.length === 0 && !loadedRef.current) {
      loadedRef.current = true;
      const supabase = createClient();
      supabase
        .from("clients")
        .select("*")
        .order("name")
        .then(({ data }) => {
          if (data) setClients(data as Client[]);
        });
    }
  }, [initialClients.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
            Clienti
          </h2>
          <p className="text-[#6b7280] text-sm mt-1">
            {clients.length} client{clients.length === 1 ? "e" : "i"}
          </p>
        </div>
        <button className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors border-none cursor-pointer">
          ✦ Nuovo Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8 text-center">
          <p className="text-[#6b7280]">Nessun cliente ancora. Aggiungine uno per iniziare.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-[#111318] border border-[#1e2029] rounded-xl p-4 hover:border-[#6c63ff]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#f0f0f2]">{client.name}</p>
                  <p className="text-xs text-[#6b7280]">{client.email}</p>
                </div>
                <div className="text-right">
                  {client.vat_number && (
                    <p className="text-xs text-[#6b7280]">P.IVA: {client.vat_number}</p>
                  )}
                  <p className="text-xs text-[#6b7280] capitalize">{client.currency}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
