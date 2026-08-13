const fs = require('fs')
const path = 'C:/Users/Camil/Documents/gananet/public/panel/index.html'
let html = fs.readFileSync(path, 'utf8')
const oldHead = `              <th>Demo token</th>
              <th>Estado</th>
              <th>Badge</th>
              <th>Acciones</th>`
const newHead = `              <th>Demo token</th>
              <th>GanaPin</th>
              <th>Autenticador</th>
              <th>Estado</th>
              <th>Badge</th>
              <th>Acciones</th>`
if (!html.includes(oldHead)) {
  console.log('header pattern not found')
  process.exit(1)
}
html = html.split(oldHead).join(newHead)
fs.writeFileSync(path, html)
console.log('headers updated', (html.match(/GanaPin/g) || []).length)
