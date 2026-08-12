'use client'

import { useEffect, useState } from 'react'
import TodayTab from '@/components/TodayTab'
import SchoolTab from '@/components/SchoolTab'
import PersonalTab from '@/components/PersonalTab'
import InboxTab from '@/components/InboxTab'
import SettingsTab from '@/components/SettingsTab'
import { TabBar, type TabKey } from '@/components/dashboard/tab-bar'

function LiveZoomDebug({ tab }: { tab: TabKey }) {
  const [reading, setReading] = useState('')

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport
      setReading(
        `tab: ${tab} | scale ${vv ? vv.scale.toFixed(2) : 'n/a'} | ` +
        `width ${window.innerWidth}px | vvWidth ${vv ? Math.round(vv.width) : 'n/a'}px`
      )
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    const id = setInterval(update, 500)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      clearInterval(id)
    }
  }, [tab])

  return (
    <div className="fixed inset-x-0 top-0 z-[100] break-words bg-yellow-400 p-2 text-[11px] font-bold text-black">
      {reading}
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('today')

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <LiveZoomDebug tab={activeTab} />
      <div key={activeTab} className="flex-1 overflow-y-auto tab-transition">
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'school' && <SchoolTab />}
        {activeTab === 'personal' && <PersonalTab />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  )
}
