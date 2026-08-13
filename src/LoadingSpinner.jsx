import './LoadingSpinner.css'

export default function LoadingSpinner({ scoped = false }) {
  return (
    <div
      className={`loading-spinner${scoped ? ' loading-spinner--scoped' : ''}`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="ball-clip-rotate" aria-hidden="true">
        <div />
      </div>
    </div>
  )
}
