/**
 * Color science utilidades puras (sin DOM) para el sistema visual "color desde la portada".
 * Todo se calcula en OKLCH: percepción uniforme, mezcla estable y contraste WCAG.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Oklch {
  /** Luminosidad percibida, 0..1 */
  l: number
  /** Croma, 0..~0.4 */
  c: number
  /** Matiz en grados, 0..360 */
  h: number
}

export interface Sample extends Rgb {
  weight?: number
}

export interface Palette {
  /** Color más frecuente de la portada */
  dominant: string
  /** Color más saturado con luminosidad media */
  vibrant: string
  /** Tono apagado para superficies */
  muted: string
  /** Vibrante aclarado hasta contraste >= 4.5:1 sobre el fondo oscuro */
  accent: string
  /** Color de texto con contraste >= 4.5:1 sobre `accent` */
  onAccent: string
  /** Opacidad de oscurecimiento adaptativo del fondo, 0.35..0.7 */
  dim: number
}

export const DEFAULT_VIOLET = '#7C6CFF'
export const DARK_BACKGROUND = '#0a0a0c'
const GRAY_THRESHOLD = 0.035
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function hexToRgb(hex: string): Rgb {
  const raw = hex.replace('#', '').trim()
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (full.length !== 6) return { r: 0, g: 0, b: 0 }
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return { r: 0, g: 0, b: 0 }
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex(rgb: Rgb): string {
  const part = (n: number): string =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase()
}

const srgbToLinear = (channel: number): number => {
  const c = clamp(channel, 0, 1)
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

const linearToSrgb = (channel: number): number => {
  const c = clamp(channel, 0, 1)
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r / 255)
  const g = srgbToLinear(rgb.g / 255)
  const b = srgbToLinear(rgb.b / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const light = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const blue = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return {
    l: clamp(light, 0, 1),
    c: Math.max(0, Math.hypot(a, blue)),
    h: (Math.atan2(blue, a) * DEG + 360) % 360,
  }
}

export function oklchToRgb(color: Oklch): Rgb {
  const hue = ((color.h % 360) + 360) % 360
  const a = color.c * Math.cos(hue * RAD)
  const b = color.c * Math.sin(hue * RAD)
  const l_ = color.l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = color.l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = color.l - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: clamp(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255, 0, 255),
    g: clamp(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255, 0, 255),
    b: clamp(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255, 0, 255),
  }
}

export function oklchToHex(color: Oklch): string {
  return rgbToHex(oklchToRgb(color))
}

/** Luminancia relativa WCAG (0..1) de un color sRGB. */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbToLinear(rgb.r / 255) +
    0.7152 * srgbToLinear(rgb.g / 255) +
    0.0722 * srgbToLinear(rgb.b / 255)
  )
}

/** Ratio de contraste WCAG entre dos colores sRGB (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Blanco o casi negro, el que mejor contraste tenga sobre `background`. */
export function bestTextColor(background: Rgb): string {
  const onWhite = contrastRatio(background, { r: 255, g: 255, b: 255 })
  const onDark = contrastRatio(background, hexToRgb(DARK_BACKGROUND))
  return onWhite >= onDark ? '#FFFFFF' : DARK_BACKGROUND
}

/**
 * Sube la luminosidad del color (manteniendo matiz/croma) hasta alcanzar
 * `minRatio` sobre el fondo. Nunca hace falta superar L=1: el blanco siempre
 * cumple 4.5:1 contra un fondo oscuro.
 */
export function ensureContrast(
  color: Oklch,
  background: Rgb = hexToRgb(DARK_BACKGROUND),
  minRatio = 4.5,
): Oklch {
  let candidate: Oklch = { ...color, l: clamp(color.l, 0, 1) }
  if (contrastRatio(oklchToRgb(candidate), background) >= minRatio) return candidate

  for (let l = candidate.l; l <= 1.000001; l += 0.005) {
    const next = { ...candidate, l: clamp(l, 0, 1) }
    if (contrastRatio(oklchToRgb(next), background) >= minRatio) return next
  }
  return { ...candidate, l: 1 }
}

/** alpha = clamp(0.35 + 0.35 × luminancia, 0.35, 0.7) */
export function adaptiveDim(luminance: number): number {
  if (!Number.isFinite(luminance)) return 0.35
  return clamp(0.35 + 0.35 * clamp(luminance, 0, 1), 0.35, 0.7)
}

/**
 * Mezcla equivalente a `color-mix(in oklab)`: interpola las coordenadas
 * cartesianas a/b (no el ángulo de matiz), para que los colores acromáticos
 * no desplacen el tono. Es clave en portadas casi grises.
 */
export function mixOklch(a: Oklch, b: Oklch, amount: number): Oklch {
  const t = clamp(amount, 0, 1)
  const aA = a.c * Math.cos(a.h * RAD)
  const aB = a.c * Math.sin(a.h * RAD)
  const bA = b.c * Math.cos(b.h * RAD)
  const bB = b.c * Math.sin(b.h * RAD)
  const mixedA = aA + (bA - aA) * t
  const mixedB = aB + (bB - aB) * t
  return {
    l: a.l + (b.l - a.l) * t,
    c: Math.max(0, Math.hypot(mixedA, mixedB)),
    h: (Math.atan2(mixedB, mixedA) * DEG + 360) % 360,
  }
}

interface Point {
  l: number
  a: number
  b: number
  weight: number
}

