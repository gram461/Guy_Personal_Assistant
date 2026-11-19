import type { Metadata } from 'next'
import SynergyClient from '@/components/synergy/SynergyClient'

export const metadata: Metadata = { title: 'Synergy' }

export default function AppPage() {
  return (
    <div style={{ background: '#f4f5f9', height: '100dvh' }}>
      <SynergyClient />
    </div>
  )
}
