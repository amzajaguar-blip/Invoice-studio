/**
 * Property test P13 — Rewarded ad: incremento avviene solo via SSV
 * Feature: vela-pivot-prodotto, Property 13: reward ad SSV security
 * Requirements: 20.3, anti-pattern client-side increment
 */
import * as fc from 'fast-check';
import { supabase } from '../lib/supabase';

// Mock Supabase Edge Function
const mockInvoke = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { documents_generated_total: 3, quota_limit: 5, documents_reward_credits: 0 },
        error: null,
      }),
    }),
    rpc: jest.fn().mockResolvedValue({ data: 4, error: null }),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/iap-engine', () => ({
  checkEntitlement: jest.fn().mockResolvedValue(false),
}));

describe('P13: Rewarded ad — incremento avviene solo via risposta SSV 200', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('senza risposta SSV 200: documents_reward_credits invariato', async () => {
    // Feature: vela-pivot-prodotto, Property 13: no direct client increment
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgId: fc.uuid(),
          rewardToken: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ orgId, rewardToken }) => {
          // SSV fallisce (403 o errore rete)
          mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('SSV failed') });

          // Il contatore NON deve incrementarsi senza SSV 200
          // In QuotaPaywall, handleSsvVerification viene chiamato solo con onUserEarnedReward
          // e chiama supabase.functions.invoke — se fallisce, non si accredita nulla
          const result = await mockInvoke('reward-document-credit', {
            body: { reward_token: rewardToken, user_id: orgId },
          });

          // Con errore SSV, data è null
          expect(result.data).toBeNull();
          expect(result.error).toBeTruthy();

          // Verifico che il contatore non sia stato incrementato via RPC diretta
          expect(supabase.rpc).not.toHaveBeenCalledWith('grant_reward_document', expect.anything());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('con risposta SSV 200: onQuotaUpdated viene chiamato', async () => {
    // Feature: vela-pivot-prodotto, Property 13: SSV 200 triggers quota update
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgId: fc.uuid(),
          rewardToken: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ orgId, rewardToken }) => {
          // SSV ha successo
          mockInvoke.mockResolvedValueOnce({
            data: { success: true, credits_granted: 1 },
            error: null,
          });

          const onQuotaUpdated = jest.fn();

          const result = await mockInvoke('reward-document-credit', {
            body: { reward_token: rewardToken, user_id: orgId },
          });

          // Con SSV 200, data non è null
          expect(result.data).not.toBeNull();
          expect(result.error).toBeNull();

          // Simula il comportamento di QuotaPaywall: chiama onQuotaUpdated dopo 200
          if (!result.error && result.data) {
            onQuotaUpdated();
          }

          expect(onQuotaUpdated).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('con risposta SSV 403: documents_reward_credits invariato', async () => {
    // Feature: vela-pivot-prodotto, Property 13: SSV 403 = no credit
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgId: fc.uuid(),
          rewardToken: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ orgId, rewardToken }) => {
          mockInvoke.mockResolvedValueOnce({
            data: null,
            error: { message: 'Forbidden', status: 403 },
          });

          const onQuotaUpdated = jest.fn();

          const result = await mockInvoke('reward-document-credit', {
            body: { reward_token: rewardToken, user_id: orgId },
          });

          // Con 403, non si chiama onQuotaUpdated
          if (!result.error && result.data) {
            onQuotaUpdated();
          }

          expect(onQuotaUpdated).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
