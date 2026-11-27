import { act, createElement, memo } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { PlaybackProvider, usePlayer, usePlayerTime } from '../src/hooks/usePlayer'

class FakeAudio extends EventTarget {
  src = ''
  currentTime = 0
  duration = 120
  volume = 1
  paused = true
  preload = ''
  load(): void {}
  pause(): void {
    this.paused = true
  }
  play(): Promise<void> {
    this.paused = false
    return Promise.resolve()
  }
  removeAttribute(): void {}
}

let timeRenders = 0
let mainRenders = 0
let hidden = false

const TimeConsumer = memo(function TimeConsumer() {
  usePlayerTime()
  timeRenders += 1
  return null
})
const MainConsumer = memo(function MainConsumer() {
  usePlayer()
  mainRenders += 1
  return null
})

describe('aislamiento de renders del tiempo de reproducción', () => {
  let root: Root
  let container: HTMLDivElement
  let audios: FakeAudio[]

  beforeEach(() => {
    timeRenders = 0
    mainRenders = 0
    audios = []
    vi.stubGlobal('Audio', class extends FakeAudio {
      constructor() {
        super()
        audios.push(this)
      }
    })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root.render(createElement(PlaybackProvider, null, createElement(TimeConsumer), createElement(MainConsumer)))
    })
  })

  it('solo repinta el consumidor del tiempo y se detiene con la ventana oculta', async () => {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
    const baselineTime = timeRenders
    const baselineMain = mainRenders
    for (let index = 1; index <= 10; index += 1) {
      audios[0].currentTime = index
      act(() => audios[0].dispatchEvent(new Event('timeupdate')))
    }
    const visibleRenders = timeRenders - baselineTime
    hidden = true
    for (let index = 11; index <= 20; index += 1) {
      audios[0].currentTime = index
      act(() => audios[0].dispatchEvent(new Event('timeupdate')))
    }
    const hiddenRenders = timeRenders - baselineTime - visibleRenders
    expect(visibleRenders).toBe(10)
    expect(hiddenRenders).toBe(0)
    expect(mainRenders - baselineMain).toBe(0)
    act(() => root.unmount())
    container.remove()
  })
})
