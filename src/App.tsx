import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useCallback, useRef } from 'react'
import Phaser from 'phaser'
import './App.css'
import GameScene from './game/scenes/GameScene'
// @ts-expect-error - Module resolution issue with ItemSelectionPanel component
import ItemSelectionPanel from './components/ItemSelectionPanel'
import DeathModal from './components/DeathModal'
import TutorialModal from './components/TutorialModal'

// Define game status types
type GameStatus = 'tutorial' | 'win' | 'playing' | 'reset' | 'gameover' | 'select' | 'placement';
// Define death types
type DeathType = 'dart' | 'spike' | null;

// Define item types
export type ItemType = 'platform' | 'spike' | 'moving';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

const supabase = createClient(supabaseUrl as string, supabaseKey as string)

function App() {
  // Start with 'tutorial' state to show the tutorial modal first
  const [gameStatus, setGameStatus] = useState<GameStatus>('tutorial');
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [placementConfirmed, setPlacementConfirmed] = useState<boolean>(false);
  const [deathType, setDeathType] = useState<DeathType>(null);

  // Handle tutorial completion
  const handleTutorialComplete = () => {
    console.log('Tutorial completed, moving to item selection');
    setGameStatus('select');
  };

  // Handle item selection
  const handleSelectItem = (itemType: ItemType) => {
    console.log(`Item selected: ${itemType}`);
    setSelectedItem(itemType);
    
    // Notify the game scene to enter placement mode
    const event = new CustomEvent('enter-placement-mode', {
      detail: { type: itemType }
    });
    window.dispatchEvent(event);
    
    setGameStatus('placement');
    setPlacementConfirmed(false);
    console.log(`Game status changed to: placement`);
  };

  // Handle item placement
  const handlePlaceItem = (x: number, y: number) => {
    if (!selectedItem || placementConfirmed) return;
    
    console.log(`Placing item: ${selectedItem} at position (${x}, ${y})`);
    setPlacementConfirmed(true);
    
    // Notify the game scene to place the item
    const event = new CustomEvent('place-item', {
      detail: { type: selectedItem, x, y }
    });
    window.dispatchEvent(event);
    
    // Reset selected item
    setSelectedItem(null);
    
    // Change game status to 'playing' to hide the placement modal during countdown
    setGameStatus('playing');
    console.log('Game status changed to: playing');
  };

  // Cancel item placement
  const handleCancelPlacement = () => {
    console.log('Placement cancelled');
    
    // Notify the game scene to exit placement mode
    const event = new CustomEvent('exit-placement-mode', {
      detail: {}
    });
    window.dispatchEvent(event);
    
    setSelectedItem(null);
    setPlacementConfirmed(false);
    setGameStatus('select');
    console.log(`Game status changed to: select`);
  };
  
  // Continue to next round after death
  const handleContinueToNextRound = () => {
    console.log('Continuing to next round');
    // Reset death type immediately to hide the modal
    setDeathType(null);
    
    // Notify the game scene to start the next round
    const event = new CustomEvent('continue-to-next-round', {
      detail: {}
    });
    window.dispatchEvent(event);
    
    // Game will transition to 'select' state via game state update event
  };
  
  // Listen for game state changes from the Phaser scene
  useEffect(() => {
    const handleGameStateUpdate = (event: Event) => {
      const gameEvent = event as CustomEvent<{status: GameStatus, deathType?: 'dart' | 'spike'}>;
      console.log(`Game state update received: ${gameEvent.detail.status}`);
      
      // Don't override the tutorial state with 'select' on initial load
      if (gameStatus === 'tutorial' && gameEvent.detail.status === 'select') {
        console.log('Ignoring initial select state during tutorial');
        return;
      }
      
      setGameStatus(gameEvent.detail.status);
      
      // If the status is 'select', reset the selected item
      if (gameEvent.detail.status === 'select') {
        setSelectedItem(null);
        setPlacementConfirmed(false);
      }
      
      // If the status is 'gameover', set the death type
      if (gameEvent.detail.status === 'gameover' && gameEvent.detail.deathType) {
        setDeathType(gameEvent.detail.deathType);
      }
    };
    
    window.addEventListener('game-state-update', handleGameStateUpdate);
    
    // Listen for placement confirmation from the game scene
    const handleConfirmPlacement = (event: Event) => {
      const placementEvent = event as CustomEvent<{type: ItemType, x: number, y: number}>;
      console.log(`Placement confirmed at (${placementEvent.detail.x}, ${placementEvent.detail.y})`);
      
      if (!placementConfirmed) {
        handlePlaceItem(placementEvent.detail.x, placementEvent.detail.y);
      }
    };
    
    window.addEventListener('confirm-placement', handleConfirmPlacement);
    
    return () => {
      window.removeEventListener('game-state-update', handleGameStateUpdate);
      window.removeEventListener('confirm-placement', handleConfirmPlacement);
    };
  }, [gameStatus, selectedItem, placementConfirmed]); // Add dependencies to ensure the event handlers use the latest state

  // Use useRef to avoid recreating the function on every render
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  const initGame = useCallback(() => {
    console.log('Initializing game...');
    
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
    
    // We'll start with the tutorial now, so we don't need to force select mode
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
    console.log('Game reset requested');
    setGameStatus('reset');
    setSelectedItem(null);
    setPlacementConfirmed(false);
    setDeathType(null);
    initGame();
    
    // Start with the tutorial again after reset
    setTimeout(() => {
      console.log('Showing tutorial after reset');
      setGameStatus('tutorial');
    }, 1000);
  };

  // Render different UI based on game status
  const renderGameUI = () => {
    console.log(`Rendering UI for game status: ${gameStatus}`);
    
    switch (gameStatus) {
      case 'tutorial':
        return <TutorialModal onStart={handleTutorialComplete} />;
      case 'select':
        console.log('Rendering item selection panel');
        return (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            width: '80%',
            maxWidth: '800px'
          }}>
            <ItemSelectionPanel onSelectItem={handleSelectItem} />
          </div>
        );
      case 'placement':
        return (
          <div style={{ 
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '10px 20px',
            borderRadius: '8px',
            color: 'white'
          }}>
            <p>Click in the game to place your {selectedItem}.</p>
            <button 
              onClick={handleCancelPlacement}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                marginTop: '10px'
              }}
            >
              Cancel Placement
            </button>
          </div>
        );
      case 'gameover':
        // Show death modal if we have a death type
        if (deathType) {
          return <DeathModal deathType={deathType} onContinue={handleContinueToNextRound} />;
        }
        return null;
      case 'win':
        return (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <h2>You Won!</h2>
            <button 
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                marginTop: '10px'
              }}
            >
              Play Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Goat In The Shell</h1>
      </header>
      
      <div style={{ position: 'relative' }}>
        {/* Game container */}
        <div id="game-container" style={{ width: '100%', height: '600px' }}></div>
        
        {/* Overlay UI based on game status */}
        {renderGameUI()}
      </div>
      
      {/* Restart button always visible below the game */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          onClick={handleReset}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Restart Game
        </button>
      </div>
      
      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
        <p>Use arrow keys or WASD to move. Space to jump.</p>
        <p>Avoid darts and dangerous platforms. Reach the finish line!</p>
      </footer>
    </div>
  );
}

export default App
