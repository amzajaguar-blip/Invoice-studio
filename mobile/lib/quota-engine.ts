/**
 * quota-engine.ts — Contatore documenti lifetime per piano gratuito
 *
 * Implementa il Quota_Engine per Milo Office.
 * Il contatore è persistito su Supabase (non aggirabile lato client).
 * L'unica fonte di verità per lo stato premium è RevenueCat via iap-engine.ts.
 *
 * VINCOLI CRITICI:
 * - ZERO import da rate-limit-engine.ts o PlanContext.tsx
 * - NON modifica organizations.plan, user_plan.plan
 * - Il contatore vive su Supabase — NON lato client
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const QUOTA_CACHE_KEY = 'milo_quota_cache_v1';
/** TTL cache quota: 5 minuti in ms */
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Contatore di riserva, usato solo quando non esiste un'organizzazione a cui
 * attribuire il documento. Vedi `checkQuotaOrLocal`.
 */
const LOCAL_COUNT_KEY = 'milo_local_doc_count_v1';

/**
 * Quota gratuita di riferimento, da tenere allineata al DEFAULT della colonna
 * `organizations.quota_limit` (migrazione `..._quota_launch.sql`).
 *
 * Era 5 documenti *a vita*: troppo pochi perche' l'app si faccia valutare. Chi
 * genera cinque file non ha ancora capito se il prodotto vale un abbonamento, e
 * al sesto trovava un paywall la cui uscita gratuita — il video premio — non
 * riceve annunci finche' l'account AdMob non e' approvato. Il risultato era una
 * disinstallazione al posto di un acquisto.
 *
 * 20 lascia spazio per usare l'app su lavoro vero e arrivare al paywall avendo
 * capito cosa si sta comprando. Il muro resta, perche' l'acquisto Pro funziona
 * ed e' la via di uscita; il video premio tornera' a essere l'alternativa
 * gratuita quando AdMob approvera' l'account.
 *
 * NB: questo valore e' un fallback per righe senza quota, non la fonte di
 * verita'. La colonna e' NOT NULL, quindi comanda il database: va tenuto
 * allineato al DEFAULT della migrazione `..._quota_launch.sql`.
 */
export const DEFAULT_FREE_QUOTA = 20;

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  total: number;
  limit: number;
  isPremium: boolean;
  networkError?: boolean;
  /**
   * true quando il conteggio viene dal contatore locale di riserva invece che
   * da Supabase, perche' non esiste un'organizzazione a cui attribuirlo.
   */
  localOnly?: boolean;
}

interface CachedQuota {
  result: QuotaCheckResult;
  cachedAt: number;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * @param ignoreTtl accetta anche una lettura scaduta. Serve solo al fallback di
 *        rete: un contatore vecchio e' comunque un dato reale, e mostrarlo e'
 *        meglio che inventarne uno.
 */
async function readQuotaCache(
  orgId: string,
  { ignoreTtl = false }: { ignoreTtl?: boolean } = {}
): Promise<QuotaCheckResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`${QUOTA_CACHE_KEY}_${orgId}`);
    if (!raw) return null;
    const cached: CachedQuota = JSON.parse(raw);
    if (!ignoreTtl && Date.now() - cached.cachedAt > QUOTA_CACHE_TTL_MS) return null;
    return cached.result;
  } catch {
    return null;
  }
}

async function writeQuotaCache(orgId: string, result: QuotaCheckResult): Promise<void> {
  try {
    const cached: CachedQuota = { result, cachedAt: Date.now() };
    await AsyncStorage.setItem(`${QUOTA_CACHE_KEY}_${orgId}`, JSON.stringify(cached));
  } catch {
    // Cache write failure is non-blocking
  }
}

