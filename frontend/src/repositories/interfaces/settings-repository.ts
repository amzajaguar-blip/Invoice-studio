// ─── Settings Repository interface ───
// Extracted from useSettingsState into proper repository pattern.

import type { Organization, OrganizationSettings } from "@/types/models";

export interface SettingsRepository {
  getSettings(orgId: string): Promise<{
    organization: Organization;
    settings: OrganizationSettings;
  }>;
  updateSettings(orgId: string, settings: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
}
