import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Replaces the file in one step: if the write fails, the previous file is left as it was.
export async function atomicWriteFile(filePath: string, data: string | Buffer, mode = 0o600): Promise<void> {
  const temp = `${filePath}.tmp`

  await mkdir(path.dirname(filePath), { recursive: true })
  await rm(temp, { force: true })
  try {
    await writeFile(temp, data, { mode })
    await rename(temp, filePath)
  } catch (err) {
    await rm(temp, { force: true })
    throw err
  }
}
