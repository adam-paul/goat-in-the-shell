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
    
    // Clean up on unmount
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []);
  
  // Set up event bus for placement confirmations
  useEffect(() => {
    const placementHandler = (data: { type: string, x: number, y: number }) => {
      handlePlaceItem(data.x, data.y);
    };
    
    const unsubPlacement = gameEvents.subscribe<{ type: string, x: number, y: number }>(
      'PLACEMENT_CONFIRMED', 
      placementHandler
    );
    
    return () => unsubPlacement();
  }, [handlePlaceItem]);
  
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
  
  // Set up event bus for player input
  useEffect(() => {
    const playerInputHandler = (input: unknown) => {
      if (socket.connected) {
        socket.sendPlayerInput(input);
      }
    };
    
    const unsubPlayerInput = gameEvents.subscribe(
      'PLAYER_INPUT', 
      playerInputHandler
    );
    
    return () => unsubPlayerInput();
  }, [socket]);
  
  // Set up server state handling
  useEffect(() => {
    // Request initial state from server
    if (socket.connected) {
      socket.sendMessage(MESSAGE_TYPES.REQUEST_INITIAL_STATE, {});
    }
    
    // Function to handle server state updates
    const handleServerState = (state: any) => {
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
    const unsubStateUpdate = gameEvents.subscribe(MESSAGE_TYPES.STATE_UPDATE, handleStateUpdate);
    
    // Clean up
    return () => {
      unsubStateUpdate();
    };
  }, [socket.connected, updateGameState]);

  // Return the container for Phaser to render into
  return <div id={containerClassName} />;
};

export default GameRenderer;