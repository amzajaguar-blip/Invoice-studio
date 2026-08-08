/**
 * revenuecat-identity.ts — Allinea l'App User ID di RevenueCat all'org_id Supabase.
 *
 * PERCHE' ESISTE
 * `Purchases.configure({ apiKey })` in app/_layout.tsx non passa `appUserID`,
 * quindi RevenueCat assegna un ID anonimo (`$RCAnonymousID:...`). Quello stesso
 * valore finisce in `event.app_user_id` di ogni webhook, e l'handler
 * frontend/src/app/api/webhooks/revenuecat/route.ts lo valida come UUID:
 *
 *     const uuidRegex = /^[0-9a-f]{8}-.../i;
 *     if (!uuidRegex.test(rawOrgId)) return 400 "Invalid organization ID";
 *
 * Con l'ID anonimo il test fallisce sempre: il webhook rigetta il 100% degli
 * eventi e `organizations.plan` non passa mai a 'pro'. Allineando l'App User ID
 * all'org_id il webhook torna a riconoscere l'organizzazione.
 *
 * ALIASING DEGLI ACQUISTI ESISTENTI
 * `Purchases.logIn(orgId)` fonde l'utente anonimo corrente con l'ID reale
 * (aliasing lato RevenueCat): gli acquisti gia' fatti su questo device sotto
 * ID anonimo restano associati e non serve un restore manuale. Per chi
 * reinstalla, resta disponibile "Ripristina acquisti" in ProUpgrade.
 *
 * NON tocca i product ID, i prezzi, ne' il flusso di acquisto.
 */

import Purchases from 'react-native-purchases';
import { supabase } from './supabase';

/** Tentativi di attesa di Purchases.configure() prima di rinunciare. */
const CONFIGURE_MAX_ATTEMPTS = 8;
const CONFIGURE_INITIAL_DELAY_MS = 100;
const CONFIGURE_MAX_DELAY_MS = 2_000;

/**
 * Risolve l'org_id dell'utente autenticato: prima dai user_metadata (pattern
 * V33, non costa una query), poi da org_members. Stessa logica di
 * hooks/usePlanLimits.ts — se cambia li', va cambiata anche qui.
 */
export async function resolveOrgId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const metaOrgId = user.user_metadata?.org_id as string | undefined;
    if (metaOrgId) return metaOrgId;

    const { data } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();

    return data?.org_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Attende che Purchases.configure() abbia propagato il singleton nativo.
 * Stesso backoff usato da PlanContext: su React 19 StrictMode l'effect del
 * root layout e quello dei figli possono interleacciarsi.
 */
async function waitForPurchasesConfigured(): Promise<boolean> {
  let delay = CONFIGURE_INITIAL_DELAY_MS;
  for (let attempt = 0; attempt <= CONFIGURE_MAX_ATTEMPTS; attempt++) {
    try {
      if (Purchases.isConfigured && (await Purchases.isConfigured())) return true;
    } catch {
      // isConfigured assente su SDK vecchi — si continua ad attendere
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, CONFIGURE_MAX_DELAY_MS);
  }
  return false;
}

/**
 * Porta l'App User ID di RevenueCat a coincidere con l'org_id corrente.
 * Idempotente: se l'ID e' gia' allineato non chiama logIn().
 *
 * @returns l'org_id applicato, o null se non c'e' sessione / SDK non pronto.
 *          Non lancia mai: un fallimento qui non deve impedire l'uso dell'app.
 */
export async function syncRevenueCatIdentity(): Promise<string | null> {
  try {
    if (!(await waitForPurchasesConfigured())) return null;

    const orgId = await resolveOrgId();
    if (!orgId) return null;

    const current = await Purchases.getAppUserID();
    if (current === orgId) return orgId;

    await Purchases.logIn(orgId);
    return orgId;
  } catch (err) {
    console.warn('[revenuecat-identity] logIn fallito — il webhook resta disallineato', err);
    return null;
  }
}

/**
 * Riporta RevenueCat a un utente anonimo al logout, cosi' un secondo account
 * sullo stesso device non eredita l'entitlement del primo.
 */
export async function resetRevenueCatIdentity(): Promise<void> {
  try {
    if (!(await Purchases.isConfigured())) return;
    await Purchases.logOut();
  } catch {
    // logOut() lancia se l'utente e' gia' anonimo: e' lo stato voluto.
  }
}

/**
 * Aggancia l'identita' RevenueCat al ciclo di vita della sessione Supabase.
 * Da chiamare una sola volta, subito dopo Purchases.configure().
 *
 * @returns funzione di unsubscribe.
 */
export function initRevenueCatIdentity(): () => void {
  // Sessione gia' attiva al boot (caso piu' comune: app riaperta da loggati).
  void syncRevenueCatIdentity();

  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      void resetRevenueCatIdentity();
    } else if (
      event === 'SIGNED_IN' ||
      event === 'INITIAL_SESSION' ||
      event === 'USER_UPDATED'
    ) {
      // USER_UPDATED conta: org_id vive nei user_metadata e puo' arrivare
      // dopo il primo SIGNED_IN, quando il trigger handle_new_user() ha finito.
      void syncRevenueCatIdentity();
    }
  });

  return () => data.subscription.unsubscribe();
}
