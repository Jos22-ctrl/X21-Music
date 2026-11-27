import { describe, expect, it } from 'vitest'
import {
  APP_LABEL,
  APP_STAGE,
  APP_VERSION,
  formatVersion,
  LETTER_LABELS,
  RELEASE_LETTER,
  RELEASE_STAGE,
} from '../src/lib/release'

describe('sistema de versiones Alpha', () => {
  it('toma el número de package.json y muestra la letra inicial', () => {
    expect(APP_VERSION).toBe('1.0.0')
    expect(RELEASE_STAGE).toBe('Alpha')
    expect(RELEASE_LETTER).toBe('A')
    expect(APP_STAGE).toBe('Alpha')
    expect(APP_LABEL).toBe('Alpha 1.0.0A')
  })

  it('compone etiquetas con cualquier letra y etapa', () => {
    expect(formatVersion('2.3.4')).toBe('Alpha 2.3.4A')
    expect(formatVersion('2.3.4', 'M')).toBe('Alpha 2.3.4M')
    expect(formatVersion('2.3.4', 'T')).toBe('Alpha 2.3.4T')
    expect(formatVersion('2.3.4', 'F')).toBe('Alpha 2.3.4F')
    expect(formatVersion('1.0.0', 'A', 'Beta')).toBe('Beta 1.0.0A')
  })

  it('explica cada letra, incluida la marca F de GitHub', () => {
    expect(LETTER_LABELS).toEqual({
      A: 'Mejoras grandes',
      M: 'Mejoras en estructura',
      T: 'Cambios menores',
      F: 'Versión obsoleta',
    })
  })
})
