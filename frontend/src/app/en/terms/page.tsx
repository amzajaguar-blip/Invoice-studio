import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "VELA Terms and Conditions of Use.",
  alternates: {
    languages: {
      it: "/terms",
      en: "/en/terms",
    },
  },
};

export default function TermsPageEn() {
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
          <LanguageSelector current="/en/terms" itPath="/terms" enPath="/en/terms" />
        </div>

        <h1 className="text-3xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-3">
          Terms of Service
        </h1>
        <p className="text-sm text-[#9ca3af] mb-10">
          Last updated: May 18, 2026
        </p>

        {/* 1. Service Description */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            1. Service Description
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            VELA (&ldquo;the App&rdquo;) is an Android mobile application for
            freelancers, professionals, and small businesses with a VAT number
            that enables creating, sending, and managing professional invoices
            and quotes, automating payment reminders, and syncing data in the
            cloud. The app is distributed via the Google Play Store.
          </p>
        </section>

        {/* 2. Registration and Account */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            2. Registration and Account
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            To use the App, you must create an account by providing a valid
            email address and a password. You are responsible for maintaining
            the confidentiality of your credentials and for all activities that
            occur under your account. Sharing credentials with third parties or
            using the account for illegal activities is prohibited. VELA
            reserves the right to suspend or close accounts that violate these
            terms.
          </p>
        </section>

        {/* 3. User Obligations */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            3. User Obligations
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            By using VELA, you agree to:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>Provide accurate and up-to-date information.</li>
            <li>
              Not use the App for fraudulent, illegal, or unauthorized
              activities.
            </li>
            <li>
              Not infringe the intellectual property rights of VELA or third
              parties.
            </li>
            <li>
              Comply with Italian tax regulations regarding e-invoicing and
              document retention.
            </li>
            <li>
              Not attempt to access other users' data or accounts without
              authorization.
            </li>
          </ul>
        </section>

        {/* 4. Payments and Subscriptions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            4. Payments and Subscriptions
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af] mb-2">
            VELA offers a free plan and two paid premium plans (monthly and
            annual). Prices are published in the app and on the Google Play
            Store. Subscriptions are managed via <strong>Google Play Billing</strong>
            on Android. <strong>RevenueCat</strong> acts as a subscription
            and entitlements management layer and does not store card data. You
            are responsible for timely payment through your Google account.
            Failed payments result in suspension of premium features. Renewals
            are automatic unless cancelled (managed by Google Play). Transaction
            fees on payments received from clients (e.g., invoices paid via bank
            transfer) are your responsibility.
          </p>
        </section>

        {/* 5. Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            5. Intellectual Property
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            The software, design, logos, and content of the App are the
            exclusive property of VELA and are protected by Italian and
            international copyright laws. Content you enter (client data,
            invoices, quotes, notes) remains your property. You grant VELA a
            limited license to process such data solely to provide the service.
          </p>
        </section>

        {/* 6. Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            6. Limitation of Liability
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            VELA provides the service &ldquo;as is&rdquo; and does not guarantee
            that the service will be error-free or uninterrupted. To the extent
            permitted by law, VELA shall not be liable for direct or indirect
            damages arising from the use or inability to use the App, including
            but not limited to data loss, lost profits, or business
            interruptions. VELA's total liability shall not exceed the amount
            paid by you in the last 12 months.
          </p>
        </section>

        {/* 7. Term and Termination */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            7. Term and Termination
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            These terms remain in effect while you maintain an active account
            on the App. You may close your account at any time from settings.
            VELA may terminate or suspend access for breach of these terms,
            with 7 days' notice (or immediately for serious breaches). Upon
            termination, you will have 30 days to export your data. After that
            period, data will be deleted, subject to tax retention obligations.
          </p>
        </section>

        {/* 8. Governing Law */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            8. Governing Law and Jurisdiction
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            These Terms of Service are governed by Italian law. Any dispute
            arising from the interpretation or execution of these terms shall
            be subject to the exclusive jurisdiction of the court where VELA
            has its registered office, except as provided by the Consumer Code
            (Legislative Decree 206/2005) for consumers.
          </p>
        </section>

        {/* 9. Changes */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f0f2] mb-3">
            9. Changes to the Terms
          </h2>
          <p className="text-sm leading-relaxed text-[#9ca3af]">
            VELA reserves the right to modify these terms at any time. Changes
            will be communicated via email with at least 15 days' notice.
            Continued use of the App after the effective date of changes
            constitutes acceptance of the new terms.
          </p>
        </section>

        <div className="border-t border-[#1e2029] pt-8 mt-12">
          <p className="text-xs text-[#6b7280]">
            VELA — Mobile app for professional invoicing and quotes.
            For questions about terms:{" "}
            <span className="text-[#6c63ff]">supporto@vela.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}