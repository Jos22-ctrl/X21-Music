import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { migrateTrackRecord } from './dbMigration'
import { DEFAULT_PERSISTED_SNAPSHOT } from './persistence'
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
    dbPromise = openDB<X21Schema>(DB_NAME, 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('tracks')) {
          const tracks = db.createObjectStore('tracks', { keyPath: 'id' })
          tracks.createIndex('by-added', 'addedAt')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
        if (oldVersion < 2) {
          // Migración v1 → v2: los registros antiguos no tenían contentHash.
          const store = transaction.objectStore('tracks')
          return (async () => {
            let cursor = await store.openCursor()
            while (cursor) {
              const migrated = migrateTrackRecord(cursor.value)
              if (migrated !== cursor.value) await cursor.update(migrated)
              cursor = await cursor.continue()
            }
          })()
        }
        return undefined
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

/** Un lote = una transacción de escritura; reduce el coste al importar. */
export async function saveTracks(tracks: StoredTrack[]): Promise<void> {
  if (!tracks.length) return
  try {
    const db = await getDb()
    const transaction = db.transaction('tracks', 'readwrite')
    await Promise.all(tracks.map((track) => transaction.store.put(track)))
    await transaction.done
  } catch {
    // Igual que saveTrack: la sesión actual sigue siendo funcional.
  }
}

export async function getTrack(id: string): Promise<StoredTrack | undefined> {
  try {
    const db = await getDb()
    return await db.get('tracks', id)
  } catch {
    return undefined
  }
}

/** Actualiza solo la forma de onda; conserva el resto del registro guardado. */
export async function updateTrackWaveform(id: string, waveform: number[]): Promise<void> {
  try {
    const db = await getDb()
    const record = await db.get('tracks', id)
    if (!record) return
    await db.put('tracks', { ...record, waveform, waveformReal: true })
  } catch {
    // Una forma de onda calculada no justifica perder la pista.
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

/** Actualiza solo la posición sin sobrescribir el resto del estado guardado. */
export async function savePlaybackPosition(currentTime: number): Promise<void> {
  const stored = await loadSettings()
  if (!stored) return
  const { key: _key, ...rest } = stored
  await saveSettings({ ...DEFAULT_PERSISTED_SNAPSHOT, ...rest, currentTime })
}
