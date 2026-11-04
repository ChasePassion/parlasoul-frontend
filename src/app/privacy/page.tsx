import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy – ParlaSoul",
  description: "Privacy Policy for ParlaSoul",
};

const LAST_UPDATED = "April 14, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-7 max-sm:py-5">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <Image src="/icon.svg" alt="ParlaSoul" width={24} height={24} className="rounded-md" />
          <span className="text-base font-semibold tracking-tight">ParlaSoul</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 pb-20 max-sm:py-8">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-gray-600">
          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">1. Introduction</h2>
            <p className="mt-2">
              ParlaSoul (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to
              protecting your personal data. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our AI character roleplay
              platform. Please read this policy carefully.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">2. Information We Collect</h2>
            <p className="mt-2 font-medium text-gray-700">2.1 Information You Provide</p>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              <li><strong>Account information:</strong> Email address and display name.</li>
              <li><strong>Conversation data:</strong> Messages you send to AI characters and the responses you receive.</li>
              <li><strong>Profile information:</strong> Any optional profile details you choose to provide.</li>
              <li><strong>Payment information:</strong> Billing details processed securely through our third-party payment provider. We do not store full credit card numbers.</li>
            </ul>
            <p className="mt-3 font-medium text-gray-700">2.2 Information Collected Automatically</p>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              <li><strong>Usage data:</strong> Features accessed, session duration, interaction patterns, and click behavior.</li>
              <li><strong>Device information:</strong> Browser type, operating system, device type, and screen resolution.</li>
              <li><strong>Log data:</strong> IP address, access timestamps, and referring URLs.</li>
              <li><strong>Cookies and similar technologies:</strong> Session cookies for authentication and analytics cookies to improve the Service.</li>
            </ul>
            {/* Google 登录已撤销；恢复时取消整段注释。
            <p className="mt-3 font-medium text-gray-700">2.3 Information from Third Parties</p>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              <li>When you sign in with Google, we receive your email address and basic profile info from your Google account.</li>
            </ul>
            */}
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">3. How We Use Your Information</h2>
            <p className="mt-2">We use the collected information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Provide, operate, and maintain the Service.</li>
              <li>Process and deliver AI-generated conversations.</li>
              <li>Improve and personalize your experience.</li>
              <li>Process payments and manage subscriptions.</li>
              <li>Send service-related notifications (e.g., security alerts, billing updates).</li>
              <li>Analyze usage patterns to improve our product.</li>
              <li>Detect, prevent, and address fraud, abuse, and security issues.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">4. Data Storage and Security</h2>
            <p className="mt-2">
              Your data is stored on secure servers with industry-standard encryption (TLS/SSL in
              transit, AES-256 at rest). We implement reasonable administrative, technical, and
              physical safeguards to protect your information. However, no method of transmission
              over the Internet or electronic storage is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">5. Data Sharing</h2>
            <p className="mt-2">We do not sell your personal data. We may share your information with:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Service providers:</strong> Third-party companies that help us operate the Service (e.g., AI model providers, payment processors, hosting services, email delivery).</li>
              <li><strong>Legal requirements:</strong> When required by law, regulation, legal process, or governmental request.</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">6. Data Retention</h2>
            <p className="mt-2">
              We retain your account data for as long as your account is active. Conversation
              history is retained to provide continuity in your interactions. You may request
              deletion of your account and associated data at any time by contacting us. We will
              process deletion requests within 30 days, except where retention is required by law.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">7. Your Rights</h2>
            <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data.</li>
              <li><strong>Portability:</strong> Request transfer of your data in a machine-readable format.</li>
              <li><strong>Objection:</strong> Object to certain processing of your data.</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:verify@parlasoul.com" className="text-gray-900 underline underline-offset-2 hover:text-black">
                verify@parlasoul.com
              </a>.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">8. Cookies</h2>
            <p className="mt-2">
              We use cookies and similar tracking technologies to enhance your experience. You can
              manage cookie preferences through your browser settings. Disabling cookies may affect
              certain features of the Service. We use:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Essential cookies:</strong> Required for the Service to function (e.g., session authentication).</li>
              <li><strong>Analytics cookies:</strong> Help us understand how users interact with the Service.</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">9. Children&apos;s Privacy</h2>
            <p className="mt-2">
              The Service is not directed to children under 13. We do not knowingly collect personal
              data from children under 13. If we become aware that we have collected data from a
              child under 13, we will take steps to delete such information promptly.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">10. International Data Transfers</h2>
            <p className="mt-2">
              Your information may be transferred to and processed in countries other than your own.
              We ensure appropriate safeguards are in place, including standard contractual clauses
              and adherence to applicable data protection frameworks.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">11. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new policy on this page and updating the &quot;Last
              updated&quot; date. Your continued use of the Service after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900">12. Contact</h2>
            <p className="mt-2">
              If you have questions or concerns about this Privacy Policy, please contact us at{" "}
              <a href="mailto:verify@parlasoul.com" className="text-gray-900 underline underline-offset-2 hover:text-black">
                verify@parlasoul.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
