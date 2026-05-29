# PROMPT ESECUTIVO — Integrazione InvoiceStudio ZIP → Progetto Corrente

## OBIETTIVO
Integrare componenti e servizi dal progetto ZIP estratto in `/home/locoomo/Scrivania/building factory/saas_app/invoice studio/temp_extracted_code/InvoiceStudioProject/` nel progetto corrente `/home/locoomo/Scrivania/building factory/saas_app/invoice studio/`.

**REGOLE FERREE:**
- NON toccare `mobile/`, `backend/`, `supabase/`
- NON modificare file esistenti in `frontend/` se non esplicitamente indicato
- NON installare librerie già presenti
- TUTTI i nuovi file vanno dentro `frontend/src/`
- I componenti ZIP usano tRPC/wouter → ADATTARE a Next.js API routes + fetch
- Le route API ZIP usano Drizzle/MySQL → ADATTARE a Supabase/PostgreSQL

---

## FASE A: Componenti UI (4 file da creare/modificare)

### A1 — AIChatBox (`frontend/src/components/ai/AIChatBox.tsx`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/client/src/components/AIChatBox.tsx`

**Azioni:**
1. Crea directory `frontend/src/components/ai/`
2. Copia il file sorgente
3. RIMUOVI import di tRPC (non esiste più `@/lib/trpc`)
4. SOSTITUISCI il meccanismo `onSendMessage` — invece di chiamare tRPC, chiama `fetch('/api/ai/suggest', { method: 'POST', body: JSON.stringify({ messages }) })`
5. MANTIENI import di: `streamdown`, `lucide-react`, `@/lib/utils`, componenti UI esistenti
6. AGGIUNGI export default `AIChatBox`

**Dipendenze da installare:**
```bash
cd frontend && npm install streamdown sonner
```

---

### A2 — ReceiptUpload (`frontend/src/components/receipts/ReceiptUpload.tsx`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/client/src/components/ReceiptUpload.tsx`

**Azioni:**
1. Crea directory `frontend/src/components/receipts/`
2. Copia il file sorgente tal quale (è già standalone, non ha dipendenze tRPC)
3. Modifica import path: `@/components/ui/button` → `@/components/ui/button` (verifica che esista, altrimenti crea un Button wrapper)
4. Aggiungi export default

---

### A3 — ExportButtons (`frontend/src/components/export/ExportButtons.tsx`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/client/src/components/ExportButtons.tsx`

**Azioni:**
1. Crea directory `frontend/src/components/export/`
2. Copia il file sorgente
3. RIMUOVI `import { trpc } from "@/lib/trpc"`
4. SOSTITUISCI tutte le chiamate tRPC con `fetch()` verso le API routes esistenti:
   - `exportInvoicePdfMutation` → `fetch('/api/invoices/[id]/pdf', { method: 'POST', body: JSON.stringify(input) })`
   - `exportInvoiceExcelMutation` → `fetch('/api/invoices/export-csv', { method: 'POST', body: JSON.stringify(input) })`
   - `exportReceiptPdfMutation` → `fetch('/api/ocr/receipt', { method: 'POST', body: JSON.stringify(input) })` (o nuova route)
5. USA `useState` per loading invece di `mutation.isPending`
6. Aggiungi export default

---

### A4 — ErrorBoundary (`frontend/src/components/ErrorBoundary.tsx`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/client/src/components/ErrorBoundary.tsx`

**Azioni:**
1. Copia il file tal quale in `frontend/src/components/ErrorBoundary.tsx`
2. Verifica che gli import siano validi, correggi se necessario
3. Aggiungi export default se non presente

---

## FASE B: Servizi AI Backend (3 file da creare)

### B1 — Voice Transcription (`frontend/src/lib/voice-transcription.ts`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/server/_core/voiceTranscription.ts`

**Azioni:**
1. Copia il file in `frontend/src/lib/voice-transcription.ts`
2. RIMUOVI `import { ENV } from "./env"` — sostituisci con `process.env`
3. SOSTITUISCI tutte le referenze a `ENV.forgeApiUrl` → `process.env.FORGE_API_URL`
4. SOSTITUISCI tutte le referenze a `ENV.forgeApiKey` → `process.env.FORGE_API_KEY`
5. SOSTITUISCI `Buffer.from()` → usa `Uint8Array` + `ArrayBuffer` (Next.js Edge runtime compatibile)
6. ESPORTA la funzione `transcribeAudio` e tutti i tipi TypeScript
7. Aggiungi commento JSDoc con esempio di utilizzo

**Nuova route API (opzionale, crea se vuoi):**
Crea `frontend/src/app/api/ai/voice-transcribe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/voice-transcription';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await transcribeAudio(body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
```

---

### B2 — Image Generation (`frontend/src/lib/image-generation.ts`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/server/_core/imageGeneration.ts`

