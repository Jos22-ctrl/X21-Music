# Registro de cambios

El número es `X.Y.Z` y la letra se añade solo en el título del release y en la interfaz.
Las reglas y el significado de cada letra están en [`docs/VERSIONES.md`](docs/VERSIONES.md).

## [1.0.0A] - 2026-11-26 — Menos memoria, animaciones y versión Alpha

- Importación por lotes de 20 canciones, como máximo 2 análisis en paralelo y progreso limitado.
- Escrituras de IndexedDB agrupadas, miniaturas de ~300 px y forma de onda diferida en idle.
- URLs de audio y portada con caché LRU y liberación con `revokeObjectURL`.
- Listas virtualizadas y `React.memo` para que el tiempo de reproducción no repinte la biblioteca.
- Animaciones de entrada, respiración del botón principal y ecualizador de la fila actual.
- Ajuste persistente «Reducir animaciones», también respetado con `prefers-reduced-motion`.
- Etapa Alpha, letra inicial `A` y versión leída desde `package.json` como única fuente.
- Actualizaciones tolerantes con sufijos (`v1.0.0A`, `1.0.0-A`) y aviso informativo de versiones `F`.
- Nombre correcto del `.sha256` y título de release `Alpha X.Y.ZL — descripción corta`.

## [0.9.14] - 2026-11-25 — Consulta de GitHub corregida

- `senderFrame.url` se lee como propiedad de Electron 45, no como función.
- `net.fetch` se inyecta desde el proceso principal sin cargar Electron en las pruebas.
- Los assets del release se publican como `.exe` y `.exe.sha256`.

## [0.9.13] - 2026-11-25 — Motivos de error en actualizaciones

- La búsqueda usa la red de Electron y distingue sin conexión, error de GitHub y versión al día.
