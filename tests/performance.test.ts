import { describe, expect, it } from 'vitest'
import {
  MAX_WAVE_BARS,
  MAX_WAVE_BARS_LOW,
  PAGE_SIZE_LOW,
  PAGE_SIZE_NORMAL,
  downsample,
  pageSizeFor,
} from '../src/lib/performance'

describe('modo de bajo rendimiento', () => {
  it('usa páginas más pequeñas', () => {
    expect(PAGE_SIZE_LOW).toBeLessThan(PAGE_SIZE_NORMAL)
    expect(pageSizeFor(true)).toBe(PAGE_SIZE_LOW)
    expect(pageSizeFor(false)).toBe(PAGE_SIZE_NORMAL)
  })

  it('reduce la forma de onda promediando bloques', () => {
    expect(MAX_WAVE_BARS_LOW).toBeLessThan(MAX_WAVE_BARS)
    const original = Array.from({ length: 80 }, (_, index) => (index < 40 ? 0.2 : 0.8))
    const reduced = downsample(original, MAX_WAVE_BARS_LOW)
    expect(reduced).toHaveLength(MAX_WAVE_BARS_LOW)
    expect(reduced[0]).toBeCloseTo(0.2, 5)
    expect(reduced[reduced.length - 1]).toBeCloseTo(0.8, 5)
    expect(downsample(original, MAX_WAVE_BARS)).toBe(original)
  })
})
