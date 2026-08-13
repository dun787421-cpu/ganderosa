import './DashboardPage.css'

export default function DashboardPage({ user, onLogout }) {
  const displayName = user?.nombre || user?.username || 'Usuario'

  return (
    <div className="dashboard">
      <header className="dashboard__top">
        <div className="dashboard__brand">
          <img src={`${import.meta.env.BASE_URL}banco-ganadero-logo.svg`} alt="Banco Ganadero" />
          <span>GanaNet</span>
        </div>
        <div className="dashboard__user">
          <span>Hola, {displayName}</span>
          <button type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard__main">
        <section className="dashboard__hero">
          <h1>Bienvenido a tu banca digital</h1>
          <p>Sesión iniciada correctamente. Esta es una vista demo del dashboard.</p>
        </section>

        <section className="dashboard__grid">
          <article className="dashboard__card">
            <h2>Cuentas</h2>
            <p>Consulta saldos y movimientos.</p>
          </article>
          <article className="dashboard__card">
            <h2>Transferencias</h2>
            <p>Envía dinero entre cuentas.</p>
          </article>
          <article className="dashboard__card">
            <h2>Pagos</h2>
            <p>Paga servicios y obligaciones.</p>
          </article>
          <article className="dashboard__card">
            <h2>Seguridad</h2>
            <p>Gestiona claves y dispositivos.</p>
          </article>
        </section>
      </main>
    </div>
  )
}
