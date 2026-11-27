import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus, FolderOpen, LoaderCircle, Music, Plus, Search, Trash2 } from 'lucide-react'
import { useCoverUrl } from '../hooks/useTrackUrls'
import { useVirtualList } from '../hooks/useVirtualList'
import { usePlayer } from '../hooks/usePlayer'
import { formatTime } from '../lib/format'
import { pageSizeFor } from '../lib/performance'
import type { Track } from '../types'
import { EqualizerBars } from './EqualizerBars'
import { MarqueeText } from './MarqueeText'

/** 44 px de fila + 5 px de separación, según biblioteca.css. */
const ROW_HEIGHT = 49

interface LibraryRowProps {
  track: Track
  isCurrent: boolean
  isPlaying: boolean
  onPlay: (id: string) => void
  onEnqueue: (id: string) => void
  onRemove: (id: string) => Promise<void>
}

const LibraryRow = memo(function LibraryRow({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  onEnqueue,
  onRemove,
}: LibraryRowProps) {
  const coverUrl = useCoverUrl(track)
  return (
    <div className={`track-row ${isCurrent ? 'is-current' : ''}`}>
      <button
        type="button"
        className="track-row__main"
        onClick={() => onPlay(track.id)}
        title={`Reproducir ${track.title}`}
      >
        <span className="track-row__thumb">
          {coverUrl ? (
            <img src={coverUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <Music size={15} />
          )}
        </span>
        {isCurrent && isPlaying && <EqualizerBars />}
        <span className="track-row__text">
          <strong>
            <MarqueeText>{track.title}</MarqueeText>
          </strong>
          <small>
            <MarqueeText>{track.artist}</MarqueeText>
          </small>
        </span>
        <span className="track-row__time tabular">{formatTime(track.durationMs / 1000)}</span>
      </button>
      <button
        type="button"
        className="icon-btn tiny"
        onClick={() => onEnqueue(track.id)}
        aria-label={`Añadir ${track.title} a la cola`}
        title="Añadir a la cola"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        className="icon-btn tiny danger"
        onClick={() => void onRemove(track.id)}
        aria-label={`Quitar ${track.title} de la biblioteca`}
        title="Quitar de la biblioteca"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
})

export function LibraryIsland() {
  const {
    tracks,
    queue,
    currentTrack,
    isPlaying,
    isImporting,
    importProgress,
    importFiles,
    playTrack,
    enqueue,
    removeTrack,
    settings,
  } = usePlayer()
  const [tab, setTab] = useState<'library' | 'queue'>('library')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const pageSize = pageSizeFor(settings.lowPerformance)
  const [limit, setLimit] = useState(pageSize)

  const source = tab === 'queue' ? queue : tracks
  const search = deferredQuery.trim().toLowerCase()
  const visible = useMemo(
    () =>
      search
        ? source.filter((track) =>
            `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(search),
          )
        : source,
    [search, source],
  )
  const shown = visible.slice(0, limit)
  const virtual = useVirtualList(shown.length, ROW_HEIGHT, 4)

  useEffect(() => setLimit(pageSize), [pageSize, search, tab])

  const handleFiles = (files: FileList | null): void => {
    if (files?.length) void importFiles(Array.from(files))
  }

  return (
    <section
      className="island library-island"
      aria-label="Biblioteca y cola de reproducción"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        void importFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <div className="library-island__head">
        <div className="tabs" role="tablist" aria-label="Vista de la biblioteca">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'library'}
            className={tab === 'library' ? 'is-active' : ''}
            onClick={() => setTab('library')}
          >
            Biblioteca
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'queue'}
            className={tab === 'queue' ? 'is-active' : ''}
            onClick={() => setTab('queue')}
          >
            Cola
          </button>
        </div>
        <div className="library-island__actions">
          <button
            type="button"
            className="icon-btn small"
            onClick={() => fileRef.current?.click()}
            aria-label="Añadir archivos de audio"
            title="Añadir archivos"
          >
            <FilePlus size={16} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            onClick={() => folderRef.current?.click()}
            aria-label="Importar una carpeta"
            title="Importar carpeta"
          >
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      <label className="search-field">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar canción, artista o álbum"
          aria-label="Buscar en la biblioteca"
        />
      </label>

      <div className="library-island__list island-scroll" ref={virtual.ref}>
        {shown.length === 0 ? (
          <div className="library-empty">
            <Music size={34} strokeWidth={1.3} />
            <strong>{search ? 'Sin resultados' : 'Tu biblioteca está vacía'}</strong>
            <p>Arrastra archivos aquí, añade canciones o importa una carpeta completa.</p>
            {!search && (
              <div className="library-empty__actions">
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  Añadir canciones
                </button>
                <button type="button" className="btn" onClick={() => folderRef.current?.click()}>
                  Importar carpeta
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {virtual.paddingTop > 0 && (
              <div
                className="virtual-spacer"
                style={{ height: Math.max(0, virtual.paddingTop - 5) }}
                aria-hidden="true"
              />
            )}
            {shown.slice(virtual.start, virtual.end).map((track) => (
              <LibraryRow
                key={track.id}
                track={track}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={playTrack}
                onEnqueue={enqueue}
                onRemove={removeTrack}
              />
            ))}
            {virtual.paddingBottom > 0 && (
              <div
                className="virtual-spacer"
                style={{ height: Math.max(0, virtual.paddingBottom - 5) }}
                aria-hidden="true"
              />
            )}
          </>
        )}
        {visible.length > limit && (
          <button
            type="button"
            className="chip chip--muted list-more"
            onClick={() => setLimit((current) => current + pageSize)}
          >
            Mostrar más ({visible.length - limit})
          </button>
        )}
      </div>

      {isImporting && (
        <div className="import-status" role="status">
          <LoaderCircle size={16} className="spin" />
          Importando {importProgress?.current ?? 0} de {importProgress?.total ?? 0}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.flac,.opus,.m4a,.aac"
        multiple
        className="hidden-input"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden-input"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
    </section>
  )
}
