"use client";

import { useEffect } from "react";

/**
 * Registra il service worker per il supporto PWA / Trusted Web Activity.
 * Eseguito lato client — il service worker è disponibile solo in produzione
 * (o in dev se Next.js lo serve tramite la cartella public/).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Ritarda la registrazione per non competere con il rendering iniziale
    const timeout = setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log(
            "[PWA] Service Worker registrato con successo:",
            registration.scope
          );

          // Ascolta gli aggiornamenti del service worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log(
                  "[PWA] Nuova versione disponibile — ricarica per aggiornare."
                );
              }
            });
          });
        })
        .catch((error) => {
          console.error("[PWA] Registrazione Service Worker fallita:", error);
        });
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
