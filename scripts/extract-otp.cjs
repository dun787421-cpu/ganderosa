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
  const text = await get('https://digital.bg.com.bo/apps/GanaNet/1785448008273/desktopweb/web/localfiles/site/main.30ffd2fd3f2e8436.js')
  const idx = text.indexOf('Ingresar c\\xf3digo de verificaci\\xf3n')
  console.log(text.slice(idx - 500, idx + 2000))
  const idx2 = text.indexOf('img-seguridad')
  console.log('\n--- img-seguridad ---')
  console.log(text.slice(idx2 - 400, idx2 + 800))
  const idx3 = text.indexOf('loginv2')
  console.log('\n--- loginv2 ---')
  console.log(text.slice(idx3 - 100, idx3 + 900))
})().catch(e=>{console.error(e);process.exit(1)})
