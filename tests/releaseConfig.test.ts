import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { safeInstallerName } from '../electron/update.cjs'

function read(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

describe('configuración de la versión 0.9.12', () => {
  it('mantiene la misma versión en todos los archivos', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string }
    const lock = JSON.parse(read('package-lock.json')) as { version: string }
    expect(pkg.version).toBe('0.9.12')
    expect(lock.version).toBe('0.9.12')
    expect(read('src/lib/version.ts')).toContain("'0.9.12'")
    expect(read('index.html')).toContain('pre-alpha 0.9.12')
  })

  it('deja una sola configuración de empaquetado', () => {
    expect(existsSync(resolve(process.cwd(), 'electron-builder.final.yml'))).toBe(false)
    expect(read('package.json')).not.toContain('"build": {')
    const config = read('electron-builder.yml')
    expect(config).toContain('appId: com.x21.music')
    expect(config).toContain('output: release')
    expect(config).toContain('icon: build/icon.png')
    expect(config).toContain('include: build/installer.nsh')
  })

  it('incluye los dos workflows de CI y release', () => {
    const ci = read('.github/workflows/ci.yml')
    expect(ci).toContain('npm run lint')
    expect(ci).toContain('npm test')
    expect(ci).toContain('npm run build')

    const release = read('.github/workflows/release.yml')
    expect(release).toContain("- 'v*'")
    expect(release).toContain('Get-FileHash')
    expect(release).toContain('gh release create')
  })

  it('muestra las novedades y los créditos en «Acerca de»', () => {
    const about = read('src/components/SettingsDialog.tsx')
    expect(about).toContain('Novedades de 0.9.12')
    expect(about).toContain('Claude y X21')
  })
})

describe('nombres de instalador en Windows', () => {
  it('acepta rutas con ambas barras mediante path.win32.basename', () => {
    expect(safeInstallerName('C:\\Users\\alguien\\setup.exe')).toBe('setup.exe')
    expect(safeInstallerName('C:/Users/alguien/setup.exe')).toBe('setup.exe')
    expect(safeInstallerName('setup.exe')).toBe('setup.exe')
  })

  it('sigue rechazando nombres sin extensión .exe', () => {
    expect(safeInstallerName('update.json')).toBe('')
    expect(safeInstallerName('')).toBe('')
  })
})
