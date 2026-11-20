'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The service worker is for the website's push notifications. Inside the phone app it isn't used, and some phone web views don't support it.
    if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return <SessionProvider>{children}</SessionProvider>
}
