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
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

;(async () => {
  const base = 'https://digital.bg.com.bo/apps/GanaNet/1785448008273/desktopweb/web/localfiles/site'
  const text = await get(base + '/main.30ffd2fd3f2e8436.js')
  const idx = text.indexOf('content-bottom')
  console.log('--- around content-bottom ---')
  console.log(text.slice(idx - 800, idx + 2500))

  const idx2 = text.indexOf('Olvid')
  console.log('\n--- Olvid ---', idx2)
  console.log(text.slice(idx2 - 100, idx2 + 200))

  // themify icons?
  const css = fs.readFileSync('C:/Users/Camil/.cursor/projects/c-Users-Camil-Documents-gananet/agent-tools/82d24d55-104d-46d0-92e2-1d7ac6301f26.txt', 'utf8')
  for (const k of ['.ti-user', '.ti-lock', 'themify', '.light-logo', '.text-bold', 'font-weight:200', '.bg-success']) {
    const i = css.indexOf(k)
    console.log('\nCSS', k, i)
    if (i >= 0) console.log(css.slice(i, i + 200))
  }

  // download themify or font awesome if referenced in index
  const indexHtml = await get(base + '/index.html')
  fs.writeFileSync('C:/Users/Camil/Documents/gananet/public/_orig-index.html', indexHtml)
  console.log('\nindex len', indexHtml.length)
  console.log(indexHtml.slice(0, 2500))
})().catch((e) => { console.error(e); process.exit(1) })
