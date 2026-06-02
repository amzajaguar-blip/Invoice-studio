# 🚀 BUILD V20 (RC) — PRE-FLIGHT CHECKLIST

Questo documento contiene i punti salienti finali da spuntare immediatamente post-lancio (o appena prima) per assicurarsi che la Build V20 operi al 100% in ambiente reale.

## 🔴 Azioni Immediate (Bloccanti per i nuovi iscritti)

- [ ] **Eseguire `fix_handle_new_user_null_name.sql` su Supabase (SQL Editor)**
  *Perché:* Se un utente si iscrive con Google o senza un nome completo, il trigger attuale crasherà impedendo la creazione dell'account. Il fix fornisce un fallback automatico a "Freelancer's Studio".

## 🟡 Da Monitorare Post-Lancio (Primi 30 giorni)

- [ ] **Monitorare i webhook Stripe nella dashboard**
  *Cosa controllare:* Verificare che gli eventi `checkout.session.completed` ritornino `200 OK` e che le fatture vengano effettivamente marcate come "pagate".
- [ ] **Monitorare i log di RevenueCat**
  *Cosa controllare:* Assicurarsi che l'evento `INITIAL_PURCHASE` passi correttamente la validazione del webhook (SEC-001 fixato) e aggiorni il piano dell'organizzazione a "pro".

## 🔵 Backlog per la V21/V22 (Non bloccanti ora)

- [ ] **Risolvere SEC-002 e SEC-003 (Ruoli `org_members`)**
  *Azione:* Aggiornare le policy RLS su Supabase per impedire a un membro di promuoversi a `owner` o di invitare altri come `owner`. (Rilevante solo quando si abiliteranno i team).
- [ ] **Riattivare l'OCR Scanner**
  *Azione:* Migliorare l'affidabilità di `Tesseract.js` o collegare un'API OCR esterna e sbloccare la route disabilitata.
