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
    /** URL del `.sha256` publicado junto al instalador. */
    checksumUrl?: string
    /** SHA-256 esperado (local) o vacío si se toma del `.sha256` remoto. */
    sha256?: string
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
    copyMusicFiles: (paths: string[]) => Promise<string[]>
    moveMusicFiles: (paths: string[]) => Promise<string[]>
    saveMusicFile: (fileName: string, data: ArrayBuffer) => Promise<string | null>
    trashMusicFiles: (paths: string[]) => Promise<string[]>
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
