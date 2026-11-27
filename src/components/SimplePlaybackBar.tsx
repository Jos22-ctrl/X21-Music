import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'

/**
 * Barra de reproducción simple: sustituye solo a la isla de controles.
 * La información, forma de onda, deslizador, volumen y biblioteca se mantienen igual.
 */
export function SimplePlaybackBar() {
  const { isPlaying, isShuffle, repeatMode, togglePlay, toggleShuffle, cycleRepeat, prev, next } =
    usePlayer()

  return (
    <section
      className="island controls-island simple-controls"
      aria-label="Controles de reproducción"
    >
      <button
        type="button"
        className={`icon-btn small ${isShuffle ? 'is-active' : ''}`}
        onClick={toggleShuffle}
        aria-pressed={isShuffle}
        aria-label="Reproducción aleatoria"
        title="Aleatorio"
      >
        <Shuffle size={16} />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={prev}
        aria-label="Canción anterior"
        title="Anterior"
      >
        <SkipBack size={18} fill="currentColor" />
      </button>
      <button
        type="button"
        className={`btn-play simple-controls__play ${isPlaying ? 'is-playing' : ''}`}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {isPlaying ? (
          <Pause size={24} fill="currentColor" />
        ) : (
          <Play size={24} fill="currentColor" />
        )}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={next}
        aria-label="Canción siguiente"
        title="Siguiente"
      >
        <SkipForward size={18} fill="currentColor" />
      </button>
      <button
        type="button"
        className={`icon-btn small ${repeatMode !== 'off' ? 'is-active' : ''}`}
        onClick={cycleRepeat}
        aria-label={`Repetición: ${repeatMode}`}
        title={`Repetición: ${repeatMode}`}
      >
        <Repeat size={16} />
        {repeatMode === 'one' ? <span className="repeat-one">1</span> : null}
      </button>
    </section>
  )
}
