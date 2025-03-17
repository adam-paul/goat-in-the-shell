// src/client/rendering/GameRenderer.tsx
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameMode, PlayerRole } from '../../shared/types';
import { GAME_EVENTS, GAME_DIMENSIONS } from '../../shared/constants';
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
      width: GAME_DIMENSIONS.WIDTH / 2, // Half the world width for viewport
      height: GAME_DIMENSIONS.HEIGHT,
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
          gravity: { y: 0.8 * 300, x: 0 }, // Match server gravity with scale factor
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
    console.log('GameRenderer mounted, initializing game with mode:', currentGameMode);
    initGame(currentGameMode, playerRole);
    
    // Clean up on unmount
    return () => {
      console.log('GameRenderer unmounting, destroying game instance');
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, [currentGameMode, playerRole]); // Re-init game if mode or role changes
  
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
    };
    
    const unsubReset = gameEvents.subscribe<{ mode: GameMode }>(
      'GAME_RESET', 
      resetHandler
    );
    
    return () => unsubReset();
  }, [playerRole]);
  
  // Set up server state handling
  useEffect(() => {
    // Request initial state from server
    if (socket.connected) {
      socket.sendMessage(GAME_EVENTS.REQUEST_INITIAL_STATE, {});
    }
    
    // Function to handle server state updates
    const handleServerState = (state: any) => {
      // Process and update game state
      updateGameState(state);
      gameEvents.publish('SERVER_STATE_UPDATE', state);
    };
    
    // Set up socket event listener for state updates
    const handleStateUpdate = (data: any) => {
      if (data && data.state) {
        handleServerState(data.state);
      }
    };
    
    // Subscribe to STATE_UPDATE events from socket
    const unsubStateUpdate = gameEvents.subscribe(GAME_EVENTS.STATE_UPDATE, handleStateUpdate);
    
    // Clean up
    return () => {
      unsubStateUpdate();
    };
  }, [socket.connected, updateGameState]);

  // Return the container for Phaser to render into
  return <div id={containerClassName} />;
};

export default GameRenderer;