import React, { useState } from 'react';

// Using a type instead of enum to avoid React refresh warning
export type GameMode = 'single_player' | 'multiplayer';

// Constants to use in place of enum
export const GameModes = {
  SINGLE_PLAYER: 'single_player' as GameMode,
  MULTIPLAYER: 'multiplayer' as GameMode
};

interface GameModeSelectionProps {
  onSelectMode: (mode: GameMode, lobbyCode?: string) => void;
}

const GameModeSelection: React.FC<GameModeSelectionProps> = ({ onSelectMode }) => {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [lobbyCode, setLobbyCode] = useState<string>('');
  const [isCreatingLobby, setIsCreatingLobby] = useState<boolean>(false);

  const handleCreateGame = () => {
    if (selectedMode === GameModes.SINGLE_PLAYER) {
      onSelectMode(GameModes.SINGLE_PLAYER);
    } else if (selectedMode === GameModes.MULTIPLAYER) {
      if (isCreatingLobby) {
        // Generate a new lobby
        onSelectMode(GameModes.MULTIPLAYER);
      } else {
        // Join existing lobby with code
        onSelectMode(GameModes.MULTIPLAYER, lobbyCode);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000
    }}>
      <div style={{
        width: '80%',
        maxWidth: '700px',
        padding: '30px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '15px',
        boxShadow: '0 0 30px rgba(233, 69, 96, 0.5)',
        border: '2px solid #e94560',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Grid background similar to tutorial modal */}
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

        <h2 style={{
          fontFamily: "'Press Start 2P', cursive, sans-serif",
          fontSize: '24px',
          marginBottom: '20px',
          color: '#e94560',
          textShadow: '0 0 10px rgba(233, 69, 96, 0.7)',
          textAlign: 'center'
        }}>
          Select Game Mode
        </h2>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          marginBottom: '25px'
        }}>
          <button
            onClick={() => {
              setSelectedMode(GameModes.SINGLE_PLAYER);
              setIsCreatingLobby(false);
            }}
            style={{
              padding: '15px 20px',
              backgroundColor: selectedMode === GameModes.SINGLE_PLAYER ? 'rgba(233, 69, 96, 0.4)' : 'rgba(233, 69, 96, 0.2)',
              color: 'white',
              border: '2px solid #e94560',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontFamily: "'Press Start 2P', cursive, sans-serif",
              boxShadow: selectedMode === GameModes.SINGLE_PLAYER ? '0 7px 20px rgba(233, 69, 96, 0.6)' : '0 0 15px rgba(233, 69, 96, 0.5)',
              transition: 'all 0.3s ease',
              textShadow: '0 0 5px rgba(233, 69, 96, 0.7)',
              transform: selectedMode === GameModes.SINGLE_PLAYER ? 'translateY(-3px)' : 'translateY(0)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
            }}
            onMouseOut={(e) => {
              if (selectedMode !== GameModes.SINGLE_PLAYER) {
                e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
              }
            }}
          >
            Single Player (AI Prompter)
          </button>

          <button
            onClick={() => {
              setSelectedMode(GameModes.MULTIPLAYER);
              setIsCreatingLobby(true);
            }}
            style={{
              padding: '15px 20px',
              backgroundColor: selectedMode === GameModes.MULTIPLAYER && isCreatingLobby ? 'rgba(233, 69, 96, 0.4)' : 'rgba(233, 69, 96, 0.2)',
              color: 'white',
              border: '2px solid #e94560',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontFamily: "'Press Start 2P', cursive, sans-serif",
              boxShadow: selectedMode === GameModes.MULTIPLAYER && isCreatingLobby ? '0 7px 20px rgba(233, 69, 96, 0.6)' : '0 0 15px rgba(233, 69, 96, 0.5)',
              transition: 'all 0.3s ease',
              textShadow: '0 0 5px rgba(233, 69, 96, 0.7)',
              transform: selectedMode === GameModes.MULTIPLAYER && isCreatingLobby ? 'translateY(-3px)' : 'translateY(0)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
            }}
            onMouseOut={(e) => {
              if (!(selectedMode === GameModes.MULTIPLAYER && isCreatingLobby)) {
                e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
              }
            }}
          >
            Create Multiplayer Lobby
          </button>

          <button
            onClick={() => {
              setSelectedMode(GameModes.MULTIPLAYER);
              setIsCreatingLobby(false);
            }}
            style={{
              padding: '15px 20px',
              backgroundColor: selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby ? 'rgba(233, 69, 96, 0.4)' : 'rgba(233, 69, 96, 0.2)',
              color: 'white',
              border: '2px solid #e94560',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontFamily: "'Press Start 2P', cursive, sans-serif",
              boxShadow: selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby ? '0 7px 20px rgba(233, 69, 96, 0.6)' : '0 0 15px rgba(233, 69, 96, 0.5)',
              transition: 'all 0.3s ease',
              textShadow: '0 0 5px rgba(233, 69, 96, 0.7)',
              transform: selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby ? 'translateY(-3px)' : 'translateY(0)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
            }}
            onMouseOut={(e) => {
              if (!(selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby)) {
                e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
              }
            }}
          >
            Join Multiplayer Lobby
          </button>
        </div>

        {selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && (
          <div style={{
            marginBottom: '20px'
          }}>
            <input
              type="text"
              placeholder="Enter lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{
                padding: '10px 15px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: '2px solid #e94560',
                borderRadius: '8px',
                fontSize: '16px',
                width: '200px',
                textAlign: 'center',
                fontFamily: "'Courier New', Courier, monospace",
                letterSpacing: '2px'
              }}
            />
          </div>
        )}

        <button
          onClick={handleCreateGame}
          disabled={!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)}
          style={{
            padding: '12px 30px',
            backgroundColor: (!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) 
              ? 'rgba(102, 102, 102, 0.2)' 
              : 'rgba(233, 69, 96, 0.2)',
            color: 'white',
            border: `2px solid ${(!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) ? '#666' : '#e94560'}`,
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: (!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) ? 'not-allowed' : 'pointer',
            boxShadow: `0 0 15px rgba(${(!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) ? '102, 102, 102' : '233, 69, 96'}, 0.5)`,
            transition: 'all 0.3s ease',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            textShadow: `0 0 5px rgba(${(!selectedMode || (selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) ? '102, 102, 102' : '233, 69, 96'}, 0.7)`
          }}
          onMouseOver={(e) => {
            if (selectedMode && !(selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (selectedMode && !(selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby && !lobbyCode)) {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
            }
          }}
        >
          {selectedMode === GameModes.MULTIPLAYER && !isCreatingLobby ? 'Join Game' : 'Start Game'}
        </button>
      </div>
    </div>
  );
};

export default GameModeSelection;