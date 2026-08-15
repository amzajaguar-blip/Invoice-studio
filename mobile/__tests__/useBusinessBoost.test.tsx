/**
 * useBusinessBoost.test.tsx — il bottone "Guarda video" deve reagire al tap.
 *
 * Due difetti distinti rendevano i comandi del Business Boost inerti, e
 * nessuno dei due produceva un errore visibile: il tap semplicemente non
 * faceva niente.
 *
 *   1. `showAd` pretendeva `user_metadata.org_id` e usciva in silenzio se
 *      mancava — cosa normale, perche' nessun trigger scrive quel campo — pur
 *      passandolo a una funzione che non lo leggeva mai.
 *
 *   2. il bottone "Riprova" dello stato di errore chiamava `showAd`, che esce
 *      subito se lo stato non e' 'ready'. In stato 'error' non lo e' per
 *      definizione, quindi "Riprova" non poteva ricaricare niente.
 *
 * I test coprono entrambi: l'annuncio parte senza org_id nei metadata, e il
 * retry fa ripartire davvero il preload.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock della catena annunci ───────────────────────────────────────────────

const mockPreload = jest.fn();
const mockShow = jest.fn();

jest.mock('@/lib/business-boost', () => ({
  __esModule: true,
  preloadBoostAd: (...args: unknown[]) => mockPreload(...args),
  showBoostAd: (...args: unknown[]) => mockShow(...args),
  writeSuggestionCooldown: jest.fn().mockResolvedValue(undefined),
  formatTimeRemaining: () => null,
}));

// Piano free con tutti e 3 i video giornalieri ancora disponibili: senza
// questo il preload non parte nemmeno (daily cap).
jest.mock('@/context/PlanContext', () => ({
  usePlan: () => ({
    limits: {
      dailyAdsMax: 3,
      dailyAdsWatched: 0,
      boostActive: false,
      boostExpiresAt: null,
    },
  }),
}));

jest.mock('@/components/LocaleProvider', () => ({
  useLocale: () => ({ t: (k: string) => k }),
}));

import { useBusinessBoost } from '@/hooks/useBusinessBoost';

describe('useBusinessBoost', () => {
  beforeEach(() => {
    mockPreload.mockReset();
    mockShow.mockReset();
    mockShow.mockResolvedValue(undefined);
  });

  /** Preload che riesce: invoca subito `onReady`. */
  const preloadSucceeds = () => {
    mockPreload.mockImplementation((opts: { onReady: (a: unknown) => void }) => {
      opts.onReady({ id: 'ad' });
      return () => {};
    });
  };

  /** Preload che fallisce: invoca `onError`. */
  const preloadFails = () => {
    mockPreload.mockImplementation((opts: { onError: (m: string) => void }) => {
      opts.onError('boost_unavailable_video_hint');
      return () => {};
    });
  };

  it('mostra l\'annuncio anche senza org_id nei user_metadata', async () => {
    preloadSucceeds();

    const { result } = renderHook(() => useBusinessBoost());
    await waitFor(() => expect(result.current.boostSession.state).toBe('ready'));

    act(() => {
      result.current.boostSession.showAd();
    });

    // Il tap deve arrivare fino all'SDK: e' esattamente cio' che la vecchia
    // guardia su org_id impediva.
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('non passa piu\' orgId a showBoostAd', async () => {
    preloadSucceeds();

    const { result } = renderHook(() => useBusinessBoost());
    await waitFor(() => expect(result.current.boostSession.state).toBe('ready'));

    act(() => {
      result.current.boostSession.showAd();
    });

    expect(mockShow.mock.calls[0][0]).not.toHaveProperty('orgId');
  });

  it('retryAd fa ripartire il preload dopo un errore', async () => {
    preloadFails();

    const { result } = renderHook(() => useBusinessBoost());
    await waitFor(() => expect(result.current.boostSession.state).toBe('error'));
    expect(mockPreload).toHaveBeenCalledTimes(1);

    // Al retry l'annuncio e' di nuovo disponibile.
    preloadSucceeds();
    act(() => {
      result.current.boostSession.retryAd();
    });

    await waitFor(() => expect(result.current.boostSession.state).toBe('ready'));
    expect(mockPreload).toHaveBeenCalledTimes(2);
  });

  it('chiudere il video a meta\' non lascia il modale bloccato', async () => {
    preloadSucceeds();

    // showBoostAd che simula l'utente che chiude il video prima del reward:
    // nessun onBoostApplied, nessun onBoostError — solo onDismissed. Senza
    // quest'ultimo lo stato restava 'showing' per sempre, e il bottone
    // "Guarda video" — disabilitato proprio quando isShowing — diventava un
    // vicolo cieco fino allo smontaggio della schermata.
    mockShow.mockImplementation(
      async (opts: { onShowing?: () => void; onDismissed?: () => void }) => {
        opts.onShowing?.();
        opts.onDismissed?.();
      },
    );

    const { result } = renderHook(() => useBusinessBoost());
    await waitFor(() => expect(result.current.boostSession.state).toBe('ready'));

    await act(async () => {
      result.current.boostSession.showAd();
    });

    // Si torna a uno stato da cui l'utente puo' riprovare, non a 'showing'.
    await waitFor(() => expect(result.current.boostSession.state).not.toBe('showing'));
    // E il prossimo annuncio viene ricaricato da solo.
    await waitFor(() => expect(mockPreload).toHaveBeenCalledTimes(2));
  });

  it('showAd resta inerte se l\'annuncio non e\' pronto', async () => {
    preloadFails();

    const { result } = renderHook(() => useBusinessBoost());
    await waitFor(() => expect(result.current.boostSession.state).toBe('error'));

    act(() => {
      result.current.boostSession.showAd();
    });

    // Nessun annuncio caricato: non c'e' niente da mostrare. E' il motivo per
    // cui "Riprova" deve chiamare retryAd e non showAd.
    expect(mockShow).not.toHaveBeenCalled();
  });
});
