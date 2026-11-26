import { useState } from 'react'
import { Check, Copy, Download, ExternalLink, RefreshCw } from 'lucide-react'
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
      setError('No se pudo consultar GitHub.')
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
        'Instalador verificado con SHA-256 y abierto desde GitHub. Escribe la clave de un solo uso en la opción «Actualizar».',
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
        Busca únicamente en los releases de GitHub. La app verifica el SHA-256 del instalador antes
        de abrirlo y te da una clave de un solo uso para confirmar la actualización.
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
        </div>
      </div>

      {info && !info.available && !info.error && (
        <p className="update-message">
          <Check size={14} />{' '}
          {info.message ?? `Ya tienes la última versión (${info.currentVersion}).`}
        </p>
      )}

      {info?.available && (
        <div className="update-found">
          <div className="setting-row__info">
            <strong>
              <Download size={14} /> Versión {info.version} disponible
              <span className="update-source">GitHub</span>
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

      {(error || info?.error) && (
        <p className="update-error">{error || info?.error}</p>
      )}
      {status && <p className="update-message">{status}</p>}
    </div>
  )
}
