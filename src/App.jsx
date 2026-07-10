import { useEffect, useState } from 'react'
import './App.css'

const FULL_PLACEHOLDER = "What would you like to build?"
const TYPING_START_DELAY = 1900 // waits for prompt-in animation to land first
const TYPING_SPEED = 45

function useStars(count = 55) {
  const [stars] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      maxOpacity: Math.random() * 0.5 + 0.15,
      duration: Math.random() * 3 + 3,
      delay: Math.random() * 1.5,
    }))
  )
  return stars
}

function App() {
  const stars = useStars()
  const [placeholder, setPlaceholder] = useState('')
  const [isTyping, setIsTyping] = useState(true) // was: useState(false)
  const [showCursor, setShowCursor] = useState(true)

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

  return (
    <div className="container">
      <div className="starfield">
        {stars.map((s) => (
          <div
            key={s.id}
            className="star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              '--max-opacity': s.maxOpacity,
              '--dur': `${s.duration}s`,
              animationDelay: `${s.delay}s, ${s.delay + 2}s`,
            }}
          />
        ))}
      </div>

      <div className="glow-close" />
      <div className="glow-ambient" />
      <div className="orbit-ring" />

      <div className="prompt-wrapper">
        <input
          className="prompt"
          type="text"
          placeholder={displayPlaceholder}
        />
        <div className="status-label">Awaiting input</div>
      </div>
    </div>
  )
}

export default App