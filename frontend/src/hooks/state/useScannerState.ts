// ─── useScannerState — custom hook for OCR scanner flow ───
// Supports: Loading | Success | Error | Offline state transitions.

"use client";

import { useCallback, useRef, useState } from "react";
import type { ScannerUiState } from "@/types/states/scanner";
import { loading, success, error, empty } from "@/types/states/base";
import type { ScannerRepository } from "@/repositories/interfaces/scanner-repository";

export function useScannerState(repository: ScannerRepository, orgId: string) {
  const [state, setState] = useState<ScannerUiState>(loading());
  const [remainingScans, setRemainingScans] = useState(0);
  const mountedRef = useRef(true);

  const init = useCallback(async () => {
    setState(loading());
    try {
      const scans = await repository.getRemainingScans(orgId);
      if (!mountedRef.current) return;
      setRemainingScans(scans);
      if (scans <= 0) {
        setState(empty("Hai esaurito le scansioni gratuite di questo mese. Passa a Pro per scansioni illimitate."));
      } else {
        setState(
          success({
            step: "capture",
            remainingScans: scans,
            extractedData: null,
            imageValid: false,
            processingError: null,
          }),
        );
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("network") || msg.includes("fetch")) {
        setState({
          status: "offline",
          cachedData: { step: "capture", remainingScans: remainingScans, extractedData: null, imageValid: false, processingError: null },
          lastSyncedAt: undefined,
        });
      } else {
        // eslint-disable-next-line react-hooks/immutability
        setState(error(msg || "Impossibile inizializzare lo scanner", () => init()));
      }
    }
  }, [repository, orgId, remainingScans]);

  const processImage = useCallback(
    async (imageBase64: string) => {
      setState(
        success({
          step: "processing",
          remainingScans,
          extractedData: null,
          imageValid: true,
          processingError: null,
        }),
      );
      try {
        const extracted = await repository.processImage(orgId, imageBase64);
        if (!mountedRef.current) return;
        setState(
          success({
            step: "review",
            remainingScans,
            extractedData: extracted,
            imageValid: true,
            processingError: null,
          }),
        );
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : "Elaborazione OCR fallita";

        if (msg.includes("network") || msg.includes("fetch")) {
          setState({
            status: "offline",
            cachedData: {
              step: "capture",
              remainingScans,
              extractedData: null,
              imageValid: false,
              processingError: "Elaborazione non disponibile offline. Riprova quando sei connesso.",
            },
            lastSyncedAt: undefined,
          });
        } else {
          setState(
            success({
              step: "capture",
              remainingScans,
              extractedData: null,
              imageValid: false,
              processingError: msg,
            }),
          );
        }
      }
    },
    [repository, orgId, remainingScans],
  );

  const confirm = useCallback(async () => {
    const current = state;
    if (current.status !== "success" || !current.data.extractedData) return;
    setState(success({ ...current.data, step: "confirming" }));
    try {
      const result = await repository.confirmAndCreateInvoice(orgId, current.data.extractedData);
      if (!mountedRef.current) return;
      const newRemaining = remainingScans - 1;
      setRemainingScans(newRemaining);
      setState(
        success({
          step: "capture",
          remainingScans: newRemaining,
          extractedData: null,
          imageValid: false,
          processingError: null,
        }),
      );
      return result;
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Errore nella creazione fattura";
      if (msg.includes("network")) {
        setState({
          status: "offline",
          cachedData: {
            step: "review",
            remainingScans,
            extractedData: current.data.extractedData,
            imageValid: true,
            processingError: null,
          },
          lastSyncedAt: undefined,
        });
      } else {
        // eslint-disable-next-line react-hooks/immutability
        setState(error(msg, () => confirm()));
      }
    }
  }, [repository, orgId, state, remainingScans]);

  const retry = useCallback(() => {
    const current = state;
    if (current.status === "error" || current.status === "offline") {
      init();
    }
  }, [state, init]);

  return { state, init, processImage, confirm, retry };
}