async function invalidateQuotaCache(orgId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${QUOTA_CACHE_KEY}_${orgId}`);
  } catch {
    // Non-blocking
  }
}

// ─── Contatore di riserva ──────────────────────────────────────────────────────

async function readLocalCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_COUNT_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function bumpLocalCount(): Promise<void> {
  try {
    const next = (await readLocalCount()) + 1;
    await AsyncStorage.setItem(LOCAL_COUNT_KEY, String(next));
  } catch {
    // Non-blocking: il file esiste comunque, un conteggio perso non lo annulla.
  }
}

/**
 * Stato premium secondo RevenueCat, con fallback pessimistico.
 *
 * Estratto da `checkQuota` perche' serve identico anche al ramo senza
 * organizzazione: un abbonato Pro non deve incontrare il muro solo perche' la
 * sua riga `organizations` non e' mai stata creata.
 */
async function isPremiumNow(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active['pro'];
  } catch {
    // RevenueCat non raggiungibile — pessimistic fallback: non bypass quota.
    // L'utente premium con rete assente vedrà il gate quota, ma non verrà bloccato
    // se ha ancora quota residua. Caso raro; accettabile per MVP.
    return false;
  }
}

// ─── Funzioni pubbliche ────────────────────────────────────────────────────────

/**
 * Verifica se l'utente può generare un documento.
 *
 * Se premium (RevenueCat) → sempre allowed: true.
 * Se free → legge il contatore da Supabase (con cache TTL 5 min).
 * Se errore di rete → usa la cache locale; se assente → allowed: true, perché
 * la generazione di un file è locale e non deve dipendere dalla connessione.
 */
export async function checkQuota(orgId: string): Promise<QuotaCheckResult> {
  // 1. Se abbonato Pro (entitlement 'pro' da RevenueCat), bypass totale del contatore.
  //    Fonte di verità: customerInfo.entitlements.active['pro'] — stessa chiave di
  //    ProUpgrade.tsx:155 e PlanContext.tsx:199. NON usare checkEntitlement() con
  //    product ID one-time (vela.template.premium) come proxy — causa P0 Fase A.
  if (await isPremiumNow()) {
    return {
      allowed: true,
      remaining: Infinity,
      total: 0,
      limit: Infinity,
      isPremium: true,
    };
  }

  // 2. Leggi dalla cache se disponibile
  const cached = await readQuotaCache(orgId);
  if (cached) return cached;

  // 3. Fetch da Supabase
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('documents_generated_total, quota_limit, documents_reward_credits')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'No data');
    }

    const total = data.documents_generated_total ?? 0;
    const limit = data.quota_limit ?? DEFAULT_FREE_QUOTA;
    const credits = data.documents_reward_credits ?? 0;
    const effectiveLimit = limit + credits;
    const remaining = Math.max(0, effectiveLimit - total);
    const allowed = total < effectiveLimit;

    const result: QuotaCheckResult = { allowed, remaining, total, limit: effectiveLimit, isPremium: false };
    await writeQuotaCache(orgId, result);
    return result;

  } catch {
    // Errore di rete — si concede la generazione.
    //
    // Il fallback era pessimistico (`allowed: false`) e questo rendeva l'app
    // inutilizzabile senza connessione: ma generare un PDF, un XLSX o un RTF e'
    // un'operazione interamente locale, che non ha bisogno di Supabase per
    // riuscire. Bloccarla significava punire l'utente in aereo o in
    // metropolitana per un guasto che non e' suo, proprio nel momento in cui un
    // generatore di file offline vale di piu'.
    //
    // Il contatore non si perde: `networkError` dice al chiamante che questo
    // esito non e' stato confermato dal server, e il conteggio si riallinea al
    // primo `checkQuota` che riesce.
    //
    // Si', restando offline si aggira il muro. E' una scelta consapevole:
    // rendere l'app inutilizzabile a tutti gli onesti per fermare chi mette il
    // telefono in modalita' aereo e' un pessimo affare.
    //
    // I contatori pero' non si inventano. Restituire `total: 0` e
    // `remaining: <quota piena>` avrebbe fatto scrivere a schermo "hai 20
    // documenti rimasti" a chi ne ha zero, e nessun chiamante puo' distinguere
    // un numero finto da uno vero se non guardando `networkError`. Si rilegge
    // quindi l'ultima lettura riuscita **ignorando il TTL**: e' vecchia, ma e'
    // un dato reale. Solo se non c'e' mai stata si ricade sulla quota piena,
    // che per un utente al primo avvio offline e' anche corretta.
    const stale = await readQuotaCache(orgId, { ignoreTtl: true });
    if (stale) {
      return { ...stale, allowed: true, isPremium: false, networkError: true };
    }
    return {
      allowed: true,
      remaining: DEFAULT_FREE_QUOTA,
      total: 0,
      limit: DEFAULT_FREE_QUOTA,
      isPremium: false,
      networkError: true,
    };
  }
}

/**
 * Incrementa il contatore quota su Supabase via RPC atomica.
 * Da chiamare DOPO che il documento è stato generato con successo.
 * Invalida la cache locale immediatamente.
 *
 * @throws se la quota è esaurita o se la RPC fallisce
 */
export async function incrementQuota(orgId: string): Promise<void> {
  // Invalida la cache prima della chiamata RPC
  await invalidateQuotaCache(orgId);

  const { data: newTotal, error } = await supabase
    .rpc('increment_document_quota', { org_id: orgId });

  if (error) {
    throw new Error(`Quota increment failed: ${error.message}`);
  }

  if (newTotal === null) {
    // La RPC ritorna NULL quando la quota è esaurita (UPDATE non ha trovato righe)
    throw new Error('Quota exhausted');
  }
}

/**
 * Come `checkQuota`, ma accetta anche l'assenza di un'organizzazione.
 *
 * Perche' esiste
 * ──────────────
 * Le schermate ricavano `orgId` da una `select` su `organizations`. Se quella
 * riga non c'e', `orgId` resta `null` — e il codice che chiamava direttamente
 * `checkQuota(orgId)` doveva saltare l'intero blocco, saltando **sia il muro
 * sia il conteggio**. Chi si trovava in quello stato generava documenti
 * all'infinito, gratis, senza comparire in nessun contatore.
 *
 * Non e' uno stato teorico: `handle_new_user()`, la funzione che dovrebbe
 * creare quella riga, e' citata in `20260801000001_rls_organizations.sql` ma
 * non e' definita in nessuna migrazione del repository, e le policy RLS non
 * danno `INSERT` ad `authenticated` — quindi un utente in quello stato non puo'
 * nemmeno crearsi l'organizzazione da solo.
 *
 * Il rimedio non tocca il database: si conta in locale. E' aggirabile
 * reinstallando l'app, ma il confronto giusto non e' con un contatore
 * inviolabile — e' con nessun contatore affatto, che e' la situazione di prima.
 */
export async function checkQuotaOrLocal(orgId: string | null): Promise<QuotaCheckResult> {
  if (orgId) return checkQuota(orgId);

  if (await isPremiumNow()) {
    return { allowed: true, remaining: Infinity, total: 0, limit: Infinity, isPremium: true };
  }

  const total = await readLocalCount();
  return {
    allowed: total < DEFAULT_FREE_QUOTA,
    remaining: Math.max(0, DEFAULT_FREE_QUOTA - total),
    total,
    limit: DEFAULT_FREE_QUOTA,
    isPremium: false,
    localOnly: true,
  };
}

/**
 * Registra un documento generato, sul canale giusto: Supabase se
 * l'organizzazione esiste, contatore locale altrimenti.
 *
 * Non solleva mai: il file e' gia' stato prodotto quando questa viene chiamata,
 * e un errore di conteggio non lo annulla. I chiamanti non devono avvolgerla in
 * un `try` per ricordarselo.
 */
export async function countGeneratedDocument(orgId: string | null): Promise<void> {
  try {
    if (orgId) {
      await incrementQuota(orgId);
    } else {
      await bumpLocalCount();
    }
  } catch (err) {
    console.warn('[quota-engine] conteggio non riuscito', err);
  }
}

/**
 * Restituisce il numero di documenti rimanenti nel piano gratuito.
 * Usa la stessa logica di checkQuota (con cache).
 */
export async function getRemainingQuota(orgId: string): Promise<number> {
  const result = await checkQuota(orgId);
  if (result.isPremium) return Infinity;
  return result.remaining;
}
