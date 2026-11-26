import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ISLAND_LAYOUT,
  ISLAND_SLOTS,
  normalizeIslandLayout,
  swapIslandSlots,
} from '../src/lib/islandLayout'

describe('layout de islas', () => {
  it('empieza con una isla por ranura y sin duplicados', () => {
    const values = Object.values(DEFAULT_ISLAND_LAYOUT)
    expect(values).toHaveLength(ISLAND_SLOTS.length)
    expect(new Set(values).size).toBe(ISLAND_SLOTS.length)
  })

  it('repara un layout guardado con duplicados, huecos e islas desconocidas', () => {
    const repaired = normalizeIslandLayout({
      cover: 'controls',
      info: 'controls',
      wave: 'desconocida' as never,
      controls: 'cover',
      volume: 'info',
    })

    const values = Object.values(repaired)
    expect(new Set(values).size).toBe(ISLAND_SLOTS.length)
    expect(values.every((id) => ISLAND_SLOTS.includes(id))).toBe(true)
    expect(repaired.cover).toBe('controls')
    expect(repaired.info).not.toBe('controls')
  })

  it('intercambia dos ranuras sin perder ninguna isla', () => {
    const swapped = swapIslandSlots(DEFAULT_ISLAND_LAYOUT, 'cover', 'library')

    expect(swapped.cover).toBe('library')
    expect(swapped.library).toBe('cover')
    expect(swapped.info).toBe('info')
    expect(Object.values(swapped).sort()).toEqual(Object.values(DEFAULT_ISLAND_LAYOUT).sort())
  })

  it('no altera el layout al intercambiar una ranura por sí misma', () => {
    expect(swapIslandSlots(DEFAULT_ISLAND_LAYOUT, 'wave', 'wave')).toBe(DEFAULT_ISLAND_LAYOUT)
  })
})
