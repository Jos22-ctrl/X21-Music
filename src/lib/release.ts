import packageInfo from '../../package.json'

/** Etapa visible y letra inicial del sistema de versiones. */
export const RELEASE_STAGE = 'Alpha'
export const RELEASE_LETTER = 'A'

/** Significado de cada letra; F solo se publica en GitHub, nunca en el paquete. */
export const LETTER_LABELS = {
  A: 'Mejoras grandes',
  M: 'Mejoras en estructura',
  T: 'Cambios menores',
  F: 'Versión obsoleta',
} as const

export type ReleaseLetter = keyof typeof LETTER_LABELS

/** Única fuente del número: package.json (sin letras ni prefijos). */
export const APP_VERSION: string = packageInfo.version
export const APP_STAGE = RELEASE_STAGE

/** Devuelve, por ejemplo, `Alpha 1.0.0A`. */
export function formatVersion(
  version: string = APP_VERSION,
  letter: ReleaseLetter = RELEASE_LETTER,
  stage: string = RELEASE_STAGE,
): string {
  return `${stage} ${version}${letter}`
}

export const APP_LABEL = formatVersion()
