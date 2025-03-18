// src/client/input/ItemPlacementHandler.ts
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEvents } from '../utils/GameEventBus';
import { GAME_EVENTS } from '../../shared/constants';

/**
 * Custom hook to handle item placement interactions
 */
export const useItemPlacementHandler = () => {
  // Get game store for state/communication
  const { 
    gameStatus,
    selectedItem,
    setSelectedItem,
    setGameStatus
  } = useGameStore();
  
  // Set up event listeners for placement
  useEffect(() => {
    // Only active when in placement mode
    if (gameStatus !== 'placement' || !selectedItem) {
      return;
    }
    
    // Notify scene that we're in placement mode
    gameEvents.publish(GAME_EVENTS.PLACEMENT_MODE_START, { itemType: selectedItem });
    
    // Handle escape key to cancel placement
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        // Cancel placement
        setSelectedItem(null);
        setGameStatus('select');
        gameEvents.publish(GAME_EVENTS.PLACEMENT_MODE_EXIT, {});
      }
    };
    
    // Add escape key listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      gameEvents.publish(GAME_EVENTS.PLACEMENT_MODE_EXIT, {});
    };
  }, [gameStatus, selectedItem, setSelectedItem, setGameStatus]);
  
  return null;
};

export default useItemPlacementHandler;