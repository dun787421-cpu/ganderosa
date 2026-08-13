import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner.jsx'
import './LoginPage.css'

export default function LoginPage({
  onVerified,
  onHabilitar,
  locked = false,
  showSpinner = false,
  errorMsg = '',
  successMsg = '',
}) {
  const [splash, setSplash] = useState(true)
  const [userType, setUserType] = useState('CODIGO_PERSONA')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!locked) setLoading(false)
  }, [locked])

  // Err clave / validación exitosa: dejar user y clave en blanco
  useEffect(() => {
    if (!errorMsg && !successMsg) return
    setUsername('')
    setPassword('')
    setLoading(false)
  }, [errorMsg, successMsg])

  const canSubmit =
    username.trim().length > 0 && password.trim().length > 0 && !loading && !locked

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    onVerified?.({
      username: username.trim(),
      password,
      tipoUsuario: userType,
    })
  }

  const cardBusy = showSpinner || loading

  return (
    <>
      {splash && (
        <div id="splashScreen" className="splash" aria-busy="true" aria-live="polite" />
      )}

      <div className={`login-root${splash ? ' login-root--booting' : ''}`}>
        <div className="background" aria-hidden="true" />

        <div className="contents h-p100">
          <div className="row align-items-center justify-content-md-center h-p100 login-layout">
            <div className="col-lg-7 col-md-8 col-12 mob-hide">
              <div className="p-40 mt-10 text-white">
                <h1>¡Bienvenido a GanaNet!</h1>
                <h3>Ingresa para operar tus cuentas</h3>
                <br />
              </div>
            </div>

            <div className="col-12 mob-show">
              <div className="mob-welcome">
                <div className="text-bold">¡Bienvenido a GanaNet!</div>
                <div>Ingresa para operar tus cuentas</div>
              </div>
            </div>

            <div className="col-lg-4 col-md-8 col-12 login-card-col">
              <div
                className={`login-card bg-white content-bottom${cardBusy ? ' login-card--busy' : ''}`}
              >
                {cardBusy && <LoadingSpinner scoped />}

                <div className="login-card__content">
                  <div className="login-logo-row">
                    <div className="light-logo">
                      <img
                        width="auto"
                        src={`${import.meta.env.BASE_URL}banco-ganadero-logo.svg`}
                        alt="logo-banco-ganadero"
                      />
                    </div>
                  </div>

                  {successMsg ? (
                    <div className="login-success" role="status">
                      {successMsg}
                    </div>
                  ) : null}

                  {errorMsg ? (
                    <div className="login-error" role="alert">
                      {errorMsg}
                    </div>
                  ) : null}

                  <form className="login-form" onSubmit={handleSubmit} noValidate>
                    <div className="form-group">
                      <label htmlFor="tipo-usuario">Tipo usuario</label>
                      <select
                        id="tipo-usuario"
                        className="form-control"
                        value={userType}
                        onChange={(e) => setUserType(e.target.value)}
                      >
                        <option value="ALIAS">Alias</option>
                        <option value="CODIGO_PERSONA">Código de persona</option>
                        <option value="DOCUMENTO_IDENTIDAD">
                          Documento de Identidad
                        </option>
                      </select>
                    </div>

                    <div className="form-group">
                      <div className="input-group">
                        <div className="input-group-prepend">
                          <span className="input-group-text bg-success border-success">
                            <i className="ti-user" aria-hidden="true" />
                          </span>
                        </div>
                        <input
                          type="text"
                          className="form-control input-upper"
                          placeholder="Ingresar"
                          maxLength={200}
                          autoComplete="username"
                          enterKeyHint="next"
                          value={username}
                          disabled={locked || loading}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="input-group">
                        <div className="input-group-prepend">
                          <span className="input-group-text bg-success border-success">
                            <i className="ti-unlock" aria-hidden="true" />
                          </span>
                        </div>
                        <input
                          type="password"
                          className="form-control input-upper"
                          placeholder="Contraseña"
                          maxLength={200}
                          autoComplete="current-password"
                          enterKeyHint="done"
                          value={password}
                          disabled={locked || loading}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group mb-0">
                      <div className="input-group mb-0">
                        <button
                          type="submit"
                          className="btn btn-success btn-block"
                          disabled={!canSubmit}
                        >
                          {showSpinner && locked ? 'Verificando…' : 'Verificar'}
                        </button>
                      </div>
                    </div>

                    <div className="fog-pwd text-right">
                      <a href="#olvide-usuario">
                        <i className="fa fa-lock" aria-hidden="true" /> Olvidé mi
                        usuario
                      </a>
                    </div>
                    {typeof onHabilitar === 'function' ? (
                      <div className="fog-pwd text-right" style={{ marginTop: '0.35rem' }}>
                        <a
                          href="#/habilitar"
                          onClick={(e) => {
                            e.preventDefault()
                            if (!locked) onHabilitar()
                          }}
                        >
                          Habilitar dispositivo
                        </a>
                      </div>
                    ) : null}
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
