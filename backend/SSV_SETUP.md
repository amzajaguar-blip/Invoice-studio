# SSV (Server-Side Verification) — Setup Guide

## Come ottenere i 3 dati necessari

### 1. Google Service Account

Vai su [Google Cloud Console](https://console.cloud.google.com) → IAM → Service Accounts.

**Passaggi:**
1. Clicca **"CREATE SERVICE ACCOUNT"**
2. Nome: `invoicestudio-ssv` (o quello che preferisci)
3. Ruolo: `Ad Manager Admin` (o crea un ruolo custom con solo `rewardedAds.verify`)
4. Clicca **"DONE"**
5. Nella lista, clicca sul Service Account creato → tab **"KEYS"**
6. **ADD KEY → Create New Key → JSON**
7. Scarica il file JSON

Dal JSON estrai:
- `client_email` → sarà `GOOGLE_ADSSV_CLIENT_EMAIL`
- `private_key` → sarà `GOOGLE_ADSSV_PRIVATE_KEY`

### 2. Network Code

Vai su [AdMob Console](https://apps.admob.com) → **Impostazioni** (ingranaggio) → **Informazioni account**.

Copia il **Network Code** (numero, es. `123456789`).
→ sarà `ADMOB_NETWORK_CODE`

### 3. Abilita l'API

Su [Google Cloud Console](https://console.cloud.google.com) → **API & Services → Library**:
1. Cerca **"Ad Manager API"**
2. Clicca **"ENABLE"**

---

## Dove inserire le variabili d'ambiente

### Vercel (produzione)

Vai su [Vercel Dashboard](https://vercel.com) → InvoiceStudio → **Settings → Environment Variables**:

| Nome | Valore |
|------|--------|
| `ADMOB_NETWORK_CODE` | `123456789` |
| `GOOGLE_ADSSV_CLIENT_EMAIL` | `invoicestudio-ssv@project.iam.gserviceaccount.com` |
| `GOOGLE_ADSSV_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...` |

⚠️ Per `GOOGLE_ADSSV_PRIVATE_KEY`: includi TUTTA la chiave compresi i `\n`. Incolla il valore ESATTAMENTE come appare nel JSON, con le virgolette.

### GitHub Actions (CI)

Vai su [GitHub → Settings → Secrets and variables → Actions](https://github.com/amzajaguar-blip/Invoice-studio/settings/secrets/actions):

Aggiungi gli stessi 3 secret.

---

## Verifica

Dopo aver configurato le env vars, testa l'endpoint:

```bash
curl -X POST https://invoicestudio.app/api/ads/reward-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"admob_callback_id": "test"}'
```

Dovresti ricevere un errore 400 (callback non valido) — significa che SSV è attivo e sta verificando.
