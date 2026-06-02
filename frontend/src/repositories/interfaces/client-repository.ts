// ─── Client Repository interface ───

import type { Client } from "@/types/models";

export interface ClientRepository {
  /** List all clients for an organization. */
  list(orgId: string): Promise<Client[]>;

  /** Get a single client by ID. */
  getById(clientId: string): Promise<Client | null>;

  /** Create a new client. */
  create(orgId: string, input: CreateClientInput): Promise<Client>;

  /** Update an existing client. */
  update(clientId: string, input: UpdateClientInput): Promise<Client>;

  /** Delete a client. */
  delete(clientId: string): Promise<void>;
}

export interface CreateClientInput {
  name: string;
  email: string;
  vatNumber?: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  vatNumber?: string;
  address?: string;
  phone?: string;
  notes?: string;
}
