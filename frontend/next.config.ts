import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://www.googletagservices.com https://accounts.google.com`,
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.resend.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://accounts.google.com",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {},

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/pay/:token",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
      {
        // OAuth callback routes need relaxed COOP/COEP so Google redirect works
        source: "/auth/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
      {
        // Login/signup pages need relaxed COOP for Google OAuth redirect
        source: "/(login|signup)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  serverExternalPackages: ["tesseract.js"],

  experimental: {
    optimizePackageImports: ["lucide-react"],
  },


  env: {
    SENTRY_SUPPRESS_TURBOPACK_WARNING: "1",
  },
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  org: "invoice-studio",
  project: "frontend",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  // Fix: App Router doesn't generate pages-manifest.json (Pages Router only).
  // Disabling these prevents ENOENT crash when Sentry tries to instrument server functions.
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
});
