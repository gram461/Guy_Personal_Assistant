import { isApp, isWeb } from './bridge'
import { Empty, Header } from './parts'
import type { Synergy } from './useSynergy'

// What Personal and Email show until Google is connected. Nothing is read from Google until the person signs in.
export function GoogleConnect({ app, eyebrow, title, what, again }: { app: Synergy; eyebrow: string; title: string; what: string; again?: boolean }) {
  const configured = app.data.google?.configured ?? false
  return (
    <>
      <Header eyebrow={eyebrow} title={title} />
      {!configured ? (
        <Empty title="Google isn't set up yet">
          <p>
            {isApp()
              ? "Calendar and email aren't in the phone app yet, because Google doesn't allow signing in inside an app's own window. They're on the Synergy website. Your Schoology grades work as usual."
              : "This version of Synergy was made without a Google client ID, so it can't connect to Google. Your Schoology grades work as usual."}
          </p>
        </Empty>
      ) : (
        <Empty title={again ? 'Sign in with Google again' : `Connect ${what}`}>
          <p>
            {again
              ? 'Google no longer accepts the saved sign-in, so nothing can be shown until you sign in again.'
              : `Synergy can show ${what} here. It only reads, and never changes, sends, or deletes anything.`}{' '}
            {isWeb()
              ? "You sign in on Google's own page. Synergy keeps the sign-in encrypted on its server so it can read for you while you're signed in."
              : "You sign in on Google's own page in your normal browser, and the sign-in is kept encrypted on this computer."}
          </p>
          <button type="button" className="primary" disabled={app.googleBusy} onClick={() => void app.connectGoogle()}>
            {app.googleBusy ? 'Waiting for Google…' : again ? 'Sign in with Google' : 'Connect Google'}
          </button>
        </Empty>
      )}
    </>
  )
}
