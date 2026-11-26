import { describe, expect, it } from 'vitest'
import {
  adaptiveDim,
  contrastRatio,
  DEFAULT_PALETTE,
  ensureContrast,
  hexToRgb,
  oklchToRgb,
  paletteFromSamples,
  rgbToOklch,
  type Rgb,
} from '../src/lib/color'

const repeat = (color: Rgb, times: number): Rgb[] => Array.from({ length: times }, () => color)
const DARK = hexToRgb('#0A0A0C')
const MIN_CONTRAST = 4.5

describe('conversiones OKLCH', () => {
  it('conserva el color en ida y vuelta sRGB → OKLCH → sRGB', () => {
    for (const hex of ['#7C6CFF', '#FF0000', '#123456', '#F5F5F5', '#00FF9C']) {
      const original = hexToRgb(hex)
      const result = oklchToRgb(rgbToOklch(original))
      expect(Math.abs(result.r - original.r)).toBeLessThanOrEqual(2)
      expect(Math.abs(result.g - original.g)).toBeLessThanOrEqual(2)
      expect(Math.abs(result.b - original.b)).toBeLessThanOrEqual(2)
    }
  })

  it('blanco sobre negro da el ratio máximo de contraste', () => {
    expect(contrastRatio(hexToRgb('#FFFFFF'), hexToRgb('#000000'))).toBeCloseTo(21, 5)
  })
})

describe('extracción de paleta desde la portada', () => {
  it('dos portadas muy distintas producen paletas distintas', () => {
    const warm = paletteFromSamples([
      ...repeat(hexToRgb('#FF5A1F'), 30),
      ...repeat(hexToRgb('#FFC300'), 12),
    ])
    const cool = paletteFromSamples([
      ...repeat(hexToRgb('#123CFF'), 30),
      ...repeat(hexToRgb('#00E5FF'), 12),
    ])

    expect(warm.dominant).not.toBe(cool.dominant)
    expect(warm.vibrant).not.toBe(cool.vibrant)
    expect(warm.accent).not.toBe(cool.accent)
  })

  it('toma como dominante el color más frecuente', () => {
    const palette = paletteFromSamples([
      ...repeat(hexToRgb('#2244AA'), 40),
      ...repeat(hexToRgb('#FF8800'), 8),
    ])
    const dominant = rgbToOklch(hexToRgb(palette.dominant))
    const expected = rgbToOklch(hexToRgb('#2244AA'))
    expect(Math.abs(dominant.h - expected.h)).toBeLessThan(20)
    expect(dominant.c).toBeGreaterThan(0.05)
  })

  it('una portada casi gris mezcla el violeta por defecto con el dominante', () => {
    const palette = paletteFromSamples(repeat(hexToRgb('#808080'), 64))
    const violet = rgbToOklch(hexToRgb('#7C6CFF'))
    const vibrant = rgbToOklch(hexToRgb(palette.vibrant))

    expect(vibrant.c).toBeGreaterThan(violet.c * 0.5)
    expect(Math.abs(vibrant.h - violet.h)).toBeLessThan(8)
  })

  it('sin muestras devuelve la paleta por defecto', () => {
    expect(paletteFromSamples([])).toEqual(DEFAULT_PALETTE)
  })
})

describe('ajuste de contraste del acento', () => {
  it('garantiza al menos 4.5:1 sobre el fondo oscuro', () => {
    for (const hex of ['#000000', '#101010', '#1A2A40', '#7C6CFF', '#FFD700']) {
      const accent = ensureContrast(rgbToOklch(hexToRgb(hex)))
      expect(contrastRatio(oklchToRgb(accent), DARK)).toBeGreaterThanOrEqual(MIN_CONTRAST - 1e-6)
    }
  })

  it('el texto automático sobre el acento también cumple 4.5:1', () => {
    for (const hex of ['#FFFFFF', '#F5D000', '#7C6CFF', '#123CFF']) {
      const palette = paletteFromSamples([hexToRgb(hex)])
      expect(contrastRatio(hexToRgb(palette.onAccent), hexToRgb(palette.accent))).toBeGreaterThanOrEqual(
        MIN_CONTRAST - 1e-6,
      )
    }
  })

  it('la paleta por defecto ya es legible', () => {
    expect(contrastRatio(hexToRgb(DEFAULT_PALETTE.accent), DARK)).toBeGreaterThanOrEqual(
      MIN_CONTRAST - 1e-6,
    )
  })
})

describe('oscurecimiento adaptativo', () => {
  it('aplica la fórmula clamp(0.35 + 0.35 × luminancia, 0.35, 0.7)', () => {
    expect(adaptiveDim(0)).toBeCloseTo(0.35, 6)
    expect(adaptiveDim(0.5)).toBeCloseTo(0.525, 6)
    expect(adaptiveDim(1)).toBeCloseTo(0.7, 6)
  })

  it('acota valores fuera de rango y no numéricos', () => {
    expect(adaptiveDim(-4)).toBe(0.35)
    expect(adaptiveDim(9)).toBe(0.7)
    expect(adaptiveDim(Number.NaN)).toBe(0.35)
  })

  it('oscurece más una portada clara que una oscura', () => {
    const dark = paletteFromSamples(repeat(hexToRgb('#101010'), 32))
    const light = paletteFromSamples(repeat(hexToRgb('#FFFFFF'), 32))

    expect(light.dim).toBeGreaterThan(dark.dim)
    expect(dark.dim).toBeCloseTo(0.35, 2)
    expect(light.dim).toBeCloseTo(0.7, 2)
  })
})
