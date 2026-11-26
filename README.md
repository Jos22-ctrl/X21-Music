# X21 Music — pre-alpha 0.9.6

Reproductor de música **local para Windows** con **Diseño de Islas** y una interfaz cuyo
color se deriva por completo de la portada de la canción actual. Todo se procesa en el
dispositivo: metadatos ID3, portadas, forma de onda, biblioteca y paleta. Sin backend.

**Versión actual: pre-alpha 0.9.6** (también visible en «Acerca de» dentro de la app).

## Características

- **Color desde la portada**: la carátula se reduce a 32×32 y se agrupan sus colores en
  OKLCH (median-cut, k=4). Se calculan `--c-dominant`, `--c-vibrant`, `--c-muted` y un
  `--accent` con contraste ≥ 4.5:1. La paleta se guarda en cada registro y transiciona
  en 600 ms al cambiar de canción. Si la portada es casi gris se usa `#7C6CFF` mezclado
  con un 30 % del dominante.
- **Fondo adaptativo**: portada difuminada (`blur(60px) saturate(1.5)`), radiales teñidos
  y oscurecimiento `clamp(0.35 + 0.35 × luminancia, 0.35, 0.7)` para que el texto siempre
  se lea.
- **Islas y botones teñidos**: las islas usan `backdrop-filter`, los botones solo relleno
  translúcido con brillo interior (nunca `backdrop-filter` anidado). Máximo cuatro islas.
- **Biblioteca local**: importa archivos o carpetas (MP3, M4A, AAC, OGG, OPUS, WAV, FLAC…),
  deduplica, guarda blobs en IndexedDB y lee título/artista/álbum/duración/carátula con
  `music-metadata`.
- **Cambio deslizable de canciones**: el control central se arrastra para avanzar o
  retroceder; al 70 % del recorrido se activa el salto y, si se mantiene en el borde,
  sigue saltando cada 500 ms. Muestra vista previa de la pista destino. También admite
  clic en «Anterior/Siguiente» y `←`/`→` (`Shift` para saltos de 2).
- **Portada adaptativa**: el cuadro es siempre cuadrado y se dimensiona solo con el
  espacio disponible de su columna (container queries); la imagen se ajusta con
  `object-fit: cover` y tiene fallback si no hay carátula o falla al cargar.
- **Reproducción**: barra de onda seekable, volumen, silencio, aleatorio, repetición
  `off/one/all`, cola, búsqueda y Media Session API.
- **Botones fundidos**: rellenos con degradados que terminan en transparente, de modo que el
  cristal teñido de la isla (y la portada difuminada detrás) se ve a través de ellos.
- **Responsivo en todo**: tres zonas en escritorio, dos en tablet y una columna con scroll en
  móvil; la ventana se puede reducir hasta 480×420 para que se apliquen los tres modos, se
  compacta en ventanas bajas y cada isla se adapta a su ancho real mediante container queries.
  La ventana de Electron no muestra la barra de menú «File / Edit / …».
- **Alineación automática**: la rejilla, la portada y los botones se acomodan solos según el
  ancho/alto de la ventana y de cada isla (container queries); sin portada, la columna de la
  carátula se reduce y los controles ganan espacio.
- **Barra de reproducción simple (por defecto)**: solo cambia la isla de controles (aleatorio,
  anterior, play/pausa, siguiente y repetición, sin anillo de progreso); portada, información,
  forma de onda, deslizador, volumen y biblioteca se mantienen exactamente igual. En Ajustes →
  «Diseño de reproducción» puedes elegir **Clásico** para recuperar la barra anterior.
- **Islas reordenables**: mantén **Ctrl** y arrastra con el clic izquierdo una isla hasta otra
  zona; las islas intercambian ranuras fijas, sin solapes, y el layout se guarda en IndexedDB.
  Funciona en ambos diseños; en Ajustes → «Disposición de las islas» puedes volver al orden
  original.
- **Carpeta de música en Users**: al importar, los archivos se mueven a
  `C:\Users\<usuario>\X21 Music\Música` (se crea sola). La carpeta se abre desde Ajustes y
  «Copiar biblioteca» vuelca allí las canciones que ya estaban en IndexedDB. Los metadatos,
  portadas y la paleta siguen guardados localmente en IndexedDB.
