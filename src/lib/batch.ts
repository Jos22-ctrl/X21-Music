/** Utilidades puras para importar sin bloquear el hilo principal. */

/** Divide una lista en lotes; con tamaño inválido devuelve un único lote. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const width = Number.isFinite(size) && size > 0 ? Math.floor(size) : 0
  if (!width || !items.length) return items.length ? [Array.from(items)] : []
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += width) {
    batches.push(Array.from(items.slice(index, index + width)))
  }
  return batches
}

/** El progreso visual se limita a unas cuatro actualizaciones por segundo. */
export const PROGRESS_INTERVAL_MS = 250

export function shouldReportProgress(
  now: number,
  lastReportedAt: number | null,
  interval = PROGRESS_INTERVAL_MS,
): boolean {
  if (lastReportedAt === null) return true
  return now - lastReportedAt >= interval
}

/** Ejecuta hasta `limit` tareas en paralelo; con 2 se solapan sin saturar el hilo. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const runners = Array.from(
    { length: Math.max(1, Math.min(Math.floor(limit) || 1, items.length || 1)) },
    async () => {
      while (next < items.length) {
        const index = next
        next += 1
        results[index] = await worker(items[index], index)
      }
    },
  )
  await Promise.all(runners)
  return results
}

/** Cede el hilo entre lotes; usa scheduler.yield() cuando Chromium lo ofrece. */
export async function yieldToBrowser(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<unknown> }
    }
  ).scheduler
  if (typeof scheduler?.yield === 'function') {
    await scheduler.yield()
    return
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
