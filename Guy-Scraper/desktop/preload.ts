import { contextBridge, ipcRenderer } from 'electron'

// The only things the window can ask for. It never gets file access, Schoology cookies, or the key.
contextBridge.exposeInMainWorld('synergy', {
  status: () => ipcRenderer.invoke('synergy:status'),
  dashboard: () => ipcRenderer.invoke('synergy:dashboard'),
  gradebook: () => ipcRenderer.invoke('synergy:gradebook'),
  edits: () => ipcRenderer.invoke('synergy:edits'),
  saveEdits: (edits: unknown) => ipcRenderer.invoke('synergy:edits-save', edits),
  sync: () => ipcRenderer.invoke('synergy:sync'),
  signOut: () => ipcRenderer.invoke('synergy:sign-out'),
  exportTsv: () => ipcRenderer.invoke('synergy:export'),
  openFolder: () => ipcRenderer.invoke('synergy:open-folder'),
  deleteData: () => ipcRenderer.invoke('synergy:delete'),
})
