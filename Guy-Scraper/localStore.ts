import { randomBytes } from 'node:crypto'
import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from './atomicWrite'
import { DataUnreadableError, StoreUnavailableError } from './errors'
import { emptyEdits, parseEdits, sanitizeEdits, serializeEdits, type SavedEdits } from './savedEdits'
import { decryptBytes, EDITS_CONTEXT, encryptBytes } from './secureFile'
import type { SchoologySnapshot } from './snapshot'
import { buildGradesTsv, TSV_COLUMNS } from './tsv'

// Wraps the encryption key with the computer's own secure storage (the macOS Keychain, Windows DPAPI).
export type KeyProtector = {
  isAvailable(): boolean
  protect(key: Buffer): Buffer
  unprotect(blob: Buffer): Buffer
}

export type StoreStatus = {
  dataFolder: string
  fileName: string
  classes: number
  assignments: number
  lastSyncedAt: string | null
}

const DATA_FILE = 'grades.tsv.enc'
const KEY_FILE = 'grades.key'
const EDITS_FILE = 'edits.enc'

const exists = (file: string) => access(file).then(() => true, () => false)

export class LocalGradesStore {
  // One operation at a time, so two calls on a fresh install can't each create their own key.
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: { dir: string; templatePath: string; protector: KeyProtector }) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => undefined)
    return result
  }

  private get dataFile() {
    return path.join(this.options.dir, DATA_FILE)
  }

  private get keyFile() {
    return path.join(this.options.dir, KEY_FILE)
  }

  private get editsFile() {
    return path.join(this.options.dir, EDITS_FILE)
  }

  private async loadEdits(key: Buffer): Promise<SavedEdits> {
    try {
      return parseEdits(decryptBytes(await readFile(this.editsFile), key, EDITS_CONTEXT).toString('utf8'))
    } catch {
      // No file yet, or one that can't be read: either way there is nothing to show, and the next save replaces it.
      return emptyEdits()
    }
  }

  // Never invents a new key while a grades file exists, and never touches a file its key can't open:
  // either would leave grades nothing can decrypt instead of reporting the problem.
  private async open(): Promise<{ key: Buffer; text: string }> {
    const { protector, templatePath } = this.options
    if (!protector.isAvailable()) throw new StoreUnavailableError()

    const [hasKey, hasData] = await Promise.all([exists(this.keyFile), exists(this.dataFile)])

    let key: Buffer
    if (hasKey) {
      try {
        key = protector.unprotect(await readFile(this.keyFile))
      } catch {
        throw new DataUnreadableError("The grades key can't be opened on this account. Use Delete my data to start over.")
      }
      if (key.length !== 32) throw new DataUnreadableError('The grades key is damaged. Use Delete my data to start over.')
    } else if (hasData) {
      throw new DataUnreadableError('The grades file is here but its key is missing. Use Delete my data to start over.')
    } else {
      key = randomBytes(32)
      await atomicWriteFile(this.keyFile, protector.protect(key))
    }

    if (!hasData) {
      const template = await readFile(templatePath)
      await atomicWriteFile(this.dataFile, encryptBytes(template, key))
      return { key, text: template.toString('utf8') }
    }
    return { key, text: decryptBytes(await readFile(this.dataFile), key).toString('utf8') }
  }

  private async read(): Promise<string> {
    return (await this.open()).text
  }

  save(snapshot: SchoologySnapshot, scrapedAt = new Date()): Promise<{ classes: number; assignments: number }> {
    return this.serialize(async () => {
      const { key } = await this.open()
      const { text, classes, assignments } = buildGradesTsv(snapshot, scrapedAt)
      await atomicWriteFile(this.dataFile, encryptBytes(text, key))
      return { classes, assignments }
    })
  }

  readTsv(): Promise<string> {
    return this.serialize(() => this.read())
  }

  status(): Promise<StoreStatus> {
    return this.serialize(async () => {
      const [, ...rows] = (await this.read()).trimEnd().split('\n').map(line => line.split('\t'))
      const typeAt = TSV_COLUMNS.indexOf('type')
      const stampAt = TSV_COLUMNS.indexOf('scraped_at')
      const stamps = rows.map(r => r[stampAt]).filter(Boolean).sort()

      return {
        dataFolder: this.options.dir,
        fileName: DATA_FILE,
        classes: rows.filter(r => r[typeAt] === 'class').length,
        assignments: rows.filter(r => r[typeAt] === 'assignment').length,
        lastSyncedAt: stamps.at(-1) ?? null,
      }
    })
  }

  // A readable copy for the user to open in a spreadsheet; the stored file stays encrypted.
  exportTo(destination: string): Promise<void> {
    return this.serialize(async () => atomicWriteFile(destination, await this.read()))
  }

  // The scores the user typed and the assignments they added on the grade page. They stay until the user resets them or deletes their data.
  readEdits(): Promise<SavedEdits> {
    return this.serialize(async () => this.loadEdits((await this.open()).key))
  }

  // Replaces everything saved. The input is cleaned first, and what was actually kept is returned.
  saveEdits(edits: unknown): Promise<SavedEdits> {
    return this.serialize(async () => {
      const { key } = await this.open()
      const kept = sanitizeEdits(edits)
      await atomicWriteFile(this.editsFile, encryptBytes(serializeEdits(kept), key, EDITS_CONTEXT))
      return kept
    })
  }

  deleteAll(): Promise<void> {
    return this.serialize(async () => {
      await Promise.all(
        [this.dataFile, this.keyFile, this.editsFile].flatMap(file => [rm(file, { force: true }), rm(`${file}.tmp`, { force: true })]),
      )
    })
  }
}
