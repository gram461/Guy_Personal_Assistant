'use client'

import { useState } from 'react'

type Props = {
  type: 'school' | 'personal'
  onClose: () => void
  onAdd: (event: { title: string; subtitle: string }) => void
}

export default function AddEventModal({ type, onClose, onAdd }: Props) {
  const [selectedType, setSelectedType] = useState<'school' | 'personal'>(type)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')

  const handleAdd = () => {
    if (!title.trim()) return
    const subtitle = [date, time, 'Added by you'].filter(Boolean).join(' · ')
    onAdd({ title, subtitle })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <p className="text-lg font-medium text-gray-900 mb-4">Add event</p>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Type</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setSelectedType('school')}
            className="rounded-xl py-3 text-center transition-all"
            style={{ background: selectedType === 'school' ? '#1a1a2e' : '#f9f9f9', color: selectedType === 'school' ? 'white' : '#888' }}>
            <p className="text-lg mb-1">🎓</p>
            <p className="text-sm font-medium">School</p>
          </button>
          <button onClick={() => setSelectedType('personal')}
            className="rounded-xl py-3 text-center transition-all"
            style={{ background: selectedType === 'personal' ? '#1a3a2e' : '#f9f9f9', color: selectedType === 'personal' ? 'white' : '#888' }}>
            <p className="text-lg mb-1">👤</p>
            <p className="text-sm font-medium">Personal</p>
          </button>
        </div>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Event name</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study group with Jake"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:border-gray-400" />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Date</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Time</p>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
          </div>
        </div>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Notes (optional)</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 outline-none focus:border-gray-400 resize-none h-16" />

        <button onClick={handleAdd}
          className="w-full py-3 rounded-xl text-sm font-medium text-white"
          style={{ background: selectedType === 'school' ? '#1a1a2e' : '#1a3a2e' }}>
          Add to {selectedType === 'school' ? 'School' : 'Personal'} tab
        </button>
      </div>
    </div>
  )
}
