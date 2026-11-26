import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { PlayerTimeContext, usePlayerTime } from '../src/hooks/usePlayer'
import { computeProgress } from '../src/lib/playerTime'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const roots: Array<ReturnType<typeof createRoot>> = []
afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount())
})

describe('contexto de tiempo del reproductor', () => {
  it('calcula el progreso sin duraciones inválidas', () => {
    expect(computeProgress(5, 10)).toBe(0.5)
    expect(computeProgress(20, 10)).toBe(1)
    expect(computeProgress(5, 0)).toBe(0)
    expect(computeProgress(Number.NaN, 10)).toBe(0)
  })

  it('solo repinta quien consume el tiempo', async () => {
    let timeRenders = 0
    let otherRenders = 0
    const TimeConsumer = () => {
      timeRenders += 1
      return createElement('span', null, String(usePlayerTime().currentTime))
    }
    const OtherConsumer = () => {
      otherRenders += 1
      return createElement('b', null, 'fijo')
    }
    // Misma referencia: así responde React cuando el proveedor cambia de valor.
    const children = createElement(
      'div',
      null,
      createElement(TimeConsumer),
      createElement(OtherConsumer),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(
        createElement(
          PlayerTimeContext.Provider,
          { value: { currentTime: 1, duration: 10, progress: 0.1 } },
          children,
        ),
      )
    })
    await act(async () => {
      root.render(
        createElement(
          PlayerTimeContext.Provider,
          { value: { currentTime: 2, duration: 10, progress: 0.2 } },
          children,
        ),
      )
    })

    expect(timeRenders).toBe(2)
    expect(otherRenders).toBe(1)
    expect(container.querySelector('span')?.textContent).toBe('2')
  })
})
