#################################################################
#                                                               #
#                                                               #
#                           IMPORTS                             #
#                                                               #
#                                                               #
#################################################################


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
} from './shared/types';

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
    if (mode === 'single_player') {
      // Single player mode
      setCurrentGameMode('single_player');
      setGameStatus('select');
    } else {
      // Multiplayer mode
      setCurrentGameMode('multiplayer');
      
      if (joinLobbyCode) {
        // Joining an existing lobby
        setLobbyCode(joinLobbyCode);
        setPlayerRole('goat'); // Player who joins is the goat by default
        
        try {
          const connected = await multiplayerService.connect(joinLobbyCode, 'goat');
          if (connected) {
            setGameStatus('lobby');
            // Setup event listeners for multiplayer
            setupMultiplayerEventListeners();
          }
        } catch (error) {
          console.error('Error connecting to lobby:', error);
        }
      } else {
        // Creating a new lobby
        // Generate a random 6-letter code
        const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setLobbyCode(generatedCode);
        setPlayerRole('prompter'); // Player who creates is the prompter by default
        
        try {
          const connected = await multiplayerService.connect(generatedCode, 'prompter');
          if (connected) {
            setGameStatus('lobby');
            // Setup event listeners for multiplayer
            setupMultiplayerEventListeners();
          }
        } catch (error) {
          console.error('Error creating lobby:', error);
        }
      }
    }
  };

  // Handle lobby cancel
  const handleCancelLobby = () => {
    multiplayerService.disconnect();
    setGameStatus('modeSelect');
  };

  // Setup multiplayer event listeners
  const setupMultiplayerEventListeners = () => {
    // Listen for player joined event
    multiplayerService.on('player_joined', () => {
      // Note: Game starting is now handled by the start button
    });

    // Listen for game start event (triggered by host)
    multiplayerService.on('start_game', () => {
      // Start the game and move to select state
      setGameStatus('select');
    });

    // Listen for player state updates
    multiplayerService.on('player_state', (data) => {
      // Update player state in game
      const event = new CustomEvent('remote-player-update', {
        detail: data
      });
      window.dispatchEvent(event);
    });

    // Listen for command results
    multiplayerService.on('command_result', (data) => {
      // Handle command results
      const commandData = data as {type?: string; x?: number; y?: number};
      if (commandData.type && commandData.x !== undefined && commandData.y !== undefined) {
        handlePlaceObstacle(commandData.type, commandData.x, commandData.y);
      }
    });

    // Listen for disconnect events
    multiplayerService.on('disconnect', () => {
      setGameStatus('modeSelect');
    });
  };

  // Handle item selection
  const handleSelectItem = (itemType: ItemType) => {
    setSelectedItem(itemType);
    
    // Notify the game scene to enter placement mode
    const event = new CustomEvent('enter-placement-mode', {
      detail: { type: itemType }
    });
    window.dispatchEvent(event);
    
    setGameStatus('placement');
    setPlacementConfirmed(false);
  };

  // Handle item placement
  const handlePlaceItem = useCallback((x: number, y: number) => {
    if (!selectedItem || placementConfirmed) return;
    
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
  }, [selectedItem, placementConfirmed]);

  // Cancel item placement
  const handleCancelPlacement = () => {
    // Notify the game scene to exit placement mode
    const event = new CustomEvent('exit-placement-mode', {
      detail: {}
    });
    window.dispatchEvent(event);
    
    setSelectedItem(null);
    setPlacementConfirmed(false);
    setGameStatus('select');
  };
  
  // Continue to next round after death
  const handleContinueToNextRound = () => {
    // Reset death type immediately to hide the modal
    setDeathType(null);
    
    // Notify the game scene to start the next round
    const event = new CustomEvent('continue-to-next-round', {
      detail: {}
    });
    window.dispatchEvent(event);
  };
  
  // Listen for game state changes from the Phaser scene
  useEffect(() => {
    const handleGameStateUpdate = (event: Event) => {
      const gameEvent = event as CustomEvent<{status: GameStatus, deathType?: 'dart' | 'spike'}>;
      
      // Don't override certain states with 'select' on initial load
      if ((gameStatus === 'tutorial' || gameStatus === 'modeSelect' || gameStatus === 'lobby') && 
          gameEvent.detail.status === 'select') {
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
      
      if (!placementConfirmed) {
        handlePlaceItem(placementEvent.detail.x, placementEvent.detail.y);
      }
    };
    
    // Listen for game start events from the multiplayer lobby
    const handleGameStartMultiplayer = () => {
      // Reinitialize the game with current multiplayer settings to ensure proper roles
      reinitializeGameWithMultiplayer();
      
      // Wait a short delay to ensure game is reinitialized before changing state
      setTimeout(() => {
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
  }, [gameStatus, selectedItem, placementConfirmed, handlePlaceItem]);

  // Use useRef to avoid recreating the function on every render
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  const initGame = useCallback((gameMode?: GameMode, role?: PlayerRole) => {
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
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [GameScene],
      parent: 'game-container',
      canvas: document.createElement('canvas'),
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false
      },
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
    const actualRole = role || playerRole;
    const actualMode = gameMode || currentGameMode;
    
    const gameConfig = {
      mode: actualMode,
      playerRole: actualRole,
      isMultiplayer: actualMode === 'multiplayer'
    };
    
    // Pass config to the game scene
    const event = new CustomEvent('game-mode-config', {
      detail: gameConfig
    });
    
    // Set a short delay to ensure scene is created before sending config
    setTimeout(() => {
      window.dispatchEvent(event);
    }, 500);
  }, [playerRole, currentGameMode]);
  
  // Method to explicitly reinitialize game with current multiplayer settings
  const reinitializeGameWithMultiplayer = useCallback(() => {
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
  }, [initGame]);

  const handleReset = () => {
    // Save current state if in multiplayer mode for debugging
    if (currentGameMode === 'multiplayer') {
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
      setGameStatus('modeSelect');
    }, 1000);
  };

  // Handle placing obstacles from the prompter
  const handlePlaceObstacle = (type: string, x: number, y: number) => {
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

  // Get item display name and instructions for placement UI
  const getPlacementInfo = (item: ItemType | null) => {
    let placementInstructions = 'Click in the game to place your item.';
    let displayName = 'Item';
    
    switch(item) {
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
    }
    
    return { placementInstructions, displayName };
  }

  // Render different UI based on game status
  const renderGameUI = () => {
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
        return (
          <div className="item-selection-container">
            <ItemSelectionPanel onSelectItem={handleSelectItem} />
          </div>
        );
      case 'placement': {
        const { placementInstructions, displayName } = getPlacementInfo(selectedItem);
        
        return (
          <div className="placement-container">
            <div className="placement-grid-bg" />
            <h3 className="placement-heading">
              Placing: {displayName}
            </h3>
            <p className="placement-instructions">
              {placementInstructions}
            </p>
            <button 
              onClick={handleCancelPlacement}
              className="cancel-button"
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
          <div className="win-container">
            <h2>You Won!</h2>
            <button 
              onClick={handleReset}
              className="restart-button"
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
      return playerRole === 'prompter';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="game-title">Goat In The Shell</h1>
      </header>
      
      <div className="game-relative-container">
        {/* Game container */}
        <div id="game-container"></div>
        
        {/* Overlay UI based on game status */}
        {(gameStatus === 'tutorial' || gameStatus === 'modeSelect' || gameStatus === 'lobby' || 
         gameStatus === 'select' || gameStatus === 'gameover' || gameStatus === 'win') && renderGameUI()}
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
        <div className={`multiplayer-status ${multiplayerService.isConnected() ? 'status-connected' : 'status-disconnected'}`}>
          <div className="status-indicator">
            <span className={`status-dot ${multiplayerService.isConnected() ? 'dot-connected' : 'dot-disconnected'}`}></span>
            <span style={{ fontWeight: 'bold' }}>
              {multiplayerService.isConnected() ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div>Role: <span className="player-role">{playerRole === 'goat' ? 'Escape Goat' : 'Shell Commander'}</span></div>
          <div>Lobby: <span className="lobby-code">{lobbyCode}</span></div>
        </div>
      )}
      
      {/* Restart button and prompter toggle always visible below the game */}
      <div className="game-controls">
        <button 
          onClick={handleReset}
          className="restart-button"
        >
          <div className="grid-bg"></div>
          Restart Game
        </button>
        
        {/* Only show prompter toggle in single player mode */}
        {currentGameMode === 'single_player' && (
          <button 
            onClick={togglePrompter}
            className={`prompter-button ${gameStatus !== 'playing' ? 'prompter-button-disabled' : ''}`}
            disabled={gameStatus !== 'playing'}
          >
            <div className={`prompter-grid-bg ${gameStatus !== 'playing' ? 'disabled-grid-bg' : ''}`}></div>
            {showPrompter ? 'Hide Command Terminal' : 'Show Command Terminal'}
          </button>
        )}
      </div>
      
      <footer className="game-footer">
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
