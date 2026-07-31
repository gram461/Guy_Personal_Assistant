'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NewAssignment = {
  title: string
  description: string
  dueDate: string
}

export function AddAssignmentSheet({
  open,
  onClose,
  onSubmit,
  heading = 'New assignment',
  submitLabel = 'Add assignment',
  nameLabel = 'Assignment name',
  namePlaceholder = 'e.g. Biology Chapter 5 Notes',
  emptyNameError = 'Give your assignment a name.',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (assignment: NewAssignment) => void
  heading?: string
  submitLabel?: string
  nameLabel?: string
  namePlaceholder?: string
  emptyNameError?: string
}) {
  const fieldId = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setDueDate(new Date().toISOString().slice(0, 10))
    setError(null)
    const id = window.setTimeout(() => titleRef.current?.focus(), 60)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError(emptyNameError)
      titleRef.current?.focus()
      return
    }
    if (!dueDate) {
      setError('Pick a due date.')
      return
    }
    onSubmit({ title: title.trim(), description: description.trim(), dueDate })
    onClose()
  }

  const inputClasses =
    'w-full rounded-xl border border-input bg-secondary px-3.5 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 mx-auto flex max-w-md items-end justify-center transition-opacity',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-heading`}
        className={cn(
          'relative w-full rounded-t-3xl border-t border-border bg-card p-5 pb-8 shadow-2xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />

        <div className="mb-5 flex items-center justify-between">
          <h2 id={`${fieldId}-heading`} className="text-xl font-extrabold tracking-tight text-card-foreground">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-xl bg-foreground/10 text-foreground transition-colors hover:bg-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-title`} className="block text-xs font-semibold text-muted-foreground">
              {nameLabel}
            </label>
            <input
              id={`${fieldId}-title`}
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError(null)
              }}
              placeholder={namePlaceholder}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-desc`} className="block text-xs font-semibold text-muted-foreground">
              Description <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id={`${fieldId}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add any details or instructions…"
              className={cn(inputClasses, 'resize-none')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-due`} className="block text-xs font-semibold text-muted-foreground">
              Due date
            </label>
            <input
              id={`${fieldId}-due`}
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (error) setError(null)
              }}
              className={cn(inputClasses, '[color-scheme:dark]')}
            />
          </div>

          {error ? <p className="text-sm font-medium text-urgent">{error}</p> : null}

          <button
            type="submit"
            className="mt-1 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
