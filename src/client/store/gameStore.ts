// src/client/store/gameStore.ts
import { create } from 'zustand';
import { 
  GameStatus, 
  DeathType, 
  ItemType, 
  GameMode, 
  PlayerRole 
} from '../../shared/types';

// Define the store state interface
interface GameState {
  // Game state
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus) => void;
  
  // Item placement state
  selectedItem: ItemType | null;
  setSelectedItem: (item: ItemType | null) => void;
  placementConfirmed: boolean;
  setPlacementConfirmed: (confirmed: boolean) => void;
  
  // Death handling
  deathType: DeathType;
  setDeathType: (type: DeathType) => void;
  
  // Prompter UI state
  showPrompter: boolean;
  togglePrompter: () => void;
  
  // Multiplayer state
  currentGameMode: GameMode;
  setCurrentGameMode: (mode: GameMode) => void;
  lobbyCode: string;
  setLobbyCode: (code: string) => void;
  playerRole: PlayerRole;
  setPlayerRole: (role: PlayerRole) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  
  // Game item placement helpers
  handleSelectItem: (item: ItemType) => void;
  handleCancelPlacement: () => void;
  handlePlaceItem: (x: number, y: number) => void;
  handleContinueToNextRound: () => void;
  
  // Reset game
  resetGame: () => void;
}

// Create the store
export const useGameStore = create<GameState>((set, get) => ({
  // Default game state
  gameStatus: 'tutorial',
  setGameStatus: (status) => set({ gameStatus: status }),
  
  // Item placement state
  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item }),
  placementConfirmed: false,
  setPlacementConfirmed: (confirmed) => set({ placementConfirmed: confirmed }),
  
  // Death handling
  deathType: null,
  setDeathType: (type) => set({ deathType: type }),
  
  // Prompter UI state
  showPrompter: false,
  togglePrompter: () => set((state) => ({ showPrompter: !state.showPrompter })),
  
  // Multiplayer state
  currentGameMode: 'single_player',
  setCurrentGameMode: (mode) => set({ currentGameMode: mode }),
  lobbyCode: '',
  setLobbyCode: (code) => set({ lobbyCode: code }),
  playerRole: 'goat',
  setPlayerRole: (role) => set({ playerRole: role }),
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),
  
  // Game item placement helpers
  handleSelectItem: (item: ItemType) => {
    set({ 
      selectedItem: item, 
      gameStatus: 'placement',
      placementConfirmed: false
    });
    
    // Notify the server about entering placement mode
    // This will be implemented in NetworkProvider
    const event = new CustomEvent('enter-placement-mode', {
      detail: { type: item }
    });
    window.dispatchEvent(event);
  },
  
  handleCancelPlacement: () => {
    set({ 
      selectedItem: null, 
      placementConfirmed: false,
      gameStatus: 'select' 
    });
    
    // Notify the server about exiting placement mode
    // This will be implemented in NetworkProvider
    const event = new CustomEvent('exit-placement-mode', {
      detail: {}
    });
    window.dispatchEvent(event);
  },
  
  handlePlaceItem: (x: number, y: number) => {
    const state = get();
    
    if (!state.selectedItem || state.placementConfirmed) {
      return;
    }
    
    set({ 
      placementConfirmed: true,
      selectedItem: null,
      gameStatus: 'playing' 
    });
    
    // Notify the server to place the item
    // This will be implemented in NetworkProvider
    const event = new CustomEvent('place-item', {
      detail: { 
        type: state.selectedItem, 
        x, 
        y 
      }
    });
    window.dispatchEvent(event);
  },
  
  handleContinueToNextRound: () => {
    set({ deathType: null });
    
    // Notify the server to continue to the next round
    // This will be implemented in NetworkProvider
    const event = new CustomEvent('continue-to-next-round', {
      detail: {}
    });
    window.dispatchEvent(event);
  },
  
  // Reset game
  resetGame: () => {
    const state = get();
    
    // If in multiplayer, disconnect from the server
    if (state.currentGameMode === 'multiplayer' && state.isConnected) {
      // This will be implemented in NetworkProvider
      const event = new CustomEvent('disconnect-multiplayer', {
        detail: {}
      });
      window.dispatchEvent(event);
    }
    
    set({
      gameStatus: 'reset',
      selectedItem: null,
      placementConfirmed: false,
      deathType: null,
      currentGameMode: 'single_player',
      isConnected: false
    });
    
    // Reinitialize the game
    // This will be implemented in GameRenderer
    const event = new CustomEvent('reset-game', {
      detail: {
        mode: 'single_player'
      }
    });
    window.dispatchEvent(event);
    
    // Go to mode selection after a short delay
    setTimeout(() => {
      set({ gameStatus: 'modeSelect' });
    }, 1000);
  }
}));