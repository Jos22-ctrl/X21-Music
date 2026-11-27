import { describe, expect, it } from 'vitest'
import { visibleWindow } from '../src/hooks/useVirtualList'

describe('ventana visible de una lista virtual', () => {
  it('empieza en cero y deja espacio para el resto de filas', () => {
    expect(
      visibleWindow({ scrollTop: 0, viewportHeight: 100, rowHeight: 50, count: 20, overscan: 1 }),
    ).toEqual({ start: 0, end: 3, paddingTop: 0, paddingBottom: 850 })
  })

  it('desplaza la ventana y aplica el margen de filas', () => {
    expect(
      visibleWindow({ scrollTop: 250, viewportHeight: 100, rowHeight: 50, count: 20, overscan: 2 }),
    ).toEqual({ start: 3, end: 9, paddingTop: 150, paddingBottom: 550 })
  })

  it('no devuelve índices negativos ni ventanas vacías', () => {
    expect(visibleWindow({ scrollTop: -10, viewportHeight: 0, rowHeight: 0, count: 0 })).toEqual({
      start: 0,
      end: 0,
      paddingTop: 0,
      paddingBottom: 0,
    })
    expect(
      visibleWindow({ scrollTop: 10_000, viewportHeight: 100, rowHeight: 50, count: 5 }).start,
    ).toBe(5)
  })
})
