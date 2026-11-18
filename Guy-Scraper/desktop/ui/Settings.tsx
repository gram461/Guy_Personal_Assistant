import { syncedLabel } from './dates'
import { Header } from './parts'
import { useDisplayName } from './prefs'
import type { Synergy } from './useSynergy'

export function Settings({ app }: { app: Synergy }) {
  const [name, setName] = useDisplayName()
  const { status, google } = app.data
  const signedIn = status?.signedIn ?? false
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
            <div className="sub">{signedIn ? `Your password is never saved. ${syncedLabel(status?.lastSyncedAt ?? null, new Date())}.` : 'Sign in to bring your grades here. Your password is never saved.'}</div>
          </div>
          <span className={`chip ${signedIn ? 'green' : 'gray'}`}>{signedIn ? 'Connected' : 'Not connected'}</span>
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
          <button type="button" className={signedIn ? 'secondary' : 'primary'} disabled={app.syncing} onClick={() => void app.signIn()}>
            {app.syncing ? 'Signing in…' : signedIn ? 'Sign in again or switch account' : 'Sign in to Schoology'}
          </button>
          {signedIn && <button type="button" className="secondary" onClick={() => void app.signOut()}>Sign out of Schoology</button>}
          {google?.connected && <button type="button" className="secondary" onClick={() => void app.disconnectGoogle()}>Disconnect Google</button>}
          {google?.configured && !google.connected && (
            <button type="button" className="primary" disabled={app.googleBusy} onClick={() => void app.connectGoogle()}>{app.googleBusy ? 'Waiting for Google…' : 'Connect Google'}</button>
          )}
        </div>
      </section>

      <section className="card stack" aria-labelledby="data-h">
        <h2 id="data-h">Your data stays on this computer</h2>
        <p className="body">Your grades and the scores you enter are saved in encrypted files here. Nobody else, including the people who made Synergy, can open them.</p>
        <div className="buttons">
          <button type="button" className="primary" onClick={() => void app.exportTsv()}>Export as TSV</button>
          <button type="button" className="secondary" onClick={() => void app.openFolder()}>Show data folder</button>
        </div>
        <div className="hint flush">An exported file is a plain copy that anyone who can open it can read.</div>
      </section>

      <section className="card stack danger" aria-labelledby="danger-h">
        <h2 id="danger-h">Delete my data</h2>
        <p className="body">This permanently erases your saved grades, the scores you entered, and your Schoology sign-in from this computer. It cannot be undone, and you will be asked to confirm.</p>
        <button type="button" className="danger-button" onClick={() => void app.deleteData()}>Delete my data…</button>
      </section>
    </>
  )
}
