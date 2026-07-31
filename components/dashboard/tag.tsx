import { cn } from '@/lib/utils'

export type TagTone = 'brand' | 'urgent' | 'warning' | 'neutral' | 'success'

const toneStyles: Record<TagTone, string> = {
  brand: 'bg-brand-muted text-primary-foreground',
  urgent: 'bg-urgent-muted text-urgent-foreground',
  warning: 'bg-warning-muted text-warning',
  neutral: 'bg-secondary text-muted-foreground',
  success: 'bg-secondary text-success',
}

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: TagTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
