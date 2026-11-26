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
    ])
  })

  it('deja los estilos de la aplicación en su propio módulo', () => {
    expect(read('src/App.css')).toBe(
      "@import './styles/app-layout.css';\n@import './styles/app-islas.css';\n",
    )
  })
})
