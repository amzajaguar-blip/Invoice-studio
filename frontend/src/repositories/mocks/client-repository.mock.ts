// ─── Client Repository — Mock implementation ───

import type { ClientRepository, CreateClientInput, UpdateClientInput } from "@/repositories/interfaces/client-repository";
import type { Client } from "@/types/models";

const MOCK_CLIENTS: Client[] = [
  {
    id: "c1", orgId: "org-1", name: "Studio Legale Rossi", email: "amministrazione@studiolegalerossi.it",
    vatNumber: "IT12345678901", address: "Via Roma 1, Milano", city: "Milano", postalCode: "20100", country: "IT",
    currency: "EUR", phone: "+39 02 1234567", notes: "Cliente storico — paga puntuale",
    createdAt: "2026-01-10T08:00:00Z", updatedAt: null,
  },
  {
    id: "c2", orgId: "org-1", name: "WebAgency Pro", email: "info@webagencypro.it",
    vatNumber: "IT98765432109", address: "Corso Italia 42, Roma", city: "Roma", postalCode: "00100", country: "IT",
    currency: "EUR", phone: null, notes: null,
    createdAt: "2026-02-15T14:00:00Z", updatedAt: "2026-03-01T09:00:00Z",
  },
];

export function createClientRepositoryMock(): ClientRepository {
  let clients = [...MOCK_CLIENTS];

  return {
    async list(_orgId: string): Promise<Client[]> {
      await new Promise((r) => setTimeout(r, 300));
      return clients;
    },

    async getById(clientId: string): Promise<Client | null> {
      await new Promise((r) => setTimeout(r, 150));
      return clients.find((c) => c.id === clientId) ?? null;
    },

    async create(_orgId: string, input: CreateClientInput): Promise<Client> {
      await new Promise((r) => setTimeout(r, 400));
      const client: Client = {
        id: `c-${Date.now()}`,
        orgId: _orgId,
        name: input.name,
        email: input.email,
        vatNumber: input.vatNumber ?? null,
        address: input.address ?? null,
        city: null,
        postalCode: null,
        country: null,
        currency: "EUR",
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      clients = [client, ...clients];
      return client;
    },

    async update(clientId: string, input: UpdateClientInput): Promise<Client> {
      await new Promise((r) => setTimeout(r, 300));
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx === -1) throw new Error("Client not found");
      clients[idx] = { ...clients[idx]!, ...input, updatedAt: new Date().toISOString() };
      return clients[idx]!;
    },

    async delete(clientId: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 200));
      clients = clients.filter((c) => c.id !== clientId);
    },
  };
}
