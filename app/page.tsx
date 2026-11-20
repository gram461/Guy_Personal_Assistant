import Link from 'next/link'
import StandaloneRedirect from '@/components/StandaloneRedirect'
import { APP_NAME } from '@/lib/legal'

// The public home page: what Synergy is, what it reads and why, and where to find the policies.
// Everything here is plain text and links, so it reads the same to a visitor, a search engine, or a Google reviewer.
export default function HomePage() {
  return (
    <main style={{ background: '#f4f5f9', color: '#161a2e', minHeight: '100dvh' }}>
      <StandaloneRedirect />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-12">
        <header className="flex flex-col gap-4">
          <div className="text-sm font-semibold tracking-wide" style={{ color: '#2536b8' }}>{APP_NAME}</div>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight">Your grades, calendar and inbox in one calm place.</h1>
          <p className="text-lg leading-relaxed" style={{ color: '#3a4060' }}>
            {APP_NAME} is a personal assistant for adults. It shows your Schoology assignments and grades, lets you try out how a score would change your
            grade, and shows your Google Calendar and Gmail inbox next to them.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/app" className="inline-flex h-12 items-center rounded-xl px-6 text-base font-semibold text-white" style={{ background: '#3347e6' }}>
              Open {APP_NAME}
            </Link>
          </div>
        </header>

        <section aria-labelledby="what-h" className="flex flex-col gap-4">
          <h2 id="what-h" className="text-2xl font-bold">What it does</h2>
          <ul className="flex flex-col gap-3 text-base leading-relaxed" style={{ color: '#3a4060' }}>
            <li><strong style={{ color: '#161a2e' }}>School.</strong> See every class, its categories and each assignment, and enter a score to see how your grade would change. The desktop app reads your grades from Schoology and keeps them in an encrypted file on your own computer. On the website you load that file, and it stays in your browser.</li>
            <li><strong style={{ color: '#161a2e' }}>Personal.</strong> Your Google Calendar, one week at a time.</li>
            <li><strong style={{ color: '#161a2e' }}>Email.</strong> Your Gmail inbox, with sender, subject, time and a short preview. Open any message in Gmail to read or reply.</li>
          </ul>
        </section>

        <section aria-labelledby="google-h" className="flex flex-col gap-4">
          <h2 id="google-h" className="text-2xl font-bold">How {APP_NAME} uses your Google data</h2>
          <p className="text-base leading-relaxed" style={{ color: '#3a4060' }}>
            When you sign in with Google, {APP_NAME} asks to read your calendar and your inbox. It only reads: it never sends, changes or deletes
            anything. It shows you the next days of your calendar and the sender, subject, time and short preview of your latest emails. It does not read the full
            text of your messages, does not use your Google data for advertising, and does not sell it. You can remove access at any time with Delete my data in Settings,
            or at <a href="https://myaccount.google.com/permissions" style={{ color: '#2536b8', textDecoration: 'underline' }}>myaccount.google.com/permissions</a>.
          </p>
          <p className="text-base leading-relaxed" style={{ color: '#3a4060' }}>
            {APP_NAME}&apos;s use and transfer of information received from Google APIs adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: '#2536b8', textDecoration: 'underline' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
            Read the full <Link href="/privacy" style={{ color: '#2536b8', textDecoration: 'underline' }}>privacy policy</Link>.
          </p>
        </section>

        <footer className="flex flex-wrap gap-5 border-t pt-6 text-sm" style={{ borderColor: '#e3e6ef', color: '#5b6178' }}>
          <Link href="/privacy" className="hover:underline">Privacy policy</Link>
          <Link href="/terms" className="hover:underline">Terms of service</Link>
          <span>For adults aged 18 and over.</span>
        </footer>
      </div>
    </main>
  )
}
