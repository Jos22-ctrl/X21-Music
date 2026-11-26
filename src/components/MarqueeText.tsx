import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePlayer } from '../hooks/usePlayer'

interface MarqueeTextProps {
  children: ReactNode
  className?: string
  title?: string
}

/**
 * Texto de una sola línea. Por defecto se recorta con elipsis; si el ajuste
 * `marqueeTitles` está activo y el texto no cabe, se desplaza de forma continua.
 */
export function MarqueeText({ children, className = '', title }: MarqueeTextProps) {
  const { settings } = usePlayer()
  const hostRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  const plain = typeof children === 'string' || typeof children === 'number' ? String(children) : ''

  useEffect(() => {
    if (!settings.marqueeTitles || !plain) {
      setOverflowing(false)
      return
    }

    const measure = (): void => {
      const host = hostRef.current
      const text = measureRef.current
      if (!host || !text) return
      setOverflowing(text.scrollWidth > host.clientWidth + 1)
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      if (hostRef.current) observer.observe(hostRef.current)
      if (measureRef.current) observer.observe(measureRef.current)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [plain, settings.marqueeTitles])

  const scrolling = settings.marqueeTitles && overflowing
  const duration = Math.max(8, Math.min(28, plain.length * 0.45))
  const style = scrolling ? ({ '--marquee-duration': `${duration}s` } as CSSProperties) : undefined

  return (
    <span
      ref={hostRef}
      className={`marquee-text ${scrolling ? 'is-scrolling' : ''} ${className}`.trim()}
      title={title ?? plain}
      style={style}
    >
      <span ref={measureRef} className="marquee-text__measure" aria-hidden="true">
        {children}
      </span>
      {scrolling ? (
        <span className="marquee-text__track">
          <span>{children}</span>
          <span aria-hidden="true">{children}</span>
        </span>
      ) : (
        <span className="marquee-text__value">{children}</span>
      )}
    </span>
  )
}
