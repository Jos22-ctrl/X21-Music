import { useEffect, useSyncExternalStore } from 'react'
import { ensureCoverUrl, getCoverUrl, getUrlVersion, subscribeUrls } from '../lib/trackUrls'
import type { Track } from '../types'

/** URL de portada de una fila: se crea solo cuando la fila se monta. */
export function useCoverUrl(track: Track | null | undefined): string | null {
  useSyncExternalStore(subscribeUrls, getUrlVersion, getUrlVersion)
  const id = track?.id
  useEffect(() => {
    if (id) ensureCoverUrl(id)
  }, [id])
  return id ? (getCoverUrl(id) || null) : null
}
