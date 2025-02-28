import { useEffect, useState, useCallback, useRef } from 'react'
import Phaser from 'phaser'
import './App.css'
import GameScene from './game/scenes/GameScene'
import PrompterControls from './components/PrompterControls'

function App() {
  const [gameStatus, setGameStatus] = useState<'win' | 'playing' | 'reset' | 'gameover'>('reset');

  // This will be implemented later to connect the prompter to the game
  const handlePlaceObstacle = (type: string, x: number, y: number) => {
    console.log(`Placing ${type} at position (${x}, ${y})`);
    // In the future, this will communicate with the Phaser game scene
  };
  
  // Listen for game state changes from the Phaser scene
  useEffect(() => {
    const handleGameStateUpdate = (event: Event) => {
      const gameEvent = event as CustomEvent<{status: 'win' | 'playing' | 'reset' | 'gameover'}>;
      setGameStatus(gameEvent.detail.status);
    };
    
    window.addEventListener('game-state-update', handleGameStateUpdate);
    
    return () => {
      window.removeEventListener('game-state-update', handleGameStateUpdate);
    };
  }, []);

  // Use useRef to avoid recreating the function on every render
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  const initGame = useCallback(() => {
    // Use the ref to track and clean up the game instance
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
    }
    
    // Clear the container first to prevent duplicate canvases
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = '';
    }
    
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      width: 1200,
      height: 800,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 300, x: 0 },
          debug: false // Disable debug mode
        }
      },
      // Enable the camera to follow the player
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [GameScene],
      parent: 'game-container',
      // Make sure we have proper rendering
      canvas: document.createElement('canvas'),
      // Define explicit render type
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false
      },
      // Make sure keyboard input is enabled
      input: {
        keyboard: true,
        gamepad: false,
        mouse: true,
        touch: true
      }
    }

    const newGame = new Phaser.Game(config);
    gameInstanceRef.current = newGame;
  }, []); // No dependencies to avoid re-creation

  useEffect(() => {
    initGame();

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const handleReset = () => {
    setGameStatus('reset');
    initGame();
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Platformer Challenge</h1>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center', 
        margin: '0 auto'
      }}>
        <div id="game-container" style={{ 
          width: '1200px', 
          height: '800px',
          backgroundColor: '#333',
          borderRadius: '8px',
        }}>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        {gameStatus === 'gameover' ? (
          <p style={{ color: '#d9534f', fontWeight: 'bold' }}>
            Game over! Try again.
          </p>
        ) : (
          <p>Use arrow keys to move and SPACEBAR to jump. Reach the red marker to win!</p>
        )}
        <button 
          onClick={handleReset}
          style={{
            padding: '8px 16px',
            backgroundColor: gameStatus === 'gameover' ? '#d9534f' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            marginTop: '10px'
          }}
        >
          {gameStatus === 'gameover' ? 'Try Again' : 'Reset Game'}
        </button>
      </div>
      
      {/* Prompter Controls - Enabled only when the game is in playing state */}
      <PrompterControls 
        onPlaceObstacle={handlePlaceObstacle} 
        disabled={gameStatus !== 'playing'} // Only enabled during gameplay
      />
    </div>
  )
}

export default App
