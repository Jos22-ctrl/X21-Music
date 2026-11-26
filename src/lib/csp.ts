/** Política CSP de la app. Desarrollo permite HMR; producción no permite scripts en línea. */

const SHARED = [
  "default-src 'self' file:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "img-src 'self' data: blob: file:",
  "media-src 'self' blob: file:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
].join('; ')

const CONNECTED = [
  'connect-src',
  "'self'",
  'https://api.github.com',
  'https://github.com',
  'https://objects.githubusercontent.com',
].join(' ')

export function buildCsp(isDev: boolean): string {
  if (isDev) {
    return [
      SHARED,
      "script-src 'self' 'unsafe-inline' file:",
      "worker-src 'self' blob:",
      `${CONNECTED} http://localhost:5173 ws://localhost:5173`,
    ].join('; ')
  }
  return [SHARED, "script-src 'self' file:", "worker-src 'self' blob:", CONNECTED].join('; ')
}

/** Inserta la meta CSP una sola vez, justo tras `<head>`. */
export function injectCsp(html: string, policy: string): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
  return html.includes('<head>') ? html.replace('<head>', `<head>\n    ${tag}`) : `${tag}\n${html}`
}
