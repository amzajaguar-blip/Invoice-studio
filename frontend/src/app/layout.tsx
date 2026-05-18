import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieBanner } from "@/components/gdpr/CookieBanner";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
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
    default: "InvoiceStudio — Fatture Professionali per Freelancer",
    template: "%s | InvoiceStudio",
  },
  description:
    "Crea fatture professionali, accetta pagamenti online con Stripe e PayPal, e automatizza i reminder. La piattaforma SaaS per freelancer e agenzie italiane.",
  keywords: ["fatture", "freelancer", "partita IVA", "Stripe", "fatturazione", "SaaS"],
  authors: [{ name: "InvoiceStudio" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "InvoiceStudio — Fatture Professionali per Freelancer",
    description: "Fatture + pagamenti integrati in un'unica piattaforma.",
    type: "website",
    locale: "it_IT",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "InvoiceStudio",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#0a0b0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="InvoiceStudio" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[300] focus:px-4 focus:py-2 focus:bg-[#6c63ff] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
        >
          Salta al contenuto principale
        </a>
        {children}
        <CookieBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
