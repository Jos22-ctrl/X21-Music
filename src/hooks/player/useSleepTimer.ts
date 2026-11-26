import { useEffect, useState } from 'react'

/** Temporizador de apagado: cuenta atrás en vivo y aviso al expirar. */
export function useSleepTimer(onExpire: () => void) {
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null)
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null)
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (sleepEndsAt === null) return
    const tick = (): void => {
      const left = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000))
      setSleepRemaining(left)
      if (left === 0) {
        onExpire()
        setSleepEndsAt(null)
        setSleepMinutes(null)
        setSleepRemaining(null)
      }
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [onExpire, sleepEndsAt])

  const setSleepTimer = (minutes: number | null): void => {
    setSleepMinutes(minutes)
    setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null)
    setSleepRemaining(minutes ? minutes * 60 : null)
  }

  return { sleepMinutes, sleepRemaining, setSleepTimer }
}
