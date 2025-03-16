// src/client/input/ItemPlacementHandler.ts
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { ItemType } from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';

/**
 * Custom hook to handle item placement interactions
 */
export const useItemPlacementHandler = () => {
  // Get game store for state/communication
  const { 
    gameStatus,
    selectedItem,
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
    
    // Handle escape key to cancel placement
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        handleCancelPlacement();
      }
    };
    
    // Add escape key listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Notify Phaser that we're exiting placement mode
      gameEvents.publish('PLACEMENT_MODE_END', {});
    };
  }, [gameStatus, selectedItem, handleCancelPlacement]);
  
  return null;
};

export default useItemPlacementHandler;