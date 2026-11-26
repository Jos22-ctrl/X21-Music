/**
 * La cola guardada puede quedarse corta (bibliotecas antiguas o importaciones
 * posteriores). Se conserva su orden y se añaden las canciones que faltan.
 */
export function reconcileQueue(
  savedQueue: readonly string[] | null | undefined,
  libraryIds: readonly string[],
): string[] {
  const known = new Set(libraryIds)
  const result = (Array.isArray(savedQueue) ? savedQueue : []).filter(
    (id): id is string => typeof id === 'string' && known.has(id),
  )
  const present = new Set(result)
  for (const id of libraryIds) {
    if (!present.has(id)) {
      result.push(id)
      present.add(id)
    }
  }
  return result
}
