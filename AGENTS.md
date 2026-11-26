# AGENTS.md — X21 Music (M2)

Reproductor de música local para Windows (Electron + React + TypeScript + Vite).
Toda la música se procesa en el dispositivo: no hay backend ni servicios externos.

## 1. Estructura

- `src/lib/color.ts`: color science puro (sRGB ↔ OKLCH, WCAG, median-cut k=4, paleta).
- `src/lib/palette.ts`: reduce la portada a 32×32 en canvas y extrae la paleta.
- `src/lib/metadata.ts`: ID3/Vorbis (`music-metadata`) + forma de onda RMS.
- `src/lib/db.ts`: IndexedDB (`idb`); cada registro de canción guarda su campo `palette`.
- `src/hooks/usePlayer.tsx`: motor de audio, cola, modos, persistencia y Media Session.
- `src/components/*`: islas visuales. `src/index.css`: sistema visual completo.
- `electron/`: ventana principal y preload de Electron; IPC `music:*` crea y usa
  `C:\Users\<usuario>\X21 Music\Música`, e IPC `update:*` gestiona las actualizaciones.
  `electron/update.cjs` compara versiones y valida `update.json`. `dist:win` genera el
  instalador NSIS.
- `src/lib/musicFolder.ts`: puente renderer→main para mover/guardar archivos en esa carpeta
  (`webUtils.getPathForFile` en el preload; `fs.rename` con fallback a copia en el main).

## 2. Reglas de reproducción

- Un solo `<audio>`; la fuente es un object URL del blob guardado en IndexedDB.
- Repetición `off | all | one`, aleatorio e historial de cola persistidos. La posición se lee
  del elemento de audio al guardar (nunca de `currentTime`, que cambia con `timeupdate`): estado
  completo con debounce de 500 ms, posición cada 5 s reproduciendo y guardado inmediato al pausar,
  cambiar de pista, ocultar la ventana o cerrar. Al hidratar se aplica al `<audio>` en
  `loadedmetadata`, sin iniciar la reproducción. `src/lib/persistence.ts` contiene el serializador
  y `shouldPersist`, que excluye la posición del guardado completo.
- Metadatos y portadas se leen del archivo; deduplicación por huella nombre+tamaño+fecha y,
  si `preventDuplicates` está activo, también por título/artista/álbum.
- Ajustes persistentes en `preferences`: transición gradual (`crossfadeSeconds`, fundido
  de volumen antes/después del cambio), `skipSilence`, `preventDuplicates`, `monoDark`,
  `marqueeTitles` (false por defecto: una línea con elipsis; true: desplazamiento si no cabe),
  `playbackBarStyle` (`simple` por defecto; `clasico` recupera la barra de controles anterior),
  `islandLayout` (isla por ranura; se reordena con Ctrl + arrastrar en ambos diseños) y
  `lowPerformance` (false por defecto: sin desenfoques/animaciones, forma de onda reducida y
  biblioteca paginada).
- Al importar se toma una copia en memoria del `File`, se leen metadatos/forma de onda y se
  mueve el original a la carpeta de música de Users; `StoredTrack.filePath` guarda la ruta.
  «Copiar biblioteca» exporta los blobs ya guardados a esa misma carpeta.
- Temporizador de apagado: cuenta atrás en vivo y pausa automática al expirar.

## 3. Sistema visual

- Fondo de tres capas: portada con `blur(60px) saturate(1.5)` (único elemento con
  `will-change: transform`), radiales de los colores de la portada y oscurecimiento adaptativo.
- Islas: `backdrop-filter: blur(24px) saturate(1.6)`; máximo ~8 islas, nunca anidadas.
- Botones: **sin** `backdrop-filter`; relleno en degradado radial que termina en transparente
  para que el cristal teñido de la isla se vea a través (difuminado con el fondo).
- Diseño responsivo por media queries (ancho/alto) y container queries (`app`, `center`,
  `library`): una columna en móvil, dos en tablet, tres en escritorio; la rejilla usa
  `--cover-column`/`--cover-max` y `data-cover` para dar espacio a los controles cuando no hay
  portada. Botones e islas se alinean con `safe center` y pueden envolverse. La ventana de
  Electron no muestra la barra de menú (`Menu.setApplicationMenu(null)`). El mínimo de ventana
  es 480×420 para que las media queries de tablet/móvil puedan aplicarse de verdad.
- `src/lib/islandLayout.ts`: siete ranuras fijas (`cover`, cinco del centro y `library`);
  `normalizeIslandLayout` repara layouts guardados y `swapIslandSlots` intercambia dos ranuras
  sin duplicados ni huecos. `src/hooks/useIslandDrag.ts` implementa Ctrl + clic izquierdo +
  arrastrar con umbral de 5 px, captura de puntero y supresión del clic posterior.