- **Ajustes persistentes y legibles**: panel dividido en Sonido, Apariencia, Biblioteca y
  Apagado, con el estado «Activado/Desactivado» visible en cada interruptor, texto más grande
  y mayor contraste;
  transición gradual entre pistas (0–8 s, con fundido de volumen), opción de omitir el
  silencio entre canciones, bloqueo de duplicados al importar/añadir a la cola, diseño de
  reproducción (Simple/Clásico), modo oscuro monocromo de un solo color y desplazamiento
  opcional de títulos largos (por defecto se cortan en una línea). Se guardan en IndexedDB.
- **Temporizador de apagado**: 5, 10, 15, 30, 45 o 60 minutos; muestra la cuenta atrás y
  detiene la reproducción al terminar.
- **Vista «Canciones»**: vista completa sin reproductor, con canciones, álbum, artista, fecha
  de incorporación y duración; filtros «Recién agregadas/Todas», búsqueda y ordenación.
- **Acerca de**: versión `pre-alpha 0.9.6` y resumen de características desde el panel.
- **Accesibilidad**: contraste verificado, foco visible, `prefers-reduced-motion` y
  `prefers-reduced-transparency`.

## Requisitos

Node.js 20+ y npm. Para empaquetar, electron-builder descarga los binarios de Windows.

## Desarrollo

```bash
npm install
npm run dev            # navegador en http://localhost:5173
npm run dev:electron   # Vite + ventana de Electron
npm run lint           # tsc --noEmit
npm test               # vitest run
npm run build          # tsc -b && vite build
```

## Generar el ejecutable de Windows

```bash
npm run dist:win
```

Crea `release/X21 Music Setup 0.9.6.exe` (instalador NSIS x64, con acceso directo en
escritorio y menú de inicio). Cierra el reproductor antes de empaquetar o instalar para
evitar que Windows bloquee el archivo. Para desarrollo rápido, `npm run electron` abre la
ventana Electron usando el `dist` ya compilado.

También se genera una PWA instalable cuando se sirve por http(s); en Electron se carga
por `file://` y el service worker no se registra.

## Actualizaciones

El botón de actualizaciones de la cabecera (y «Ajustes → Actualizaciones») consulta primero
el último release de `Jos22-ctrl/X21-Music` en GitHub. Si no hay red o no hay un release más
nuevo, busca en `C:\Users\<usuario>\X21 Music\Actualizaciones`.

Para publicar en GitHub, crea un release `vX.Y.Z` y sube el `.exe` como asset. Para publicar
en local, coloca allí el instalador y un `update.json`:

```json
{
  "version": "0.9.7",
  "installer": "X21 Music Setup 0.9.7.exe",
  "notes": "Novedades de esta versión"
}
```

La app compara la versión con la instalada. Si hay una más nueva, muestra una clave
(`X21-XXXXXXXX`), descarga el instalador (de GitHub o de la carpeta local) a
`%TEMP%\X21 Music Updates` y lo abre con la opción «Actualizar» preseleccionada. El instalador
ofrece **Instalar**, **Reinstalar**, **Instalar para todos los usuarios** y **Actualizar**; esta
última opción exige escribir la clave que mostró la app. Sin clave, la actualización se detiene.

## Estructura

```
electron/            main.cjs, preload.cjs
src/lib/color.ts     OKLCH, contraste WCAG, median-cut y paleta
src/lib/palette.ts   muestreo 32×32 de la portada
src/lib/db.ts        IndexedDB (canciones + ajustes, campo palette)
src/lib/metadata.ts  ID3 y forma de onda
src/hooks/usePlayer  contexto del reproductor, ajustes y temporizador
src/components/      islas, vista de canciones y panel de ajustes
src/index.css        sistema visual y tokens en :root
tests/               pruebas de color, contraste y oscurecimiento
```

Ver `AGENTS.md` para las reglas de arquitectura y la sección 5 (paleta desde la portada).
