import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dashboard } from '../../dashboard'
import type { Gradebook } from '../../gradebook'
import { emptyEdits, type SavedEdits } from '../../savedEdits'
import { synergy, failureText, type GoogleStatus, type MailMessage, type Status } from './bridge'

const SAVE_DELAY_MS = 400

export type Data = {
  status: Status | null
  gradebook: Gradebook | null
  dashboard: Dashboard | null
  edits: SavedEdits
  // null until the first load finishes
  google: GoogleStatus | null
}

// The inbox, kept here so the tab bar can show the unread count and the Email screen opens already filled.
export type Mail = {
  messages: MailMessage[] | null
  loading: boolean
  error: string | null
  // Google no longer accepts the saved sign-in.
  needsReconnect: boolean
}

export type Synergy = {
  loaded: boolean
  data: Data
  // Something went wrong loading or saving; shown at the top of every screen.
  problem: string | null
  syncing: boolean
  // The result of the last sync, shown once.
  notice: string | null
  dismiss: () => void
  sync: () => Promise<void>
  // Opens the Schoology login window every time, to sign in again or switch accounts, then syncs.
  signIn: () => Promise<void>
  // Website only: loads a grades file the person chose.
  importGrades: (text: string) => Promise<void>
  tooBig: () => void
  changeEdits: (change: (edits: SavedEdits) => SavedEdits) => void
  reload: () => Promise<void>
  signOut: () => Promise<void>
  exportTsv: () => Promise<void>
  openFolder: () => Promise<void>
  deleteData: () => Promise<void>
  mail: Mail
  refreshMail: () => Promise<void>
  googleBusy: boolean
  connectGoogle: () => Promise<void>
  disconnectGoogle: () => Promise<void>
}

const nothing: Data = { status: null, gradebook: null, dashboard: null, edits: emptyEdits(), google: null }
const noMail: Mail = { messages: null, loading: false, error: null, needsReconnect: false }

