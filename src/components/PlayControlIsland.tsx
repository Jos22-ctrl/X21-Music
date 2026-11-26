import type { CSSProperties } from 'react'
import { Pause, Play, Repeat, Shuffle } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'

export function PlayControlIsland() {
  const { isPlaying, progress, isShuffle, repeatMode, togglePlay, toggleShuffle, cycleRepeat } =
    usePlayer()

  return (
    <section className="island controls-island" aria-label="Controles de reproducción">
      <button
        type="button"
        className={`icon-btn ${isShuffle ? 'is-active' : ''}`}
        onClick={toggleShuffle}
        aria-pressed={isShuffle}
        aria-label="Reproducción aleatoria"
        title="Aleatorio"
      >
        <Shuffle size={18} />
      </button>
      <button
        type="button"
        className="btn-play"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        style={{ '--progress': progress } as CSSProperties}
      >
        <span className="btn-play__ring" aria-hidden="true" />
        {isPlaying ? (
          <Pause size={26} fill="currentColor" />
        ) : (
          <Play size={26} fill="currentColor" />
        )}
      </button>
      <button
        type="button"
        className={`icon-btn ${repeatMode !== 'off' ? 'is-active' : ''}`}
        onClick={cycleRepeat}
        aria-label={`Repetición: ${repeatMode}`}
        title={`Repetición: ${repeatMode}`}
      >
        <Repeat size={18} />
        {repeatMode === 'one' ? <span className="repeat-one">1</span> : null}
      </button>
    </section>
  )
}
