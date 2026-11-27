import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Disc3, Info, ListMusic, RefreshCw, Settings2, X } from 'lucide-react'
import { AmbientBackdrop } from './components/AmbientBackdrop'
import { CoverIsland } from './components/CoverIsland'
import { TrackInfoIsland } from './components/TrackInfoIsland'
import { WaveformProgressIsland } from './components/WaveformProgressIsland'
import { TrackSliderIsland } from './components/TrackSliderIsland'
import { PlayControlIsland } from './components/PlayControlIsland'
import { VolumeIsland } from './components/VolumeIsland'
import { LibraryIsland } from './components/LibraryIsland'
import { SimplePlaybackBar } from './components/SimplePlaybackBar'
import { SongsView } from './components/SongsView'
import { SettingsDialog, type DialogTab } from './components/SettingsDialog'
import { useIslandDrag } from './hooks/useIslandDrag'
import { usePlayer } from './hooks/usePlayer'
import { MONO_PALETTE } from './lib/color'
import {
  CENTER_SLOTS,
  DEFAULT_ISLAND_LAYOUT,
  ISLAND_LABELS,
  swapIslandSlots,
  type IslandId,
  type IslandSlot,
} from './lib/islandLayout'
import { APP_LABEL } from './lib/version'
import './App.css'

type View = 'player' | 'songs'

const ISLAND_COMPONENTS: Record<IslandId, ComponentType> = {
  cover: CoverIsland,
  info: TrackInfoIsland,
  wave: WaveformProgressIsland,
  slider: TrackSliderIsland,
  controls: PlayControlIsland,
  volume: VolumeIsland,
  library: LibraryIsland,
}

function Island({ id }: { id: IslandId }) {
  const Component = ISLAND_COMPONENTS[id] ?? TrackInfoIsland
  return <Component />
}

export default function App() {
  const { palette, currentTrack, settings, updateSettings, error, clearError } = usePlayer()
  const [view, setView] = useState<View>('player')
  const [dialog, setDialog] = useState<DialogTab | null>(null)

  // En modo monocromo se ignoran los colores y la imagen de la portada.
  const activePalette = settings.monoDark ? MONO_PALETTE : palette
  const hasCover = Boolean(currentTrack?.coverUrl) && !settings.monoDark

  const layout = settings.islandLayout ?? DEFAULT_ISLAND_LAYOUT
  const isClassic = settings.playbackBarStyle === 'clasico'
  const handleReorder = useCallback(
    (from: IslandSlot, to: IslandSlot): void => {
      updateSettings({ islandLayout: swapIslandSlots(layout, from, to) })
    },
    [layout, updateSettings],
  )
  const { dragging, target, onPointerDownCapture } = useIslandDrag({ onReorder: handleReorder })

  /** En modo simple solo se sustituye la isla de controles; el resto no cambia. */
  const renderIsland = (id: IslandId) =>
    id === 'controls' && !isClassic ? <SimplePlaybackBar /> : <Island id={id} />

  const slotProps = (slot: IslandSlot) => {
    const id = layout[slot]
    const label = ISLAND_LABELS[id] ?? ISLAND_LABELS.info
    return {
      'data-island-slot': slot,
      'data-island-id': id,
      'data-island-label': label,
      'data-dragging': dragging === slot ? 'true' : undefined,
      'data-drop-target': target === slot ? 'true' : undefined,
      title: `Ctrl + arrastrar para mover ${label}`,
    }
  }

  // Tokens dinámicos en :root, calculados una sola vez por canción.
  useEffect(() => {
    const style = document.documentElement.style
    style.setProperty('--c-dominant', activePalette.dominant)
    style.setProperty('--c-vibrant', activePalette.vibrant)
    style.setProperty('--c-muted', activePalette.muted)
    style.setProperty('--accent', activePalette.accent)
    style.setProperty('--on-accent', activePalette.onAccent)
    style.setProperty('--cover-dim', String(activePalette.dim))
    style.setProperty(
      '--cover-url',
      !settings.monoDark && currentTrack?.coverUrl ? `url("${currentTrack.coverUrl}")` : 'none',
    )
    style.setProperty('--low-performance', settings.lowPerformance ? '1' : '0')
    document.documentElement.dataset.lowPerformance = settings.lowPerformance ? 'true' : 'false'
    document.documentElement.dataset.motion = settings.reduceMotion ? 'reduced' : 'full'
  }, [activePalette, currentTrack?.coverUrl, settings.monoDark, settings.lowPerformance, settings.reduceMotion])

  return (
    <>
      <AmbientBackdrop />

      <main className="app-shell" data-cover={hasCover ? 'yes' : 'none'} data-view={view}>
        <header className="app-header">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">
              X21 <strong>MUSIC</strong>
            </span>
            <span className="brand__tag">{APP_LABEL}</span>
          </div>

          <span className="reorder-hint">Ctrl + arrastrar mueve las islas</span>

          <nav className="view-switch" aria-label="Vistas de la aplicación">
            <button
              type="button"
              className={view === 'player' ? 'is-active' : ''}
              onClick={() => setView('player')}
              aria-pressed={view === 'player'}
            >
              <Disc3 size={15} /> <span>Reproductor</span>
            </button>
            <button
              type="button"
              className={view === 'songs' ? 'is-active' : ''}
              onClick={() => setView('songs')}
              aria-pressed={view === 'songs'}
            >
              <ListMusic size={15} /> <span>Canciones</span>
            </button>
          </nav>

          <div className="header-actions">
            <div className="header-palette" aria-hidden="true">
              <span style={{ background: activePalette.dominant }} />
              <span style={{ background: activePalette.vibrant }} />
              <span style={{ background: activePalette.accent }} />
            </div>
            <button
              type="button"
              className="icon-btn small"
              onClick={() => setDialog('updates')}
              aria-label="Buscar actualizaciones"
              title="Actualizaciones"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              className="icon-btn small"
              onClick={() => setDialog('about')}
              aria-label="Acerca de X21 Music"
              title="Acerca de"
            >
              <Info size={16} />
            </button>
            <button
              type="button"
              className="icon-btn small"
              onClick={() => setDialog('settings')}
              aria-label="Ajustes"
              title="Ajustes"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </header>

        {view === 'player' ? (
          <div
            className="player-grid"
            data-reordering={dragging ? 'true' : 'false'}
            onPointerDownCapture={onPointerDownCapture}
          >
            <div className="area-cover island-slot" {...slotProps('cover')}>
              {renderIsland(layout.cover)}
            </div>

            <div className="area-center">
              {CENTER_SLOTS.map((slot) => (
                <div key={slot} className="center-slot island-slot" {...slotProps(slot)}>
                  {renderIsland(layout[slot])}
                </div>
              ))}
            </div>

            <div className="area-library island-slot" {...slotProps('library')}>
              {renderIsland(layout.library)}
            </div>
          </div>
        ) : (
          <div className="songs-area">
            <SongsView />
          </div>
        )}

        <div className="sr-only" aria-live="polite">
          {dragging && target
            ? `${ISLAND_LABELS[layout[dragging]]} se moverá a la zona de ${ISLAND_LABELS[target]}.`
            : ''}
        </div>
      </main>

      {dialog && (
        <SettingsDialog
          tab={dialog}
          onTabChange={setDialog}
          onClose={() => setDialog(null)}
        />
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  )
}
