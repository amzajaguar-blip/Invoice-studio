# InvoiceStudio Mobile

React Native (Expo) app per InvoiceStudio — sostituisce il TWA Android.

## Setup

```bash
cd mobile
npm install
npx expo start
```

## Struttura

```
mobile/
├── app/                    # Expo Router file-based routing
│   ├── _layout.tsx         # Root layout + AuthProvider
│   ├── login.tsx           # Login / Signup screen
│   └── (app)/              # Authenticated routes
│       ├── _layout.tsx     # Auth guard
│       ├── (tabs)/         # Tab navigation
│       │   ├── index.tsx   # Dashboard
│       │   ├── invoices.tsx
│       │   ├── clients.tsx
│       │   └── settings.tsx
│       └── scanner.tsx     # OCR receipt scanner
├── lib/
│   ├── supabase.ts         # Supabase client + SecureStore
│   └── ai.ts               # AI suggest (Gemini)
├── hooks/
│   └── useAuth.ts          # Auth context + provider
└── assets/                 # Icons, splash, fonts
```

## Funzionalità

- **Auth**: Supabase Auth (email/password, magic link, OAuth)
- **Dashboard**: fatture emesse, fatturato
- **Scanner** (WIP): OCR ricevute con fotocamera
- **AI** (WIP): suggerimenti descrizioni/note via Gemini
- **Sync**: stesso backend Supabase del web

## Backend condiviso

L'app mobile usa lo stesso progetto Supabase già configurato per il frontend Next.js:

- Auth: `supabase.auth` (stessi utenti)
- DB: `supabase.from(...)` (stesse tabelle, RLS policies)
- API: Next.js API routes accessibili dall'app via fetch con Bearer token

## Notes

- Il TWA (`frontend/twa/`) rimane funzionante come fallback Android
- L'app Expo sarà distribuita separatamente su Play Store (o in sostituzione del TWA)
- OCR in arrivo: Google ML Kit on-device (gratuito, nessuna chiave API richiesta)
