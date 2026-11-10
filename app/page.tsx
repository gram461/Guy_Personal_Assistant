'use client'

import { useState } from 'react'
import TodayTab from '@/components/TodayTab'
import SchoolTab from '@/components/SchoolTab'
import PersonalTab from '@/components/PersonalTab'
import InboxTab from '@/components/InboxTab'
import SettingsTab from '@/components/SettingsTab'
import Link from 'next/link'
import { TabBar, type TabKey } from '@/components/dashboard/tab-bar'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('today')

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <div key={activeTab} className="flex-1 overflow-y-auto tab-transition">
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'school' && <SchoolTab />}
        {activeTab === 'personal' && <PersonalTab />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'settings' && <SettingsTab />}
        <footer className="flex justify-center gap-5 px-4 pb-28 pt-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:underline">Privacy policy</Link>
          <Link href="/terms" className="hover:underline">Terms of service</Link>
        </footer>
      </div>
      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  )
}
