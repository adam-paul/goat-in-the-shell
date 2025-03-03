import React, { useEffect, useState } from 'react';
import { MultiplayerService } from '../services/MultiplayerService';
import { LobbyWaitingScreenProps } from '../types';

const LobbyWaitingScreen: React.FC<LobbyWaitingScreenProps> = ({ 
  lobbyCode, 
  playerRole,
  onCancel 
}) => {
  const [connectedPlayers, setConnectedPlayers] = useState<number>(1); // Start with 1 (self)
  const [showStartButton, setShowStartButton] = useState<boolean>(false);
  const multiplayerService = MultiplayerService.getInstance();

  // Check for player joined events
  useEffect(() => {
    const handlePlayerJoined = (data: unknown) => {
      // Type assertion to work with our expected data structure
      const lobbyData = data as { has_goat?: boolean; has_prompter?: boolean; player_count?: number };
      console.log("Player joined event in LobbyWaitingScreen:", data);
      
      // Check if both players are now connected
      if (lobbyData && ((lobbyData.has_goat && lobbyData.has_prompter) || (lobbyData.player_count !== undefined && lobbyData.player_count >= 2))) {
        console.log("Both players are now connected!");
        setConnectedPlayers(2); // We now have both players
        
        // Only host (prompter) gets the start button
        if (playerRole === 'prompter') {
          setShowStartButton(true);
        }
      } else {
        console.log("Still waiting for both players to connect");
      }
    };

    // Register for player joined events
    multiplayerService.on('player_joined', handlePlayerJoined);
    
    // Register for system messages as a fallback
    multiplayerService.on('system_message', (data: unknown) => {
      console.log("System message in LobbyWaitingScreen:", data);
      // Type assertion to work with our expected data structure
      const messageData = data as { lobby_info?: { has_goat?: boolean; has_prompter?: boolean; player_count?: number } };
      if (messageData && messageData.lobby_info) {
        handlePlayerJoined(messageData.lobby_info);
      }
    });

    // Check current status immediately
    const checkInitialStatus = () => {
      // Send a ping to get current lobby state
      multiplayerService.sendMessage('ping', {
        timestamp: Date.now(),
        requestLobbyInfo: true
      });
    };
    
    // Check initial status after a short delay
    setTimeout(checkInitialStatus, 500);

    return () => {
      // Clean up listeners
      multiplayerService.off('player_joined', handlePlayerJoined);
      multiplayerService.off('system_message');
    };
  }, [playerRole, multiplayerService]);

  // Function to start the game
  const handleStartGame = () => {
    console.log(`Starting multiplayer game. Lobby: ${lobbyCode}, Role: ${playerRole}`);
    
    // Tell server we're starting the game
    multiplayerService.sendMessage('start_game', {
      lobbyCode: lobbyCode,
      initiatorRole: playerRole
    });
    
    // Trigger the game to start locally with explicit role information
    const event = new CustomEvent('game-start-multiplayer', {
      detail: {
        lobbyCode: lobbyCode,
        playerRole: playerRole,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
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
        
        <h2 style={{
          fontFamily: "'Press Start 2P', cursive, sans-serif",
          fontSize: '24px',
          marginBottom: '20px',
          color: '#e94560',
          textShadow: '0 0 10px rgba(233, 69, 96, 0.7)',
          textAlign: 'center'
        }}>
          Waiting for players
        </h2>

        <div style={{
          marginTop: '30px',
          marginBottom: '30px',
          padding: '15px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '8px',
          border: '2px solid #e94560'
        }}>
          <h3 style={{
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '16px',
            color: '#e94560',
            marginBottom: '15px'
          }}>
            Lobby Code
          </h3>
          <p style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '32px',
            letterSpacing: '8px',
            fontWeight: 'bold'
          }}>
            {lobbyCode}
          </p>
          <p style={{
            marginTop: '20px',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '14px'
          }}>
            Share this code with a friend to join your game
          </p>
        </div>

        <div style={{
          marginBottom: '30px'
        }}>
          <h3 style={{
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '16px',
            color: '#e94560',
            marginBottom: '15px'
          }}>
            Your Role: {playerRole === 'goat' ? 'Escape Goat' : 'Shell Commander'}
          </h3>
          <p style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '14px'
          }}>
            {playerRole === 'goat' 
              ? 'You will control the goat character using keyboard controls.' 
              : 'You will issue commands through the terminal to place obstacles.'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          marginBottom: '30px',
          position: 'relative'
        }}>
          <h3 style={{
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '16px',
            color: '#e94560',
            marginBottom: '15px'
          }}>
            Connected Players: {connectedPlayers}/2
          </h3>
          
          <div style={{
            width: '100%',
            height: '30px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '15px',
            border: '2px solid #10b981',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${connectedPlayers * 50}%`,
              height: '100%',
              backgroundColor: 'rgba(16, 185, 129, 0.3)',
              borderRadius: 'inherit',
              display: 'flex',
              transition: 'width 0.5s ease-in-out'
            }}>
              {/* Green digital-looking blocks */}
              {Array.from({ length: connectedPlayers }).map((_, index) => (
                <div key={index} style={{
                  width: '50%',
                  height: '100%',
                  backgroundColor: 'rgba(16, 185, 129, 0.7)',
                  borderRight: index === 0 ? '2px dashed rgba(16, 185, 129, 0.5)' : 'none',
                  boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.5)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '70%',
                    height: '60%',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(16, 185, 129, 0.4) 100%)',
                    clipPath: 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
                    boxShadow: '0 0 5px rgba(16, 185, 129, 0.8)'
                  }}></div>
                </div>
              ))}
            </div>
            
            {/* Grid overlay */}
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
              backgroundSize: '10px 10px',
              pointerEvents: 'none'
            }}></div>
          </div>
        </div>

        {!showStartButton ? (
          <div>
            <p style={{
              marginTop: '20px',
              marginBottom: '30px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '16px'
            }}>
              {connectedPlayers < 2 
                ? "Waiting for the other player to join..." 
                : "Waiting for host to start the game..."}
            </p>
          
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '5px solid #e94560',
                borderRadius: '50%',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }}></div>
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '20px',
            marginBottom: '30px'
          }}>
            <button 
              onClick={handleStartGame}
              style={{
                padding: '12px 30px',
                marginBottom: '20px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: 'white',
                border: '2px solid #10b981',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)',
                transition: 'all 0.3s ease',
                fontFamily: "'Press Start 2P', cursive, sans-serif",
                textShadow: '0 0 5px rgba(16, 185, 129, 0.7)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 7px 20px rgba(16, 185, 129, 0.6)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)';
              }}
            >
              Start Game
            </button>
            
            <p style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '14px',
              opacity: 0.8
            }}>
              Both players connected! You can now start the game.
            </p>
          </div>
        )}

        <button 
          onClick={onCancel}
          style={{
            padding: '12px 30px',
            backgroundColor: 'rgba(233, 69, 96, 0.2)',
            color: 'white',
            border: '2px solid #e94560',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(233, 69, 96, 0.5)',
            transition: 'all 0.3s ease',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
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
          Cancel
        </button>
      </div>
    </div>
  );
};

export default LobbyWaitingScreen;