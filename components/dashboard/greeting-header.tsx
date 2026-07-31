import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TimeOfDay = 'morning' | 'afternoon' | 'night'

const variants: Record<TimeOfDay, { greeting: string; gradient: string; icon: typeof Sun }> = {
  morning: {
    greeting: 'Good morning',
    gradient: 'from-[oklch(0.5_0.19_300)] via-[oklch(0.36_0.16_292)] to-background',
    icon: Sun,
  },
  afternoon: {
    greeting: 'Good afternoon',
    gradient: 'from-[oklch(0.5_0.2_275)] via-[oklch(0.36_0.16_282)] to-background',
    icon: Sun,
  },
  night: {
    greeting: 'Good evening',
    gradient: 'from-[oklch(0.36_0.17_290)] via-[oklch(0.26_0.12_288)] to-background',
    icon: Moon,
  },
}

export function GreetingHeader({
  name,
  timeOfDay,
  dateLabel,
}: {
  name: string
  timeOfDay: TimeOfDay
  dateLabel: string
}) {
  const variant = variants[timeOfDay]
  const Icon = variant.icon

  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b px-5 pb-8 pt-8',
        variant.gradient,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/70">{dateLabel}</p>
          <h1 className="mt-1 text-pretty text-3xl font-extrabold tracking-tight text-foreground">
            {variant.greeting},
            <br />
            {name}
          </h1>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/10 backdrop-blur-sm">
          <Icon className="size-6 text-foreground" strokeWidth={2.25} aria-hidden="true" />
        </div>
      </div>
    </header>
  )
}
