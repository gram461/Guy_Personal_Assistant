import { useCallback, useState } from 'react'

// Small conveniences kept in this window's own storage: the name to greet and the assignments checked off.
// Delete my data clears them along with everything else.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage isn't available: the choice just won't be remembered.
  }
}

const NAME_KEY = 'bessy-name'
const DONE_KEY = 'bessy-done'
const MAX_NAME = 40
const MAX_DONE = 500

export function useDisplayName(): [string, (name: string) => void] {
  const [name, setName] = useState(() => (read(NAME_KEY) ?? '').slice(0, MAX_NAME))
  const change = useCallback((next: string) => {
    const kept = next.slice(0, MAX_NAME)
    setName(kept)
    write(NAME_KEY, kept)
  }, [])
  return [name, change]
}

function readDone(): string[] {
  try {
    const parsed: unknown = JSON.parse(read(DONE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(-MAX_DONE) : []
  } catch {
    return []
  }
}

export function useDoneAssignments(): [Set<string>, (id: string) => void] {
  const [done, setDone] = useState(() => new Set(readDone()))
  const toggle = useCallback((id: string) => {
    setDone(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(DONE_KEY, JSON.stringify([...next].slice(-MAX_DONE)))
      return next
    })
  }, [])
  return [done, toggle]
}
