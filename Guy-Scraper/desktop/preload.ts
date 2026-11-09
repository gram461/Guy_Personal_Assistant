import { contextBridge, ipcRenderer } from 'electron'

// The only things the window can ask for. It never gets file access, Schoology cookies, or the key.
contextBridge.exposeInMainWorld('bessy', {
  status: () => ipcRenderer.invoke('bessy:status'),
  dashboard: () => ipcRenderer.invoke('bessy:dashboard'),
  gradebook: () => ipcRenderer.invoke('bessy:gradebook'),
  edits: () => ipcRenderer.invoke('bessy:edits'),
  saveEdits: (edits: unknown) => ipcRenderer.invoke('bessy:edits-save', edits),
  sync: () => ipcRenderer.invoke('bessy:sync'),
  signOut: () => ipcRenderer.invoke('bessy:sign-out'),
  exportTsv: () => ipcRenderer.invoke('bessy:export'),
  openFolder: () => ipcRenderer.invoke('bessy:open-folder'),
  deleteData: () => ipcRenderer.invoke('bessy:delete'),
})
