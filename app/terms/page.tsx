import type { Metadata } from 'next'
import { H2, LegalPage, List } from '@/components/LegalPage'
import { APP_NAME, CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = { title: `Terms of service - ${APP_NAME}` }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms apply when you use {APP_NAME}. By signing in you agree to them. If you do not agree, please do not use{' '}
        {APP_NAME}.
      </p>

      <H2>Who can use it</H2>
      <p>You must be 18 or older. You are responsible for what happens under your account.</p>

      <H2>What {APP_NAME} does</H2>
      <p>
        {APP_NAME} shows your school assignments and grades, your Google Calendar events, and your Gmail inbox in one place, and
        can send you reminders and a daily summary. It only reads your accounts, and never sends, changes, or deletes anything in
        them. How your information is handled is described in the{' '}
        <a className="text-primary underline" href="/privacy">privacy policy</a>.
      </p>

      <H2>Your accounts</H2>
      <List>
        <li>Connect only accounts that belong to you, or that you have permission to connect.</li>
        <li>Follow the rules of the services you connect, such as Google and Schoology, including your school&apos;s rules.</li>
        <li>You can disconnect or delete your data at any time with <strong>Delete my data</strong> in Settings.</li>
      </List>

      <H2>Grades and dates are estimates</H2>
      <p>
        {APP_NAME} reads information from your school&apos;s system and calculates some numbers itself, so what you see may be late,
        incomplete, or different from what your school shows. Scores you type in to see how your grade would change are your own
        estimates. Always check important grades and due dates with your school. Nothing in {APP_NAME} is an official record.
      </p>

      <H2>Using it fairly</H2>
      <p>Do not try to break {APP_NAME}, get into other people&apos;s data, overload it, or use it to break the law or anyone&apos;s rules.</p>

      <H2>No warranty</H2>
      <p>
        {APP_NAME} is provided &ldquo;as is&rdquo;, without promises that it will always work, be accurate, or be available.
      </p>

      <H2>Limit of responsibility</H2>
      <p>
        To the extent the law allows, {APP_NAME} is not responsible for missed deadlines, grades, or other losses that result
        from using it or from it being unavailable.
      </p>

      <H2>Ending and changes</H2>
      <p>
        You can stop using {APP_NAME} at any time. We may change or stop the service, or change these terms. If the terms change,
        the date above will change, and continuing to use {APP_NAME} means you accept them.
      </p>

      <H2>Contact</H2>
      <p>
        Questions? Write to <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
