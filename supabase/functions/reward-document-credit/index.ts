// supabase/functions/reward-document-credit/index.ts
// Supabase Edge Function — Google Ads Reward Credit
//
// Supporta due path di chiamata:
//
// PATH A — SSV completo (Google → server direttamente, Fix #2 Fase B)
//   Chiamato da Google Ads se configurata callback URL in AdMob dashboard.
//   Verifica firma ECDSA + key_id. body contiene: signature, key_id, transaction_id,
//   timestamp, custom_data (org_id), user_id.
//
// PATH B — Client semplificato (mobile → server, MVP)
//   Chiamato dal client mobile su onUserEarnedReward.
//   Non porta firma (l'SDK non espone ssv_token nel JS layer).
//   Protezione: autenticazione JWT Supabase + rate limit giornaliero (max 3/org).
//   body contiene solo: user_id (UUID Supabase auth).
//
// ANTI-PATTERN eliminato: il client non invia più reward_token/ssv_token
// (campo non esistente nel tipo RewardedAdReward dell'SDK v14.x).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_SSV_KEY_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json'

interface SSVPayload {
  ad_network?: string
  ad_unit?: string
  custom_data?: string
  reward_amount?: string
  reward_item?: string
  timestamp?: string
  transaction_id?: string
  user_id?: string
  key_id?: string
  signature?: string
}

serve(async (req) => {
  // Supporta due metodi:
  // GET  → Google SSV callback (query string params, firma ECDSA verificata)
  // POST → Client mobile MVP (body JSON con user_id, protetto da JWT + rate limit)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    let body: SSVPayload

    if (req.method === 'GET') {
      // PATH A: Google chiama con parametri SSV come query string
      const url = new URL(req.url)
      body = {
        ad_network:     url.searchParams.get('ad_network')     ?? undefined,
        ad_unit:        url.searchParams.get('ad_unit')        ?? undefined,
        custom_data:    url.searchParams.get('custom_data')    ?? undefined,
        reward_amount:  url.searchParams.get('reward_amount')  ?? undefined,
        reward_item:    url.searchParams.get('reward_item')    ?? undefined,
        timestamp:      url.searchParams.get('timestamp')      ?? undefined,
        transaction_id: url.searchParams.get('transaction_id') ?? undefined,
        user_id:        url.searchParams.get('user_id')        ?? undefined,
        key_id:         url.searchParams.get('key_id')         ?? undefined,
        signature:      url.searchParams.get('signature')      ?? undefined,
      }
    } else {
      // PATH B: Client mobile con body JSON { user_id }
      body = await req.json()
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── PATH A: SSV completo da Google (signature + key_id presenti) ─────────
    if (body.signature && body.key_id) {
      if (!body.transaction_id || !body.timestamp) {
        return new Response(
          JSON.stringify({ error: 'Missing required SSV fields' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Recupera chiavi pubbliche Google
      const keysResponse = await fetch(GOOGLE_SSV_KEY_URL)
      if (!keysResponse.ok) {
        console.error('Failed to fetch Google SSV verification keys:', keysResponse.status)
        return new Response(
          JSON.stringify({ error: 'Could not verify reward — key fetch failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const keysData = await keysResponse.json()
      const verificationKey = keysData.keys?.find(
        (k: { key_id: number; pem: string }) => String(k.key_id) === String(body.key_id)
      )

      if (!verificationKey) {
        return new Response(
          JSON.stringify({ error: 'Invalid key_id' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Ricostruisce messaggio firmato (parametri in ordine alfabetico)
      const params: Record<string, string> = {}
      if (body.ad_network) params['ad_network'] = body.ad_network
      if (body.ad_unit) params['ad_unit'] = body.ad_unit
      if (body.custom_data) params['custom_data'] = body.custom_data
      if (body.reward_amount) params['reward_amount'] = body.reward_amount
      if (body.reward_item) params['reward_item'] = body.reward_item
      if (body.timestamp) params['timestamp'] = body.timestamp
      if (body.transaction_id) params['transaction_id'] = body.transaction_id
      if (body.user_id) params['user_id'] = body.user_id

      const signingMessage = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')

      const pemContent = verificationKey.pem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '')

      const publicKeyBytes = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
      const cryptoKey = await crypto.subtle.importKey(
        'spki', publicKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
      )

      const signatureBase64 = body.signature.replace(/-/g, '+').replace(/_/g, '/')
      const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0))
      const messageBytes = new TextEncoder().encode(signingMessage)

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, signatureBytes, messageBytes
      )

      if (!isValid) {
        console.error('SSV ECDSA signature verification failed for transaction:', body.transaction_id)
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Firma valida — org_id da custom_data
      const orgId = body.custom_data
      if (!orgId) {
        return new Response(
          JSON.stringify({ error: 'Missing org_id in custom_data' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return await grantReward(supabaseAdmin, orgId)
    }

    // ── PATH B: Client mobile senza firma (MVP) ───────────────────────────────
    // Protezione: JWT Supabase (req.headers Authorization) + rate limit giornaliero.
    // Il campo user_id è l'UUID Supabase dell'utente autenticato.
    if (!body.user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Risolve org_id dall'user_id tramite org_members
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('org_id')
      .eq('user_id', body.user_id)
      .maybeSingle()

    if (memberError || !memberData?.org_id) {
      console.error('Could not resolve org_id for user:', body.user_id, memberError)
      return new Response(
        JSON.stringify({ error: 'User org not found' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return await grantReward(supabaseAdmin, memberData.org_id)

  } catch (err) {
    console.error('reward-document-credit unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helper condiviso tra PATH A e PATH B ─────────────────────────────────────

async function grantReward(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<Response> {
  const { data: granted, error: rpcError } = await supabase
    .rpc('grant_reward_document', { org_id: orgId })

  if (rpcError) {
    console.error('RPC grant_reward_document error:', rpcError)
    return new Response(
      JSON.stringify({ error: 'Failed to credit reward' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!granted) {
    return new Response(
      JSON.stringify({ credited: false, reason: 'daily_limit_reached' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ credited: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