- `prefers-reduced-motion` y `prefers-reduced-transparency` tienen prioridad.
- La rejilla usa `flex: 1 1 0` y filas `minmax(0, …)`; la biblioteca y la vista de canciones
  desplazan su lista dentro de la isla (`overflow-y: auto`), nunca fuera de la ventana.
  `src/lib/performance.ts` limita las filas dibujadas (50 normal / 20 en bajo rendimiento) y
  reduce la forma de onda a 24 barras en modo de bajo rendimiento.

## 4. Interfaz

- Español. Layout de escritorio en tres zonas (portada / controles / biblioteca).
- Por defecto solo se sustituye la isla de controles por `src/components/SimplePlaybackBar.tsx`
  (aleatorio, anterior, play/pausa, siguiente y repetición, sin anillo de progreso). El resto de
  islas, su layout y el reordenamiento con Ctrl + arrastrar no cambian. Ajustes → «Diseño de
  reproducción» permite volver a la barra anterior (`PlayControlIsland.tsx`).
- En el diseño clásico, el cambio de canción es deslizable
  (`src/components/TrackSliderIsland.tsx`, `jumpBy`): umbral 70 %, salto mantenido cada 500 ms
  en el borde, vista previa y soporte de teclado.
- La portada es un cuadrado autodimensionado con unidades de container query
  (`min(100cqw, 100cqh)`); la imagen usa `object-fit: cover` y fallback automático.
- Atajos multimedia del sistema vía Media Session API.
- Dos vistas desde la cabecera: «Reproductor» (islas) y «Canciones» (lista completa sin
  reproductor, con álbum/artista/fecha, filtro «Recién agregadas» y ordenación).
- `src/components/MarqueeText.tsx` mide el texto con `ResizeObserver` y solo lo desplaza si
  no cabe y `marqueeTitles` está activo; con `prefers-reduced-motion` la animación se detiene.
- Panel con pestañas «Ajustes», «Actualizaciones» y «Acerca de»; botón de actualizaciones en
  la cabecera. Primero consulta `https://api.github.com/repos/Jos22-ctrl/X21-Music/releases/latest`
  y, si falla o no hay versión mayor, lee `update.json` y el `.exe` de
  `C:\Users\<usuario>\X21 Music\Actualizaciones`. Si hay versión mayor, genera una clave
  `X21-XXXXXXXX`, descarga el instalador a `%TEMP%\X21 Music Updates` y lo lanza con
  `/X21KEY=<clave>` `/X21MODE=update`. `build/installer.nsh` añade las opciones Instalar,
  Reinstalar, Instalar para todos los usuarios y Actualizar; esta última valida la clave.
  Versión `pre-alpha 0.9.10` en `src/lib/version.ts` y en `package.json`.
- `monoDark` sustituye la paleta por `MONO_PALETTE` y desactiva la imagen de fondo.

## 5. Paleta desde la portada (reemplaza "Color de acento extraído de la portada")

**Esta sección prevalece sobre la sección 1 del prompt M2 donde haya contradicción.**

- Todo el color sale de la portada de la canción actual. No hay cristal gris neutro:
  islas y botones se ven hechos de la portada difuminada y teñidos con sus colores.
- Reducir la portada a 32×32, agrupar colores (median-cut, k=4) en OKLCH.
- Tokens dinámicos en `:root`, calculados una vez por canción y guardados en el registro
  (`campo palette`):
  - `--c-dominant`: color más frecuente.
  - `--c-vibrant`: más saturado con luminosidad media.
  - `--c-muted`: tono apagado para superficies.
  - `--accent`: derivado de `--c-vibrant`, con contraste ≥ 4.5:1 sobre el fondo oscuro.
- Portada casi gris/monocromática: violeta `#7C6CFF` mezclado con un 30% del dominante.
- Cambio de canción: transición de 600 ms de los tokens (properties registradas).
- Oscurecimiento: `alpha = clamp(0.35 + 0.35 × luminancia, 0.35, 0.7)`.
- Sin `backdrop-filter` o con transparencia reducida:
  `color-mix(in oklab, var(--c-muted) 35%, #14141c)`.
- `prefers-reduced-motion`: sin deriva del degradado; cambio de color en 120 ms.

## 6. Verificación

`npm run lint`, `npm test` y `npm run build` deben pasar. Las pruebas unitarias cubren
extracción de paleta, contraste del acento y oscurecimiento adaptativo.
