import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell, type IpcMainInvokeEvent } from 'electron'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { buildDashboard } from '../dashboard'
import { DataUnreadableError, ScraperLayoutError, SessionExpiredError, StoreUnavailableError } from '../errors'
import { fetchSnapshot } from '../fetchSnapshot'
import { buildGradebook } from '../gradebook'
import { LocalGradesStore, type KeyProtector } from '../localStore'

const ORIGIN = 'https://fuhsd.schoology.com'
const PARTITION = 'persist:schoology'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

// The key that encrypts the grades file is itself locked by the computer's own secure storage.
const protector: KeyProtector = {
  isAvailable: () => {
    if (!safeStorage.isEncryptionAvailable()) return false
    const backend = (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend?.()
    return backend !== 'basic_text'
  },
  protect: key => safeStorage.encryptString(key.toString('base64')),
  unprotect: blob => Buffer.from(safeStorage.decryptString(blob), 'base64'),
}

let mainWindow: BrowserWindow | null = null
let store: LocalGradesStore
let activeSync: Promise<unknown> | null = null

const dataDir = () => path.join(app.getPath('userData'), 'grades')
const templatePath = () =>
  app.isPackaged ? path.join(process.resourcesPath, 'grades.tsv') : path.join(__dirname, '..', '..', 'data', 'grades.tsv')

function describeError(err: unknown): string {
  if (err instanceof SessionExpiredError) return "Schoology didn't accept the sign-in. Please try again."
  if (err instanceof ScraperLayoutError) {
    return "Schoology's pages look different than expected, so nothing was changed. The app may need an update."
  }
  if (err instanceof SignInIncompleteError) return "Sign-in wasn't finished, so nothing was changed."
  if (err instanceof StoreUnavailableError || err instanceof DataUnreadableError) return err.message
  return 'Something went wrong. Check your internet connection and try again.'
}

// The sign-in window was closed or left alone too long, so there is nothing wrong to report, just nothing new.
class SignInIncompleteError extends Error {}

const httpsOnly = (url: string) => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function signIn(parent: BrowserWindow | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      parent: parent ?? undefined,
      title: 'Sign in to Schoology',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged },
    })

    let finished = false
    const finish = (err?: Error) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (!win.isDestroyed()) win.destroy()
      if (err) reject(err)
      else resolve()
    }
    const timer = setTimeout(() => finish(new SignInIncompleteError()), SIGN_IN_TIMEOUT_MS)

    const signedIn = (url: string) => {
      try {
        const parsed = new URL(url)
        if (parsed.origin === ORIGIN && parsed.pathname.startsWith('/home')) finish()
      } catch {
        // Not a URL we can read: keep waiting.
      }
    }

    win.webContents.on('did-navigate', (_event, url) => signedIn(url))
    win.webContents.on('did-navigate-in-page', (_event, url) => signedIn(url))
    win.webContents.on('will-navigate', (event, url) => {
      if (!httpsOnly(url)) event.preventDefault()
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (httpsOnly(url)) void win.loadURL(url)
      return { action: 'deny' }
    })
    win.on('closed', () => finish(new SignInIncompleteError()))

    void win.loadURL(`${ORIGIN}/`)
  })
}

async function schoologyCookies(): Promise<string | null> {
  const cookies = await session.fromPartition(PARTITION).cookies.get({ url: ORIGIN })
  return cookies.length > 0 ? cookies.map(c => `${c.name}=${c.value}`).join('; ') : null
}

async function runSync() {
  let cookies = await schoologyCookies()

  for (let attempt = 0; attempt < 2; attempt++) {
    if (!cookies) {
      await signIn(mainWindow)
      cookies = await schoologyCookies()
    }

    try {
      const snapshot = await fetchSnapshot(cookies ?? '')
      const saved = await store.save(snapshot)
      return { ok: true as const, ...saved }
    } catch (err) {
      // An old sign-in is expected sometimes; ask once, then give up if Schoology still refuses.
      if (err instanceof SessionExpiredError && attempt === 0) {
        cookies = null
        continue
      }
      throw err
    }
  }
  throw new SessionExpiredError()
}

// Anything the window sends arrives as `unknown`: each handler passes it to code that checks it before use.
function handle<T>(channel: string, action: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T>) {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false, message: 'Not allowed.' }
    try {
      return await action(event, ...args)
    } catch (err) {
      return { ok: false, message: describeError(err) }
    }
  })
}

function registerHandlers() {
  // signedIn only means a Schoology sign-in is saved on this computer; whether Schoology still accepts it is found out on the next sync.
  handle('bessy:status', async () => ({ ok: true, ...(await store.status()), signedIn: (await schoologyCookies()) !== null }))

  handle('bessy:dashboard', async () => ({ ok: true, ...buildDashboard(await store.readTsv()) }))

  // What the grade page works from. The window does the math itself with gradeCalc, so nothing here takes input.
  handle('bessy:gradebook', async () => ({ ok: true, ...buildGradebook(await store.readTsv()) }))

  // The scores the user typed and the assignments they added, kept in their own encrypted file.
  handle('bessy:edits', async () => ({ ok: true, edits: await store.readEdits() }))

  handle('bessy:edits-save', async (_event, edits) => ({ ok: true, edits: await store.saveEdits(edits) }))

  handle('bessy:sign-out', async () => {
    const schoology = session.fromPartition(PARTITION)
    await schoology.clearStorageData()
    await schoology.clearCache()
    return { ok: true }
  })

  handle('bessy:sync', async () => {
    activeSync ??= runSync().finally(() => {
      activeSync = null
    })
    return activeSync
  })

  handle('bessy:export', async () => {
    const choice = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export grades',
      message: 'This copy is a plain file that anyone who can open it can read.',
      defaultPath: path.join(app.getPath('documents'), 'grades.tsv'),
      filters: [{ name: 'Tab-separated values', extensions: ['tsv'] }],
    })
    if (choice.canceled || !choice.filePath) return { ok: false, canceled: true }
    await store.exportTo(choice.filePath)
    return { ok: true, path: choice.filePath }
  })

  handle('bessy:open-folder', async () => {
    await mkdir(dataDir(), { recursive: true })
    const problem = await shell.openPath(dataDir())
    return problem ? { ok: false, message: "Couldn't open the folder." } : { ok: true }
  })

  handle('bessy:delete', async () => {
    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      message: 'Delete all of your Better Bessy data?',
      detail: 'This permanently deletes your saved grades and signs you out of Schoology in this app. It cannot be undone.',
      buttons: ['Delete everything', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (choice.response !== 0) return { ok: false, canceled: true }

    await store.deleteAll()
    const schoology = session.fromPartition(PARTITION)
    await schoology.clearStorageData()
    await schoology.clearCache()
    // The window keeps your name and the assignments you checked off in its own storage.
    await session.defaultSession.clearStorageData({ storages: ['localstorage'] })
    return { ok: true }
  })
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'Better Bessy',
    backgroundColor: '#F4F5F9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.on('closed', () => {
    mainWindow = null
  })
  void win.loadFile(path.join(__dirname, 'index.html'))
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', event => event.preventDefault())
  })

  app.on('window-all-closed', () => app.quit())

  void app.whenReady().then(() => {
    for (const ses of [session.defaultSession, session.fromPartition(PARTITION)]) {
      ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      ses.setPermissionCheckHandler(() => false)
    }

    store = new LocalGradesStore({ dir: dataDir(), templatePath: templatePath(), protector })
    registerHandlers()
    mainWindow = createMainWindow()
  })
}
