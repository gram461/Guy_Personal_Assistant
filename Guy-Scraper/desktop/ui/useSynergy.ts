import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dashboard } from '../../dashboard'
import type { Gradebook } from '../../gradebook'
import { emptyEdits, type SavedEdits } from '../../savedEdits'
import { synergy, failureText, type Status } from './bridge'

const SAVE_DELAY_MS = 400

export type Data = {
  status: Status | null
  gradebook: Gradebook | null
  dashboard: Dashboard | null
  edits: SavedEdits
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
  changeEdits: (change: (edits: SavedEdits) => SavedEdits) => void
  reload: () => Promise<void>
  signOut: () => Promise<void>
  exportTsv: () => Promise<void>
  openFolder: () => Promise<void>
  deleteData: () => Promise<void>
}

const nothing: Data = { status: null, gradebook: null, dashboard: null, edits: emptyEdits() }

export function useSynergy(): Synergy {
  const [data, setData] = useState<Data>(nothing)
  const [loaded, setLoaded] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

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

  const reload = useCallback(async () => {
    // Anything typed a moment ago is saved first, so loading can't bring back the old version.
    await flush()
    const [status, gradebook, dashboard, edits] = await Promise.all([synergy().status(), synergy().gradebook(), synergy().dashboard(), synergy().edits()])
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
      setData({ status, gradebook, dashboard, edits: editsRef.current })
    }
    setLoaded(true)
  }, [flush])

  useEffect(() => {
    void reload()
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
    sync, changeEdits, reload, signOut, exportTsv, openFolder, deleteData,
  }
}