**Azioni:**
1. Copia il file in `frontend/src/lib/image-generation.ts`
2. RIMUOVI `import { storagePut } from "server/storage"` e `import { ENV } from "./env"`
3. SOSTITUISCI storagePut con Supabase Storage upload:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
   // Upload a 'generated-images' bucket
   const { data } = await supabase.storage.from('generated-images').upload(`${Date.now()}.png`, buffer);
   const url = supabase.storage.from('generated-images').getPublicUrl(data.path).data.publicUrl;
   ```
4. SOSTITUISCI env vars come in B1
5. SOSTITUISCI `Buffer.from()` come in B1
6. ESPORTA `generateImage` e tipi

---

### B3 — LLM Service (`frontend/src/lib/llm.ts`)

**Fonte:** `temp_extracted_code/InvoiceStudioProject/server/_core/llm.ts`

**Azioni:**
1. Copia il file in `frontend/src/lib/llm.ts`
2. RIMUOVI `import { ENV } from "./env"` — usa `process.env`
3. SOSTITUISCI `ENV.forgeApiUrl` → `process.env.FORGE_API_URL`
4. SOSTITUISCI `ENV.forgeApiKey` → `process.env.FORGE_API_KEY`
5. MANTIENI tutte le definizioni di tipo (Role, Message, Tool, InvokeParams, InvokeResult, etc.)
6. ESPORTA `invokeLLM` e tutti i tipi
7. Aggiungi fallback a OpenAI-compatible endpoint se Forge non configurato

**Aggiorna route esistente:**
Modifica `frontend/src/app/api/ai/suggest/route.ts` per usare il nuovo `invokeLLM` da `@/lib/llm` invece della logica inline attuale. NON rimuovere la logica esistente, wrappala in un try/catch con fallback.

---

## FASE C: Verifica & Pulizia

### C1 — Verifica build

```bash
cd frontend && npm run build
```

Se ci sono errori:
- Controlla che tutti gli import path siano corretti
- Verifica che le dipendenze `streamdown` e `sonner` siano installate
- Controlla che i tipi TypeScript siano compatibili
- Risolvi eventuali conflitti di versione

### C2 — Type check

```bash
cd frontend && npx tsc --noEmit
```

Correggi eventuali errori di tipo. I più comuni:
- `@/lib/utils` non esporta `cn` → verifica che esista
- `@/components/ui/*` non esiste → crea wrapper minimale o usa alternativa

### C3 — Pulizia

```bash
rm -rf "/home/locoomo/Scrivania/building factory/saas_app/invoice studio/temp_extracted_code"
```

### C4 — Commit

```bash
cd "/home/locoomo/Scrivania/building factory/saas_app/invoice studio"
git add frontend/src/components/ai/ frontend/src/components/receipts/ frontend/src/components/export/ frontend/src/components/ErrorBoundary.tsx frontend/src/lib/voice-transcription.ts frontend/src/lib/image-generation.ts frontend/src/lib/llm.ts frontend/src/app/api/ai/voice-transcribe/ frontend/package.json frontend/package-lock.json
git commit -m "$(cat <<'EOF'
feat(v19): integrazione ZIP — AI Chat, ReceiptUpload, Export, Voice, ErrorBoundary

Componenti UI integrati dal progetto InvoiceStudio ZIP:
- AIChatBox: chat AI con Streamdown markdown, prompt suggeriti
- ReceiptUpload: drag&drop upload ricevute con preview e validazione
- ExportButtons: export PDF/Excel riutilizzabile
- ErrorBoundary: React error boundary globale

Servizi AI:
- voice-transcription: Whisper API via Forge
- image-generation: generazione immagini via Forge
- llm.ts: client LLM unificato con supporto tools e structured output

Dipendenze: streamdown, sonner

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

---

## RIEPILOGO COMANDI DA ESEGUIRE IN SEQUENZA

```bash
# 1. Installa dipendenze
cd "/home/locoomo/Scrivania/building factory/saas_app/invoice studio/frontend" && npm install streamdown sonner

# 2. Crea directory
mkdir -p frontend/src/components/ai frontend/src/components/receipts frontend/src/components/export frontend/src/app/api/ai/voice-transcribe

# 3. Copia e adatta i file (A1-A4, B1-B3) — vedi istruzioni sopra

# 4. Verifica
npm run build

# 5. Pulizia
rm -rf temp_extracted_code

# 6. Commit
git add -A && git commit -m "feat(v19): integrazione ZIP"
```

---

## STRUTTURA FINALE ATTESA

```
frontend/src/
├── components/
│   ├── ai/
│   │   └── AIChatBox.tsx          ← NUOVO
│   ├── receipts/
│   │   └── ReceiptUpload.tsx      ← NUOVO
│   ├── export/
│   │   └── ExportButtons.tsx      ← NUOVO
│   └── ErrorBoundary.tsx          ← NUOVO
├── lib/
│   ├── voice-transcription.ts     ← NUOVO
│   ├── image-generation.ts        ← NUOVO
│   └── llm.ts                     ← NUOVO
└── app/
    └── api/
        └── ai/
            ├── suggest/
            │   └── route.ts       ← MODIFICATO (usa nuovo llm.ts)
            └── voice-transcribe/
                └── route.ts       ← NUOVO (opzionale)
```