// src/client/App.tsx
import { useCallback } from 'react';
import './App.css';

// Import components from new structure
import GameRenderer from './rendering/GameRenderer';
import { useGameStore } from './store/gameStore';
import { useNetwork } from './network/NetworkProvider';
import useInputHandler from './input/InputHandler';
import useItemPlacementHandler from './input/ItemPlacementHandler';

// Import components from the new component structure
import DeathModal from './components/DeathModal';
import ItemSelectionPanel from './components/ItemSelectionPanel';
import TutorialModal from './components/TutorialModal';
import PrompterControls from './components/PrompterControls';
import GameModeSelection from './components/GameModeSelection';
import LobbyWaitingScreen from './components/LobbyWaitingScreen';

function App() {
  // Use our game store for state management
  const {
    gameStatus,
    selectedItem,
    deathType,
    showPrompter,
    currentGameMode,
    lobbyCode,
    playerRole,
    handleSelectItem,
    handleCancelPlacement,
    handleContinueToNextRound,
    resetGame,
    togglePrompter
  } = useGameStore();
  
  // Use network context for multiplayer functionality
  const network = useNetwork();
  
  // Use our custom hooks for input handling
  useInputHandler();
  useItemPlacementHandler();
  
  // Handle game mode selection
  const handleGameModeSelect = useCallback(async (mode: any, joinLobbyCode?: string) => {
    const { 
      setCurrentGameMode, 
      setGameStatus, 
      setLobbyCode, 
      setPlayerRole 
    } = useGameStore.getState();
    
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
          const connected = await network.connect(joinLobbyCode, 'goat');
          if (connected) {
            setGameStatus('lobby');
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
          const connected = await network.connect(generatedCode, 'prompter');
          if (connected) {
            setGameStatus('lobby');
          }
        } catch (error) {
          console.error('Error creating lobby:', error);
        }
      }
    }
  }, [network]);

  // Handle lobby cancel
  const handleCancelLobby = useCallback(() => {
    network.disconnect();
    useGameStore.getState().setGameStatus('modeSelect');
  }, [network]);

  // Handle placing obstacles from the prompter
  const handlePlaceObstacle = useCallback((type: string, x: number, y: number) => {
    // In multiplayer mode, send the command to other players via network
    if (currentGameMode === 'multiplayer' && network.isConnected()) {
      network.sendMessage('command', {
        type,
        x,
        y
      });
    }
    
    // Notify the game renderer to place the item without restarting the level
    const event = new CustomEvent('place-live-item', {
      detail: { type, x, y }
    });
    window.dispatchEvent(event);
  }, [currentGameMode, network]);

  // Get placement info helper function
  const getPlacementInfo = (item: any) => {
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
  };

  // Render different UI based on game status
  const renderGameUI = () => {
    switch (gameStatus) {
      case 'tutorial':
        return <TutorialModal onStart={() => useGameStore.getState().setGameStatus('modeSelect')} />;
      
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
              onClick={resetGame}
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
        {/* Game container - now using GameRenderer component */}
        <GameRenderer />
        
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
        <div className={`multiplayer-status ${network.isConnected() ? 'status-connected' : 'status-disconnected'}`}>
          <div className="status-indicator">
            <span className={`status-dot ${network.isConnected() ? 'dot-connected' : 'dot-disconnected'}`}></span>
            <span style={{ fontWeight: 'bold' }}>
              {network.isConnected() ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div>Role: <span className="player-role">{playerRole === 'goat' ? 'Escape Goat' : 'Shell Commander'}</span></div>
          <div>Lobby: <span className="lobby-code">{lobbyCode}</span></div>
        </div>
      )}
      
      {/* Restart button and prompter toggle always visible below the game */}
      <div className="game-controls">
        <button 
          onClick={resetGame}
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

export default App;