const fs = require('fs')

const src =
  'C:/Users/Camil/.cursor/browser-logs/cdp-response-Runtime.evaluate-2026-08-11T13-59-05-299Z.json'
const dest = 'C:/Users/Camil/Documents/gananet/public/hero-bg.jpg'

const j = JSON.parse(fs.readFileSync(src, 'utf8'))
const v = j.result?.result?.value || j.result?.value || j.value
const s = typeof v === 'string' ? v : JSON.stringify(v)
const i = s.indexOf(',')
const b64 = i >= 0 ? s.slice(i + 1) : s
fs.writeFileSync(dest, Buffer.from(b64, 'base64'))
console.log('bytes', fs.statSync(dest).size)
console.log('head', s.slice(0, 50))
