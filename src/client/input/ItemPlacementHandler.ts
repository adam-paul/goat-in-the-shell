// src/client/input/ItemPlacementHandler.ts
import { useEffect } from 'react';
import { useSocket } from '../network';
import { useGameStore } from '../store/gameStore';
import { ItemType } from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';

/**
 * Custom hook to handle item placement interactions
 */
export const useItemPlacementHandler = () => {
  // Get socket and game store for state/communication
  const socket = useSocket();
  const { 
    gameStatus,
    selectedItem,
    handlePlaceItem,
    handleCancelPlacement
  } = useGameStore();
  
  // Set up event listeners for placement
  useEffect(() => {
    // Only active when in placement mode
    if (gameStatus !== 'placement' || !selectedItem) {
      return;
    }
    
    // Publish placement mode start event
    gameEvents.publish('PLACEMENT_MODE_START', { itemType: selectedItem });
    
    // Event handler for placement confirmation from Phaser
    const handlePlaceItemAtPosition = (data: {x: number, y: number, type: string}) => {
      const { x, y } = data;
      
      // Place the item using the store action
      handlePlaceItem(x, y);
      
      // If in multiplayer, send placement to server
      if (socket.connected) {
        socket.sendPlaceItem(selectedItem, x, y);
      }
    };
    
    // Handle escape key to cancel placement
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        handleCancelPlacement();
      }
    };
    
    // Subscribe to placement confirmations from Phaser
    const unsubscribePlacement = gameEvents.subscribe<{x: number, y: number, type: string}>(
      'PLACEMENT_CONFIRMED', 
      handlePlaceItemAtPosition
    );
    
    // Add escape key listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up listeners
    return () => {
      unsubscribePlacement();
      window.removeEventListener('keydown', handleKeyDown);
      // Notify Phaser that we're exiting placement mode
      gameEvents.publish('PLACEMENT_MODE_END', {});
    };
  }, [gameStatus, selectedItem, handlePlaceItem, handleCancelPlacement, socket]);
  
  return null;
};

export default useItemPlacementHandler;