import { useEffect } from 'react'
import Phaser from 'phaser'
import './App.css'

function App() {
  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 300, x: 0 },
          debug: false
        }
      },
      scene: {
        preload: function() {
          // Assets will be loaded here
        },
        create: function(this: Phaser.Scene) {
          const text = this.add.text(400, 300, 'Welcome to Ultimate Parrot Shark', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial'
          });
          text.setOrigin(0.5); // This centers the text at its position
        },
        update: function() {
          // Game logic will run here
        }
      },
      parent: 'game-container'
    }

    const game = new Phaser.Game(config)

    return () => {
      game.destroy(true)
    }
  }, [])

  return (
    <div id="game-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    </div>
  )
}

export default App
