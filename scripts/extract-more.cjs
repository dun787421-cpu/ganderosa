const https = require('https')
const fs = require('fs')
const path = require('path')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(new URL(res.headers.location, url).href).then(resolve, reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

;(async () => {
  const base = 'https://digital.bg.com.bo/apps/GanaNet/1785448008273/desktopweb/web/localfiles/site'
  const text = (await get(base + '/main.30ffd2fd3f2e8436.js')).buf.toString('utf8')

  // find fog-pwd nearby strings
  let i = 0, n = 0
  while ((i = text.indexOf('fog-pwd', i + 1)) !== -1 && n < 5) {
    console.log('fog', n, text.slice(i - 50, i + 300))
    n++
  }

  for (const needle of ['usuario', 'Contrase', 'Ingresar', 'placeholder', 'ti-user', 'fa-lock', 'Olvid']) {
    const idxs = []
    let p = 0
    while ((p = text.indexOf(needle, p + 1)) !== -1 && idxs.length < 8) idxs.push(p)
    console.log('\n', needle, idxs.length)
    idxs.slice(0, 3).forEach((idx) => console.log(text.slice(idx - 80, idx + 120).replace(/\n/g,' ')))
  }

  // download fonts
  const out = 'C:/Users/Camil/Documents/gananet/public/fonts'
  fs.mkdirSync(out, { recursive: true })
  for (const f of [
    'themify.58ecddba064e63f7.woff',
    'themify.0504804445e9a55f.eot',
  ]) {
    try {
      const r = await get(base + '/' + f)
      fs.writeFileSync(path.join(out, f), r.buf)
      console.log('font', f, r.status, r.buf.length)
    } catch (e) {
      console.log('fail', f, e.message)
    }
  }

  // also try assets path for themify
  const css = fs.readFileSync('C:/Users/Camil/.cursor/projects/c-Users-Camil-Documents-gananet/agent-tools/82d24d55-104d-46d0-92e2-1d7ac6301f26.txt','utf8')
  const m = css.match(/url\((themify\.[^)]+)\)/g)
  console.log('themify urls', m && m.slice(0,10))
})().catch(e => { console.error(e); process.exit(1) })
