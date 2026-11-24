'use client'

import { useEffect, useRef, useState } from 'react'
import { isApp, isInstalledApp, isIosDevice } from '@/Guy-Scraper/desktop/ui/bridge'
import './installSheet.css'
import { openShareSheet, readDismissedAt, rememberDismissed, shouldOfferInstall } from './installLogic'

// A sheet that suggests putting Synergy on the Home Screen. Only shown in Safari on iPhone and iPad.
export default function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [manual, setManual] = useState(false)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const offer = shouldOfferInstall({
      ios: isIosDevice(),
      installed: isInstalledApp(),
      phoneApp: isApp(),
      dismissedAt: readDismissedAt(window.localStorage),
      now: Date.now(),
    })
    if (offer) setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    primary.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    rememberDismissed(window.localStorage, Date.now())
    setOpen(false)
  }

  async function add() {
    const outcome = await openShareSheet(navigator, window.location.origin + '/app')
    if (outcome === 'shared') close()
    else if (outcome === 'unavailable') setManual(true)
  }

  if (!open) return null

  return (
    <div className="install-scrim" onClick={close}>
      <div className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={event => event.stopPropagation()}>
        <img className="install-icon" src="/icon-192.png" alt="" width={64} height={64} />
        <h2 id="install-title">Get Synergy as an app</h2>
        <p>Add Synergy to your Home Screen to open it like an app, full screen, with its own icon.</p>
        <button ref={primary} type="button" className="install-primary" onClick={() => void add()}>
          Add to Home Screen
        </button>
        <p className="install-hint">
          {manual
            ? 'Tap the Share button at the bottom of Safari, then choose Add to Home Screen.'
            : 'This opens the iPhone share menu. Choose Add to Home Screen there.'}
        </p>
        <button type="button" className="install-later" onClick={close}>
          Not now
        </button>
      </div>
    </div>
  )
}
