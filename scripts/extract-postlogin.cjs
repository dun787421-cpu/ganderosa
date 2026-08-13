const https = require('https')
const fs = require('fs')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(new URL(res.headers.location, url).href).then(resolve, reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

;(async () => {
  const base = 'https://digital.bg.com.bo/apps/GanaNet/1785448008273/desktopweb/web/localfiles/site'
  const text = await get(base + '/main.30ffd2fd3f2e8436.js')

  const needles = [
    'Verificando',
    'imagen',
    'seguridad',
    'dashboard',
    'Inicio',
    'selecciona tu imagen',
    'Selecciona',
    'pregunta',
    'token',
    'OTP',
    'segundo factor',
    'clave de acceso',
    'Bienvenido',
    'navigate',
    'routerLink',
    'path:',
    'login',
    'home',
    'site/home',
    'validarUsuario',
    'autenticar',
  ]

  for (const n of needles) {
    const idx = text.toLowerCase().indexOf(n.toLowerCase())
    console.log(n, idx)
    if (idx >= 0) console.log(text.slice(Math.max(0, idx - 100), idx + 220).replace(/\n/g, ' ').slice(0, 320))
  }

  // routes
  const routeIdx = text.indexOf('path:"login"')
  console.log('\nroute login', routeIdx)
  console.log(text.slice(routeIdx - 400, routeIdx + 800))

  const routeIdx2 = text.indexOf("path:'login'")
  console.log('\nroute login2', routeIdx2)
  console.log(text.slice(Math.max(0, routeIdx2 - 200), routeIdx2 + 600))
})().catch((e) => { console.error(e); process.exit(1) })
