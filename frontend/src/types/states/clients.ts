// ─── Clients UiState ───

import type { UiState } from "./base";
import type { Client } from "../models";

export interface ClientsData {
  clients: Client[];
  total: number;
}

export type ClientsUiState = UiState<ClientsData>;
