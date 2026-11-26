/** Ranuras fijas del reproductor. Cada isla ocupa siempre una ranura válida. */
export const ISLAND_SLOTS = [
  'cover',
  'info',
  'wave',
  'slider',
  'controls',
  'volume',
  'library',
] as const

export type IslandSlot = (typeof ISLAND_SLOTS)[number]
export type IslandId = IslandSlot
export type IslandLayout = Record<IslandSlot, IslandId>

export const ISLAND_SLOT_SET: ReadonlySet<string> = new Set<string>(ISLAND_SLOTS)

export const CENTER_SLOTS: readonly IslandSlot[] = ['info', 'wave', 'slider', 'controls', 'volume']

export const DEFAULT_ISLAND_LAYOUT: IslandLayout = {
  cover: 'cover',
  info: 'info',
  wave: 'wave',
  slider: 'slider',
  controls: 'controls',
  volume: 'volume',
  library: 'library',
}

export const ISLAND_LABELS: Record<IslandId, string> = {
  cover: 'Portada',
  info: 'Información',
  wave: 'Forma de onda',
  slider: 'Cambio de canción',
  controls: 'Controles',
  volume: 'Volumen',
  library: 'Biblioteca',
}

/** Repara un layout guardado: sin duplicados, sin huecos y solo islas conocidas. */
export function normalizeIslandLayout(
  value?: Partial<IslandLayout> | null,
): IslandLayout {
  const result = {} as IslandLayout
  const used = new Set<IslandId>()

  for (const slot of ISLAND_SLOTS) {
    const candidate = value?.[slot]
    if (candidate && ISLAND_SLOT_SET.has(candidate) && !used.has(candidate)) {
      result[slot] = candidate
      used.add(candidate)
    }
  }

  for (const slot of ISLAND_SLOTS) {
    if (result[slot]) continue
    const fallback = ISLAND_SLOTS.find((id) => !used.has(id)) ?? slot
    result[slot] = fallback
    used.add(fallback)
  }

  return result
}

/** Intercambia dos ranuras; el resto se mantiene intacto y no hay solapes. */
export function swapIslandSlots(
  layout: IslandLayout,
  a: IslandSlot,
  b: IslandSlot,
): IslandLayout {
  if (a === b) return layout
  const next = { ...layout }
  const previous = next[a]
  next[a] = next[b]
  next[b] = previous
  return next
}
