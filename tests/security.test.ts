import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const security = require('../electron/security.cjs') as {
  isAllowedExternalUrl: (value: string) => boolean
  isAllowedFrameUrl: (value: string, options: { devUrl?: string; isPackaged?: boolean }) => boolean
}

describe('hardening de Electron', () => {
  it('solo abre enlaces HTTPS como externos', () => {
    expect(security.isAllowedExternalUrl('https://github.com/Jos22-ctrl/X21-Music')).toBe(true)
    expect(security.isAllowedExternalUrl('file:///C:/secretos.txt')).toBe(false)
    expect(security.isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('acepta solo el origen local en desarrollo', () => {
    const options = { devUrl: 'http://localhost:5173', isPackaged: false }
    expect(security.isAllowedFrameUrl('http://localhost:5173/', options)).toBe(true)
    expect(security.isAllowedFrameUrl('https://ejemplo.com', options)).toBe(false)
    expect(security.isAllowedFrameUrl('', options)).toBe(false)
  })

  it('acepta solo file:// en la app empaquetada', () => {
    const options = { devUrl: 'http://localhost:5173', isPackaged: true }
    expect(security.isAllowedFrameUrl('file:///C:/App/dist/index.html', options)).toBe(true)
    expect(security.isAllowedFrameUrl('http://localhost:5173/', options)).toBe(false)
  })
})
