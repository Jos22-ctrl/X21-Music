/** Puente local con el proceso Electron para la carpeta de música del usuario. */

function api(): ElectronAPI | undefined {
  return typeof window === 'undefined' ? undefined : window.electronAPI
}

export function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function sourcePathOf(file: File): string | null {
  const bridge = api()
  if (!bridge?.isElectron || !bridge.getPathForFile) return null
  try {
    return bridge.getPathForFile(file)
  } catch {
    return null
  }
}

export async function getMusicFolder(): Promise<string | null> {
  const bridge = api()
  if (!bridge?.isElectron || !bridge.getMusicFolder) return null
  try {
    return await bridge.getMusicFolder()
  } catch {
    return null
  }
}

export async function moveFilesToMusicFolder(paths: string[]): Promise<string[]> {
  const bridge = api()
  if (!bridge?.isElectron || !bridge.moveMusicFiles || paths.length === 0) return []
  try {
    return (await bridge.moveMusicFiles(paths)).filter((item): item is string => Boolean(item))
  } catch {
    return []
  }
}

export async function saveFileToMusicFolder(
  fileName: string,
  data: ArrayBuffer,
): Promise<string | null> {
  const bridge = api()
  if (!bridge?.isElectron || !bridge.saveMusicFile) return null
  try {
    return await bridge.saveMusicFile(fileName, data)
  } catch {
    return null
  }
}

export async function openMusicFolder(): Promise<void> {
  const bridge = api()
  if (!bridge?.isElectron || !bridge.openMusicFolder) return
  try {
    await bridge.openMusicFolder()
  } catch {
    // El Explorador puede estar ocupado; no afecta a la reproducción.
  }
}
