import { cookies as requestCookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { privacyTranslations, type PrivacySection } from "./translations";
import Link from "next/link";
import { company } from "../lib/company";

const sections = [
  {
    title: "1. Who is responsible for your information",
    paragraphs: [
      `${company.legalName}, presented under the BRICKWISE brand and represented by its Manager, ${company.manager}, operates this website and determines how personal information submitted through it is used. References to “we”, “us”, or “our” in this policy refer to this operator.`,
      `Registered office: ${company.street}, ${company.locality}. European contact office: ${company.europeanStreet}, ${company.europeanLocality}. Privacy questions, requests, or complaints can be sent to privacy@brickwise-immo.de or info@brickwise-immo.de.`,
    ],
  },
  {
    title: "2. Scope of this policy",
    paragraphs: [
      "This policy applies when you browse the website, create or use an account, view property information, submit a contact or funding request, communicate with our team, or choose cookie and marketing preferences.",
      "It does not govern third-party websites, messaging services, banks, wallet providers, or other services that you access through an external link. Those providers apply their own privacy notices.",
    ],
  },
  {
    title: "3. Information we collect",
    bullets: [
      "Account data: name, email address, encrypted authentication credentials, account identifiers, confirmation status, profile details, and account activity.",
      "Contact and request data: telephone number when voluntarily supplied, message content, selected property, requested amount, payout preference, payment preference, and request status.",
      "Technical data: IP address, approximate country, browser and device information, timestamps, requested pages, referral information, security logs, and cookie identifiers.",
      "Marketing and consent data: whether marketing tracking was accepted or rejected and, after consent, page-view and conversion events associated with Meta Pixel and Google Ads.",
      "Communications: emails, support requests, WhatsApp messages initiated by you, and records needed to respond or prevent fraud.",
      "We do not ask you to submit private keys, wallet recovery phrases, card PINs, online-banking passwords, or funds through this website.",
    ],
  },
  {
    title: "4. How and why we use information",
    bullets: [
      "Create, secure, confirm, and administer user accounts.",
      "Display the client dashboard and associate requests with the correct user.",
      "Respond to property, withdrawal, funding, account, and general enquiries.",
      "Prepare non-binding references and enable follow-up by an authorized team member.",
      "Operate, troubleshoot, protect, and improve the website and detect abuse or unauthorized access.",
      "Measure website and advertising performance only after marketing consent is given.",
      "Meet accounting, regulatory, dispute-resolution, fraud-prevention, and other legal obligations.",
    ],
  },
  {
    title: "5. Legal bases",
    paragraphs: [
      "Where the EU/EEA, UK, or similar privacy rules apply, processing is based on one or more of the following: steps requested before entering an agreement; performance of an agreement; compliance with legal obligations; our legitimate interests in operating, securing, and improving the service; and your consent for optional marketing technology or communications.",
      "You may withdraw consent at any time. Withdrawal does not affect processing that was lawful before withdrawal. Necessary account and security processing cannot always be disabled while an account remains active.",
    ],
  },
  {
    title: "6. When information is shared",
    bullets: [
      "Supabase provides authentication, database, and related backend infrastructure.",
      "Vercel provides website hosting, delivery, security, and operational logs.",
      "Meta receives marketing-event information through Meta Pixel only after you accept marketing tracking.",
      "Google receives advertising measurement information through the Google tag only after you accept marketing tracking.",
      "OpenAI receives the messages you type into the website chat assistant in order to generate replies. No account data is sent, requests are made with response storage at OpenAI disabled (store: false), and the information is processed in the USA.",
      "Resend delivers transactional emails, such as internal notifications to our team about new registrations.",
      "Google receives your IP address and browser information through the Google Maps embed on property pages only after you click to load the map.",
      "Email, telecommunications, professional advisory, compliance, and support providers may process the minimum information needed for their service.",
      "Authorities, courts, regulators, or counterparties may receive information where disclosure is legally required or necessary to establish, exercise, or defend legal claims.",
      "Information may be transferred as part of a merger, financing, restructuring, or sale, subject to appropriate confidentiality and legal safeguards.",
    ],
  },
  {
    title: "7. International transfers",
    paragraphs: [
      "The website supports users and property opportunities across borders, including the United States, Canada, Germany, Austria, and Switzerland. Service providers may process information in these or other locations where they operate.",
      "In particular, OpenAI processes chat assistant messages in the USA, and Google processes Google Maps requests in the USA; the map is loaded only after you click to load it.",
      "Where required, international transfers are supported by an adequacy decision, contractual safeguards, or another legally recognized transfer mechanism. No transfer mechanism removes all risks associated with processing information in another jurisdiction.",
    ],
  },
  {
    title: "8. Retention",
    bullets: [
      "Account data is generally retained while the account is active and for a reasonable period afterward to handle security, disputes, and legal obligations.",
      "Contact and property requests are retained while the request is open and afterward where needed for follow-up, recordkeeping, or legal claims.",
      "Security and technical logs are retained for periods appropriate to fraud prevention, troubleshooting, and infrastructure security.",
      "Consent records are retained to document your choice. Data is deleted or anonymized when it is no longer reasonably required, unless law requires longer retention.",
    ],
  },
  {
    title: "9. Security",
    paragraphs: [
      "We use access controls, authenticated sessions, encrypted connections, managed infrastructure, and role-based administration intended to protect personal information. Passwords are handled through the authentication provider and are not displayed to website administrators.",
      "No internet service is completely secure. Keep your password confidential, use a unique password, verify payment instructions independently, and contact us promptly if you suspect unauthorized access. Never send private keys or recovery phrases.",
    ],
  },
  {
    title: "10. Your privacy rights",
    bullets: [
      "Request access to personal information and receive information about how it is processed.",
      "Request correction of inaccurate or incomplete information.",
      "Request deletion, restriction, or anonymization where the applicable law permits it.",
      "Object to certain processing based on legitimate interests or to direct marketing.",
      "Withdraw consent and change cookie choices at any time.",
      "Request a portable copy of eligible information.",
      "Complain to the relevant privacy or data-protection authority in your country or province.",
    ],
    after: "We may need to verify your identity before completing a request. Rights can be limited where information must be retained by law, is needed to protect other people, or is required for legal claims.",
  },
  {
    title: "11. Children",
    paragraphs: [
      "The website and investor workflow are intended for adults. We do not knowingly request account or investment information from children. If you believe a child has supplied personal information, contact us so the record can be reviewed and removed where appropriate.",
    ],
  },
  {
    title: "12. Automated decisions",
    paragraphs: [
      "The website may calculate modelled property values, yields, shares, or references. These calculations do not make a legally binding investment, credit, eligibility, or payment decision. Material requests require separate human review and confirmation.",
    ],
  },
  {
    title: "13. Changes to this policy",
    paragraphs: [
      "We may update this policy when the service, providers, legal requirements, or operating entity changes. The revised version will be posted here with a new effective date. Material changes may also be communicated through the website or by email where appropriate.",
    ],
  },
];

const cookies = [
  ["Supabase authentication cookies (names beginning with sb-)", "Necessary", "Maintain secure sign-in, refresh authenticated sessions, and protect account access.", "Session or provider-defined period"],
  ["brickwise-locale", "Preference", "Remember the selected or regionally resolved website language.", "Up to 12 months"],
  ["brickwise-locale-manual", "Necessary (functional)", "Remember that you chose the website language manually, so it is not changed automatically.", "Up to 12 months"],
  ["brickwise-marketing-consent", "Consent preference (local storage)", "Remember whether Meta marketing tracking was accepted or rejected.", "Until cleared or changed by you"],
  ["Meta Pixel cookies and identifiers", "Marketing", "Measure page visits, registration events, and advertising performance after explicit consent.", "As determined by Meta and your browser settings"],
  ["Google Ads cookies and identifiers (AW-18367220713)", "Marketing", "Measure visits, conversions, and advertising performance after explicit consent.", "As determined by Google and your browser settings"],
  ["brickwise-pending-otp-email", "Temporary session storage", "Temporarily support an email verification flow when that feature is used.", "Until the browser tab/session ends or the value is removed"],
];

export default async function PrivacyPage() {
  const locale = normalizeLocale((await requestCookies()).get(localeCookieName)?.value) || "en";
  const text = locale === "en" ? null : privacyTranslations[locale];
  const visibleSections: PrivacySection[] = text?.sections || sections;
  const visibleCookies = text?.cookies || cookies;
  return (
    <main className="bg-canvas text-ink">
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-36">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{text?.eyebrow || "Legal and privacy information"}</p>
        <h1 className="font-display mt-4 text-5xl font-bold leading-tight sm:text-6xl">{text?.title || "Privacy and Cookies"}</h1>
        <p className="mt-6 max-w-4xl text-xl leading-8 text-slate-600">
          {text?.intro || "This policy explains how personal information is collected, used, shared, protected, and controlled when you use the BRICKWISE platform."}
        </p>

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-y border-slate-300 py-5 text-sm text-slate-600">
          <p><strong className="text-ink">{text?.effective || "Effective date:"}</strong> {text?.date || "23 October 2026"}</p>
          <p><strong className="text-ink">{text?.contact || "Contact:"}</strong> <a className="underline" href="mailto:privacy@brickwise-immo.de">privacy@brickwise-immo.de</a></p>
          <p><strong className="text-ink">{text?.choices || "Cookie choices:"}</strong> {text?.choicesText || "use the “Cookie settings” button at the bottom of the website."}</p>
        </div>

        <nav aria-label={text?.contents || "Privacy policy contents"} className="mt-10 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">{text?.contents || "Contents"}</h2>
          <div className="mt-4 grid gap-2 text-brand sm:grid-cols-2">
            {visibleSections.map((section, index) => (
              <a key={section.title} href={`#privacy-${index + 1}`} className="underline-offset-4 hover:underline">{section.title}</a>
            ))}
            <a href="#cookie-details" className="underline-offset-4 hover:underline">{text?.storage || "Cookie and storage details"}</a>
          </div>
        </nav>

        <div className="mt-14 space-y-12 text-lg leading-8 text-slate-700">
          {visibleSections.map((section, index) => (
            <section key={section.title} id={`privacy-${index + 1}`} className="scroll-mt-28 border-t border-slate-300 pt-8">
              <h2 className="text-3xl font-bold text-ink">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4">{paragraph}</p>)}
              {section.bullets && (
                <ul className="mt-5 list-disc space-y-3 pl-6">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {section.after && <p className="mt-5">{section.after}</p>}
            </section>
          ))}
        </div>

        <section id="cookie-details" className="mt-14 scroll-mt-28 border-t border-slate-300 pt-8">
          <h2 className="text-3xl font-bold">{text?.storage || "Cookie and storage details"}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            {text?.storageText || "Necessary technologies operate the website and authenticated sessions. Meta Pixel and Google Ads remain disabled unless you select “Accept marketing”. Rejecting marketing does not prevent account, security, language, or other necessary functions."}</p>
          <div tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-brand mt-7 overflow-x-auto rounded-2xl border border-slate-300 bg-white">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="bg-ink text-white">
                <tr>{(text?.headings || ["Technology", "Category", "Purpose", "Typical duration"]).map((heading) => <th key={heading} className="px-5 py-4">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {visibleCookies.map((row) => (
                  <tr key={row[0]} className="border-t border-slate-200 align-top">
                    {row.map((cell) => <td key={cell} className="px-5 py-4 leading-6 text-slate-700">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-7 rounded-2xl bg-brand-soft p-6 text-slate-700">
            <h3 className="text-xl font-bold text-ink">{text?.managing || "Managing cookies"}</h3>
            <p className="mt-3 leading-7">{text?.managingText || "Use the persistent “Cookie settings” control to accept or reject optional marketing tracking. You can also delete browser cookies and local storage through your browser settings. Blocking necessary cookies may prevent sign-in or other account features from working correctly."}</p>
          </div>
        </section>

        <div className="mt-14 rounded-2xl bg-ink p-7 text-white sm:p-9">
          <h2 className="text-3xl font-bold">{text?.rights || "Contact or exercise your rights"}</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/80">{text?.rightsText || "Email privacy@brickwise-immo.de with the subject “Privacy request”. Describe the request and the email associated with your account. Do not send passwords, private keys, or identity documents unless specifically requested through a secure process."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:privacy@brickwise-immo.de?subject=Privacy%20request" className="bg-brand px-6 py-3 font-bold text-white rounded-lg">{text?.send || "Send privacy request"}</a>
            <Link href="/risk" className="border border-white/60 px-6 py-3 font-bold text-white">{text?.risks || "Read risk warnings"}</Link>
          </div>
        </div>

        <p className="mt-10 text-sm leading-6 text-slate-500">{text?.note || "This policy provides transparency about the website’s current data practices. It is not legal advice and should be reviewed when the final operating entity, regulated activities, or service providers change."}</p>
      </section>
    </main>
  );
}
