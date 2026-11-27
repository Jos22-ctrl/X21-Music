import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlaybackProvider } from './hooks/usePlayer'
import './index.css'
import App from './App.tsx'

// REQUIERE PRUEBA MANUAL EN WINDOWS: comprobar memoria con 500/2000/10000 pistas sembradas.
if (import.meta.env.DEV) {
  void import('./dev/seed').then(({ seedFakeTracks }) => {
    Object.assign(window, { __x21Seed: seedFakeTracks })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlaybackProvider>
      <App />
    </PlaybackProvider>
  </StrictMode>,
)

// La PWA se registra solo en http(s); Electron carga la app por file://.
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost')
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}
