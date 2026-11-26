import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { PersistedSettings, StoredTrack } from '../types'

interface X21Schema extends DBSchema {
  tracks: {
    key: string
    value: StoredTrack
    indexes: { 'by-added': number }
  }
  settings: {
    key: string
    value: PersistedSettings
  }
}

const DB_NAME = 'x21-music'
const SETTINGS_KEY = 'player'

let dbPromise: Promise<IDBPDatabase<X21Schema>> | null = null

function getDb(): Promise<IDBPDatabase<X21Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<X21Schema>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const tracks = db.createObjectStore('tracks', { keyPath: 'id' })
          tracks.createIndex('by-added', 'addedAt')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    }).catch((error: unknown) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

export async function loadTracks(): Promise<StoredTrack[]> {
  try {
    const db = await getDb()
    const all = await db.getAllFromIndex('tracks', 'by-added')
    return all.sort((a, b) => a.addedAt - b.addedAt)
  } catch {
    return []
  }
}

export async function saveTrack(track: StoredTrack): Promise<void> {
  try {
    const db = await getDb()
    await db.put('tracks', track)
  } catch {
    // Almacenamiento no disponible: la sesión actual sigue siendo funcional.
  }
}

export async function deleteTrack(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('tracks', id)
  } catch {
    // Ignorado: no hay nada que hacer si IndexedDB no está disponible.
  }
}

export async function loadSettings(): Promise<PersistedSettings | undefined> {
  try {
    const db = await getDb()
    return await db.get('settings', SETTINGS_KEY)
  } catch {
    return undefined
  }
}

export async function saveSettings(
  settings: Omit<PersistedSettings, 'key'>,
): Promise<void> {
  try {
    const db = await getDb()
    await db.put('settings', { ...settings, key: SETTINGS_KEY })
  } catch {
    // Ignorado: las preferencias se conservan en memoria durante la sesión.
  }
}
