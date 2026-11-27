/** Miniaturas de portada para importaciones nuevas (no se migran las antiguas). */

export const COVER_THUMB_SIZE = 300
export const MAX_EMBEDDED_COVER_BYTES = 256 * 1024

/** Solo se reduce una portada embebida cuando supera el umbral. */
export function shouldShrinkCover(
  sizeBytes: number,
  limit = MAX_EMBEDDED_COVER_BYTES,
): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > limit
}

/**
 * Reduce la portada a ~300 px con `createImageBitmap` y `OffscreenCanvas`.
 * REQUIERE PRUEBA MANUAL EN WINDOWS: convertToBlob(WebP/JPEG) en Electron 45.
 */
export async function shrinkCover(
  blob: Blob | null,
  maxSize = COVER_THUMB_SIZE,
): Promise<Blob | null> {
  if (!blob || !shouldShrinkCover(blob.size)) return blob
  const scope = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => {
      getContext: (kind: '2d') => {
        drawImage: (image: ImageBitmap, dx: number, dy: number, dw: number, dh: number) => void
      } | null
      convertToBlob: (options?: { type?: string; quality?: number }) => Promise<Blob>
    }
  }
  if (typeof createImageBitmap !== 'function' || typeof scope.OffscreenCanvas !== 'function') {
    return blob
  }
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    const ratio = Math.min(1, maxSize / Math.max(1, bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = new scope.OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(bitmap, 0, 0, width, height)
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
    return webp.size > 0 ? webp : blob
  } catch {
    return blob
  } finally {
    bitmap?.close?.()
  }
}
