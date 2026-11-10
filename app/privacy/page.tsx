import type { Metadata } from 'next'
import { H2, LegalPage, List } from '@/components/LegalPage'
import { APP_NAME, CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = { title: `Privacy policy - ${APP_NAME}` }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {APP_NAME} is a personal assistant for adults that shows your school assignments and grades, your calendar, and your
        inbox in one place. This policy explains what information {APP_NAME} uses, why, who else receives it, and how you can
        delete it. For questions, write to <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <H2>What {APP_NAME} accesses</H2>
      <p>You choose what to connect. {APP_NAME} only reads the following, and never changes, sends, or deletes anything in your accounts.</p>
      <List>
        <li>
          <strong>Your Google account:</strong> your name, email address, profile picture, and a Google account ID, to sign you in.
        </li>
        <li>
          <strong>Google Calendar (read-only):</strong> the titles, times, and locations of events on your primary calendar for the
          next 14 days.
        </li>
        <li>
          <strong>Gmail (read-only):</strong> for the 20 most recent inbox messages, the sender, subject, date, a short preview
          snippet, and whether the message is unread. {APP_NAME} does not read the full body of your email or your attachments.
        </li>
        <li>
          <strong>Schoology, if you connect it:</strong> your class names, teachers, assignments, due dates, and grades.
        </li>
        <li>
          <strong>Settings you create:</strong> the name you want to be called, notification choices, which assignments you marked
          done, and a device token so your phone can receive notifications.
        </li>
      </List>

      <H2>How {APP_NAME} uses it</H2>
      <p>
        Only to show you your own information in the app, to send the notifications you turn on, and to write your daily summary.
        {' '}{APP_NAME} does not show ads, does not sell your data, and does not use it for anything else.
      </p>

      <H2>Who else receives it</H2>
      <List>
        <li>
          <strong>Anthropic (Claude):</strong> to write your daily summary and flag high-stakes assignments, {APP_NAME} sends the
          titles and times of your calendar events and the titles and due dates of your assignments. Your email is not sent to
          Anthropic.
        </li>
        <li>
          <strong>Service providers that run {APP_NAME}:</strong> Vercel (hosting), Supabase (database), and Google Firebase
          (notifications). They process data only to provide the service.
        </li>
        <li>We do not share your information with anyone else, except if the law requires it.</li>
      </List>

      <H2>Google user data and Limited Use</H2>
      <p>
        {APP_NAME}&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{' '}
        <a className="text-primary underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. In particular, {APP_NAME} uses Google data only to provide and improve the
        features you see in the app, does not transfer it to others except as described above, does not use it for advertising,
        and does not let people read it (except with your consent, to investigate abuse, or as required by law). Google data
        is not used to develop, improve, or train generalized AI or machine-learning models.
      </p>

      <H2>How it is stored and protected</H2>
      <List>
        <li>
          Your Google sign-in is saved on our server as an encrypted token (AES-256-GCM). Short-lived access tokens are kept in
          memory only and are never sent to your browser.
        </li>
        <li>
          Calendar events and email details are fetched when needed and shown to you. They are not saved, apart from the text of
          your daily summary.
        </li>
        <li>Data is kept separate for each person, and the connection to our database is encrypted in transit.</li>
      </List>

      <H2>The desktop app</H2>
      <p>
        The {APP_NAME} desktop app keeps your Schoology grades and the scores you enter in encrypted files on your own computer.
        We do not receive them. Your Schoology password is never saved.
      </p>

      <H2>Keeping and deleting your data</H2>
      <p>
        Data is kept until you delete it. Choose <strong>Delete my data</strong> in Settings to remove your account, settings,
        saved Google sign-in, notification devices, and daily summaries, and to revoke {APP_NAME}&apos;s access to your Google account.
        You can also remove access any time at{' '}
        <a className="text-primary underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        If you cannot use the button, email us and we will delete your data.
      </p>

      <H2>Who may use {APP_NAME}</H2>
      <p>{APP_NAME} is for adults aged 18 and over. We do not knowingly collect information from anyone younger.</p>

      <H2>Changes</H2>
      <p>If this policy changes, the date above will change, and we will say so in the app if the change is significant.</p>
    </LegalPage>
  )
}
