import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ISLAND_SLOT_SET, type IslandSlot } from '../lib/islandLayout'

interface DragState {
  source: IslandSlot
  pointerId: number
  startX: number
  startY: number
  active: boolean
  target: IslandSlot | null
}

interface UseIslandDragOptions {
  onReorder: (from: IslandSlot, to: IslandSlot) => void
  enabled?: boolean
}

const DRAG_THRESHOLD = 5

function slotFromPoint(x: number, y: number, ignored: IslandSlot): IslandSlot | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (!(element instanceof HTMLElement)) continue
    const slotElement = element.closest<HTMLElement>('[data-island-slot]')
    const slot = slotElement?.dataset.islandSlot
    if (slot && slot !== ignored && ISLAND_SLOT_SET.has(slot)) return slot as IslandSlot
  }
  return null
}

/**
 * Ctrl + clic izquierdo + arrastrar reordena las islas entre ranuras fijas.
 * El layout resultante siempre cubre todas las ranuras sin solapes.
 */
export function useIslandDrag({ onReorder, enabled = true }: UseIslandDragOptions) {
  const [dragging, setDragging] = useState<IslandSlot | null>(null)
  const [target, setTarget] = useState<IslandSlot | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const captureRef = useRef<HTMLElement | null>(null)
  const reorderRef = useRef(onReorder)
  const suppressClickRef = useRef(false)

  reorderRef.current = onReorder

  const finishDrag = useCallback(() => {
    const drag = dragRef.current
    if (drag && captureRef.current) {
      try {
        captureRef.current.releasePointerCapture(drag.pointerId)
      } catch {
        // La captura ya se liberó al soltar el puntero.
      }
    }
    captureRef.current = null
    dragRef.current = null
    document.body.classList.remove('is-reordering-islands')
    setDragging(null)
    setTarget(null)
  }, [])

  const cancelDrag = useCallback(
    (event?: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || (event && event.pointerId !== drag.pointerId)) return
      finishDrag()
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    },
    [finishDrag],
  )

  const onPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (!enabled) return
    if (!event.ctrlKey || event.button !== 0 || !event.isPrimary || dragRef.current) return

    const slotElement = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-island-slot]',
    )
    const slot = slotElement?.dataset.islandSlot
    if (!slot || !ISLAND_SLOT_SET.has(slot)) return

    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      source: slot as IslandSlot,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      target: null,
    }
    captureRef.current = event.currentTarget
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Algunos dispositivos no permiten captura; los listeners globales bastan.
    }
  }, [enabled])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      if (!drag.active) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        )
        if (distance < DRAG_THRESHOLD) return
        drag.active = true
        suppressClickRef.current = true
        document.body.classList.add('is-reordering-islands')
        setDragging(drag.source)
      }

      const next = slotFromPoint(event.clientX, event.clientY, drag.source)
      if (next !== drag.target) {
        drag.target = next
        setTarget(next)
      }
      event.preventDefault()
    }

    const onPointerUp = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      const destination = drag.active
        ? slotFromPoint(event.clientX, event.clientY, drag.source)
        : null
      const from = drag.source
      const shouldReorder = Boolean(
        drag.active && destination && destination !== from,
      )
      const wasActive = drag.active
      finishDrag()

      if (shouldReorder && destination) reorderRef.current(from, destination)
      if (wasActive) {
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancelDrag()
    }

    const blockClick = (event: MouseEvent): void => {
      if (!suppressClickRef.current) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', cancelDrag, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('click', blockClick, true)

    return () => {
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', cancelDrag, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('click', blockClick, true)
      document.body.classList.remove('is-reordering-islands')
      suppressClickRef.current = false
    }
  }, [cancelDrag, finishDrag])

  return { dragging, target, onPointerDownCapture }
}
