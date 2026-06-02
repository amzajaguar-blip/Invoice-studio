// ─── useSettingsState — custom hook for settings/admin page ───

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SettingsUiState, SettingsSection } from "@/types/states/settings";
import { loading, success, error, offline } from "@/types/states/base";
import type { SettingsRepository } from "@/repositories/interfaces/settings-repository";
import { createSettingsRepositoryMock } from "@/repositories/mocks/settings-repository.mock";

export function useSettingsState(
  repository?: SettingsRepository,
  orgId: string = "org-1",
) {
  const repo = repository ?? createSettingsRepositoryMock();
  const [state, setState] = useState<SettingsUiState>(loading());
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setState(loading());
    try {
      const data = await repo.getSettings(orgId);
      if (!mountedRef.current) return;
      setState(
        success({
          organization: data.organization,
          settings: data.settings,
          activeSection: "profile",
          isSaving: false,
        }),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore nel caricamento impostazioni";
      if (message.includes("network")) {
        setState(offline());
      } else {
        setState(error(message, () => fetch()));
      }
    }
  }, [repo, orgId]);

  const setSection = useCallback((section: SettingsSection) => {
    setState((prev) => {
      if (prev.status === "success") {
        return success({ ...prev.data, activeSection: section });
      }
      return prev;
    });
  }, []);

  const save = useCallback(async (update: Partial<import("@/types/models").OrganizationSettings>) => {
    setState((prev) => {
      if (prev.status === "success") {
        return success({ ...prev.data, isSaving: true });
      }
      return prev;
    });
    try {
      const settings = await repo.updateSettings(orgId, update);
      if (!mountedRef.current) return;
      setState((prev) => {
        if (prev.status === "success") {
          return success({ ...prev.data, settings, isSaving: false });
        }
        return prev;
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore nel salvataggio";
      setState(error(message, () => fetch()));
    }
  }, [repo, orgId, fetch]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { state, setSection, save, retry: fetch };
}
