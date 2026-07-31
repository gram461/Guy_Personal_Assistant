export function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {action}
    </div>
  )
}
