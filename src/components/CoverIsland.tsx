import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'

export function CoverIsland() {
  const { currentTrack } = usePlayer()
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [currentTrack?.coverUrl, currentTrack?.id])

  const hasCover = Boolean(currentTrack?.coverUrl) && !imageFailed

  return (
    <section className="island cover-island" aria-label="Portada de la canción actual">
      {hasCover ? (
        <img
          className="cover-island__img"
          src={currentTrack?.coverUrl ?? undefined}
          alt={`Portada de ${currentTrack?.album || currentTrack?.title || 'la canción'}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="cover-island__empty">
          <Music size={78} strokeWidth={1.2} />
          <span>Sin portada</span>
        </div>
      )}
      <div className="cover-island__gloss" aria-hidden="true" />
    </section>
  )
}
