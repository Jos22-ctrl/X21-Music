import { describe, expect, it } from 'vitest'
import { reconcileQueue } from '../src/lib/queue'

describe('cola completa', () => {
  it('añade las canciones que faltaban en una cola guardada corta', () => {
    const library = Array.from({ length: 20 }, (_, index) => `c${index + 1}`)
    expect(reconcileQueue(library.slice(0, 6), library)).toEqual(library)
  })

  it('conserva el orden elegido y solo añade lo que falta', () => {
    const library = ['a', 'b', 'c', 'd']
    expect(reconcileQueue(['c', 'a'], library)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('descarta identificadores que ya no están en la biblioteca', () => {
    expect(reconcileQueue(['vieja', 'b'], ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('usa el orden de la biblioteca cuando no hay cola guardada', () => {
    expect(reconcileQueue(null, ['a', 'b'])).toEqual(['a', 'b'])
    expect(reconcileQueue(undefined, [])).toEqual([])
  })

  it('respeta duplicados añadidos manualmente', () => {
    expect(reconcileQueue(['a', 'b', 'a'], ['a', 'b'])).toEqual(['a', 'b', 'a'])
  })
})
