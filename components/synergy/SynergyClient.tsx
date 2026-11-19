'use client'

import dynamic from 'next/dynamic'

// The screens read the browser's own storage and the sign-in, so they are only drawn in the browser.
const SynergyApp = dynamic(() => import('./SynergyApp'), { ssr: false })

export default function SynergyClient() {
  return <SynergyApp />
}
