import { MarqueeText } from './MarqueeText'
import { usePlayer } from '../hooks/usePlayer'

export function TrackInfoIsland() {
  const { currentTrack, palette } = usePlayer()
  const meta = currentTrack
    ? [currentTrack.artist, currentTrack.album].filter(Boolean).join(' · ')
    : 'Importa tu música para empezar'

  return (
    <section className="island info-island" aria-label="Información de la pista">
      <p className="eyebrow">Reproduciendo ahora</p>
      <h1 className="info-island__title">
        <MarqueeText>{currentTrack?.title ?? 'X21 Music'}</MarqueeText>
      </h1>
      <p className="info-island__meta">
        <MarqueeText>{meta}</MarqueeText>
      </p>
      <div className="palette-dots" aria-label="Paleta extraída de la portada">
        <span style={{ background: palette.dominant }} title={`Dominante ${palette.dominant}`} />
        <span style={{ background: palette.vibrant }} title={`Vibrante ${palette.vibrant}`} />
        <span style={{ background: palette.muted }} title={`Apagado ${palette.muted}`} />
        <span style={{ background: palette.accent }} title={`Acento ${palette.accent}`} />
      </div>
    </section>
  )
}
