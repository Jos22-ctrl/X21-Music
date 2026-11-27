import type { Palette } from './lib/color'
import type { IslandLayout } from './lib/islandLayout'

export interface StoredTrack {
  id: string
  title: string
  artist: string
  album: string
  durationMs: number
  fileName: string
  /** Ruta de la copia en C:\Users\<usuario>\X21 Music\Música, cuando existe. */
  filePath?: string | null
  /** SHA-256 parcial de la importación; opcional para bibliotecas de la v1. */
  contentHash?: string | null
  mimeType: string
  fileBlob: Blob
  coverBlob: Blob | null
  /** Paleta calculada una vez por canción y persistida en el registro. */
  palette: Palette
  waveform: number[]
  /** Opcional: true cuando la forma de onda real ya se calculó en tiempo de inactividad. */
  waveformReal?: boolean
  addedAt: number
}

export interface Track extends Omit<StoredTrack, 'fileBlob' | 'coverBlob'> {
  /** Tamaño del blob en memoria; se usa solo para estimar el espacio de la carpeta. */
  fileSize: number
  audioUrl: string
  coverUrl: string | null
}

export type RepeatMode = 'off' | 'one' | 'all'

/** Diseño de la barra de controles: simple por defecto o la versión anterior. */
export type PlaybackBarStyle = 'simple' | 'clasico'

/** Preferencias avanzadas del reproductor (persistidas en IndexedDB). */
export interface PlaybackSettings {
  /** Segundos de fundido entre pistas; 0 = cambio instantáneo. */
  crossfadeSeconds: number
  /** Quita la pausa fija de 400 ms entre canciones; no detecta silencio en el audio. */
  skipSilence: boolean
  /** Evita añadir dos veces la misma canción (biblioteca y cola). */
  preventDuplicates: boolean
  /** Por defecto se copia; activarlo mueve el original y envía a papelera al eliminar. */
  moveOriginals: boolean
  /** Tema oscuro monocromo: un solo color, sin paleta de la portada. */
  monoDark: boolean
  /** Desplaza los títulos largos; si es false se cortan en una línea con elipsis. */
  marqueeTitles: boolean
  /** Isla asignada a cada ranura de la rejilla (se guarda tras arrastrar con Ctrl). */
  islandLayout: IslandLayout
  /** Barra simple por defecto; «clasico» recupera la barra de controles anterior. */
  playbackBarStyle: PlaybackBarStyle
  /** Reduce animaciones, desenfoques y cantidad de elementos dibujados. */
  lowPerformance: boolean
}

export interface PersistedSettings {
  key: string
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isShuffle: boolean
  queueIds: string[]
  currentTrackId: string | null
  currentTime: number
  /** Opcional para no romper ajustes guardados en versiones anteriores. */
  preferences?: Partial<PlaybackSettings>
}
