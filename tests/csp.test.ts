import { describe, expect, it } from 'vitest'
import { buildCsp, injectCsp } from '../src/lib/csp'

describe('Content-Security-Policy', () => {
  it('produce y modifica la política según el entorno', () => {
    const prod = buildCsp(false)
    const dev = buildCsp(true)
    expect(prod).toContain("script-src 'self' file:")
    expect(prod).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(prod).toContain('https://api.github.com')
    expect(dev).toContain('ws://localhost:5173')
  })

  it('inserta una sola meta dentro de head', () => {
    const policy = buildCsp(false)
    const once = injectCsp('<html><head></head><body></body></html>', policy)
    expect(once).toContain(`<meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    expect(injectCsp(once, policy)).toBe(once)
  })
})
