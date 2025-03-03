// import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useCallback, useRef } from 'react'
import Phaser from 'phaser'
import './App.css'
import GameScene from './game/scenes/GameScene'
import ItemSelectionPanel from './components/ItemSelectionPanel'
import DeathModal from './components/DeathModal'
import TutorialModal from './components/TutorialModal'
import PrompterControls from './components/PrompterControls'
import GameModeSelection from './components/GameModeSelection'
import LobbyWaitingScreen from './components/LobbyWaitingScreen'
import { MultiplayerService } from './services/MultiplayerService'
import { 
  GameStatus, 
  DeathType, 
  ItemType, 
  GameMode, 
  PlayerRole 
} from './types';

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
  
  // Multiplayer state
  const [currentGameMode, setCurrentGameMode] = useState<GameMode>('single_player');
  const [lobbyCode, setLobbyCode] = useState<string>('');
  const [playerRole, setPlayerRole] = useState<PlayerRole>('goat');

  // Get MultiplayerService instance
  const multiplayerService = MultiplayerService.getInstance();

  // Handle tutorial completion
  const handleTutorialComplete = () => {
    setGameStatus('modeSelect');
  };

  // Handle game mode selection
  const handleGameModeSelect = async (mode: GameMode, joinLobbyCode?: string) => {
    console.log(`Game mode selected: ${mode}`);
    
    if (mode === 'single_player') {
      // Single player mode
      setCurrentGameMode('single_player');
      setGameStatus('select');
    } else {
      // Multiplayer mode
      setCurrentGameMode('multiplayer');
      
      if (joinLobbyCode) {
        // Joining an existing lobby
        console.log(`Joining lobby: ${joinLobbyCode}`);
        setLobbyCode(joinLobbyCode);
        setPlayerRole('goat'); // Player who joins is the goat by default
        
        try {
          const connected = await multiplayerService.connect(joinLobbyCode, 'goat');
          if (connected) {
            setGameStatus('lobby');
            // Setup event listeners for multiplayer
            setupMultiplayerEventListeners();
          } else {
            console.error('Failed to connect to lobby');
            // TODO: Show error message
          }
        } catch (error) {
          console.error('Error connecting to lobby:', error);
          // TODO: Show error message
        }
      } else {
        // Creating a new lobby
        // Generate a random 6-letter code
        const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log(`Creating new lobby: ${generatedCode}`);
        setLobbyCode(generatedCode);
        setPlayerRole('prompter'); // Player who creates is the prompter by default
        
        try {
          const connected = await multiplayerService.connect(generatedCode, 'prompter');
          if (connected) {
            setGameStatus('lobby');
            // Setup event listeners for multiplayer
            setupMultiplayerEventListeners();
          } else {
            console.error('Failed to create lobby');
            // TODO: Show error message
          }
        } catch (error) {
          console.error('Error creating lobby:', error);
          // TODO: Show error message
        }
      }
    }
  };

  // Handle lobby cancel
  const handleCancelLobby = () => {
    console.log('Canceling lobby');
    multiplayerService.disconnect();
    setGameStatus('modeSelect');
  };

  // Setup multiplayer event listeners
  const setupMultiplayerEventListeners = () => {
    // Listen for player joined event
    multiplayerService.on('player_joined', (data) => {
      console.log('Player joined:', data);
      // Note: Game starting is now handled by the start button
    });

    // Listen for game start event (triggered by host)
    multiplayerService.on('start_game', () => {
      console.log('Game starting...');
      // Start the game and move to select state
      setGameStatus('select');
    });

    // Listen for player state updates
    multiplayerService.on('player_state', (data) => {
      console.log('Player state update:', data);
      // Update player state in game
      const event = new CustomEvent('remote-player-update', {
        detail: data
      });
      window.dispatchEvent(event);
    });

    // Listen for command results
    multiplayerService.on('command_result', (data) => {
      console.log('Command result:', data);
      // Handle command results
      const commandData = data as {type?: string; x?: number; y?: number};
      if (commandData.type && commandData.x !== undefined && commandData.y !== undefined) {
        handlePlaceObstacle(commandData.type, commandData.x, commandData.y);
      }
    });

    // Listen for disconnect events
    multiplayerService.on('disconnect', () => {
      console.log('Disconnected from multiplayer session');
      // TODO: Show disconnect message and return to mode select
      setGameStatus('modeSelect');
    });
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
  const handlePlaceItem = useCallback((x: number, y: number) => {
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
  }, [selectedItem, placementConfirmed]);

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
      
      // Don't override certain states with 'select' on initial load
      if ((gameStatus === 'tutorial' || gameStatus === 'modeSelect' || gameStatus === 'lobby') && 
          gameEvent.detail.status === 'select') {
        console.log('Ignoring initial select state during tutorial/mode select/lobby');
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
    
    // Listen for game start events from the multiplayer lobby
    const handleGameStartMultiplayer = (event: Event) => {
      const startEvent = event as CustomEvent;
      console.log('Game start event received from lobby with details:', startEvent.detail);
      
      // Ensure we have the latest player role and lobby information
      if (startEvent.detail) {
        const { playerRole: eventRole, lobbyCode: eventLobby } = startEvent.detail;
        if (eventRole) {
          console.log(`Confirming player role: ${eventRole}`);
        }
        if (eventLobby) {
          console.log(`Confirming lobby code: ${eventLobby}`);
        }
      }
      
      // Reinitialize the game with current multiplayer settings to ensure proper roles
      reinitializeGameWithMultiplayer();
      
      // Wait a short delay to ensure game is reinitialized before changing state
      setTimeout(() => {
        console.log('Transitioning to select state after game start');
        setGameStatus('select');
      }, 200);
    };
    
    window.addEventListener('confirm-placement', handleConfirmPlacement);
    window.addEventListener('game-start-multiplayer', handleGameStartMultiplayer);
    
    return () => {
      window.removeEventListener('game-state-update', handleGameStateUpdate);
      window.removeEventListener('confirm-placement', handleConfirmPlacement);
      window.removeEventListener('game-start-multiplayer', handleGameStartMultiplayer);
    };
  }, [gameStatus, selectedItem, placementConfirmed, handlePlaceItem]); // Add dependencies to ensure the event handlers use the latest state

  // Use useRef to avoid recreating the function on every render
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  const initGame = useCallback((gameMode?: GameMode, role?: PlayerRole) => {
    console.log(`Initializing game with mode: ${gameMode}, role: ${role || playerRole}`);
    
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
    
    // When initializing the game, pass the game mode and player role to the scene
    // Setup game mode for the Phaser scene - always send the configuration
    const actualRole = role || playerRole;
    const actualMode = gameMode || currentGameMode;
    
    const gameConfig = {
      mode: actualMode,
      playerRole: actualRole,
      isMultiplayer: actualMode === 'multiplayer'
    };
    
    console.log(`Sending game-mode-config:`, gameConfig);
    
    // Pass config to the game scene
    const event = new CustomEvent('game-mode-config', {
      detail: gameConfig
    });
    
    // Set a short delay to ensure scene is created before sending config
    setTimeout(() => {
      window.dispatchEvent(event);
      console.log('Game-mode-config event dispatched');
    }, 500);
  }, [playerRole, currentGameMode]); // Include playerRole and currentGameMode in dependencies
  
  // Method to explicitly reinitialize game with current multiplayer settings
  const reinitializeGameWithMultiplayer = useCallback(() => {
    console.log(`Reinitializing game with multiplayer. Role: ${playerRole}, Mode: ${currentGameMode}`);
    initGame(currentGameMode, playerRole);
  }, [currentGameMode, playerRole, initGame]);

  useEffect(() => {
    // Initialize the game
    initGame();

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, [initGame]); // Include initGame in dependencies

  const handleReset = () => {
    console.log('Game reset requested');
    
    // Save current state if in multiplayer mode for debugging
    if (currentGameMode === 'multiplayer') {
      console.log(`Resetting from multiplayer mode. Role: ${playerRole}, Lobby: ${lobbyCode}`);
      // Disconnect from multiplayer if active
      multiplayerService.disconnect();
    }
    
    // Set game status to reset
    setGameStatus('reset');
    setSelectedItem(null);
    setPlacementConfirmed(false);
    setDeathType(null);
    
    // Initialize a new game without multiplayer settings
    initGame('single_player');
    
    // Skip tutorial and go directly to mode selection after reset
    setTimeout(() => {
      console.log('Going directly to mode selection after reset');
      setGameStatus('modeSelect');
    }, 1000);
  };

  // Handle placing obstacles from the prompter
  const handlePlaceObstacle = (type: string, x: number, y: number) => {
    console.log(`Placing obstacle from prompter: ${type} at position (${x}, ${y})`);
    
    // In multiplayer mode, send the command to other players
    if (currentGameMode === 'multiplayer' && multiplayerService.isConnected()) {
      multiplayerService.sendMessage('command', {
        type,
        x,
        y
      });
    }
    
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
      case 'modeSelect':
        return <GameModeSelection onSelectMode={handleGameModeSelect} />;
      case 'lobby':
        return (
          <LobbyWaitingScreen 
            lobbyCode={lobbyCode}
            playerRole={playerRole}
            onCancel={handleCancelLobby}
          />
        );
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
      case 'placement': {
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
      }
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

  // Determine if prompter controls should be shown
  const shouldShowPrompterControls = () => {
    // First check game status - controls should only be shown during gameplay
    if (gameStatus !== 'playing') return false;
    
    // Different logic based on game mode
    if (currentGameMode === 'single_player') {
      // In single player, only show if explicitly toggled on by the player
      return showPrompter;
    } else {
      // In multiplayer, ONLY show for the Shell Commander (prompter) player
      const showForPrompter = playerRole === 'prompter';
      console.log(`Prompter controls visibility check: role=${playerRole}, show=${showForPrompter}`);
      return showForPrompter;
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
        {gameStatus === 'tutorial' || gameStatus === 'modeSelect' || gameStatus === 'lobby' || 
         gameStatus === 'select' || gameStatus === 'gameover' || gameStatus === 'win' 
         ? renderGameUI() : null}
      </div>
      
      {/* Placement modal in normal document flow */}
      {gameStatus === 'placement' && renderGameUI()}
      
      {/* Prompter controls - only show when playing and when appropriate */}
      {shouldShowPrompterControls() && (
        <PrompterControls 
          onPlaceObstacle={handlePlaceObstacle} 
          disabled={gameStatus !== 'playing'} 
        />
      )}
      
      {/* Multiplayer status indicator */}
      {currentGameMode === 'multiplayer' && gameStatus !== 'modeSelect' && gameStatus !== 'lobby' && (
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: multiplayerService.isConnected() ? '#4CAF50' : '#e94560',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: "'Courier New', Courier, monospace",
          border: `1px solid ${multiplayerService.isConnected() ? '#4CAF50' : '#e94560'}`,
          boxShadow: `0 0 10px ${multiplayerService.isConnected() ? 'rgba(76, 175, 80, 0.5)' : 'rgba(233, 69, 96, 0.5)'}`,
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: multiplayerService.isConnected() ? '#4CAF50' : '#e94560',
              marginRight: '8px',
              boxShadow: `0 0 5px ${multiplayerService.isConnected() ? '#4CAF50' : '#e94560'}`
            }}></span>
            <span style={{ fontWeight: 'bold' }}>
              {multiplayerService.isConnected() ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div>Role: <span style={{ color: '#10b981' }}>{playerRole === 'goat' ? 'Escape Goat' : 'Shell Commander'}</span></div>
          <div>Lobby: <span style={{ color: '#e94560' }}>{lobbyCode}</span></div>
        </div>
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
        
        {/* Only show prompter toggle in single player mode */}
        {currentGameMode === 'single_player' && (
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
        )}
      </div>
      
      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
        <p>Use arrow keys or WASD to move. Space to jump.</p>
        <p>Avoid darts and dangerous platforms. Reach the finish line!</p>
        {gameStatus === 'playing' && currentGameMode === 'single_player' && (
          <p>Try the command terminal to add obstacles in real-time!</p>
        )}
        {gameStatus === 'playing' && currentGameMode === 'multiplayer' && (
          <p>
            {playerRole === 'goat' 
              ? 'The Shell Commander can add obstacles in real-time!' 
              : 'Use the command terminal to challenge the Escape Goat!'}
          </p>
        )}
      </footer>
    </div>
  );
}

export default App
