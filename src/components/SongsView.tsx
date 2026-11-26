import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Music, Play, Plus, Search } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { formatTime } from '../lib/format'
import { pageSizeFor } from '../lib/performance'
import type { Track } from '../types'
import { MarqueeText } from './MarqueeText'

type Filter = 'recent' | 'all'
type Sort = 'recent' | 'title' | 'artist' | 'album'

const dateLabel = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })

export function SongsView() {
  const {
    tracks,
    currentTrack,
    isImporting,
    importProgress,
    importFiles,
    playTrack,
    enqueue,
    settings,
  } = usePlayer()
  const [filter, setFilter] = useState<Filter>('recent')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const pageSize = pageSizeFor(settings.lowPerformance)
  const [limit, setLimit] = useState(pageSize)

  const artists = useMemo(() => new Set(tracks.map((track) => track.artist).filter(Boolean)).size, [tracks])
  const albums = useMemo(() => new Set(tracks.map((track) => track.album).filter(Boolean)).size, [tracks])

  const visible = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase()
    const list = search
      ? tracks.filter((track) =>
          `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(search),
        )
      : [...tracks]

    const by: Record<Sort, (a: Track, b: Track) => number> = {
      recent: (a, b) => b.addedAt - a.addedAt,
      title: (a, b) => a.title.localeCompare(b.title, 'es'),
      artist: (a, b) => a.artist.localeCompare(b.artist, 'es') || a.title.localeCompare(b.title, 'es'),
      album: (a, b) => a.album.localeCompare(b.album, 'es') || a.title.localeCompare(b.title, 'es'),
    }
    return list.sort(filter === 'recent' ? by.recent : by[sort])
  }, [deferredQuery, filter, sort, tracks])
  const shown = visible.slice(0, limit)

  useEffect(() => setLimit(pageSize), [deferredQuery, filter, pageSize, sort])

  const addFiles = (files: FileList | null): void => {
    if (files?.length) void importFiles(Array.from(files))
  }

  return (
    <section className="island songs-view" aria-label="Vista de canciones">
      <header className="songs-view__head">
        <div className="songs-view__intro">
          <p className="eyebrow">Tu música</p>
          <h1>Canciones</h1>
          <p>
            {tracks.length} canciones · {artists} artistas · {albums} álbumes
          </p>
        </div>
        <label className="search-field songs-view__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar canción, artista o álbum"
            aria-label="Buscar canciones"
          />
        </label>
      </header>

      <div className="songs-view__toolbar">
        <div className="tabs" role="tablist" aria-label="Filtrar canciones">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'recent'}
            className={filter === 'recent' ? 'is-active' : ''}
            onClick={() => setFilter('recent')}
          >
            Recién agregadas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={filter === 'all' ? 'is-active' : ''}
            onClick={() => setFilter('all')}
          >
            Todas
          </button>
        </div>
        <label className="songs-view__sort">
          Ordenar
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="recent">Más recientes</option>
            <option value="title">Título</option>
            <option value="artist">Artista</option>
            <option value="album">Álbum</option>
          </select>
        </label>
      </div>

      <div className="songs-table">
        <div className="songs-table__head" aria-hidden="true">
          <span>#</span>
          <span>Canción</span>
          <span className="col-album">Álbum</span>
          <span className="col-artist">Artista</span>
          <span className="col-date">Añadida</span>
          <span className="col-time">Duración</span>
          <span />
        </div>

        <div className="songs-table__body island-scroll">
          {shown.length === 0 ? (
            <div className="library-empty">
              <Music size={36} strokeWidth={1.3} />
              <strong>{query ? 'Sin resultados' : 'Todavía no hay canciones'}</strong>
              <p>Añade archivos o importa una carpeta para verlos aquí.</p>
              {!query && (
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
            shown.map((track, index) => (
              <div
                key={track.id}
                className={`song-row ${currentTrack?.id === track.id ? 'is-current' : ''}`}
              >
                <button
                  type="button"
                  className="song-row__play"
                  onClick={() => playTrack(track.id)}
                  aria-label={`Reproducir ${track.title}`}
                >
                  <span className="song-row__number">{index + 1}</span>
                  <Play size={13} fill="currentColor" className="song-row__play-icon" />
                </button>
                <div className="song-row__main">
                  <span className="song-row__thumb">
                    {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <Music size={16} />}
                  </span>
                  <span className="song-row__text">
                    <strong>
                      <MarqueeText>{track.title}</MarqueeText>
                    </strong>
                    <small>
                      <MarqueeText>{track.artist}</MarqueeText>
                    </small>
                  </span>
                </div>
                <span className="song-row__cell col-album">{track.album || '—'}</span>
                <span className="song-row__cell col-artist">{track.artist}</span>
                <span className="song-row__cell col-date">{dateLabel(track.addedAt)}</span>
                <span className="song-row__cell song-row__time col-time tabular">
                  {formatTime(track.durationMs / 1000)}
                </span>
                <button
                  type="button"
                  className="icon-btn tiny song-row__add"
                  onClick={() => enqueue(track.id)}
                  aria-label={`Añadir ${track.title} a la cola`}
                  title="Añadir a la cola"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))
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
            Importando {importProgress?.current ?? 0} de {importProgress?.total ?? 0}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.flac,.opus,.m4a,.aac"
        multiple
        className="hidden-input"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden-input"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
    </section>
  )
}
