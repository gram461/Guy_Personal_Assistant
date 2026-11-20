'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isInstalledApp } from '@/Guy-Scraper/desktop/ui/bridge'

// An installed copy of the site that was added before it opened at /app still opens on the home page.
// Inside an installed app, go straight to the app. In a normal browser tab this does nothing.
export default function StandaloneRedirect() {
  const router = useRouter()
  useEffect(() => {
    if (isInstalledApp()) router.replace('/app')
  }, [router])
  return null
}
