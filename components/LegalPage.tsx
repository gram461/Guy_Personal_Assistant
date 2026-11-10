import type { ReactNode } from 'react'
import Link from 'next/link'
import { APP_NAME, LEGAL_UPDATED } from '@/lib/legal'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 text-foreground">
      <Link href="/" className="text-sm font-semibold text-primary hover:underline">
        ← {APP_NAME}
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-4 text-[15px] leading-relaxed">{children}</div>
      <nav className="mt-12 flex gap-5 border-t border-border/60 pt-6 text-sm text-muted-foreground" aria-label="Legal">
        <Link href="/privacy" className="hover:underline">Privacy policy</Link>
        <Link href="/terms" className="hover:underline">Terms of service</Link>
      </nav>
    </main>
  )
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-4 text-lg font-semibold">{children}</h2>
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
}
