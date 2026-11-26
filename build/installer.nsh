# X21 Music — opciones de instalación y clave de actualización
# Este include se compila también para el desinstalador: todo lo nuestro es solo instalador.
!ifndef BUILD_UNINSTALLER
  !include LogicLib.nsh
  !include FileFunc.nsh
  !include nsDialogs.nsh

  Var x21Mode
  Var x21ModeArg
  Var x21ExpectedKey
  Var x21TypedKey
  Var x21ModeDialog
  Var x21KeyDialog
  Var x21KeyEdit
  Var x21RadioInstall
  Var x21RadioReinstall
  Var x21RadioAllUsers
  Var x21RadioUpdate

  # El welcome page no viene incluido por electron-builder: se añade aquí,
  # seguido de la página de opciones y de la página de clave (solo actualizar).
  !macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME
    Page custom X21ModePageShow X21ModePageLeave
    Page custom X21KeyPageShow X21KeyPageLeave
  !macroend

  # Nuestra página ya decide el modo; la página de usuario de electron-builder se omite.
  !macro customInstallmode
    ${If} $x21Mode == "allusers"
      StrCpy $isForceMachineInstall "1"
      StrCpy $isForceCurrentInstall "0"
    ${Else}
      StrCpy $isForceMachineInstall "0"
      StrCpy $isForceCurrentInstall "1"
    ${EndIf}
  !macroend

  Function X21ModePageShow
    # FileFunc no necesita plugins externos (StdUtils no está en todos los NSIS).
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/X21KEY=" $x21ExpectedKey
    ${If} ${Errors}
      StrCpy $x21ExpectedKey ""
    ${EndIf}
    ClearErrors
    ${GetOptions} $R0 "/X21MODE=" $x21ModeArg
    ${If} ${Errors}
      StrCpy $x21ModeArg "install"
    ${EndIf}

    nsDialogs::Create 1018
    Pop $x21ModeDialog

    ${NSD_CreateLabel} 0u 0u 340u 20u "Opciones de instalación — elige una:"
    Pop $R0

    ${NSD_CreateRadioButton} 10u 25u 320u 18u "Instalar (solo para mí)"
    Pop $x21RadioInstall
    ${NSD_CreateRadioButton} 10u 47u 320u 18u "Reinstalar (conserva tu música y ajustes)"
    Pop $x21RadioReinstall
    ${NSD_CreateRadioButton} 10u 69u 320u 18u "Instalar para todos los usuarios"
    Pop $x21RadioAllUsers
    ${NSD_CreateRadioButton} 10u 91u 320u 18u "Actualizar (clave de la app, de un solo uso)"
    Pop $x21RadioUpdate

    ${If} $x21ModeArg == "update"
      SendMessage $x21RadioUpdate ${BM_SETCHECK} ${BST_CHECKED} 0
    ${ElseIf} $x21ModeArg == "allusers"
      SendMessage $x21RadioAllUsers ${BM_SETCHECK} ${BST_CHECKED} 0
    ${ElseIf} $x21ModeArg == "reinstall"
      SendMessage $x21RadioReinstall ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $x21RadioInstall ${BM_SETCHECK} ${BST_CHECKED} 0
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function X21ModePageLeave
    SendMessage $x21RadioInstall ${BM_GETCHECK} 0 0 $R0
    ${If} $R0 == ${BST_CHECKED}
      StrCpy $x21Mode "install"
      Return
    ${EndIf}

    SendMessage $x21RadioReinstall ${BM_GETCHECK} 0 0 $R0
    ${If} $R0 == ${BST_CHECKED}
      StrCpy $x21Mode "reinstall"
      Return
    ${EndIf}

    SendMessage $x21RadioAllUsers ${BM_GETCHECK} 0 0 $R0
    ${If} $R0 == ${BST_CHECKED}
      StrCpy $x21Mode "allusers"
      Return
    ${EndIf}

    StrCpy $x21Mode "update"
  FunctionEnd

  Function X21KeyPageShow
    ${If} $x21Mode != "update"
      Abort
    ${EndIf}

    nsDialogs::Create 1018
    Pop $x21KeyDialog

    ${NSD_CreateLabel} 0u 0u 340u 20u "Clave de un solo uso de X21 Music:"
    Pop $R0
    ${NSD_CreateText} 10u 25u 320u 20u ""
    Pop $x21KeyEdit
    nsDialogs::Show
  FunctionEnd

  Function X21KeyPageLeave
    ${NSD_GetText} $x21KeyEdit $x21TypedKey

    ${If} $x21ExpectedKey == ""
      MessageBox MB_ICONSTOP|MB_TOPMOST "La actualización debe iniciarse desde X21 Music. Abre la app, pulsa «Buscar actualizaciones» y usa «Descargar e instalar»: la clave cambia cada vez y el instalador se verifica con SHA-256."
      Abort
    ${EndIf}

    ${If} $x21TypedKey != $x21ExpectedKey
      MessageBox MB_ICONSTOP|MB_TOPMOST "La clave no es correcta o ya se usó. Vuelve a X21 Music, busca actualizaciones de nuevo y copia la clave nueva."
      Abort
    ${EndIf}
  FunctionEnd
!endif
