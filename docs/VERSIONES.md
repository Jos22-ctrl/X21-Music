# Sistema de versiones Alpha

## Número

`package.json` contiene **solo** `X.Y.Z` (sin prefijo `v` ni letra). Es la única fuente del número:
la app lo importa desde `src/lib/release.ts` y `npm version` actualiza también el lockfile.

| Cifra | Cuándo sube |
| --- | --- |
| `X` | Cambios grandes. |
| `Y` | Cambios que no afectan al funcionamiento de la app (estructura, documentación, herramientas). |
| `Z` | Arreglos y cambios menores. |

Al subir una cifra, las de su derecha vuelven a `0`: `1.0.9` → `1.1.0` → `2.0.0`.

Para subirla sin tocar archivos a mano:

```bash
npm run version:bump -- X   # o Y, o Z
npm version 1.0.0 --no-git-tag-version   # fijar una versión concreta
```

El script rechaza `F` y cualquier valor con letra.

## Letra

| Letra | Significado | Dónde se usa |
| --- | --- | --- |
| `A` | Mejoras grandes. | Versión visible inicial: `Alpha 1.0.0A`. |
| `M` | Mejoras en estructura. | Título del release e «Acerca de». |
| `T` | Cambios menores. | Título del release e «Acerca de». |
| `F` | Versión obsoleta. | **Solo GitHub**, tras publicar; nunca en `package.json`. |

`src/lib/release.ts` exporta `RELEASE_STAGE`, `RELEASE_LETTER`, `LETTER_LABELS` y `formatVersion`.
Por defecto, `formatVersion()` devuelve `Alpha 1.0.0A` leyendo el número de `package.json`.

## Etiquetas y títulos

- La etiqueta de Git es `vX.Y.Z` **sin letra** (por ejemplo, `v1.0.0`).
- El título del release es `Alpha X.Y.ZL — descripción corta` (por ejemplo,
  `Alpha 1.0.0A — Menos memoria, animaciones y versión Alpha`).
- `.github/workflows/release.yml` comprueba que la etiqueta coincide con `package.json` y toma la
  letra y la descripción de la primera entrada de `CHANGELOG.md`, con el formato
  `## [X.Y.ZL] - AAAA-MM-DD — descripción corta`.
- El instalador se publica como `X21.Music.Setup.X.Y.Z.exe` y su suma como
  `X21.Music.Setup.X.Y.Z.exe.sha256` (la suma contiene el nombre del `.exe`).

## Marcar una versión como obsoleta (`F`)

Tras publicar `vX.Y.Z`, edita **solo** el título del release en GitHub para que incluya
`X.Y.ZF`, por ejemplo `Alpha 1.0.0F — versión obsoleta`. La etiqueta no cambia y el instalador
sigue disponible. El actualizador hace una segunda consulta opcional a la lista de releases:
si encuentra una `F`, muestra un aviso informativo en «Actualizaciones». Si esa consulta falla,
no se muestra nada y la búsqueda principal sigue funcionando con normalidad.

El comparador acepta tags con o sin `v` y sufijos como `1.0.0A` o `1.0.0-A`, y siempre compara
únicamente los tres números.

## Prueba manual en Windows

Tras publicar, comprobar en la app: «Acerca de» muestra `Alpha X.Y.ZL`, «Actualizaciones»
detecta una versión mayor tolerando su sufijo y el aviso de `F` no impide instalar.