export function useSynergy(): Synergy {
  const [data, setData] = useState<Data>(nothing)
  const [loaded, setLoaded] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [mail, setMail] = useState<Mail>(noMail)
  const [googleBusy, setGoogleBusy] = useState(false)

  const editsRef = useRef<SavedEdits>(data.edits)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    if (!dirty.current) return
    dirty.current = false
    const result = await synergy().saveEdits(editsRef.current)
    if (!result.ok) {
      dirty.current = true
      setProblem(failureText(result, "Your changes couldn't be saved."))
    }
  }, [])

  const refreshMail = useCallback(async () => {
    setMail(current => ({ ...current, loading: true, error: null }))
    const result = await synergy().mail()
    if (result.ok) setMail({ messages: result.messages, loading: false, error: null, needsReconnect: false })
    else if (result.reconnect) setMail({ messages: null, loading: false, error: null, needsReconnect: true })
    else setMail(current => ({ ...current, loading: false, error: failureText(result, "Your email couldn't be loaded.") }))
  }, [])

  const reload = useCallback(async () => {
    // Anything typed a moment ago is saved first, so loading can't bring back the old version.
    await flush()
    const [status, gradebook, dashboard, edits, googleResult] = await Promise.all([synergy().status(), synergy().gradebook(), synergy().dashboard(), synergy().edits(), synergy().googleStatus()])
    // Google being unavailable never stops the grades from showing.
    const google = googleResult.ok ? { configured: googleResult.configured, connected: googleResult.connected, email: googleResult.email } : null
    const failed = [status, gradebook, dashboard, edits].find(r => !r.ok)
    if (failed && !failed.ok) {
      setProblem(failureText(failed, "Your saved grades couldn't be opened."))
      setLoaded(true)
      return
    }
    if (status.ok && gradebook.ok && dashboard.ok && edits.ok) {
      // If something was typed while this loaded, that is newer than what was read.
      if (!dirty.current) editsRef.current = edits.edits
      setProblem(null)
      setData({ status, gradebook, dashboard, edits: editsRef.current, google })
      if (google?.connected) void refreshMail()
      else setMail(noMail)
    }
    setLoaded(true)
  }, [flush, refreshMail])

  useEffect(() => {
    void reload()
  }, [reload])

  // The website can be handed grades by the person's own Schoology tab at any moment; the screens refresh when that happens.
  useEffect(() => {
    const onChanged = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message
      void reload().then(() => {
        if (message) setNotice(message)
      })
    }
    window.addEventListener('synergy:grades-changed', onChanged)
    return () => window.removeEventListener('synergy:grades-changed', onChanged)
  }, [reload])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flush])

  const changeEdits = useCallback(
    (change: (edits: SavedEdits) => SavedEdits) => {
      const next = change(editsRef.current)
      if (next === editsRef.current) return
      editsRef.current = next
      dirty.current = true
      setData(current => ({ ...current, edits: next }))
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush],
  )

  const sync = useCallback(async () => {
    setSyncing(true)
    setNotice(null)
    try {
      const result = await synergy().sync()
      if (!result.ok) {
        setNotice(failureText(result, "Couldn't sync with Schoology."))
        return
      }
      await reload()
      setNotice(`Synced ${result.classes} ${result.classes === 1 ? 'class' : 'classes'} and ${result.assignments} ${result.assignments === 1 ? 'assignment' : 'assignments'}.`)
    } finally {
      setSyncing(false)
    }
  }, [reload])

  const signIn = useCallback(async () => {
    setSyncing(true)
    setNotice(null)
    try {
      const result = await synergy().signIn()
      if (!result.ok) {
        setNotice(failureText(result, "Couldn't sign in to Schoology."))
        await reload()
        return
      }
      await reload()
      setNotice(`Signed in. Synced ${result.classes} ${result.classes === 1 ? 'class' : 'classes'} and ${result.assignments} ${result.assignments === 1 ? 'assignment' : 'assignments'}.`)
    } finally {
      setSyncing(false)
    }
  }, [reload])

  const importGrades = useCallback(
    async (text: string) => {
      setSyncing(true)
      setNotice(null)
      try {
        const result = await synergy().importGrades?.(text)
        if (!result || !result.ok) {
          setNotice(result ? failureText(result, "That file couldn't be loaded.") : "Loading a grades file isn't available here.")
          return
        }
        await reload()
        setNotice(`Loaded ${result.classes} ${result.classes === 1 ? 'class' : 'classes'} and ${result.assignments} ${result.assignments === 1 ? 'assignment' : 'assignments'}.`)
      } finally {
        setSyncing(false)
      }
    },
    [reload],
  )

  const connectGoogle = useCallback(async () => {
    setGoogleBusy(true)
    setNotice(null)
    try {
      const result = await synergy().googleConnect()
      if (!result.ok) {
        setNotice(failureText(result, "Couldn't connect Google."))
        return
      }
      await reload()
      setNotice(`Google connected${result.email ? ` as ${result.email}` : ''}.`)
    } finally {
      setGoogleBusy(false)
    }
  }, [reload])

  const disconnectGoogle = useCallback(async () => {
    const result = await synergy().googleDisconnect()
    if (!result.ok) setNotice(failureText(result, "Couldn't disconnect Google."))
    else {
      setNotice('Disconnected from Google. Your calendar and email are no longer shown here.')
      await reload()
    }
  }, [reload])

  const signOut = useCallback(async () => {
    const result = await synergy().signOut()
    if (!result.ok) setNotice(failureText(result, "Couldn't sign out."))
    else {
      setNotice('Signed out of Schoology. Your saved grades are still here.')
      await reload()
    }
  }, [reload])

  const exportTsv = useCallback(async () => {
    const result = await synergy().exportTsv()
    if (result.ok) setNotice(`Saved a plain copy to ${result.path}.`)
    else if (!result.canceled) setNotice(failureText(result, "Couldn't export your grades."))
  }, [])

  const openFolder = useCallback(async () => {
    const result = await synergy().openFolder()
    if (!result.ok) setNotice(failureText(result, "Couldn't open the folder."))
  }, [])

  const deleteData = useCallback(async () => {
    const result = await synergy().deleteData()
    if (result.ok) {
      // Starts the window over, which also drops the name and checkmarks it kept.
      dirty.current = false
      window.location.reload()
    } else if (!result.canceled) setNotice(failureText(result, "Couldn't delete your data."))
  }, [])

  return {
    loaded, data, problem, syncing, notice,
    dismiss: () => { setNotice(null); setProblem(null) },
    sync, signIn, importGrades, tooBig: () => setNotice('That file is too large to be a grades file.'), changeEdits, reload, signOut, exportTsv, openFolder, deleteData,
    mail, refreshMail, googleBusy, connectGoogle, disconnectGoogle,
  }
}
