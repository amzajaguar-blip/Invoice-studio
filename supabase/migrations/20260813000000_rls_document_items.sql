-- ─────────────────────────────────────────────────────────────────────────────
-- RLS su document_items
--
-- Il problema
-- ───────────
-- `document_items` aveva Row Level Security DISATTIVATA e zero policy, mentre
-- la tabella padre `documents` era protetta da `documents_org_owner`. La chiave
-- anon di Supabase e' incorporata nell'APK e chiunque puo' estrarla: fino a
-- questa migrazione, con quella sola chiave era possibile leggere e modificare
-- le righe di dettaglio di ogni documento di ogni utente. Il padre chiuso e il
-- figlio aperto lasciavano comunque passare i dati.
--
-- La forma della policy
-- ─────────────────────
-- Rispecchia esattamente il predicato di `documents_org_owner`, risolto
-- attraverso il documento a cui la riga appartiene: una riga e' visibile e
-- scrivibile se il suo documento appartiene all'organizzazione di cui l'utente
-- autenticato risulta `owner` in `org_members`.
--
-- E' la stessa fonte che usa il percorso di scrittura dell'app: la route
-- POST /api/documents risolve `org_id` da `org_members` (frontend/src/lib/
-- supabase/auth-helper.ts) e lo scrive su `documents`. Percorso di scrittura e
-- policy leggono quindi lo stesso dato, e non possono divergere.
--
-- Il ruolo `anon` resta escluso senza bisogno di una clausola dedicata: senza
-- JWT `auth.uid()` e' NULL, la sottoquery non restituisce alcuna org e il
-- confronto non e' mai vero.
--
-- Verifica eseguita in transazione poi annullata, su questo database:
--   insert come proprietario ......... PERMESSO
--   righe viste dal proprietario ..... 1
--   righe viste da un altro utente ... 0
--   righe viste con la chiave anon ... 0
--
-- Nota sui dati preesistenti: i 34 documenti in tabella hanno `org_id` di
-- organizzazioni prive di membri (sono anteriori al flusso `org_members`
-- attuale), quindi erano gia' invisibili sotto la policy del padre. Questa
-- migrazione non li rende meno accessibili di prima: chiude il varco per cui
-- le loro righe erano leggibili da chiunque.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_items_org_owner ON public.document_items;

CREATE POLICY document_items_org_owner ON public.document_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_items.document_id
        AND d.org_id = (
          SELECT om.org_id
          FROM public.org_members om
          WHERE om.user_id = auth.uid() AND om.role = 'owner'
          LIMIT 1
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_items.document_id
        AND d.org_id = (
          SELECT om.org_id
          FROM public.org_members om
          WHERE om.user_id = auth.uid() AND om.role = 'owner'
          LIMIT 1
        )
    )
  );
