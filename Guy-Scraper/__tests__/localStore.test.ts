import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DataUnreadableError, StoreUnavailableError } from '../errors'
import { LocalGradesStore, type KeyProtector } from '../localStore'
import type { SchoologySnapshot } from '../snapshot'
import { DEFAULT_GRADES_PATH } from '../tsv'

const protectorWith = (mask: number, available = true): KeyProtector => ({
  isAvailable: () => available,
  protect: key => Buffer.from(key.map(b => b ^ mask)),
  unprotect: blob => Buffer.from(blob.map(b => b ^ mask)),
})

const snapshot: SchoologySnapshot = {
  gradingPeriods: [{ periodId: 'p1', name: '26-27 T1', startsOn: '2026-07-01', endsOn: '2027-06-30' }],
  courses: [
    { periodId: 'p1', sectionId: 's1', name: 'Biology', teacherName: 'SmithJ', gradePercent: 92, gradeLetter: 'A' },
    { periodId: 'p1', sectionId: 's2', name: 'Advisory', teacherName: null, gradePercent: null, gradeLetter: null },
  ],
  categories: [],
  assignments: [{
    periodId: 'p1', sectionId: 's1', assignmentId: '1', categoryId: null, title: 'Cell Lab', description: '',
    dueAt: '2026-11-06T20:00:00.000Z', dueAllDay: true, score: 9, maxPoints: 10, gradeText: null,
    status: 'graded', isLate: false, hasSubmission: false,
  }],
}

async function setup(protector = protectorWith(0x5a)) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'store-test-'))
  const dir = path.join(root, 'data')
  return { root, dir, store: new LocalGradesStore({ dir, templatePath: DEFAULT_GRADES_PATH, protector }) }
}

const files = async (dir: string) => (await readdir(dir)).sort()

