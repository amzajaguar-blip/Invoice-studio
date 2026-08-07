/**
 * iap-engine.ts — Modulo IAP per la gestione entitlement RevenueCat
 *
 * Completamente isolato da rate-limit-engine.ts e PlanContext.tsx.
 * Non importa mai nessuno dei due moduli né moduli che li re-esportano.
 *
 * VINCOLO CRITICO: ZERO import da rate-limit-engine.ts o PlanContext.tsx
 *
 * Requirements: 9.1, 9.3, 9.5, 9.6, 1.4
 */

import Purchases, { type PurchasesEntitlementInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

/**
 * Product_ID referenziati solo dopo creazione su Play Console/RevenueCat (Req 9.2).
 * Non deployare in produzione finché i prodotti non sono registrati su entrambe le piattaforme.
 */
export type IAPProductId =
  | 'vela.template.premium'
  | 'vela.logo.custom'
  | 'vela.export.excel'
  | 'vela.backup.cloud';

export interface EntitlementState {
  productId: IAPProductId;
  isActive: boolean;
  purchaseDate?: Date;
  cachedAt: number; // timestamp ms
}

export interface IAPEngineState {
  entitlements: Record<IAPProductId, EntitlementState>;
  isLoading: boolean;
  lastSyncAt: number | null;
  networkError: boolean;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const IAP_CACHE_KEY = 'vela_iap_entitlements_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Tutti gli IAP product ID gestiti dal modulo */
const ALL_PRODUCT_IDS: IAPProductId[] = [
  'vela.template.premium',
  'vela.logo.custom',
  'vela.export.excel',
  'vela.backup.cloud',
];

// ─── Helper interni ───────────────────────────────────────────────────────────

/**
 * Costruisce uno stato entitlement inattivo per un dato product ID.
 */
function buildInactiveEntitlement(productId: IAPProductId): EntitlementState {
  return {
    productId,
    isActive: false,
    cachedAt: Date.now(),
  };
}

/**
 * Costruisce un IAPEngineState con tutti gli entitlement inattivi.
 */
function buildAllInactiveState(networkError = false): IAPEngineState {
  const entitlements = {} as Record<IAPProductId, EntitlementState>;
  for (const id of ALL_PRODUCT_IDS) {
    entitlements[id] = buildInactiveEntitlement(id);
  }
  return {
    entitlements,
    isLoading: false,
    lastSyncAt: null,
    networkError,
  };
}

/**
 * Mappa le entitlements attive di RevenueCat CustomerInfo in IAPEngineState.
 * Usa il productId come chiave entitlement in RevenueCat.
 */
function mapCustomerInfoToState(
  activeEntitlements: Record<string, PurchasesEntitlementInfo>,
): IAPEngineState {
  const now = Date.now();
  const entitlements = {} as Record<IAPProductId, EntitlementState>;

  for (const id of ALL_PRODUCT_IDS) {
    const rcEntitlement = activeEntitlements[id];
    if (rcEntitlement) {
      entitlements[id] = {
        productId: id,
        isActive: true,
        purchaseDate: rcEntitlement.latestPurchaseDate
          ? new Date(rcEntitlement.latestPurchaseDate)
          : undefined,
        cachedAt: now,
      };
    } else {
      entitlements[id] = buildInactiveEntitlement(id);
    }
  }

  return {
    entitlements,
    isLoading: false,
    lastSyncAt: now,
    networkError: false,
  };
}

// ─── syncEntitlementsToCache ──────────────────────────────────────────────────

/**
 * Serializza e salva IAPEngineState in AsyncStorage sotto IAP_CACHE_KEY.
 */
export async function syncEntitlementsToCache(state: IAPEngineState): Promise<void> {
  try {
    // Serializza le Date in ISO string per poterle deserializzare correttamente
    const serializable = {
      ...state,
      entitlements: Object.fromEntries(
        Object.entries(state.entitlements).map(([key, val]) => [
          key,
          {
            ...val,
            purchaseDate: val.purchaseDate?.toISOString() ?? undefined,
          },
        ]),
      ),
    };
    await AsyncStorage.setItem(IAP_CACHE_KEY, JSON.stringify(serializable));
  } catch (err) {
    // Cache write failure non è fatale
    console.warn('[iap-engine] syncEntitlementsToCache failed:', err);
  }
}

// ─── readEntitlementsFromCache ────────────────────────────────────────────────

/**
 * Legge e deserializza IAPEngineState da AsyncStorage.
 * Ritorna null se assente o malformato.
 */
export async function readEntitlementsFromCache(): Promise<IAPEngineState | null> {
  try {
    const raw = await AsyncStorage.getItem(IAP_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as IAPEngineState & {
      entitlements: Record<
        IAPProductId,
        Omit<EntitlementState, 'purchaseDate'> & { purchaseDate?: string }
      >;
    };

    // Deserializza le Date dai campi ISO string
    const entitlements = {} as Record<IAPProductId, EntitlementState>;
    for (const id of ALL_PRODUCT_IDS) {
      const raw = parsed.entitlements?.[id];
      if (raw) {
        entitlements[id] = {
          ...raw,
          purchaseDate: raw.purchaseDate ? new Date(raw.purchaseDate) : undefined,
        };
      } else {
        entitlements[id] = buildInactiveEntitlement(id);
      }
    }

    return {
      ...parsed,
      entitlements,
    };
  } catch (err) {
    console.warn('[iap-engine] readEntitlementsFromCache failed:', err);
    return null;
  }
}

// ─── fetchEntitlements ────────────────────────────────────────────────────────

/**
 * Recupera lo stato entitlement da RevenueCat.
 * In caso di errore di rete, ritorna la cache locale (graceful degradation, Req 9.6).
 * Se cache assente → tutti entitlement inattivi + networkError: true.
 *
 * @param options.onNetworkError Callback opzionale chiamata in caso di errore di rete
 */
export async function fetchEntitlements(
  options?: { onNetworkError?: () => void },
): Promise<IAPEngineState> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const state = mapCustomerInfoToState(customerInfo.entitlements.active);
    // Aggiorna subito la cache con i dati freschi
    await syncEntitlementsToCache(state);
    return state;
  } catch (err) {
    // Errore di rete o RevenueCat non raggiungibile — graceful degradation
    console.warn('[iap-engine] fetchEntitlements failed, falling back to cache:', err);
    options?.onNetworkError?.();

    const cached = await readEntitlementsFromCache();
    if (cached) {
      // Cache presente: ritorna con networkError = true (info diagnostica)
      return { ...cached, networkError: true };
    }

    // Nessuna cache — pessimistic fallback: tutti inattivi
    return buildAllInactiveState(true);
  }
}

// ─── checkEntitlement ────────────────────────────────────────────────────────

/**
 * Verifica se un singolo entitlement è attivo.
 * Tenta prima RevenueCat; se non raggiungibile usa la cache locale.
 * Cache-first: non degrada a false se la cache recente mostra isActive: true.
 *
 * Requirements: 9.6
 */
export async function checkEntitlement(productId: IAPProductId): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return productId in customerInfo.entitlements.active;
  } catch {
    // RevenueCat non raggiungibile — legge dalla cache
    const cached = await readEntitlementsFromCache();
    if (cached) {
      return cached.entitlements[productId]?.isActive ?? false;
    }
    // Nessuna cache disponibile — pessimistic fallback
    return false;
  }
}

