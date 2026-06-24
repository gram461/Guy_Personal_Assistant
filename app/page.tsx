'use client'

import { useState } from 'react'
import TodayTab from '@/components/TodayTab'
import SchoolTab from '@/components/SchoolTab'
import PersonalTab from '@/components/PersonalTab'
import InboxTab from '@/components/InboxTab'
import SettingsTab from '@/components/SettingsTab'

type Tab = 'today' | 'school' | 'personal' | 'inbox' | 'settings'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('today')

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-xl flex flex-col" style={{ minHeight: '780px' }}>
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'today' && <TodayTab />}
          {activeTab === 'school' && <SchoolTab />}
          {activeTab === 'personal' && <PersonalTab />}
          {activeTab === 'inbox' && <InboxTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
        <div className="border-t border-gray-200 px-2 py-3 flex justify-around bg-white shrink-0">
          <NavButton label="Today" emoji="🏠" active={activeTab === 'today'} onClick={() => setActiveTab('today')} />
          <NavButton label="School" emoji="🎓" active={activeTab === 'school'} onClick={() => setActiveTab('school')} />
          <NavButton label="Personal" emoji="👤" active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} />
          <NavButton label="Inbox" emoji="✉️" active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} />
          <NavButton label="Settings" emoji="⚙️" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </div>
    </div>
  )
}

function NavButton({ label, emoji, active, onClick }: { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-2 py-1">
      <span className="text-xl">{emoji}</span>
      <span className={`text-xs font-medium ${active ? 'text-indigo-900' : 'text-gray-400'}`}>{label}</span>
    </button>
  )
}
