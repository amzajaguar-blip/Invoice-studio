-- Quota gratuita di lancio: da 5 a 20 documenti a vita.
--
-- PERCHE'
-- La quota era 5 documenti lifetime (20250800000005_quota_engine.sql), un
-- numero scelto quando il paywall aveva due uscite funzionanti. Oggi ne ha una
-- sola: l'acquisto Pro funziona, ma il video premio non riceve annunci finche'
-- l'account AdMob non e' approvato da Google. Chi generava cinque file trovava
-- quindi un muro senza alternativa gratuita, prima ancora di aver capito se il
-- prodotto valesse un abbonamento — e disinstallava invece di comprare.
--
-- 20 lascia spazio per provare Milo Office su lavoro vero e arrivare al paywall
-- con un'opinione formata. Il muro resta, perche' e' l'acquisto Pro a doverlo
-- superare; il video premio tornera' a essere l'alternativa gratuita quando
-- AdMob approvera' l'account, senza bisogno di toccare il codice.
--
-- NB: la colonna e' NOT NULL DEFAULT, quindi il default di TypeScript
-- (DEFAULT_FREE_QUOTA in mobile/lib/quota-engine.ts) non viene mai raggiunto:
-- comanda il database. I due valori vanno tenuti allineati a mano.

ALTER TABLE organizations ALTER COLUMN quota_limit SET DEFAULT 20;

-- Le organizzazioni gia' esistenti hanno 5 scritto in tabella e il nuovo
-- DEFAULT non le tocca: senza questo UPDATE il muro resterebbe esattamente
-- dov'era per tutti gli utenti attuali.
--
-- La condizione limita l'aggiornamento a chi ha ancora il valore di default
-- originale: un'organizzazione a cui fosse stata assegnata una quota su misura
-- (piu' alta o piu' bassa) non deve vedersela sovrascritta da una migrazione.
UPDATE organizations SET quota_limit = 20 WHERE quota_limit = 5;
