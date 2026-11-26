import { copyFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

/** El generador escribe junto a build/icon.png; public/ es donde Vite los sirve. */
const origen = resolve('build')
const destino = resolve('public')
const iconos = ['pwa-192x192.png', 'pwa-512x512.png']

for (const icono of iconos) {
  await copyFile(resolve(origen, icono), resolve(destino, icono))
}

// Los archivos generados en build/ no se usan: la fuente única es icon.png.
for (const sobrante of [
  ...iconos,
  'pwa-64x64.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
  'favicon.ico',
]) {
  await rm(resolve(origen, sobrante), { force: true })
}
