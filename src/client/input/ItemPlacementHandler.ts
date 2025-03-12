// src/client/input/ItemPlacementHandler.ts
import { useEffect } from 'react';
import { useNetwork } from '../network/NetworkProvider';
import { useGameStore } from '../store/gameStore';
import { ItemType } from '../../shared/types';

// Position type is already handled by the game engine

/**
 * Custom hook to handle item placement interactions
 */
export const useItemPlacementHandler = () => {
  // Get network and game store for state/communication
  const network = useNetwork();
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
    
    // Event handler for placement confirmation
    const handlePlaceItemAtPosition = (x: number, y: number) => {
      // Validate the placement position
      if (isValidPlacementPosition(selectedItem, x, y)) {
        // Place the item using the store action
        handlePlaceItem(x, y);
        
        // If in multiplayer, send placement to server
        if (network.isConnected()) {
          network.sendMessage('place_item', {
            type: selectedItem,
            x,
            y
          });
        }
      }
    };
    
    // Mouse click handler for placement
    const handleClick = (event: MouseEvent) => {
      // Get the canvas element
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      
      // Get canvas bounds
      const rect = canvas.getBoundingClientRect();
      
      // Convert click position to game coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      // Place the item at the position
      handlePlaceItemAtPosition(x, y);
    };
    
    // Add click listener to the canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', handleClick);
    }
    
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
      if (canvas) {
        canvas.removeEventListener('click', handleClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameStatus, selectedItem, handlePlaceItem, handleCancelPlacement, network]);
  
  return null;
};

/**
 * Validates if the placement position is valid for the item type
 */
function isValidPlacementPosition(_itemType: ItemType, x: number, y: number): boolean {
  // This is a simplified version - the server will do full validation
  // In the real implementation, we'd check against game world boundaries
  // and existing objects
  
  // Basic boundary check (assuming 1200x800 game world)
  if (x < 0 || x > 1200 || y < 0 || y > 800) {
    return false;
  }
  
  // For now, always return true - server will validate
  return true;
}

export default useItemPlacementHandler;