import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type IconTone = 'brand' | 'urgent' | 'warning' | 'neutral' | 'success'

const iconToneStyles: Record<IconTone, string> = {
  brand: 'bg-brand-muted text-primary-foreground',
  urgent: 'bg-urgent-muted text-urgent-foreground',
  warning: 'bg-warning-muted text-warning',
  neutral: 'bg-secondary text-foreground',
  success: 'bg-secondary text-success',
}

export function ListCard({
  icon: Icon,
  iconTone = 'neutral',
  title,
  subtitle,
  right,
  accentEdge,
  className,
}: {
  icon: LucideIcon
  iconTone?: IconTone
  title: string
  subtitle?: React.ReactNode
  right?: React.ReactNode
  accentEdge?: IconTone
  className?: string
}) {
  const edgeColors: Record<IconTone, string> = {
    brand: 'before:bg-primary',
    urgent: 'before:bg-urgent',
    warning: 'before:bg-warning',
    neutral: 'before:bg-border',
    success: 'before:bg-success',
  }

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl bg-card p-3.5',
        accentEdge &&
          cn(
            'before:absolute before:left-0 before:top-0 before:h-full before:w-1',
            edgeColors[accentEdge],
          ),
        className,
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          iconToneStyles[iconTone],
        )}
      >
        <Icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-card-foreground">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {right ? <div className="flex shrink-0 items-center">{right}</div> : null}
    </div>
  )
}
