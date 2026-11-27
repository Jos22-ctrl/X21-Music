import { describe, expect, it } from 'vitest'
import { chunk, mapWithConcurrency, shouldReportProgress } from '../src/lib/batch'

describe('troceado y cedingo del hilo', () => {
  it('divide la lista en lotes completos y conserva el resto', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
    expect(chunk([1, 2], 0)).toEqual([[1, 2]])
  })

  it('progresa como máximo cuatro veces por segundo', () => {
    expect(shouldReportProgress(1000, null)).toBe(true)
    expect(shouldReportProgress(1100, 1000)).toBe(false)
    expect(shouldReportProgress(1250, 1000)).toBe(true)
  })

  it('nunca ejecuta más de dos tareas en paralelo', async () => {
    let active = 0
    let peak = 0
    let releaseAll: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      releaseAll = resolve
    })
    const promise = mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1
      peak = Math.max(peak, active)
      await gate
      active -= 1
      return item * 2
    })
    expect(active).toBe(2)
    expect(peak).toBe(2)
    releaseAll?.()
    expect(await promise).toEqual([2, 4, 6, 8, 10])
    expect(peak).toBe(2)
  })
})
