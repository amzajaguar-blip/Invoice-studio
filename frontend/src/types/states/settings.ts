// ─── Settings UiState ───

import type { UiState } from "./base";
import type { OrganizationSettings, Organization } from "../models";

export interface SettingsData {
  organization: Organization;
  settings: OrganizationSettings;
  /** Which tab/section is active. */
  activeSection: SettingsSection;
  /** Whether a save operation is in flight. */
  isSaving: boolean;
}

export type SettingsSection =
  | "profile"
  | "workspace"
  | "integrations"
  | "billing"
  | "notifications"
  | "security"
  | "support";

export type SettingsUiState = UiState<SettingsData>;
