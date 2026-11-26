import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const nsh = readFileSync(resolve(process.cwd(), 'build/installer.nsh'), 'utf8')

function functionBody(name: string): string {
  const start = nsh.indexOf(`Function ${name}`)
  const end = nsh.indexOf('FunctionEnd', start)
  return nsh.slice(start, end)
}

describe('orden del instalador NSIS', () => {
  it('pone la elevación entre la elección de modo y la clave', () => {
    const welcome = nsh.indexOf('!insertmacro MUI_PAGE_WELCOME')
    const mode = nsh.indexOf('Page custom X21ModePageShow X21ModePageLeave')
    const elevation = nsh.indexOf('!insertmacro PAGE_INSTALL_MODE')
    const key = nsh.indexOf('Page custom X21KeyPageShow X21KeyPageLeave')
    expect(welcome).toBeGreaterThanOrEqual(0)
    expect(mode).toBeGreaterThan(welcome)
    expect(elevation).toBeGreaterThan(mode)
    expect(key).toBeGreaterThan(elevation)
  })

  it('evita insertar dos veces la página de modo de electron-builder', () => {
    const macroStart = nsh.indexOf('!macro customWelcomePage')
    const macroEnd = nsh.indexOf('!macroend', macroStart)
    const macro = nsh.slice(macroStart, macroEnd)
    expect(macro.match(/!insertmacro PAGE_INSTALL_MODE/g)).toHaveLength(1)
    expect(macro).toContain('!define INSTALL_MODE_PER_ALL_USERS')
  })

  it('la elección «todos los usuarios» sigue forzando el modo máquina', () => {
    expect(functionBody('X21ModePageLeave')).toContain('StrCpy $x21Mode "allusers"')
    const macroStart = nsh.indexOf('!macro customInstallmode')
    const macroEnd = nsh.indexOf('!macroend', macroStart)
    const macro = nsh.slice(macroStart, macroEnd)
    expect(macro).toContain('StrCpy $isForceMachineInstall "1"')
    expect(macro).toContain('StrCpy $isForceCurrentInstall "1"')
  })

  it('deja constancia de la prueba manual en Windows', () => {
    expect(nsh).toContain('REQUIERE PRUEBA MANUAL EN WINDOWS')
  })
})
