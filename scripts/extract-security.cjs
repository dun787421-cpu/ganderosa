const https = require('https')

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

  for (const n of [
    'imagenes_seguridad',
    'Imagen de seguridad',
    'imagen de seguridad',
    'Seleccione su imagen',
    'elige tu imagen',
    'Elegir imagen',
    'seguridad personal',
    'CONFIRMAR',
    'Confirmar',
    'Ingresar',
    'validarInicioSesion',
    'SEG045',
    'SEG050',
    'CODIGO_RESPUESTA',
    'mostrarImagenes',
    'listaImagenes',
  ]) {
    let p = 0, c = 0
    while ((p = text.indexOf(n, p + 1)) !== -1 && c < 2) {
      console.log('\n==', n, p)
      console.log(text.slice(Math.max(0, p - 150), p + 350).replace(/\n/g, ' '))
      c++
    }
    if (c === 0) console.log('\n==', n, 'NOT FOUND')
  }
})().catch((e) => { console.error(e); process.exit(1) })
