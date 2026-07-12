import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieBanner } from "@/components/gdpr/CookieBanner";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VELA — Fatture e Preventivi Professionali",
    template: "%s | VELA",
  },
  description:
    "Crea fatture e preventivi professionali, gestisci clienti e monitora i pagamenti. L'app mobile per freelance, professionisti e PMI italiane.",
  keywords: ["fatture", "preventivi", "freelance", "partita IVA", "fatturazione", "business"],
  authors: [{ name: "VELA" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "VELA — Fatture e Preventivi Professionali",
    description: "Fatture + preventivi + clienti in un'unica app.",
    type: "website",
    locale: "it_IT",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VELA",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#0a0b0f",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        {/* Anti-FOUC: set theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('invoice-studio-theme')||'dark';var r=t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(r);}catch(e){}})();`,
          }}
        />
        <meta name="theme-color" content="#0a0b0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VELA" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[300] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:outline-none"
        >
          Salta al contenuto principale
        </a>
        <ThemeProvider>
          {children}
          <CookieBanner />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