describe('LocalGradesStore', () => {
  it('starts from the shipped header-only file, stored encrypted', async () => {
    const { dir, store } = await setup()
    expect(await store.readTsv()).toBe(await readFile(DEFAULT_GRADES_PATH, 'utf8'))
    expect(await files(dir)).toEqual(['grades.key', 'grades.tsv.enc'])
    expect((await readFile(path.join(dir, 'grades.tsv.enc'))).toString('latin1')).not.toContain('class_grade_letter')
    expect(await store.status()).toMatchObject({ classes: 0, assignments: 0, lastSyncedAt: null })
  })

  it('saves grades encrypted, and reports what it holds', async () => {
    const { dir, store } = await setup()
    const at = new Date('2026-11-04T12:00:00Z')

    expect(await store.save(snapshot, at)).toEqual({ classes: 2, assignments: 1 })
    expect(await store.status()).toEqual({ dataFolder: dir, fileName: 'grades.tsv.enc', classes: 2, assignments: 1, lastSyncedAt: at.toISOString() })

    const onDisk = (await readFile(path.join(dir, 'grades.tsv.enc'))).toString('latin1')
    for (const word of ['Biology', 'Cell Lab', 'SmithJ']) expect(onDisk).not.toContain(word)
    expect((await store.readTsv()).split('\n').filter(l => l.startsWith('assignment\t'))[0]).toContain('Cell Lab')
  })

  it('replaces the previous grades on every save and leaves no temp files', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    await store.save({ ...snapshot, assignments: [] })
    expect(await store.status()).toMatchObject({ classes: 2, assignments: 0 })
    expect(await files(dir)).toEqual(['grades.key', 'grades.tsv.enc'])
  })

  it('exports a readable copy for the user and keeps the stored file encrypted', async () => {
    const { root, dir, store } = await setup()
    await store.save(snapshot)
    const copy = path.join(root, 'export', 'my-grades.tsv')

    await store.exportTo(copy)
    expect(await readFile(copy, 'utf8')).toBe(await store.readTsv())
    expect((await stat(copy)).mode & 0o077).toBe(0)
    expect((await readFile(path.join(dir, 'grades.tsv.enc'))).toString('latin1')).not.toContain('Biology')
  })

  it('deletes everything, then starts fresh with a new key', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    const oldKey = await readFile(path.join(dir, 'grades.key'))

    await store.deleteAll()
    expect(await files(dir)).toEqual([])
    expect(await store.status()).toMatchObject({ classes: 0, assignments: 0, lastSyncedAt: null })
    expect((await readFile(path.join(dir, 'grades.key'))).equals(oldKey)).toBe(false)
  })

  it('keeps files private to the user', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    for (const file of ['grades.key', 'grades.tsv.enc']) expect((await stat(path.join(dir, file))).mode & 0o077).toBe(0)
  })

  it('refuses to store anything when secure storage is unavailable', async () => {
    const { root, store } = await setup(protectorWith(0x5a, false))
    await expect(store.save(snapshot)).rejects.toThrow(StoreUnavailableError)
    await expect(store.status()).rejects.toThrow(StoreUnavailableError)
    expect(await files(root)).toEqual([])
  })

  it('reports an unreadable key instead of replacing it, and leaves the data alone', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    const before = await readFile(path.join(dir, 'grades.tsv.enc'))

    const otherAccount = new LocalGradesStore({ dir, templatePath: DEFAULT_GRADES_PATH, protector: protectorWith(0x33) })
    await expect(otherAccount.status()).rejects.toThrow(DataUnreadableError)
    await expect(otherAccount.save(snapshot)).rejects.toThrow(DataUnreadableError)
    expect((await readFile(path.join(dir, 'grades.tsv.enc'))).equals(before)).toBe(true)
  })

  it('reports a missing key instead of creating a new one next to existing data', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    await writeFile(path.join(dir, 'grades.key'), '')
    await store.deleteAll()
    await writeFile(path.join(dir, 'grades.tsv.enc'), 'leftover')

    await expect(store.save(snapshot)).rejects.toThrow('key is missing')
    expect(await readFile(path.join(dir, 'grades.tsv.enc'), 'utf8')).toBe('leftover')
    expect(await files(dir)).toEqual(['grades.tsv.enc'])
  })

  it('reports a grades file that was changed', async () => {
    const { dir, store } = await setup()
    await store.save(snapshot)
    const file = path.join(dir, 'grades.tsv.enc')
    const bytes = await readFile(file)
    bytes[bytes.length - 1] ^= 1
    await writeFile(file, bytes)

    await expect(store.status()).rejects.toThrow(DataUnreadableError)
  })

  describe('saved edits', () => {
    const edits = { scores: { '101': '42' }, points: { '102': '25' }, added: { 'T1|Biology|SmithJ': [{ id: 1, title: 'Unit 4 test', category: 'Tests', points: 50 }] } }
    const other = { scores: { '201': '7' }, points: {}, added: {} }
    const none = { scores: {}, points: {}, added: {} }

    it('starts with none', async () => {
      const { store } = await setup()
      expect(await store.readEdits()).toEqual(none)
    })

    it('is still there after the app is closed and opened again', async () => {
      const { dir, store } = await setup()
      expect(await store.saveEdits(edits)).toEqual(edits)

      const reopened = new LocalGradesStore({ dir, templatePath: DEFAULT_GRADES_PATH, protector: protectorWith(0x5a) })
      expect(await reopened.readEdits()).toEqual(edits)
    })

    it('replaces everything on each save', async () => {
      const { store } = await setup()
      await store.saveEdits(edits)
      await store.saveEdits(other)
      expect(await store.readEdits()).toEqual(other)
      await store.saveEdits(none)
      expect(await store.readEdits()).toEqual(none)
    })

    it('stores them encrypted, with no leftover temp file', async () => {
      const { dir, store } = await setup()
      await store.saveEdits({ ...edits, added: { 'T1|Biology|SmithJ': [{ id: 1, title: 'Secret plan', category: 'Tests', points: 50 }] } })
      const onDisk = (await readFile(path.join(dir, 'edits.enc'))).toString('latin1')
      for (const word of ['Secret plan', 'Biology', 'Tests', '42']) expect(onDisk).not.toContain(word)
      expect(await files(dir)).toEqual(['edits.enc', 'grades.key', 'grades.tsv.enc'])
      expect((await stat(path.join(dir, 'edits.enc'))).mode & 0o077).toBe(0)
    })

    it('survives a new sync of the grades', async () => {
      const { store } = await setup()
      await store.saveEdits(edits)
      await store.save(snapshot)
      expect(await store.readEdits()).toEqual(edits)
    })

    it('is deleted along with everything else', async () => {
      const { dir, store } = await setup()
      await store.saveEdits(edits)
      await store.deleteAll()
      expect(await files(dir)).toEqual([])
      expect(await store.readEdits()).toEqual(none)
    })

    it('keeps only what makes sense, and reports what it kept', async () => {
      const { store } = await setup()
      const kept = await store.saveEdits({ scores: { a: '1', b: 5 }, points: 'junk', added: { c: [{ id: 'bad' }] }, extra: true })
      expect(kept).toEqual({ scores: { a: '1' }, points: {}, added: {} })
      expect(await store.readEdits()).toEqual(kept)
    })

    it('reads a damaged edits file as empty, and the next save replaces it', async () => {
      const { dir, store } = await setup()
      await store.saveEdits(edits)
      const file = path.join(dir, 'edits.enc')
      const bytes = await readFile(file)
      bytes[bytes.length - 1] ^= 1
      await writeFile(file, bytes)

      expect(await store.readEdits()).toEqual(none)
      await store.saveEdits(other)
      expect(await store.readEdits()).toEqual(other)
    })

    it('does not accept the grades file in place of the edits file', async () => {
      const { dir, store } = await setup()
      await store.save(snapshot)
      await writeFile(path.join(dir, 'edits.enc'), await readFile(path.join(dir, 'grades.tsv.enc')))
      expect(await store.readEdits()).toEqual(none)
    })

    it("can't be read or saved when the key can't be opened, and leaves the file alone", async () => {
      const { dir, store } = await setup()
      await store.saveEdits(edits)
      const before = await readFile(path.join(dir, 'edits.enc'))

      const otherAccount = new LocalGradesStore({ dir, templatePath: DEFAULT_GRADES_PATH, protector: protectorWith(0x33) })
      await expect(otherAccount.readEdits()).rejects.toThrow(DataUnreadableError)
      await expect(otherAccount.saveEdits(none)).rejects.toThrow(DataUnreadableError)
      expect((await readFile(path.join(dir, 'edits.enc'))).equals(before)).toBe(true)
    })

    it('refuses to store anything when secure storage is unavailable', async () => {
      const { root, store } = await setup(protectorWith(0x5a, false))
      await expect(store.saveEdits(edits)).rejects.toThrow(StoreUnavailableError)
      expect(await files(root)).toEqual([])
    })

    it('handles saves that arrive at the same moment, keeping the last one', async () => {
      const { store } = await setup()
      const saves = ['1', '2', '3', '4'].map(n => store.saveEdits({ scores: { a: n }, points: {}, added: {} }))
      await Promise.all(saves)
      expect((await store.readEdits()).scores).toEqual({ a: '4' })
    })
  })

  it('creates one key even when two operations start at the same time', async () => {
    const { dir, store } = await setup()
    await Promise.all([store.status(), store.save(snapshot), store.status()])
    expect(await files(dir)).toEqual(['grades.key', 'grades.tsv.enc'])
    expect(await store.status()).toMatchObject({ classes: 2, assignments: 1 })
  })
})
