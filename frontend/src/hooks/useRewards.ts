"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserQuota } from "@/types/rewards";

/**
 * Hook to fetch and track user's plan quota and rewarded credits.
 * Polls /api/rewards/status on mount and after invoice creation.
 */
export function useQuota() {
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/rewards/status");
      if (!res.ok) {
        if (res.status === 401) return; // not authenticated
        throw new Error("Failed to fetch quota");
      }
      const json = await res.json();
      return json.data as UserQuota;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState is inside async callbacks, not synchronous
    fetchQuota().then((data) => {
      if (!cancelled && data) setQuota(data);
    });
    return () => { cancelled = true; };
  }, [fetchQuota]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchQuota();
    if (data) setQuota(data);
    return data;
  }, [fetchQuota]);

  return { quota, loading, error, refresh };
}

/**
 * Hook to manage the rewarded ad claim flow.
 * Handles nonce generation, signature, and server-side verification.
 */
export function useRewardedAd(orgId: string | undefined) {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const claimReward = useCallback(async () => {
    if (!orgId) {
      setClaimError("Non autenticato");
      return null;
    }

    setClaiming(true);
    setClaimError(null);

    try {
      // Generate nonce and timestamp
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();

      // Compute HMAC signature (client-side)
      const secret = process.env.NEXT_PUBLIC_REWARD_SECRET ?? "dev-secret";
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const data = `${nonce}:${orgId}:${timestamp}`;
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
      const signature = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Send claim to server
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce, signature, timestamp, rewardAmount: 1 }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setClaimError(json.error || "Verifica fallita");
        return null;
      }

      setClaimed(true);
      return json;
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Errore di rete");
      return null;
    } finally {
      setClaiming(false);
    }
  }, [orgId]);

  return { claimReward, claiming, claimError, claimed, resetClaimed: () => setClaimed(false) };
}
