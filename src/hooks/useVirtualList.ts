import { useEffect, useRef, useState } from 'react'

export interface VisibleWindowArgs {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  count: number
  overscan?: number
}

export interface VisibleWindow {
  start: number
  end: number
  paddingTop: number
  paddingBottom: number
}

/** Ventana visible de filas de altura fija, con margen para evitar parpadeos. */
export function visibleWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  count,
  overscan = 4,
}: VisibleWindowArgs): VisibleWindow {
  const row = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 42
  const top = Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0
  const viewport = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0
  const margin = Number.isFinite(overscan) && overscan > 0 ? Math.floor(overscan) : 0
  const first = Math.floor(top / row)
  const visible = Math.ceil(viewport / row)
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  const start = Math.min(safeCount, Math.max(0, first - margin))
  const end = Math.max(start, Math.min(safeCount, Math.max(first + visible, first + 1) + margin))
  return {
    start,
    end,
    paddingTop: start * row,
    paddingBottom: Math.max(0, (safeCount - end) * row),
  }
}

/** Hook sin dependencias para listas grandes; el scroll ocurre dentro de la isla. */
export function useVirtualList(count: number, rowHeight = 42, overscan = 4) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(rowHeight * 8)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onScroll = (): void => setScrollTop(element.scrollTop)
    element.addEventListener('scroll', onScroll, { passive: true })
    setViewportHeight(element.clientHeight)
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => setViewportHeight(element.clientHeight))
        : null
    observer?.observe(element)
    return () => {
      element.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [])

  return {
    ref,
    ...visibleWindow({ scrollTop, viewportHeight, rowHeight, count, overscan }),
  }
}
