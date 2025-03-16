// src/client/rendering/GameRenderer.tsx
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameMode, PlayerRole } from '../../shared/types';
import { MESSAGE_TYPES } from '../../shared/constants';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../network';
import { gameEvents } from '../utils/GameEventBus';
import BasicGameScene from './BasicGameScene';

interface GameRendererProps {
  containerClassName?: string;
}

const GameRenderer: React.FC<GameRendererProps> = ({ containerClassName = 'game-container' }) => {
  // Game instance reference
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  
  // Access game store for state
  const { 
    currentGameMode, 
    playerRole,
    handlePlaceItem,
    gameState,
    updateGameState
  } = useGameStore();
  
  // Get socket
  const socket = useSocket();

  // Initialize Phaser game
  const initGame = (gameMode: GameMode, role: PlayerRole) => {
    // Clean up existing game instance
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
    }
    
    // Clear the container
    const container = document.getElementById(containerClassName);
    if (container) {
      container.innerHTML = '';
    } else {
      console.error(`Container with ID ${containerClassName} not found`);
      return;
    }
    
    // Create a new Phaser game configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      width: 1200,
      height: 800,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [BasicGameScene], // Use our new scene
      parent: containerClassName,
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false
      },
      input: {
        keyboard: true,
        mouse: true,
        touch: true
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 300, x: 0 }, // Basic gravity for rendering
          debug: false
        }
      }
    };
    
    // Create the game instance
    const newGame = new Phaser.Game(config);
    gameInstanceRef.current = newGame;

    // Notify the game scene about the current mode and role
    gameEvents.publish('GAME_CONFIG', {
      mode: gameMode,
      playerRole: role,
      isMultiplayer: gameMode === 'multiplayer'
    });
  };

  // Initialize the game on component mount
  useEffect(() => {
    initGame(currentGameMode, playerRole);
    
    // Immediately request initial state to ensure we have data for rendering
    // before the countdown phase
    console.log('GAME RENDERER: Initial mount, requesting initial state');
    setTimeout(() => {
      gameEvents.publish(MESSAGE_TYPES.REQUEST_INITIAL_STATE, {});
    }, 100);
    
    // Clean up on unmount
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []);
  
  // Set up event bus for item placement events for immediate visual feedback
  useEffect(() => {
    const placementHandler = (data: { type: string, x: number, y: number }) => {
      console.log(`GameRenderer: Got item placement for ${data.type} at (${data.x}, ${data.y})`);
      
      // Create item data for immediate visual feedback
      const itemData = {
        items: [
          { 
            type: data.type, 
            x: data.x, 
            y: data.y, 
            id: `local-${Date.now()}` 
          }
        ]
      };
      
      // Update the rendering without waiting for server response
      gameEvents.publish('SERVER_STATE_UPDATE', itemData);
    };
    
    const unsubPlacement = gameEvents.subscribe<{ type: string, x: number, y: number }>(
      'ITEM_PLACEMENT', 
      placementHandler
    );
    
    return () => unsubPlacement();
  }, []);
  
  // Set up event bus for game resets
  useEffect(() => {
    const resetHandler = (data: { mode: GameMode }) => {
      initGame(data.mode, playerRole);
      
      // Request initial state again after reset
      // This ensures we have rendering data after game reset
      setTimeout(() => {
        console.log('GAME RENDERER: Game reset, requesting state refresh');
        gameEvents.publish(MESSAGE_TYPES.REQUEST_INITIAL_STATE, {});
      }, 100);
    };
    
    const unsubReset = gameEvents.subscribe<{ mode: GameMode }>(
      'GAME_RESET', 
      resetHandler
    );
    
    return () => unsubReset();
  }, [playerRole]);
  
  // We've removed redundant player input handler that sent to server
  // BasicGameScene already handles local visual updates via the PLAYER_INPUT events
  // InputHandler already sends these inputs to the server directly
  
  // Set up server state handling
  useEffect(() => {
    // Function to handle server state updates
    const handleServerState = (state: any) => {
      // Process and update game state
      console.log('GAME RENDERER: Received server state:', state);
      updateGameState(state);
      gameEvents.publish('SERVER_STATE_UPDATE', state);
    };
    
    // Set up socket event listener for state updates
    const handleStateUpdate = (data: any) => {
      console.log('GAME RENDERER: Received STATE_UPDATE with data:', data);
      if (data && data.state) {
        handleServerState(data.state);
      } else if (data && data.payload && data.payload.state) {
        // Handle alternative data structure that might come through event bus
        handleServerState(data.payload.state);
      } else if (data) {
        // For initial state or other formats, just use the data directly
        // This ensures we handle different state formats correctly
        handleServerState(data);
      }
    };
    
    // Subscribe to STATE_UPDATE events from socket
    const unsubStateUpdate = gameEvents.subscribe(MESSAGE_TYPES.STATE_UPDATE, handleStateUpdate);
    
    // We've moved the REQUEST_INITIAL_STATE to the initial mount effect
    // so we don't need to duplicate it here
    
    // Clean up
    return () => {
      unsubStateUpdate();
    };
  }, [updateGameState]);

  // Return the container for Phaser to render into
  return <div id={containerClassName} />;
};

export default GameRenderer;