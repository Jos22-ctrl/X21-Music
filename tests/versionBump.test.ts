import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { siguienteVersion } from '../scripts/bump-version.mjs'

describe('subida de versión', () => {
  it('sube la cifra elegida y reinicia las de la derecha', () => {
    expect(siguienteVersion('1.0.9', 'Z')).toBe('1.0.10')
    expect(siguienteVersion('1.0.9', 'Y')).toBe('1.1.0')
    expect(siguienteVersion('1.9.9', 'X')).toBe('2.0.0')
    expect(siguienteVersion('1.0.0', 'z')).toBe('1.0.1')
  })

  it('rechaza letras y números con letra', () => {
    expect(() => siguienteVersion('1.0.0', 'F')).toThrow(/solo se publica en GitHub/)
    expect(() => siguienteVersion('1.0.0A', 'Z')).toThrow(/solo admite X\.Y\.Z/)
    expect(() => siguienteVersion('v1.0.0', 'Z')).toThrow(/solo admite X\.Y\.Z/)
    expect(() => siguienteVersion('1.0.0', 'M')).toThrow(/X, Y o Z/)
  })

  it('ofrece el comando npm sin letras', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
    expect(pkg.scripts['version:bump']).toBe('node scripts/bump-version.mjs')
  })
})
