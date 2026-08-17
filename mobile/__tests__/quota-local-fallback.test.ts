/**
 * Il muro dei documenti regge anche senza organizzazione.
 *
 * Perche' questo test esiste
 * ──────────────────────────
 * `generate.tsx` ricavava `orgId` da una `select` su `organizations` e
 * condizionava a `orgId && ...` sia il gate quota sia il conteggio. Se quella
 * riga non esisteva — e `handle_new_user()`, la funzione che dovrebbe crearla,
 * e' citata in `20260801000001_rls_organizations.sql` ma non e' definita in
 * nessuna migrazione del repository — l'utente generava documenti all'infinito,
 * gratis, senza comparire in nessun contatore.
 *
 * `checkQuotaOrLocal(null)` + `countGeneratedDocument(null)` chiudono il caso
 * con un contatore su AsyncStorage. Qui si verifica il confine: le prime
 * DEFAULT_FREE_QUOTA generazioni passano, la successiva no.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkQuotaOrLocal,
  countGeneratedDocument,
  DEFAULT_FREE_QUOTA,
} from '../lib/quota-engine';

// AsyncStorage con stato reale: il contatore locale e' esattamente la cosa
// sotto test, quindi un mock che risponde sempre null non proverebbe nulla.
const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiSet: jest.fn(),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('no org') }) }) }) }),
    rpc: async () => ({ data: null, error: new Error('no org') }),
  },
}));

beforeEach(() => {
  store.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => store.get(k) ?? null
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
    store.set(k, v);
  });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => {
    store.delete(k);
  });
});

describe('quota senza organizzazione', () => {
  it(`concede le prime ${DEFAULT_FREE_QUOTA} generazioni e blocca la successiva`, async () => {
    for (let i = 0; i < DEFAULT_FREE_QUOTA; i++) {
      const quota = await checkQuotaOrLocal(null);
      expect(quota.allowed).toBe(true);
      expect(quota.localOnly).toBe(true);
      expect(quota.remaining).toBe(DEFAULT_FREE_QUOTA - i);
      await countGeneratedDocument(null);
    }

    const oltre = await checkQuotaOrLocal(null);
    expect(oltre.allowed).toBe(false);
    expect(oltre.remaining).toBe(0);
    expect(oltre.total).toBe(DEFAULT_FREE_QUOTA);
  });

  it("non conta piu' del dovuto: una generazione, un incremento", async () => {
    await countGeneratedDocument(null);
    await countGeneratedDocument(null);
    const quota = await checkQuotaOrLocal(null);
    expect(quota.total).toBe(2);
    expect(quota.remaining).toBe(DEFAULT_FREE_QUOTA - 2);
  });

  it('un abbonato Pro non incontra il muro nemmeno senza organizzazione', async () => {
    // Chi paga non deve essere punito perche' la sua riga organizations non
    // e' mai stata creata: e' proprio il caso in cui il danno sarebbe peggiore.
    const Purchases = require('react-native-purchases').default;
    Purchases.getCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: { pro: { identifier: 'pro' } } },
    });

    store.set('milo_local_doc_count_v1', String(DEFAULT_FREE_QUOTA + 5));
    const quota = await checkQuotaOrLocal(null);
    expect(quota.allowed).toBe(true);
    expect(quota.isPremium).toBe(true);
  });

  it('un contatore corrotto non blocca l\'utente', async () => {
    // Un valore illeggibile in AsyncStorage non deve tradursi in NaN, che
    // renderebbe `total < DEFAULT_FREE_QUOTA` falso e murerebbe tutti.
    store.set('milo_local_doc_count_v1', 'non-un-numero');
    const quota = await checkQuotaOrLocal(null);
    expect(quota.allowed).toBe(true);
    expect(quota.total).toBe(0);
  });
});
