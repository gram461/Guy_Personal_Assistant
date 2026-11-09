import { Empty, Header } from './parts'

// The mock-up has Personal and Email tabs. This app only talks to Schoology, so they say so instead of showing made-up content.
export function NotHere({ eyebrow, title, what }: { eyebrow: string; title: string; what: string }) {
  return (
    <>
      <Header eyebrow={eyebrow} title={title} />
      <Empty title="Not in the desktop app yet">
        <p>{what}</p>
        <p>This app only connects to Schoology, so nothing here is read from anywhere else.</p>
      </Empty>
    </>
  )
}
