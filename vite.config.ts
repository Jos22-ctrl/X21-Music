import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { buildCsp, injectCsp } from './src/lib/csp.ts';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Rutas relativas para que Electron pueda cargar dist/index.html por file://
  base: './',
  plugins: [
    {
      name: 'x21-csp',
      transformIndexHtml(html: string, ctx) {
        return injectCsp(html, buildCsp(Boolean(ctx.server)));
      }
    } satisfies Plugin,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'X21 Music',
        short_name: 'X21 Music',
        description: 'Reproductor de música con diseño de islas y color desde la portada',
        theme_color: '#0a0a0c',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  }
} as any);
