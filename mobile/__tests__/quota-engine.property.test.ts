/**
 * Property test P10 — Quota_Engine: contatore non supera soglia
 * Feature: vela-pivot-prodotto, Property 10: quota enforcement
 * Requirements: 20.3, 20.6
 */
import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getCustomerInfo: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
  },
}));

jest.mock('../lib/iap-engine', () => ({
  checkEntitlement: jest.fn().mockResolvedValue(false),
}));

describe('P10: Quota_Engine — contatore non supera soglia', () => {
  it('le prime N chiamate a checkQuota restituiscono allowed: true, la (N+1)-esima false', async () => {
    // Feature: vela-pivot-prodotto, Property 10: quota boundary
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (limit) => {
          // Simula un contatore in memoria per l'org
          let generatedTotal = 0;
          const orgId = `test-org-${Math.random().toString(36).slice(2)}`;

          // Mock supabase per questa org
          jest.doMock('../lib/supabase', () => ({
            supabase: {
              from: () => ({
                select: () => ({
                  eq: () => ({
                    single: jest.fn().mockImplementation(async () => ({
                      data: {
                        documents_generated_total: generatedTotal,
                        quota_limit: limit,
                        documents_reward_credits: 0,
                      },
                      error: null,
                    })),
                  }),
                }),
              }),
              rpc: jest.fn().mockImplementation(async (_fn: string, _args: any) => {
                if (generatedTotal < limit) {
                  generatedTotal += 1;
                  return { data: generatedTotal, error: null };
                }
                return { data: null, error: null }; // quota esaurita
              }),
            },
          }));

          jest.resetModules();
          // require (non import dinamico): dopo resetModules riesegue il modulo
          // con il doMock di questa iterazione, senza --experimental-vm-modules.
          const { checkQuota, incrementQuota } = require('../lib/quota-engine');

          // Le prime `limit` generazioni devono essere allowed
          for (let i = 0; i < limit; i++) {
            // Invalida cache tra ogni chiamata
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
            const result = await checkQuota(orgId);
            expect(result.allowed).toBe(true);
            await incrementQuota(orgId);
          }

          // La (limit+1)-esima deve essere not allowed
          (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
          const finalResult = await checkQuota(orgId);
          expect(finalResult.allowed).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});