// ─── purchaseProduct ──────────────────────────────────────────────────────────

/**
 * Avvia il flusso di acquisto RevenueCat per un Product_ID.
 * Aggiorna immediatamente la cache locale dopo acquisto completato (Req 9.3).
 *
 * @throws Error se l'acquisto fallisce o viene cancellato dall'utente
 */
export async function purchaseProduct(productId: IAPProductId): Promise<EntitlementState> {
  // Recupera le offering per trovare il pacchetto corrispondente al productId
  const offerings = await Purchases.getOfferings();
  const allPackages = Object.values(offerings.all ?? {}).flatMap(
    (offering) => offering.availablePackages,
  );

  // Cerca il pacchetto che corrisponde al productId (corrispondenza esatta o startsWith)
  const pkg = allPackages.find(
    (p) =>
      p.product.identifier === productId ||
      p.product.identifier?.startsWith(productId),
  );

  let customerInfo: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>;

  if (pkg) {
    // Percorso preferenziale: acquisto tramite package
    const result = await Purchases.purchasePackage(pkg);
    customerInfo = result.customerInfo;
  } else {
    // Fallback: acquisto diretto tramite storeProduct
    // Nota: getProducts potrebbe non restituire nulla finché i prodotti non
    // sono registrati su Play Console (Req 9.2 — nessun deploy in produzione prima)
    const products = await Purchases.getProducts([productId]);
    if (products.length === 0) {
      throw new Error(
        `[iap-engine] Product not found on store: ${productId}. ` +
          'Ensure product is created on Play Console and RevenueCat before deployment (Req 9.2).',
      );
    }
    const result = await Purchases.purchaseStoreProduct(products[0]);
    customerInfo = result.customerInfo;
  }

  // Aggiorna immediatamente la cache locale (Req 9.3)
  const updatedState = mapCustomerInfoToState(customerInfo.entitlements.active);
  await syncEntitlementsToCache(updatedState);

  // Ritorna lo stato dell'entitlement acquistato
  return updatedState.entitlements[productId];
}

// ─── restorePurchases ─────────────────────────────────────────────────────────

/**
 * Ripristina gli acquisti esistenti (Req 9.5).
 * Aggiorna la cache con lo stato aggiornato da RevenueCat.
 */
export async function restorePurchases(): Promise<IAPEngineState> {
  const customerInfo = await Purchases.restorePurchases();
  const updatedState = mapCustomerInfoToState(customerInfo.entitlements.active);
  await syncEntitlementsToCache(updatedState);
  return updatedState;
}
