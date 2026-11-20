import { syncedLabel } from './dates'
import { isApp, isWeb } from './bridge'
import { Header, ImportButton, SchoologyHelp } from './parts'
import { useDisplayName } from './prefs'
import type { Synergy } from './useSynergy'

export function Settings({ app }: { app: Synergy }) {
  const [name, setName] = useDisplayName()
  const { status, google } = app.data
  const signedIn = status?.signedIn ?? false
  const web = isWeb()
  const phone = isApp()
  const initial = (name.trim()[0] ?? 'B').toUpperCase()

  return (
    <>
      <Header eyebrow="Customize Synergy" title="Settings" />

      <section className="card stack" aria-labelledby="profile-h">
        <h2 id="profile-h">Profile</h2>
        <div className="profile">
          <div className="avatar" aria-hidden="true">{initial}</div>
          <label className="field grow">
            <span>What should Synergy call you?</span>
            <input type="text" value={name} maxLength={40} autoComplete="off" onChange={e => setName(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card" aria-labelledby="acct-h">
        <h2 id="acct-h">Connected accounts</h2>
        <div className="line">
          <div className="grow">
            <div className="strong">Schoology</div>
            <div className="sub">
              {web
                ? signedIn ? `Loaded from a file you imported. ${syncedLabel(status?.lastSyncedAt ?? null, new Date())}.` : 'Load the grades file exported from the desktop app.'
                : signedIn ? `Your password is never saved. ${syncedLabel(status?.lastSyncedAt ?? null, new Date())}.` : 'Sign in to bring your grades here. Your password is never saved.'}
            </div>
          </div>
          <span className={`chip ${signedIn ? 'green' : 'gray'}`}>{web ? (signedIn ? 'Loaded' : 'No file') : signedIn ? 'Connected' : 'Not connected'}</span>
        </div>
        <div className="line">
          <div className="grow">
            <div className="strong">Google (Gmail and Calendar)</div>
            <div className="sub">
              {google?.connected
                ? `Read-only${google.email ? ` · ${google.email}` : ''}`
                : google?.configured
                  ? 'Connect to see your calendar and email here. Read-only.'
                  : "Not set up in this version of Synergy."}
            </div>
          </div>
          <span className={`chip ${google?.connected ? 'green' : 'gray'}`}>{google?.connected ? 'Connected' : google?.configured ? 'Not connected' : 'Not available'}</span>
        </div>
        <div className="buttons">
          {web ? (
            <>
              <ImportButton busy={app.syncing} className={signedIn ? 'secondary' : 'primary'} onText={text => void app.importGrades(text)} onTooBig={app.tooBig}>
                {app.syncing ? 'Loading…' : signedIn ? 'Import a newer file' : 'Import grades file'}
              </ImportButton>
              {signedIn && <button type="button" className="secondary" onClick={() => void app.signOut()}>Remove grades from this browser</button>}
            </>
          ) : (
            <>
              <button type="button" className={signedIn ? 'secondary' : 'primary'} disabled={app.syncing} onClick={() => void app.signIn()}>
                {app.syncing ? 'Signing in…' : signedIn ? 'Sign in again or switch account' : 'Sign in to Schoology'}
              </button>
              {signedIn && <button type="button" className="secondary" onClick={() => void app.signOut()}>Sign out of Schoology</button>}
            </>
          )}
          {google?.connected && <button type="button" className="secondary" onClick={() => void app.disconnectGoogle()}>Disconnect Google</button>}
          {google?.configured && !google.connected && (
            <button type="button" className="primary" disabled={app.googleBusy} onClick={() => void app.connectGoogle()}>{app.googleBusy ? 'Waiting for Google…' : 'Connect Google'}</button>
          )}
        </div>
      </section>

      {web && (
        <section className="card stack" aria-labelledby="get-h">
          <h2 id="get-h">Get your grades from Schoology</h2>
          <SchoologyHelp busy={app.syncing} onText={text => void app.importGrades(text)} onTooBig={app.tooBig} />
        </section>
      )}

      <section className="card stack" aria-labelledby="data-h">
        <h2 id="data-h">{web ? 'Your data stays in this browser' : phone ? 'Your data stays on this phone' : 'Your data stays on this computer'}</h2>
        <p className="body">
          {web
            ? 'Your grades and the scores you enter are kept in this browser only. They are never uploaded to Synergy, and clearing your browser data removes them.'
            : phone
              ? 'Your grades and the scores you enter are kept in this app on your phone. They are never uploaded to Synergy, and deleting the app removes them.'
              : 'Your grades and the scores you enter are saved in encrypted files here. Nobody else, including the people who made Synergy, can open them.'}
        </p>
        <div className="buttons">
          {!phone && <button type="button" className="primary" onClick={() => void app.exportTsv()}>{web ? 'Download as TSV' : 'Export as TSV'}</button>}
          {!web && !phone && <button type="button" className="secondary" onClick={() => void app.openFolder()}>Show data folder</button>}
        </div>
        <div className="hint flush">An exported file is a plain copy that anyone who can open it can read.</div>
      </section>

      <section className="card stack danger" aria-labelledby="danger-h">
        <h2 id="danger-h">Delete my data</h2>
        <p className="body">{web ? 'This permanently erases the grades you imported and the scores you entered from this browser, and your Synergy account and saved Google sign-in if you signed in. It cannot be undone, and you will be asked to confirm.' : `This permanently erases your saved grades, the scores you entered, and your Schoology sign-in from this ${phone ? 'phone' : 'computer'}. It cannot be undone, and you will be asked to confirm.`}</p>
        <button type="button" className="danger-button" onClick={() => void app.deleteData()}>Delete my data…</button>
      </section>
    </>
  )
}
