import { useState } from 'react'
import { Check, Copy, Download, ExternalLink, FolderOpen, RefreshCw } from 'lucide-react'
import { APP_VERSION } from '../lib/version'

export function UpdateSection() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [copied, setCopied] = useState(false)

  const api = typeof window === 'undefined' ? undefined : window.electronAPI

  const check = async () => {
    if (!api) {
      setError('Las actualizaciones solo funcionan en la aplicación de Windows.')
      return
    }
    setChecking(true)
    setError('')
    setStatus('')
    setCopied(false)
    try {
      setInfo(await api.checkForUpdates())
    } catch {
      setError('No se pudo leer la carpeta de actualizaciones.')
    } finally {
      setChecking(false)
    }
  }

  const install = async () => {
    if (!api || !info?.key) return
    setInstalling(true)
    setError('')
    try {
      await api.installUpdate(info.key)
      setStatus(
        `Instalador verificado con SHA-256 y abierto (origen: ${
          info?.source === 'github' ? 'GitHub' : 'carpeta local'
        }). Escribe la clave de un solo uso en la opción «Actualizar».`,
      )
    } catch {
      setError(
        'No se pudo verificar o abrir el instalador. Vuelve a buscar actualizaciones; la clave cambia cada vez.',
      )
    } finally {
      setInstalling(false)
    }
  }

  const copyKey = async () => {
    if (!info?.key) return
    try {
      await navigator.clipboard.writeText(info.key)
      setCopied(true)
    } catch {
      setError('No se pudo copiar la clave; cópiala manualmente.')
    }
  }

  return (
    <div className="update-section">
      <p className="settings-intro">
        Busca primero en los releases de GitHub y, si no hay red o no hay uno más nuevo, en tu
        carpeta local con <code>update.json</code>. La app verificará el SHA-256 del instalador
        antes de abrirlo y te dará una clave de un solo uso para confirmar la actualización.
      </p>

      <div className="setting-row">
        <div className="setting-row__info">
          <strong>
            <RefreshCw size={14} /> Buscar actualizaciones
          </strong>
          <small>Versión instalada: {info?.currentVersion ?? APP_VERSION}.</small>
        </div>
        <div className="update-actions">
          <button
            type="button"
            className="chip"
            onClick={() => void check()}
            disabled={checking}
          >
            <RefreshCw size={13} /> {checking ? 'Buscando…' : 'Buscar'}
          </button>
          {api && (
            <button
              type="button"
              className="chip chip--muted"
              onClick={() => void api.openUpdatesFolder()}
            >
              <FolderOpen size={13} /> Abrir carpeta
            </button>
          )}
        </div>
      </div>

      {info && !info.available && (
        <p className="update-message">
          <Check size={14} /> Ya tienes la última versión disponible ({info.currentVersion}).
        </p>
      )}

      {info?.available && (
        <div className="update-found">
          <div className="setting-row__info">
            <strong>
              <Download size={14} /> Versión {info.version} disponible
              <span className="update-source">
                {info.source === 'github' ? 'GitHub' : 'Carpeta local'}
              </span>
            </strong>
            {info.notes ? <small>{info.notes}</small> : null}
            {info.releaseUrl && (
              <a className="update-link" href={info.releaseUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={13} /> Ver release en GitHub
              </a>
            )}
          </div>
          <div className="update-key">
            <span>Tu clave de actualización</span>
            <code>{info.key}</code>
            <button type="button" className="chip chip--muted" onClick={() => void copyKey()}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <button
            type="button"
            className="chip is-active"
            onClick={() => void install()}
            disabled={installing}
          >
            <Download size={13} /> {installing ? 'Descargando…' : 'Descargar e instalar'}
          </button>
          <small className="update-hint">
            El instalador debe abrirse desde aquí: elige «Actualizar» y escribe la clave. Cambia en
            cada búsqueda, así que un instalador guardado antes no servirá.
          </small>
        </div>
      )}

      {error && <p className="update-error">{error}</p>}
      {status && <p className="update-message">{status}</p>}
      {info?.folder && <small className="update-path">{info.folder}</small>}
    </div>
  )
}
