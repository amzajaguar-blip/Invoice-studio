/**
 * auth-deep-link — helpers per estrarre token dal fragment di un deep link.
 *
 * Supabase invia il recovery link via email nel formato:
 *   vela://(auth)/reset-password#access_token=...&refresh_token=...&type=recovery
 *
 * Il client Supabase su mobile ha `detectSessionInUrl: false` (vedi
 * lib/supabase.ts) perché in React Native il `URL` global non esiste
 * e il client browser-style non gira. Estraiamo manualmente il fragment
 * per usarlo con `supabase.auth.setSession()`.
 */

export interface FragmentAuthParams {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  type?: string;
}

/**
 * Estrae i parametri di autenticazione Supabase dal fragment di un URL
 * (es. tutto ciò che sta dopo il carattere '#').
 *
 * Ritorna `null` se l'URL non contiene un fragment autenticativo
 * (es. normale deep link di routing), oppure un oggetto vuoto {} se
 * il fragment è presente ma privo di parametri utilizzabili.
 */
export function extractFragmentAuthParams(url: string): FragmentAuthParams | null {
  if (!url || typeof url !== "string") return null;

  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const fragment = url.substring(hashIndex + 1);
  if (!fragment) return {};

  try {
    const params = new URLSearchParams(fragment);
    const result: FragmentAuthParams = {};
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    const expires = params.get("expires_in");
    const tokenType = params.get("token_type");
    const type = params.get("type");

    if (access) result.access_token = access;
    if (refresh) result.refresh_token = refresh;
    if (expires) {
      const n = Number(expires);
      if (Number.isFinite(n)) result.expires_in = n;
    }
    if (tokenType) result.token_type = tokenType;
    if (type) result.type = type;

    return result;
  } catch {
    return null;
  }
}

/**
 * Verifica se i parametri estratti rappresentano un sessione di recovery
 * valida (cioè abbastanza per aprire la schermata di reset-password).
 */
export function isRecoverySession(
  params: FragmentAuthParams | null | undefined
): boolean {
  if (!params) return false;
  return Boolean(params.access_token && params.refresh_token);
}
