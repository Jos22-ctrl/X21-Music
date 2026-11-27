declare global {
  interface UpdateInfo {
    available: boolean
    currentVersion: string
    version?: string
    notes?: string
    installer?: string
    /** Único origen admitido: el release de GitHub. */
    source?: 'github'
    installerUrl?: string
    /** URL del `.sha256` publicado junto al instalador. */
    checksumUrl?: string
    releaseUrl?: string
    /** Clave que muestra la app y que debe escribirse en el instalador. */
    key?: string
    /** Estado de la consulta cuando no hay actualización o falla GitHub. */
    error?: string
    message?: string
    /** Versión marcada como F en GitHub; solo informativa, nunca bloquea. */
    obsoleteRelease?: { version: string; letter: 'F'; url: string }
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
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
