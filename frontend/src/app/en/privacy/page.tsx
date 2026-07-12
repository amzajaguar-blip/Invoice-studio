import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "VELA Privacy Policy — GDPR compliant.",
  alternates: {
    languages: {
      it: "/privacy",
      en: "/en/privacy",
    },
  },
};

export default function PrivacyPageEn() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#d1d5db]">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/en"
            className="text-sm text-[#6c63ff] hover:text-[#8b5cf6] no-underline transition-colors"
          >
            ← Back to home
          </Link>
          <LanguageSelector current="/en/privacy" itPath="/privacy" enPath="/en/privacy" />
        </div>

        <h1 className="text-3xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#9ca3af] mb-10">
          Last updated: May 25, 2026
        </p>

        {/* 1. Data Controller */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            1. Data Controller
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            VELA, with operational headquarters in Italy, is the data controller
            for personal data collected through this mobile application. For any
            privacy-related requests, you can contact us at{" "}
            <span className="text-[#6c63ff]">privacy@vela.app</span>.
          </p>
        </section>

        {/* 2. Data Collected */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Personal Data Collected and Processing Purposes
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-4">
            We collect the following categories of personal data:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-2 mb-4">
            <li>
              <strong>Registration and profile data:</strong> name, email,
              password (hashed), preferred language, time zone.
            </li>
            <li>
              <strong>Tax and business data (optional):</strong> company name,
              VAT number/tax code, address, ZIP code, city, country, SDI/PEC
              code for e-invoicing.
            </li>
            <li>
              <strong>Document data:</strong> invoices, quotes, clients,
              products/services, amounts, VAT, dates, numbering.
            </li>
            <li>
              <strong>Payment data (handled by Google Play Billing):</strong>
              the app does not collect or store credit card numbers, bank
              details, or sensitive payment data. Subscriptions are processed
              via <strong>Google Play Billing</strong> on Android.
              <strong>RevenueCat</strong> acts as a subscription/entitlements
              management layer and does not store card data.
            </li>
            <li>
              <strong>Usage and diagnostic data (Sentry):</strong> errors,
              performance, crash reports, session replay (text/masked).
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Legal basis: contract performance (Art. 6.1.b GDPR), consent
            (Art. 6.1.a for analytics), legitimate interest (Art. 6.1.f for
            security/fraud prevention).
          </p>
        </section>

        {/* 3. Purposes and Legal Basis */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            3. Purposes and Legal Basis
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            We process your personal data for the following purposes:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">
                Service provision (Art. 6.1.b GDPR):
              </strong>{" "}
              account management, invoices, quotes, clients, cloud sync, backup.
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Legal obligations (Art. 6.1.c GDPR):
              </strong>{" "}
              10-year retention of tax documents (Art. 2220 Civil Code),
              e-invoicing (SDI).
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Consent (Art. 6.1.a GDPR):
              </strong>{" "}
              crash/performance analytics (Sentry).
            </li>
            <li>
              <strong className="text-[#d1d5db]">
                Legitimate interest (Art. 6.1.f GDPR):
              </strong>{" "}
              security, anti-fraud, abuse prevention, service improvement.
            </li>
          </ul>
        </section>

        {/* 4. Retention */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            4. Retention Period
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Account data is retained until deletion request. Tax data and
            invoices are retained for 10 years as required by Italian law (Art.
            2220 Civil Code). Technical logs are retained for a maximum of
            12 months.
          </p>
        </section>

        {/* 5. User Rights */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            5. Your Rights (Arts. 15-22 GDPR)
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            As a data subject, you have the following rights:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Access:</strong> obtain
              confirmation of the existence of data concerning you and receive a
              copy.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Rectification:</strong> correct
              inaccurate or incomplete data.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Erasure:</strong> request
              deletion of data (right to be forgotten), within legal limits.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Portability:</strong> receive
              your data in a structured format and transfer it to another
              controller.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Restriction:</strong> obtain
              restriction of processing in certain circumstances.
            </li>
            <li>
              <strong className="text-[#d1d5db]">Objection:</strong> object to
              processing based on legitimate interest.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-[#9ca3af] mt-2">
            To exercise your rights, write to{" "}
            <span className="text-[#6c63ff]">privacy@vela.app</span>.
            We will respond within 30 days. You also have the right to lodge a
            complaint with the Italian Data Protection Authority (
            <a
              href="https://www.garanteprivacy.it"
              className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
            >
              www.garanteprivacy.it
            </a>
            ).
          </p>
        </section>

        {/* 6. Cookies and Similar Technologies */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Cookies and Similar Technologies
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            The VELA mobile app (Android) does not use traditional web cookies.
            It uses device identifiers for:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2 mt-2">
            <li>Authentication and session (secure, httpOnly tokens).</li>
            <li>Crash/performance diagnostics (Sentry) — text masked.</li>
          </ul>
        </section>

        {/* 7. Third Parties (Data Processors) */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            7. Third Parties (Data Processors)
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            To provide the service, we engage the following data processors, all
            GDPR-compliant:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>
              <strong className="text-[#d1d5db]">Supabase:</strong> database
              hosting and authentication. Servers in EU (Frankfurt).{" "}
              <a
                href="https://supabase.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">RevenueCat:</strong> subscription
              management, entitlements, Google Play receipt validation. Does not
              store credit card data.{" "}
              <a
                href="https://www.revenuecat.com/privacy/"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Google Play Billing:</strong>
              in-app subscription payment processing on Android.{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Resend:</strong> transactional
              email delivery (invoices, reminders).{" "}
              <a
                href="https://resend.com/privacy"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-[#d1d5db]">Sentry:</strong> error
              monitoring and diagnostics.{" "}
              <a
                href="https://sentry.io/privacy/"
                className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
              >
                Privacy Policy
              </a>
              .
            </li>
          </ul>
        </section>

        {/* 8. Changes */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            8. Changes to this Privacy Policy
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            Any changes to this policy will be posted on this page and, if
            substantial, notified via email. We encourage you to review this
            page periodically.
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            VELA — Mobile app for professional invoicing and quotes.
            Operational headquarters in Italy.
          </p>
        </div>
      </div>
    </div>
  );
}