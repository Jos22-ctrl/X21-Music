import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Check,
  Clock,
  FolderOpen,
  Gauge,
  Info,
  LayoutGrid,
  Moon,
  Music,
  Palette,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  Type,
  Volume2,
  X,
} from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { formatApproximateSize } from '../lib/filePaths'
import { formatTime } from '../lib/format'
import { DEFAULT_ISLAND_LAYOUT } from '../lib/islandLayout'
import { APP_LABEL, APP_STAGE, APP_VERSION } from '../lib/version'
import { UpdateSection } from './UpdateSection'

export type DialogTab = 'settings' | 'updates' | 'about'

interface SettingsDialogProps {
  tab: DialogTab
  onTabChange: (tab: DialogTab) => void
  onClose: () => void
}

const SLEEP_OPTIONS = [5, 10, 15, 30, 45, 60]

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <div className="toggle-field">
      <span className="toggle-field__state">{checked ? 'Activado' : 'Desactivado'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

export function SettingsDialog({ tab, onTabChange, onClose }: SettingsDialogProps) {
  const {
    settings,
    updateSettings,
    musicFolder,
    openMusicFolder,
    copyLibraryToFolder,
    sleepMinutes,
    sleepRemaining,
    setSleepTimer,
    tracks,
    queue,
  } = usePlayer()
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const approximateBytes = tracks.reduce((total, track) => total + track.fileSize, 0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="island modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal__head">
          <div className="modal__tabs" role="tablist" aria-label="Panel">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'settings'}
              className={tab === 'settings' ? 'is-active' : ''}
              onClick={() => onTabChange('settings')}
            >
              <SlidersHorizontal size={14} /> Ajustes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'updates'}
              className={tab === 'updates' ? 'is-active' : ''}
              onClick={() => onTabChange('updates')}
            >
              <RefreshCw size={14} /> Actualizaciones
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'about'}
              className={tab === 'about' ? 'is-active' : ''}
              onClick={() => onTabChange('about')}
            >
              <Info size={14} /> Acerca de
            </button>
          </div>
          <button
            type="button"
            className="icon-btn small"
            onClick={onClose}
            aria-label="Cerrar panel"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        {tab === 'settings' ? (
          <div className="modal__body settings-body" id="modal-title">
            <p className="settings-intro">
              Cambia lo que quieras. Todo se guarda automáticamente en este equipo.
            </p>

            <section className="settings-section">
              <h3 className="settings-section__title">
                <Volume2 size={14} /> Sonido
              </h3>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>Transición entre canciones</strong>
                  <small>0 = cambio inmediato. Más segundos = fundido más suave.</small>
                </div>
                <div className="setting-row__control">
                  <input
                    className="slider setting-slider"
                    type="range"
                    min={0}
                    max={8}
                    step={0.5}
                    value={settings.crossfadeSeconds}
                    onChange={(event) =>
                      updateSettings({ crossfadeSeconds: Number(event.target.value) })
                    }
                    aria-label="Segundos de transición entre canciones"
                    style={{ '--fill': `${(settings.crossfadeSeconds / 8) * 100}%` } as CSSProperties}
                  />
                  <span className="setting-value">
                    {settings.crossfadeSeconds === 0
                      ? 'Inmediata'
                      : `${settings.crossfadeSeconds} s`}
                  </span>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>Sin pausa entre canciones</strong>
                  <small>
                    Suprime la pausa fija de 400 ms. No analiza ni omite silencios dentro del audio.
                  </small>
                </div>
                <Toggle
                  checked={settings.skipSilence}
                  onChange={(value) => updateSettings({ skipSilence: value })}
                  label="Sin pausa entre canciones"
                />
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section__title">
                <Palette size={14} /> Apariencia
              </h3>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>
                    <Play size={14} /> Diseño de reproducción
                  </strong>
                  <small>
                    Barra simple por defecto. «Clásico» recupera los controles anteriores con su
                    anillo de progreso. El resto de islas no cambia.
                  </small>
                </div>
                <div
                  className="style-switch"
                  role="group"
                  aria-label="Diseño de la barra de reproducción"
                >
                  <button
                    type="button"
                    className={`chip ${settings.playbackBarStyle === 'simple' ? 'is-active' : ''}`}
                    aria-pressed={settings.playbackBarStyle === 'simple'}
                    onClick={() => updateSettings({ playbackBarStyle: 'simple' })}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    className={`chip ${settings.playbackBarStyle === 'clasico' ? 'is-active' : ''}`}
                    aria-pressed={settings.playbackBarStyle === 'clasico'}
                    onClick={() => updateSettings({ playbackBarStyle: 'clasico' })}
                  >
                    Clásico
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>
                    <Moon size={14} /> Modo oscuro simple
                  </strong>
                  <small>Un solo color oscuro, sin los colores de la portada.</small>
                </div>
                <Toggle
                  checked={settings.monoDark}
                  onChange={(value) => updateSettings({ monoDark: value })}
                  label="Modo oscuro de un solo color"
                />
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>
                    <Type size={14} /> Títulos largos
                  </strong>
                  <small>
                    Por defecto se cortan en una línea con «…». Actívalo para que se desplacen.
                  </small>
                </div>
                <Toggle
                  checked={settings.marqueeTitles}
                  onChange={(value) => updateSettings({ marqueeTitles: value })}
                  label="Desplazar títulos largos"
                />
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>
                    <LayoutGrid size={14} /> Orden de las islas
                  </strong>
                  <small>
                    Mantén <kbd>Ctrl</kbd>, haz clic y arrastra una isla a otra zona. Se guarda
                    solo.
                  </small>
                </div>
                <button
                  type="button"
                  className="chip chip--muted"
                  onClick={() => updateSettings({ islandLayout: DEFAULT_ISLAND_LAYOUT })}
                  title="Volver al orden original"
                >
                  <RotateCcw size={13} /> Restablecer
                </button>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section__title">
                <Gauge size={14} /> Rendimiento
              </h3>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>Modo de bajo rendimiento</strong>
                  <small>
                    Quita desenfoques y animaciones, reduce la forma de onda y muestra menos
                    canciones a la vez. Útil en equipos lentos o con bibliotecas grandes.
                  </small>
                </div>
                <Toggle
                  checked={settings.lowPerformance}
                  onChange={(value) => updateSettings({ lowPerformance: value })}
                  label="Modo de bajo rendimiento"
                />
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>Reducir animaciones</strong>
                  <small>
                    Detiene las entradas, la respiración del botón de reproducción y el ecualizador.
                    Se guarda en este equipo y respeta la preferencia de Windows.
                  </small>
                </div>
                <Toggle
                  checked={settings.reduceMotion}
                  onChange={(value) => updateSettings({ reduceMotion: value })}
                  label="Reducir animaciones"
                />
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section__title">
                <Music size={14} /> Biblioteca y archivos
              </h3>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>No repetir canciones</strong>
                  <small>Evita añadir dos veces la misma canción.</small>
                </div>
                <Toggle
                  checked={settings.preventDuplicates}
                  onChange={(value) => updateSettings({ preventDuplicates: value })}
                  label="No permitir canciones repetidas"
                />
              </div>
              <div className="setting-row">
                <div className="setting-row__info">
                  <strong>Mover archivos originales</strong>
                  <small>
                    Por defecto se copian y el original se queda donde estaba. Si lo activas, el
                    original se mueve y al borrar la canción va a la papelera.
                  </small>
                </div>
                <Toggle
                  checked={settings.moveOriginals}
                  onChange={(value) => updateSettings({ moveOriginals: value })}
                  label="Mover archivos originales"
                />
              </div>
              <div className="setting-block music-folder">
                <div className="setting-row__info">
                  <strong>
                    <FolderOpen size={14} /> Carpeta de música
                  </strong>
                  <small className="music-folder__path">
                    {musicFolder ?? 'C:\\Users\\<usuario>\\X21 Music\\Música'}
                  </small>
                  <small>
                    Al añadir canciones se copian a esa carpeta (o se mueven si activas la opción
                    anterior). Espacio aproximado de la biblioteca:{' '}
                    {formatApproximateSize(approximateBytes)}.
                  </small>
                </div>
                <div className="music-folder__actions">
                  <button type="button" className="chip" onClick={() => void openMusicFolder()}>
                    <FolderOpen size={13} /> Abrir carpeta
                  </button>
                  <button
                    type="button"
                    className="chip chip--muted"
                    disabled={copying}
                    onClick={() => {
                      setCopying(true)
                      void copyLibraryToFolder().then((count) => {
                        setCopyMessage(`${count} canción(es) copiadas a la carpeta.`)
                        setCopying(false)
                      })
                    }}
                  >
                    {copying ? 'Copiando…' : 'Copiar biblioteca'}
                  </button>
                </div>
                {copyMessage && <p className="music-folder__status">{copyMessage}</p>}
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section__title">
                <Clock size={14} /> Apagado automático
              </h3>
              <div className="setting-block">
                <div className="setting-row__info">
                  <strong>
                    <Timer size={14} /> Detener la música
                  </strong>
                  <small>
                    {sleepRemaining !== null
                      ? `Quedan ${formatTime(sleepRemaining)}.`
                      : 'Elige cuántos minutos debe sonar antes de parar.'}
                  </small>
                </div>
                <div className="sleep-options">
                  {SLEEP_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={`chip ${sleepMinutes === minutes ? 'is-active' : ''}`}
                      onClick={() => setSleepTimer(minutes)}
                      aria-pressed={sleepMinutes === minutes}
                    >
                      {minutes} min
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip chip--muted"
                    onClick={() => setSleepTimer(null)}
                    disabled={sleepMinutes === null}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </section>

            <p className="modal__note">
              Biblioteca: {tracks.length} canciones · Cola: {queue.length}.
            </p>
          </div>
        ) : tab === 'updates' ? (
          <div className="modal__body settings-body" id="modal-title">
            <UpdateSection />
          </div>
        ) : (
          <div className="modal__body about" id="modal-title">
            <div className="about__hero">
              <span className="about__mark" aria-hidden="true" />
              <div>
                <h2>X21 Music</h2>
                <span className="about__badge">{APP_LABEL}</span>
              </div>
            </div>
            <p>
              Reproductor local de música con interfaz de islas y color extraído de la portada.
              Toda la música, los metadatos y las portadas se procesan en tu dispositivo.
            </p>
            <ul className="about__list">
              <li>
                <Check size={13} /> Color desde la carátula y modo oscuro monocromo
              </li>
              <li>
                <Check size={13} /> Transición gradual y reproducción sin silencios
              </li>
              <li>
                <Check size={13} /> Cambio de canción deslizable y vista de canciones
              </li>
              <li>
                <Check size={13} /> Temporizador de apagado y control multimedia del sistema
              </li>
              <li>
                <Check size={13} /> Alineación adaptable y títulos largos con desplazamiento opcional
              </li>
              <li>
                <Check size={13} /> Islas reordenables con Ctrl + arrastrar
              </li>
              <li>
                <Check size={13} /> Barra de controles simple, con opción de volver a la anterior
              </li>
              <li>
                <Check size={13} /> Música en tu carpeta de Users y ajustes legibles
              </li>
            </ul>
            <h3>Novedades de 0.9.14</h3>
            <ul className="about__list">
              <li>
                <Check size={13} /> Corregido el fallo que impedía consultar GitHub desde el botón
                de actualizaciones
              </li>
            </ul>
            <h3>Novedades de 0.9.13</h3>
            <ul className="about__list">
              <li>
                <Check size={13} /> La búsqueda de actualizaciones usa la red de Electron y muestra
                el motivo del fallo
              </li>
              <li>
                <Check size={13} /> Distingue entre sin conexión, respuesta de GitHub y versión al
                día
              </li>
            </ul>
            <h3>Novedades de 0.9.12</h3>
            <ul className="about__list">
              <li>
                <Check size={13} /> La cola se completa con toda la biblioteca al abrir
              </li>
              <li>
                <Check size={13} /> Actualizaciones buscadas solo en los releases de GitHub
              </li>
              <li>
                <Check size={13} /> Posición guardada sin depender de `timeupdate` y crossfade real
                entre dos pistas
              </li>
              <li>
                <Check size={13} /> Identificación SHA-256 con biblioteca migrada a IndexedDB v2
              </li>
              <li>
                <Check size={13} /> Importación que copia el original y valida las rutas
              </li>
              <li>
                <Check size={13} /> Tiempo aislado: las islas no se repintan con cada segundo
              </li>
              <li>
                <Check size={13} /> Forma de onda limitada a archivos pequeños
              </li>
              <li>
                <Check size={13} /> Actualizaciones verificadas con SHA-256 y clave de un solo uso
              </li>
              <li>
                <Check size={13} /> CSP estricta y Electron con navegación e IPC restringidos
              </li>
              <li>
                <Check size={13} /> Instalación para todos los usuarios con elevación en su momento
              </li>
              <li>
                <Check size={13} /> Integración continua y release con instalador y suma SHA-256
              </li>
            </ul>
            <p className="about__footer">
              Versión {APP_VERSION} · Etapa {APP_STAGE} · Créditos: Claude y X21
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
