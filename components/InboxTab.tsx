const emails = [
  { from: 'Mr. Johnson', subject: 'Extra credit opportunity', preview: "Hi class, I'm offering extra credit for anyone who...", time: '9:14 am', badge: 'Extra credit', badgeStyle: { background: '#FAEEDA', color: '#854F0B' }, read: false },
  { from: 'Ms. Rivera', subject: 'History essay updated rubric', preview: 'Please use the updated rubric attached for your...', time: 'Yesterday', badge: 'Action needed', badgeStyle: { background: '#FCEBEB', color: '#A32D2D' }, read: false },
  { from: 'Mr. Kim', subject: 'Math test reminder', preview: 'Just a reminder that your test is on Wednesday...', time: 'Mon', badge: 'Reminder', badgeStyle: { background: '#E6F1FB', color: '#185FA5' }, read: true },
  { from: 'Principal Davis', subject: 'School newsletter — June', preview: "This month's updates from Cupertino High...", time: 'Sun', badge: 'Info', badgeStyle: { background: '#F1EFE8', color: '#5F5E5A' }, read: true },
]

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }

export default function InboxTab() {
  return (
    <div>
      <div style={{ background: '#1a1a2e', padding: '20px 20px 16px', color: 'white' }}>
        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Inbox</p>
        <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Emails that matter to you</p>
      </div>

      <div style={{ padding: 16 }}>
        <p style={sectionLabel}>Unread</p>
        {emails.filter(e => !e.read).map((e, i) => <EmailCard key={i} {...e} />)}

        <p style={sectionLabel}>Earlier</p>
        {emails.filter(e => e.read).map((e, i) => <EmailCard key={i} {...e} />)}
      </div>
    </div>
  )
}

function EmailCard({ from, subject, preview, time, badge, badgeStyle, read }: { from: string; subject: string; preview: string; time: string; badge: string; badgeStyle: React.CSSProperties; read: boolean }) {
  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 14, fontWeight: read ? 400 : 600, color: '#111', margin: 0 }}>{from}</p>
        <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{time}</p>
      </div>
      <p style={{ fontSize: 13, color: read ? '#999' : '#333', margin: '0 0 4px' }}>{subject}</p>
      <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 10px' }}>{preview}</p>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, ...badgeStyle }}>{badge}</span>
    </div>
  )
}
