import { DEFAULT_PALETTE, paletteFromSamples, type Palette, type Rgb } from './color'

const CANVAS_SIZE = 32

function pixelsToSamples(data: Uint8ClampedArray): Rgb[] {
  const samples: Rgb[] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
  }
  return samples
}

function paletteFromImage(image: HTMLImageElement): Palette {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { ...DEFAULT_PALETTE }

  ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const samples = pixelsToSamples(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data)
  return samples.length ? paletteFromSamples(samples) : { ...DEFAULT_PALETTE }
}

/** Lee una portada (blob/objectURL/data URL), la reduce a 32×32 y extrae su paleta. */
export async function extractPalette(url: string): Promise<Palette> {
  if (typeof document === 'undefined') return { ...DEFAULT_PALETTE }

  try {
    const image = new Image()
    image.src = url
    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('No se pudo cargar la portada'))
      })
    }
    return paletteFromImage(image)
  } catch {
    return { ...DEFAULT_PALETTE }
  }
}

export async function extractPaletteFromBlob(blob: Blob | null): Promise<Palette> {
  if (!blob) return { ...DEFAULT_PALETTE }
  const url = URL.createObjectURL(blob)
  try {
    return await extractPalette(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}
