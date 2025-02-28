import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [dots, setDots] = useState('...')

  useEffect(() => {
    // Animate the dots
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="game-title">Goat In The Shell</h1>
        <div className="coming-soon-container">
          <div className="message-box">
            <p className="coming-soon-text">
              Your favorite gamer's favorite game<span className="dots-container">{dots}</span>
            </p>
            <p className="coming-soon-label">Coming Soon</p>
          </div>
          <div className="goat-animation">
            <div className="goat">🐐</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
