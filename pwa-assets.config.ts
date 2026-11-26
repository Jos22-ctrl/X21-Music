import { defineConfig, minimal2023Preset as preset, type Preset } from '@vite-pwa/assets-generator/config'

/** Solo los dos tamaños que consumes `vite.config.ts`; el resto se descarta. */
const soloNecesarios: Preset = {
  transparent: { ...preset.transparent, sizes: [192, 512], favicons: [] },
  maskable: { sizes: [] },
  apple: { sizes: [] },
}

/** Única fuente de iconos: build/icon.png (512×512). */
export default defineConfig({
  preset: soloNecesarios,
  images: ['build/icon.png'],
})
