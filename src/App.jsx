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

  // start ambient hum on the first real user gesture (focusing the prompt)
  const handleFocus = () => {
    if (ambientStarted.current) return
    ambientStarted.current = true
    ambientRef.current?.play().catch(() => {
      // autoplay blocked, ignore — hum just won't start until a later gesture
    })
  }

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
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
          />
          <div className="status-label">Awaiting input</div>
        </div>
      )}

      {phase !== 'landing' && !dollyDone && <div className="seed-point" />}
    </div>
  )
}

export default App