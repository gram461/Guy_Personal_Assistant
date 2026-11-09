import { describe, expect, it } from 'vitest'
import {
  MAX_ADDED_PER_CLASS, MAX_CLASSES, MAX_CLASS_KEY_LENGTH, MAX_ENTRIES, MAX_ID_LENGTH, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH,
  emptyEdits, parseEdits, sanitizeEdits, serializeEdits,
} from '../savedEdits'

const added = (overrides = {}) => ({ id: 1, title: 'Unit 4 test', category: 'Tests', points: 50, ...overrides })

describe('sanitizeEdits', () => {
  it('keeps good edits as they are', () => {
    const edits = { scores: { '101': '42', 'add-1': '' }, points: { '102': '25' }, added: { 'T1|Biology|SmithJ': [added()] } }
    expect(sanitizeEdits(edits)).toEqual(edits)
  })

  it('gives nothing for input that is not an object', () => {
    for (const input of [null, undefined, 'text', 7, [], [1, 2]]) expect(sanitizeEdits(input)).toEqual(emptyEdits())
  })

  it('fills in whatever is missing', () => {
    expect(sanitizeEdits({ scores: { '1': '5' } })).toEqual({ scores: { '1': '5' }, points: {}, added: {} })
  })

  it('keeps score text as typed, but only short text under a sensible id', () => {
    const kept = sanitizeEdits({
      scores: { ok: '4.5', long: 'x'.repeat(MAX_TEXT_LENGTH + 1), number: 5, empty: '', ['k'.repeat(MAX_ID_LENGTH + 1)]: '1', '': '1' },
    })
    expect(kept.scores).toEqual({ ok: '4.5', empty: '' })
  })

  it('keeps only the first entries of a huge map', () => {
    const scores = Object.fromEntries(Array.from({ length: MAX_ENTRIES + 50 }, (_, i) => [`id${i}`, '1']))
    expect(Object.keys(sanitizeEdits({ scores }).scores)).toHaveLength(MAX_ENTRIES)
  })

  it('cleans added assignments and drops the unusable ones', () => {
    const kept = sanitizeEdits({
      added: {
        good: [
          added(),
          added({ id: 0 }), added({ id: 1.5 }), added({ id: '2' }),
          added({ title: 5 }), added({ category: '' }), added({ category: 7 }),
          added({ points: 0 }), added({ points: -3 }), added({ points: NaN }), added({ points: 1e9 }), added({ points: '50' }),
          null, 'junk',
        ],
        'not a list': 'x',
        empty: [],
        '': [added()],
      },
    })
    expect(Object.keys(kept.added)).toEqual(['good'])
    expect(kept.added.good).toEqual([added()])
  })

  it('shortens a long title instead of dropping the assignment', () => {
    expect(sanitizeEdits({ added: { a: [added({ title: 'x'.repeat(MAX_TITLE_LENGTH + 30) })] } }).added.a[0].title).toHaveLength(MAX_TITLE_LENGTH)
  })

  it('limits how much is kept', () => {
    const list = Array.from({ length: MAX_ADDED_PER_CLASS + 10 }, (_, i) => added({ id: i + 1 }))
    expect(sanitizeEdits({ added: { a: list } }).added.a).toHaveLength(MAX_ADDED_PER_CLASS)

    const classes = Object.fromEntries(Array.from({ length: MAX_CLASSES + 20 }, (_, i) => [`class-${i}`, [added()]]))
    expect(Object.keys(sanitizeEdits({ added: classes }).added)).toHaveLength(MAX_CLASSES)
    expect(Object.keys(sanitizeEdits({ added: { ['k'.repeat(MAX_CLASS_KEY_LENGTH + 1)]: [added()] } }).added)).toEqual([])
  })

  it('ignores extra fields', () => {
    const kept = sanitizeEdits({ scores: {}, isAdmin: true, added: { a: [{ ...added(), extra: 1 }] } })
    expect(Object.keys(kept).sort()).toEqual(['added', 'points', 'scores'])
    expect(Object.keys(kept.added.a[0]).sort()).toEqual(['category', 'id', 'points', 'title'])
  })

  it('cannot be used to change how every object behaves', () => {
    const kept = sanitizeEdits(JSON.parse('{"scores":{"__proto__":"9"},"points":{"__proto__":"9"},"added":{"__proto__":[{"id":1,"title":"x","category":"c","points":1}]}}'))
    expect(({} as Record<string, unknown>).title).toBeUndefined()
    expect(Object.getPrototypeOf(kept.scores)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(kept.added)).toBe(Object.prototype)
  })
})

describe('serializeEdits / parseEdits', () => {
  it('round-trips edits', () => {
    const edits = { scores: { '1': '9' }, points: { '2': '10' }, added: { a: [added(), added({ id: 2, title: 'Quiz' })] } }
    expect(parseEdits(serializeEdits(edits))).toEqual(edits)
  })

  it.each([
    ['not JSON', 'this is not json'],
    ['the wrong shape', '[1, 2, 3]'],
    ['a different version', JSON.stringify({ version: 99, scores: { a: '1' } })],
    ['no version', JSON.stringify({ scores: { a: '1' } })],
    ['null', 'null'],
  ])('gives nothing for %s', (_label, text) => {
    expect(parseEdits(text)).toEqual(emptyEdits())
  })

  it('cleans what it reads', () => {
    const text = JSON.stringify({ version: 1, scores: { a: '1', b: 5 }, added: { x: [added(), { id: 'bad' }] } })
    expect(parseEdits(text)).toEqual({ scores: { a: '1' }, points: {}, added: { x: [added()] } })
  })
})
