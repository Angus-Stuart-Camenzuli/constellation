import { useEffect, useRef, useState } from 'react'
import Scene from './Scene'
import './App.css'

const FULL_PLACEHOLDER = "What would you like to build?"
const TYPING_START_DELAY = 1900
const TYPING_SPEED = 45
const DISSOLVE_DURATION = 650

function App() {
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState('landing') // landing | dissolving | constellation
  const [dollyDone, setDollyDone] = useState(false)

  const [placeholder, setPlaceholder] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [showCursor, setShowCursor] = useState(true)
  const [muted, setMuted] = useState(
    () => localStorage.getItem('constellation-muted') === 'true'
  )

  const ambientRef = useRef(null)
  const whooshRef = useRef(null)
  const ambientStarted = useRef(false)

  useEffect(() => {
    let charIndex = 0
    const startTimeout = setTimeout(() => {
      const typeInterval = setInterval(() => {
        charIndex++
        setPlaceholder(FULL_PLACEHOLDER.slice(0, charIndex))
        if (charIndex >= FULL_PLACEHOLDER.length) {
          clearInterval(typeInterval)
          setIsTyping(false)
        }
      }, TYPING_SPEED)
      return () => clearInterval(typeInterval)
    }, TYPING_START_DELAY)
    return () => clearTimeout(startTimeout)
  }, [])

  useEffect(() => {
    if (!isTyping) return
    const blink = setInterval(() => setShowCursor((c) => !c), 500)
    return () => clearInterval(blink)
  }, [isTyping])

  const displayPlaceholder = isTyping
    ? placeholder + (showCursor ? '|' : ' ')
    : placeholder

  // volume levels — kept low so the hum sits under the visuals, not over them
  useEffect(() => {
    if (ambientRef.current) ambientRef.current.volume = 0.25
    if (whooshRef.current) whooshRef.current.volume = 0.4
  }, [])

  // sync the mute toggle to both audio elements and remember the choice
  useEffect(() => {
    if (ambientRef.current) ambientRef.current.muted = muted
    if (whooshRef.current) whooshRef.current.muted = muted
    localStorage.setItem('constellation-muted', String(muted))
  }, [muted])

  const toggleMuted = () => setMuted((m) => !m)

  // try to autoplay the hum on load; most browsers allow this once muted,
  // otherwise fall back to starting it on the first user gesture anywhere
  useEffect(() => {
    const tryPlay = () => {
      if (ambientStarted.current) return
      ambientRef.current
        ?.play()
        .then(() => {
          ambientStarted.current = true
        })
        .catch(() => {
          // autoplay blocked — the fallback listener below will retry
        })
    }

    tryPlay()

    const fallback = () => {
      tryPlay()
      if (ambientStarted.current) {
        window.removeEventListener('pointerdown', fallback)
        window.removeEventListener('keydown', fallback)
      }
    }
    window.addEventListener('pointerdown', fallback)
    window.addEventListener('keydown', fallback)
    return () => {
      window.removeEventListener('pointerdown', fallback)
      window.removeEventListener('keydown', fallback)
    }
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim().length > 0 && phase === 'landing') {
      whooshRef.current?.play().catch(() => {})
      setPhase('dissolving')
      setTimeout(() => setPhase('constellation'), DISSOLVE_DURATION)
    }
  }

  return (
    <div className={`container phase-${phase}`}>
      <audio ref={ambientRef} src="/audio/ambient-hum.mp3" loop preload="auto" />
      <audio ref={whooshRef} src="/audio/enter-whoosh.mp3" preload="auto" />

      <Scene
        dollyActive={phase === 'constellation' && !dollyDone}
        onDollyComplete={() => setDollyDone(true)}
      />

      {phase !== 'constellation' && (
        <>
          <div className="glow-close" />
          <div className="glow-ambient" />
          <div className="orbit-ring" />
        </>
      )}

      {phase !== 'constellation' && (
        <div className="prompt-wrapper">
          <input
            className="prompt"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
          />
          <div className="status-label">Awaiting input</div>
        </div>
      )}

      {phase !== 'landing' && !dollyDone && <div className="seed-point" />}

      <button
        type="button"
        className="mute-toggle"
        onClick={toggleMuted}
        aria-label={muted ? 'Unmute ambient sound' : 'Mute ambient sound'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              d="M4 9v6h4l5 5V4L8 9H4z"
              fill="rgba(255,255,255,0.6)"
            />
            <path
              d="M16 9l5 6M21 9l-5 6"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              d="M4 9v6h4l5 5V4L8 9H4z"
              fill="rgba(255,255,255,0.6)"
            />
            <path
              d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export default App