import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

/** El orden de los @import define la cascada; cambiarlo cambia el diseño. */
describe('hojas de estilo partidas', () => {
  it('conserva el orden de la cascada del sistema visual', () => {
    const css = read('src/index.css')
    expect(css.startsWith("@import 'tailwindcss';")).toBe(true)
    expect(css).toContain('@source inline("filter")')
    const bloques = [...css.matchAll(/@import '\.\/styles\/([^']+)\.css';/g)].map((match) => match[1])
    expect(bloques).toEqual([
      'tokens',
      'ambiente',
      'controles',
      'canciones',
      'biblioteca',
      'responsive',
      'ajustes',
      'actualizaciones',
      'songs',
      'accesibilidad',
      'motion',
    ])
  })

  it('define los tokens de movimiento y las dos únicas animaciones infinitas', () => {
    const css = read('src/styles/motion.css')
    for (const token of [
      '--ease-out:',
      '--ease-spring:',
      '--dur-fast: 140ms',
      '--dur-med: 260ms',
      '--dur-slow: 480ms',
    ]) {
      expect(css).toContain(token)
    }
    expect(css.match(/infinite/g)).toHaveLength(2)
    expect(css).toContain(":root[data-motion='reduced']")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('@supports (animation-timeline: view())')
  })

  it('deja los estilos de la aplicación en su propio módulo', () => {
    const importaciones = read('src/App.css')
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter(Boolean)
    expect(importaciones).toEqual([
      "@import './styles/app-layout.css';",
      "@import './styles/app-islas.css';",
    ])
  })
})
