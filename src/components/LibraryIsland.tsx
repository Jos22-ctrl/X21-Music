import { useRef, useState } from 'react'
import { FilePlus, FolderOpen, LoaderCircle, Music, Plus, Search, Trash2 } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { formatTime } from '../lib/format'
import { MarqueeText } from './MarqueeText'

export function LibraryIsland() {
  const {
    tracks,
    queue,
    currentTrack,
    isImporting,
    importProgress,
    importFiles,
    playTrack,
    enqueue,
    removeTrack,
  } = usePlayer()
  const [tab, setTab] = useState<'library' | 'queue'>('library')
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const source = tab === 'queue' ? queue : tracks
  const search = query.trim().toLowerCase()
  const visible = search
    ? source.filter((track) =>
        `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(search),
      )
    : source

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

      <div className="library-island__list island-scroll">
        {visible.length === 0 ? (
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
          visible.map((track) => (
            <div
              key={track.id}
              className={`track-row ${currentTrack?.id === track.id ? 'is-current' : ''}`}
            >
              <button
                type="button"
                className="track-row__main"
                onClick={() => playTrack(track.id)}
                title={`Reproducir ${track.title}`}
              >
                <span className="track-row__thumb">
                  {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <Music size={15} />}
                </span>
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
                onClick={() => enqueue(track.id)}
                aria-label={`Añadir ${track.title} a la cola`}
                title="Añadir a la cola"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="icon-btn tiny danger"
                onClick={() => void removeTrack(track.id)}
                aria-label={`Quitar ${track.title} de la biblioteca`}
                title="Quitar de la biblioteca"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
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
