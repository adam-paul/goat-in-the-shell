// import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useCallback, useRef } from 'react'
import Phaser from 'phaser'
import './App.css'
import GameScene from './game/scenes/GameScene'
import ItemSelectionPanel from './components/ItemSelectionPanel'
import DeathModal from './components/DeathModal'
import TutorialModal from './components/TutorialModal'
import PrompterControls from './components/PrompterControls'

// Define game status types
type GameStatus = 'tutorial' | 'win' | 'playing' | 'reset' | 'gameover' | 'select' | 'placement';
// Define death types
type DeathType = 'dart' | 'spike' | 'fall' | null;

// Define item types
export type ItemType = 'platform' | 'spike' | 'moving' | 'shield';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

// Create Supabase client but don't use it yet - will be used in future features
// const supabase = createClient(supabaseUrl as string, supabaseKey as string)

function App() {
  // Start with 'tutorial' state to show the tutorial modal first
  const [gameStatus, setGameStatus] = useState<GameStatus>('tutorial');
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [placementConfirmed, setPlacementConfirmed] = useState<boolean>(false);
  const [deathType, setDeathType] = useState<DeathType>(null);
  const [showPrompter, setShowPrompter] = useState<boolean>(false);

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
    
    // Skip tutorial and go directly to item selection after reset
    setTimeout(() => {
      console.log('Going directly to item selection after reset');
      setGameStatus('select');
    }, 1000);
  };

  // Handle placing obstacles from the prompter
  const handlePlaceObstacle = (type: string, x: number, y: number) => {
    console.log(`Placing obstacle from prompter: ${type} at position (${x}, ${y})`);
    
    // Notify the game scene to place the item without restarting the level
    const event = new CustomEvent('place-live-item', {
      detail: { type, x, y }
    });
    window.dispatchEvent(event);
  };

  // Toggle the prompter visibility
  const togglePrompter = () => {
    setShowPrompter(prev => !prev);
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
        // Define item-specific instructions
        let placementInstructions = '';
        let displayName = 'Item';
        
        switch(selectedItem) {
          case 'platform':
            placementInstructions = 'Place your platform under gaps or in hard-to-reach areas.';
            displayName = 'Platform';
            break;
          case 'spike':
            placementInstructions = 'Place spikes to create challenging obstacles for your goat.';
            displayName = 'Spike';
            break;
          case 'moving':
            placementInstructions = 'Place an oscillator to help cross large gaps.';
            displayName = 'Oscillator';
            break;
          case 'shield':
            placementInstructions = 'Place a shield to block incoming darts.';
            displayName = 'Shield';
            break;
          default:
            placementInstructions = 'Click in the game to place your item.';
        }
        
        return (
          <div style={{ 
            position: 'relative',
            margin: '20px auto',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '20px 30px',
            borderRadius: '15px',
            color: 'white',
            boxShadow: '0 0 30px rgba(233, 69, 96, 0.5)',
            border: '2px solid #e94560',
            textAlign: 'center',
            width: 'auto',
            maxWidth: '600px',
            overflow: 'hidden'
          }}>
            {/* Grid background */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px),
                linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              animation: 'grid 15s linear infinite',
              zIndex: -1
            }} />
            
            <h3 style={{
              fontFamily: "'Press Start 2P', cursive, sans-serif",
              fontSize: '16px',
              color: '#e94560',
              textShadow: '0 0 10px rgba(233, 69, 96, 0.7)',
              marginBottom: '15px'
            }}>
              Placing: {displayName}
            </h3>
            
            <p style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '14px',
              marginBottom: '15px'
            }}>
              {placementInstructions}
            </p>
            
            <button 
              onClick={handleCancelPlacement}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(233, 69, 96, 0.2)',
                color: 'white',
                border: '2px solid #e94560',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: "'Press Start 2P', cursive, sans-serif",
                boxShadow: '0 0 15px rgba(233, 69, 96, 0.5)',
                transition: 'all 0.3s ease',
                textShadow: '0 0 5px rgba(233, 69, 96, 0.7)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
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
        <h1 className="game-title">Goat In The Shell</h1>
      </header>
      
      <div style={{ position: 'relative' }}>
        {/* Game container */}
        <div id="game-container" style={{ width: '100%', height: '600px' }}></div>
        
        {/* Overlay UI based on game status */}
        {gameStatus === 'tutorial' || gameStatus === 'select' || gameStatus === 'gameover' || gameStatus === 'win' ? renderGameUI() : null}
      </div>
      
      {/* Placement modal in normal document flow */}
      {gameStatus === 'placement' && renderGameUI()}
      
      {/* Prompter controls - only show when playing and when toggled on */}
      {gameStatus === 'playing' && showPrompter && (
        <PrompterControls 
          onPlaceObstacle={handlePlaceObstacle} 
          disabled={gameStatus !== 'playing'} 
        />
      )}
      
      {/* Restart button and prompter toggle always visible below the game */}
      <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button 
          onClick={handleReset}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(33, 150, 243, 0.2)',
            color: 'white',
            border: '2px solid #2196F3',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            boxShadow: '0 0 15px rgba(33, 150, 243, 0.5)',
            transition: 'all 0.3s ease',
            textShadow: '0 0 5px rgba(33, 150, 243, 0.7)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.4)';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 7px 20px rgba(33, 150, 243, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(33, 150, 243, 0.5)';
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(90deg, rgba(33, 150, 243, 0.1) 1px, transparent 1px),
              linear-gradient(rgba(33, 150, 243, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            zIndex: -1
          }} />
          Restart Game
        </button>
        
        <button 
          onClick={togglePrompter}
          style={{
            padding: '10px 20px',
            backgroundColor: gameStatus === 'playing' ? 'rgba(233, 69, 96, 0.2)' : 'rgba(102, 102, 102, 0.2)',
            color: 'white',
            border: `2px solid ${gameStatus === 'playing' ? '#e94560' : '#666'}`,
            borderRadius: '8px',
            cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            boxShadow: `0 0 15px rgba(${gameStatus === 'playing' ? '233, 69, 96' : '102, 102, 102'}, 0.5)`,
            transition: 'all 0.3s ease',
            textShadow: `0 0 5px rgba(${gameStatus === 'playing' ? '233, 69, 96' : '102, 102, 102'}, 0.7)`,
            position: 'relative',
            overflow: 'hidden'
          }}
          disabled={gameStatus !== 'playing'}
          onMouseOver={(e) => {
            if (gameStatus === 'playing') {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (gameStatus === 'playing') {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: gameStatus === 'playing' ? `
              linear-gradient(90deg, rgba(233, 69, 96, 0.1) 1px, transparent 1px),
              linear-gradient(rgba(233, 69, 96, 0.1) 1px, transparent 1px)
            ` : `
              linear-gradient(90deg, rgba(102, 102, 102, 0.1) 1px, transparent 1px),
              linear-gradient(rgba(102, 102, 102, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            zIndex: -1
          }} />
          {showPrompter ? 'Hide Command Terminal' : 'Show Command Terminal'}
        </button>
      </div>
      
      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
        <p>Use arrow keys or WASD to move. Space to jump.</p>
        <p>Avoid darts and dangerous platforms. Reach the finish line!</p>
        {gameStatus === 'playing' && (
          <p>Try the command terminal to add obstacles in real-time!</p>
        )}
      </footer>
    </div>
  );
}

export default App
