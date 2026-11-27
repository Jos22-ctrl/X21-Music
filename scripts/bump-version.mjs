import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const partesValidas = ['X', 'Y', 'Z']

/** Ruta del proyecto al ejecutar el script; con Vitest se usa el directorio de trabajo. */
function raizProyecto() {
  try {
    return fileURLToPath(new URL('..', import.meta.url))
  } catch {
    return process.cwd()
  }
}

/**
 * Sube X, Y o Z y reinicia las cifras de la derecha.
 * La letra no viaja en package.json: se documenta en CHANGELOG.md y en el título del release.
 */
export function siguienteVersion(version, parte) {
  const numero = String(version ?? '').trim()
  const letra = String(parte ?? '').trim().toUpperCase()
  if (letra === 'F') {
    throw new Error('La letra F solo se publica en GitHub; no cambia la versión del paquete.')
  }
  if (!partesValidas.includes(letra)) {
    throw new Error('Indica qué parte quieres subir: X, Y o Z. Ejemplo: npm run version:bump -- Z')
  }
  const coincidencia = numero.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!coincidencia) {
    throw new Error(`package.json solo admite X.Y.Z (sin letras ni prefijos): se recibió «${numero}».`)
  }
  const [x, y, z] = coincidencia.slice(1).map(Number)
  if (letra === 'X') return `${x + 1}.0.0`
  if (letra === 'Y') return `${x}.${y + 1}.0`
  return `${x}.${y}.${z + 1}`
}

function main() {
  const raiz = raizProyecto()
  const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8'))
  const destino = siguienteVersion(pkg.version, process.argv[2])
  execFileSync('npm', ['version', destino, '--no-git-tag-version'], {
    cwd: raiz,
    shell: true,
    stdio: 'inherit',
  })
  console.log(
    `Versión preparada: ${destino}. Añade su entrada a CHANGELOG.md antes de publicar v${destino}.`,
  )
}

const archivoActual = process.argv[1] ? resolve(process.argv[1]) : ''
if (archivoActual === resolve(raizProyecto(), 'scripts', 'bump-version.mjs')) main()
