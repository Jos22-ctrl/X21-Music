declare global {
  interface UpdateInfo {
    available: boolean
    currentVersion: string
    version?: string
    notes?: string
    installer?: string
    /** Origen del instalador: release de GitHub o carpeta local. */
    source?: 'github' | 'local'
    installerUrl?: string
    releaseUrl?: string
    /** Clave que muestra la app y que debe escribirse en el instalador. */
    key?: string
    folder: string
  }

  interface ElectronAPI {
    isElectron: boolean
    platform: string
    getPathForFile: (file: File) => string | null
    getMusicFolder: () => Promise<string | null>
    moveMusicFiles: (paths: string[]) => Promise<string[]>
    saveMusicFile: (fileName: string, data: ArrayBuffer) => Promise<string | null>
    openMusicFolder: () => Promise<void>
    checkForUpdates: () => Promise<UpdateInfo>
    installUpdate: (key: string) => Promise<{ installerPath: string }>
    openUpdatesFolder: () => Promise<void>
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
