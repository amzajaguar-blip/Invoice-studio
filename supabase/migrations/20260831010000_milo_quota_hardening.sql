-- Migration: 20260831010000_milo_quota_hardening.sql
--
-- PERCHE'
-- Due falle nella quota documenti di Milo Office (mobile/lib/quota-engine.ts),
-- trovate verificando che "i vantaggi premium funzionino per davvero":
--
-- 1. `organizations` non ha alcun campo che rifletta lato server lo stato Pro
--    verificato da RevenueCat sul device. Le rotte /api/ocr/receipt e
--    /api/convert/pdf-extract (le uniche due che costano compute reale al
--    backend: Tesseract OCR e parsing pdf.js) non possono quindi sapere se
--    l'org e' Pro senza violare il vincolo esplicito in testa a
--    quota-engine.ts: "NON modifica organizations.plan, user_plan.plan".
--    Quel campo serve al sito web legacy (non in uso come prodotto) e non e'
--    collegato allo stato Pro reale di Milo. Aggiungiamo due colonne
--    dedicate, scritte SOLO dal webhook RevenueCat esistente.
--
-- 2. increment_document_quota(org_id) e' SECURITY DEFINER e non verifica che
--    org_id appartenga a chi chiama: qualunque utente autenticato puo'
--    chiamarla passando l'id di un'ALTRA organizzazione e consumarne la
--    quota gratuita. Stesso rischio gia' corretto per grant_reward_document
--    in 20260814000000_harden_reward_rpcs.sql, ma li' con REVOKE totale
--    (quella RPC va chiamata solo da un Edge Function). Qui la funzione deve
--    restare chiamabile da qualunque utente autenticato per la PROPRIA org
--    (il client mobile la chiama direttamente dopo ogni generazione), quindi
--    il fix e' un controllo interno invece di un REVOKE.

-- ─── 1. Stato Pro di Milo, dedicato e separato da organizations.plan ────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS milo_pro_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS milo_pro_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.milo_pro_active IS
  'Stato Pro di Milo Office secondo RevenueCat (scritto dal webhook), letto SOLO server-side come backstop di quota per OCR/PDF-extract. Il client mobile continua a fidarsi esclusivamente di RevenueCat on-device (quota-engine.ts) per la UI — questo campo non e'' la fonte di verita' per il client, e non va MAI confuso con organizations.plan.';

-- Bootstrap una tantum: senza questo, ogni org gia' Pro oggi (plan='pro',
-- scritto dagli stessi eventi RevenueCat che ora alimentano anche
-- milo_pro_active) parte con milo_pro_active=false per via del DEFAULT, e il
-- nuovo gate in /api/ocr/receipt e /api/convert/pdf-extract la tratterebbe
-- da free finche' non arriva il prossimo evento webhook — che per un piano
-- annuale puo' non arrivare per mesi. NON e' un precedente per usare plan
-- come fonte di verita' in futuro: e' solo la fotografia di partenza piu'
-- vicina alla realta' che abbiamo, presa una volta sola qui.
UPDATE public.organizations SET milo_pro_active = true WHERE plan = 'pro';

-- ─── 2. Blocca il consumo cross-org della quota gratuita ────────────────────
CREATE OR REPLACE FUNCTION public.increment_document_quota(org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_total INTEGER;
BEGIN
  UPDATE public.organizations
  SET documents_generated_total = documents_generated_total + 1
  WHERE id = org_id
    AND id = public.current_org_id()
    AND documents_generated_total < (quota_limit + documents_reward_credits)
  RETURNING documents_generated_total INTO new_total;
  RETURN new_total; -- NULL se quota esaurita, org non trovata, o org_id non e' quella del chiamante
END;
$$;
