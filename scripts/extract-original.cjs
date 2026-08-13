const fs = require('fs')
const https = require('https')
const path = require('path')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), headers: res.headers }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

;(async () => {
  const base = 'https://digital.bg.com.bo/apps/GanaNet/1785448008273/desktopweb/web/localfiles/site'
  const cssPath = 'C:/Users/Camil/.cursor/projects/c-Users-Camil-Documents-gananet/agent-tools/82d24d55-104d-46d0-92e2-1d7ac6301f26.txt'
  const css = fs.readFileSync(cssPath, 'utf8')
  const keys = [
    '.background',
    '.content-bottom',
    '.h-p100',
    '.pt-40',
    '.pl-40',
    '.pr-40',
    '.pb-10',
    '.m-20',
    '.mt-10',
    '.bg-white',
    '.mb-15',
    'Nunito',
    '#044f17',
    '#aed45c',
    '7cca3d',
    'input-group-text',
    'btn-success',
  ]
  for (const k of keys) {
    const i = css.indexOf(k)
    console.log(k, i)
    if (i >= 0) console.log('  ', css.slice(Math.max(0, i - 20), i + 180).replace(/\n/g, ' '))
  }

  // download main.js and search login template fragments
  const mainUrl = base + '/main.30ffd2fd3f2e8436.js'
  const main = await get(mainUrl)
  console.log('main status', main.status, 'len', main.buf.length)
  const text = main.buf.toString('utf8')
  for (const needle of ['Bienvenido a GanaNet', 'Olvidé mi usuario', 'Tipo usuario', 'content-bottom', 'Verificar', 'Código de persona', 'background']) {
    const idx = text.indexOf(needle)
    console.log('main', needle, idx)
    if (idx >= 0) console.log(text.slice(Math.max(0, idx - 120), idx + 250).replace(/\n/g, ' '))
  }

  // download assets
  const outDir = 'C:/Users/Camil/Documents/gananet/public/assets'
  fs.mkdirSync(outDir, { recursive: true })
  for (const rel of ['assets/imagenes/genericas/candado.png', 'assets/imagenes/genericas/ganapin.png']) {
    const r = await get(base + '/' + rel)
    const name = path.basename(rel)
    fs.writeFileSync(path.join(outDir, name), r.buf)
    console.log('saved', name, r.status, r.buf.length)
  }
})().catch((e) => { console.error(e); process.exit(1) })
