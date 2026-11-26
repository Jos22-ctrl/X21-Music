import type { CSSProperties } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'

export function VolumeIsland() {
  const { volume, isMuted, setVolume, toggleMute } = usePlayer()
  const effective = isMuted ? 0 : volume

  return (
    <section className="island volume-island" aria-label="Volumen">
      <button
        type="button"
        className="icon-btn"
        onClick={toggleMute}
        aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        title={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
      <input
        className="slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={effective}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Nivel de volumen"
        style={{ '--fill': `${Math.round(effective * 100)}%` } as CSSProperties}
      />
      <span className="volume-island__value tabular">{Math.round(effective * 100)}%</span>
    </section>
  )
}
