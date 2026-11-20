'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { App } from '@/Guy-Scraper/desktop/ui/App'
import '@/Guy-Scraper/desktop/ui/styles.css'
import { createAppBridge } from './appBridge'
import type { InAppBrowserLike } from './nativeSignIn'
import { createGradesReceiver, TRUSTED_ORIGIN } from './receiveGrades'
import { webBridge } from './webBridge'

// The same screens the desktop app shows, running in the browser with the website's own bridge in place of the desktop program.
// The helper that reads Schoology inside the phone app's sign-in window, fetched once from this site.
let helperCode: Promise<string> | null = null
const loadHelperCode = () => (helperCode ??= fetch('/synergy-native-grabber.js').then(res => (res.ok ? res.text() : Promise.reject(new Error('helper missing')))))

// In the phone app the website runs inside a native shell, and the Schoology sign-in is the shell's own window.
function chooseBridge() {
  if (!Capacitor.isNativePlatform()) return webBridge
  return createAppBridge(webBridge, {
    plugin: registerPlugin<InAppBrowserLike>('InAppBrowser'),
    loadHelperCode,
    schoologyOrigin: TRUSTED_ORIGIN,
  })
}

export default function SynergyApp() {
  const [ready] = useState(() => {
    window.synergy = chooseBridge()
    return true
  })

  // Grades sent from the person's own Schoology tab by the "Get my grades" bookmark.
  useEffect(() => {
    const receive = createGradesReceiver({
      importGrades: text => webBridge.importGrades!(text),
      onImported: message => window.dispatchEvent(new CustomEvent('synergy:grades-changed', { detail: { message } })),
    })
    const listener = (event: MessageEvent) => void receive(event)
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  return ready ? <App /> : null
}
