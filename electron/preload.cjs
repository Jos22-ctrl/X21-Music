const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Superficie mínima y sólida: el renderer no necesita Node.
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  /** Ruta real del archivo seleccionado en un <input> o arrastrado. */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || null
    } catch {
      return null
    }
  },
  getMusicFolder: () => ipcRenderer.invoke('music:get-folder'),
  copyMusicFiles: (paths) => ipcRenderer.invoke('music:copy-files', paths),
  moveMusicFiles: (paths) => ipcRenderer.invoke('music:move-files', paths),
  saveMusicFile: (fileName, data) => ipcRenderer.invoke('music:save-file', { fileName, data }),
  trashMusicFiles: (paths) => ipcRenderer.invoke('music:trash-files', paths),
  openMusicFolder: () => ipcRenderer.invoke('music:open-folder'),

  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: (key) => ipcRenderer.invoke('update:install', key),
})