type Axis = 'l' | 'a' | 'b'

const toPoint = (color: Oklch, weight = 1): Point => ({
  l: color.l,
  a: color.c * Math.cos(color.h * RAD),
  b: color.c * Math.sin(color.h * RAD),
  weight,
})

const fromPoint = (point: Point): Oklch => ({
  l: clamp(point.l, 0, 1),
  c: Math.max(0, Math.hypot(point.a, point.b)),
  h: (Math.atan2(point.b, point.a) * DEG + 360) % 360,
})

const axisRange = (points: Point[], axis: Axis): number => {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const point of points) {
    min = Math.min(min, point[axis])
    max = Math.max(max, point[axis])
  }
  return max - min
}

function splitBox(points: Point[]): [Point[], Point[]] | null {
  const weights: Record<Axis, number> = { l: 1, a: 1.15, b: 1.15 }
  const axes: Axis[] = ['l', 'a', 'b']
  const axis = axes.reduce((best, current) =>
    axisRange(points, current) * weights[current] > axisRange(points, best) * weights[best]
      ? current
      : best,
  )

  if (axisRange(points, axis) < 1e-6) return null

  const sorted = [...points].sort((x, y) => x[axis] - y[axis])
  const total = sorted.reduce((sum, point) => sum + point.weight, 0)
  let accumulated = 0
  let index = sorted.findIndex((point) => {
    accumulated += point.weight
    return accumulated >= total / 2
  })
  if (index < 1) index = 1
  if (index > sorted.length - 1) index = sorted.length - 1
  return [sorted.slice(0, index), sorted.slice(index)]
}

function medianCut(points: Point[], k: number): Point[][] {
  let boxes = [points]
  while (boxes.length < k) {
    let bestIndex = -1
    let bestScore = 0
    boxes.forEach((box, index) => {
      if (box.length < 2) return
      const score =
        box.reduce((sum, point) => sum + point.weight, 0) *
        Math.max(axisRange(box, 'l'), axisRange(box, 'a'), axisRange(box, 'b'))
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    if (bestIndex < 0) break
    const split = splitBox(boxes[bestIndex])
    if (!split) break
    boxes = [...boxes.slice(0, bestIndex), ...split, ...boxes.slice(bestIndex + 1)]
  }
  return boxes
}

function representative(points: Point[]): Oklch {
  const weight = points.reduce((sum, point) => sum + point.weight, 0) || 1
  return fromPoint({
    l: points.reduce((sum, point) => sum + point.l * point.weight, 0) / weight,
    a: points.reduce((sum, point) => sum + point.a * point.weight, 0) / weight,
    b: points.reduce((sum, point) => sum + point.b * point.weight, 0) / weight,
    weight,
  })
}

/**
 * Median-cut con k=4 sobre las muestras 32×32 de la portada.
 * Devuelve los tokens listos para inyectar en :root.
 */
export function paletteFromSamples(samples: readonly Sample[]): Palette {
  const points = samples
    .filter((sample) => sample && [sample.r, sample.g, sample.b].every((v) => Number.isFinite(v)))
    .map((sample) => toPoint(rgbToOklch(sample), Math.max(sample.weight ?? 1, 0.0001)))

  if (points.length === 0) return { ...DEFAULT_PALETTE }

  const groups = medianCut(points, 4)
    .map((box) => ({
      color: representative(box),
      count: box.reduce((sum, point) => sum + point.weight, 0),
    }))
    .sort((a, b) => b.count - a.count)

  const dominant = groups[0]?.color ?? rgbToOklch(hexToRgb(DEFAULT_VIOLET))
  const violet = rgbToOklch(hexToRgb(DEFAULT_VIOLET))
  const mid = groups.filter((group) => group.color.l >= 0.22 && group.color.l <= 0.9)
  const pool = mid.length ? mid : groups
  let vibrant = pool.reduce(
    (best, group) => (group.color.c > best.c ? group.color : best),
    pool[0]?.color ?? violet,
  )

  // Portada casi gris/monocromática: violeta por defecto + 30% del dominante.
  if (vibrant.c < GRAY_THRESHOLD) vibrant = mixOklch(violet, dominant, 0.3)

  const muted: Oklch = {
    l: clamp(dominant.l * 0.78 + 0.1, 0.22, 0.58),
    c: clamp(Math.min(dominant.c, vibrant.c), 0.015, 0.07),
    h: dominant.c < GRAY_THRESHOLD ? violet.h : dominant.h,
  }

  const accent = ensureContrast(vibrant)
  const luminance =
    samples.reduce((sum, sample) => sum + relativeLuminance(sample), 0) / samples.length

  return {
    dominant: oklchToHex(dominant),
    vibrant: oklchToHex(vibrant),
    muted: oklchToHex(muted),
    accent: oklchToHex(accent),
    onAccent: bestTextColor(oklchToRgb(accent)),
    dim: adaptiveDim(luminance),
  }
}

export const DEFAULT_PALETTE: Palette = paletteFromSamples([hexToRgb(DEFAULT_VIOLET)])

/** Tema monocromo: una sola familia de grises con acento claro legible. */
export const MONO_PALETTE: Palette = {
  dominant: '#15151a',
  vibrant: '#24242b',
  muted: '#1d1d24',
  accent: '#f2f2f7',
  onAccent: '#101014',
  dim: 0.55,
}
