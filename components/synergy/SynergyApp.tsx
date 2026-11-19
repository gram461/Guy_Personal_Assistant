'use client'

import { useState } from 'react'
import { App } from '@/Guy-Scraper/desktop/ui/App'
import '@/Guy-Scraper/desktop/ui/styles.css'
import { webBridge } from './webBridge'

// The same screens the desktop app shows, running in the browser with the website's own bridge in place of the desktop program.
export default function SynergyApp() {
  const [ready] = useState(() => {
    window.synergy = webBridge
    return true
  })
  return ready ? <App /> : null
}
