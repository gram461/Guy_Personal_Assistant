import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysUntil, formatDay } from '../summaryFilters'

// Thursday Nov 5, 2026, 10:00 am Pacific.
const NOW = new Date('2026-11-05T18:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('daysUntil', () => {
  it('reads an all-day date as that Pacific calendar day, not midnight UTC', () => {
    expect(daysUntil('2026-11-05')).toBe(0)
    expect(daysUntil('2026-11-06')).toBe(1)
    expect(daysUntil('2026-11-04')).toBe(-1)
  })

  it('counts a timed item by the Pacific day it falls on', () => {
    // 11:59 pm Pacific on Nov 5 is already Nov 6 in UTC.
    expect(daysUntil('2026-11-06T07:59:00.000Z')).toBe(0)
    expect(daysUntil('2026-11-06T08:00:00.000Z')).toBe(1)
    expect(daysUntil('2026-11-06T09:00:00-08:00')).toBe(1)
  })
})

describe('formatDay', () => {
  it('shows an all-day date as itself', () => {
    expect(formatDay('2026-11-06')).toBe('Fri, Nov 6')
  })

  it('shows a timed item on its Pacific day', () => {
    expect(formatDay('2026-11-06T07:59:00.000Z')).toBe('Thu, Nov 5')
  })
})
