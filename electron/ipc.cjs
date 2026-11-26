const { isAllowedFrameUrl } = require('./security.cjs')

const DEV_URL = process.env.X21_DEV_URL || 'http://localhost:5173'

const frameOptions = (app) => ({ devUrl: DEV_URL, isPackaged: app.isPackaged })

/** Todo IPC exige que el emisor sea nuestra propia página. */
function createTrustedHandle(ipcMain, app) {
  return function trustedHandle(channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
      const frameUrl = event?.senderFrame?.url?.() ?? ''
      if (!isAllowedFrameUrl(frameUrl, frameOptions(app))) {
        throw new Error('Solicitud no permitida desde esta página.')
      }
      return handler(event, ...args)
    })
  }
}

module.exports = { DEV_URL, frameOptions, createTrustedHandle }
