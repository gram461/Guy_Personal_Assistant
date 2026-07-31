import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tag } from './tag'

type AlertTone = 'urgent' | 'warning'

const toneConfig: Record<AlertTone, { ring: string; iconWrap: string; glow: string }> = {
  urgent: {
    ring: 'ring-1 ring-inset ring-urgent/30',
    iconWrap: 'bg-urgent/15 text-urgent',
    glow: 'shadow-lg shadow-urgent/10',
  },
  warning: {
    ring: 'ring-1 ring-inset ring-warning/30',
    iconWrap: 'bg-warning/15 text-warning',
    glow: 'shadow-lg shadow-warning/10',
  },
}

export function AlertCard({
  icon: Icon,
  tone,
  title,
  subtitle,
  tag,
}: {
  icon: LucideIcon
  tone: AlertTone
  title: string
  subtitle: string
  tag: string
}) {
  const config = toneConfig[tone]

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-card p-3.5', config.ring, config.glow)}>
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', config.iconWrap)}>
        <Icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-card-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <Tag tone={tone}>{tag}</Tag>
    </div>
  )
}
