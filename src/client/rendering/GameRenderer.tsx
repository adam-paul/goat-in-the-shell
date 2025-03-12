// src/client/rendering/GameRenderer.tsx
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameMode, PlayerRole } from '../../shared/types';
import { useGameStore } from '../store/gameStore';

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
    gameStatus,
    handlePlaceItem 
  } = useGameStore();

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
    // Note: In the new architecture, physics will be handled by the server
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      width: 1200,
      height: 800,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      // We'll create a new renderer-only scene
      // The scene will connect to the server for state updates
      scene: [], // Will be replaced with our client-side scene
      parent: containerClassName,
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
      },
      // No physics in client-side renderer
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0, x: 0 }, // No gravity, physics comes from server
          debug: false
        }
      }
    };
    
    // Create the game instance
    const newGame = new Phaser.Game(config);
    gameInstanceRef.current = newGame;
    
    // Pass configuration to the scene
    // This will be handled differently in the new architecture
    // using direct state instead of events
    setTimeout(() => {
      const event = new CustomEvent('game-mode-config', {
        detail: {
          mode: gameMode,
          playerRole: role,
          isMultiplayer: gameMode === 'multiplayer'
        }
      });
      window.dispatchEvent(event);
    }, 500);
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
  
  // Listen for placement confirmations from the renderer
  useEffect(() => {
    const handleConfirmPlacement = (event: Event) => {
      const placementEvent = event as CustomEvent<{type: string, x: number, y: number}>;
      
      // Use the store's handlePlaceItem to update state and notify the server
      handlePlaceItem(placementEvent.detail.x, placementEvent.detail.y);
    };
    
    window.addEventListener('confirm-placement', handleConfirmPlacement);
    
    return () => {
      window.removeEventListener('confirm-placement', handleConfirmPlacement);
    };
  }, [handlePlaceItem]);
  
  // Listen for reset game events
  useEffect(() => {
    const handleResetGame = (event: Event) => {
      const resetEvent = event as CustomEvent<{mode: GameMode}>;
      
      // Reinitialize the game with the specified mode
      initGame(resetEvent.detail.mode, playerRole);
    };
    
    window.addEventListener('reset-game', handleResetGame);
    
    return () => {
      window.removeEventListener('reset-game', handleResetGame);
    };
  }, [playerRole]);

  // Return the container for Phaser to render into
  return <div id={containerClassName} />;
};

export default GameRenderer;