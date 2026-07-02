'use client'
import { useEffect, useState } from 'react'

interface Email {
  id: string
  from: string
  subject: string
  date: string
  unread: boolean
  snippet: string
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 8px',
}

function formatFrom(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.split('@')[0]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function InboxTab() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/gmail')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEmails(data.emails || [])
      })
      .catch(() => setError('Failed to load emails'))
      .finally(() => setLoading(false))
  }, [])

  const unread = emails.filter(e => e.unread)
  const read = emails.filter(e => !e.unread)

  return (
    <div>
      <div style={{ background: '#1a1a2e', padding: '20px 20px 16px', color: 'white' }}>
        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Inbox</p>
        <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Emails that matter to you</p>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: '#aaa', fontSize: 14 }}>Loading emails...</p>}
        {error && <p style={{ color: 'red', fontSize: 14 }}>{error}</p>}

        {!loading && !error && (
          <>
            {unread.length > 0 && (
              <>
                <p style={sectionLabel}>Unread</p>
                {unread.map(e => <EmailCard key={e.id} {...e} />)}
              </>
            )}
            {read.length > 0 && (
              <>
                <p style={sectionLabel}>Earlier</p>
                {read.map(e => <EmailCard key={e.id} {...e} />)}
              </>
            )}
            {emails.length === 0 && (
              <p style={{ color: '#aaa', fontSize: 14 }}>No emails found.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmailCard({ from, subject, date, unread, snippet }: Email) {
  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 14, fontWeight: unread ? 600 : 400, color: '#111', margin: 0 }}>{formatFrom(from)}</p>
        <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{formatDate(date)}</p>
      </div>
      <p style={{ fontSize: 13, color: unread ? '#333' : '#999', margin: '0 0 4px' }}>{subject}</p>
      <p style={{ fontSize: 12, color: '#bbb', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snippet}</p>
    </div>
  )
}
