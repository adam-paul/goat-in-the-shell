// src/client/store/gameStore.ts
import { create } from 'zustand';
import { 
  GameStatus, 
  DeathType, 
  ItemType, 
  GameMode, 
  PlayerRole 
} from '../../shared/types';

// Define the state interface (without actions)
interface GameStateData {
  // Game state
  gameStatus: GameStatus;
  
  // Item placement state
  selectedItem: ItemType | null;
  placementConfirmed: boolean;
  
  // Death handling
  deathType: DeathType;
  
  // Prompter UI state
  showPrompter: boolean;
  
  // Multiplayer state
  currentGameMode: GameMode;
  lobbyCode: string;
  playerRole: PlayerRole;
  
  // Network state
  networkConnected: boolean;
  errorMessage: string;
  clientId: string;
  
  // Server state
  gameConfig: any;
  gameState: any;
}

// Define the complete store interface with actions
interface GameState extends GameStateData {
  // State setters
  setGameStatus: (status: GameStatus) => void;
  setSelectedItem: (item: ItemType | null) => void;
  setPlacementConfirmed: (confirmed: boolean) => void;
  setDeathType: (type: DeathType) => void;
  togglePrompter: () => void;
  setCurrentGameMode: (mode: GameMode) => void;
  setLobbyCode: (code: string) => void;
  setPlayerRole: (role: PlayerRole) => void;
  
  // Network state setters
  setNetworkConnected: (connected: boolean) => void;
  setErrorMessage: (message: string) => void;
  setClientId: (id: string) => void;
  
  // Server state setters
  setGameConfig: (config: any) => void;
  updateGameState: (state: any) => void;
  
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
  selectedItem: null,
  placementConfirmed: false,
  deathType: null,
  showPrompter: false,
  currentGameMode: 'single_player',
  lobbyCode: '',
  playerRole: 'goat',
  
  // Network state
  networkConnected: false,
  errorMessage: '',
  clientId: '',
  
  // Server state
  gameConfig: {},
  gameState: {},
  
  // State setters
  setGameStatus: (status) => set(() => ({ gameStatus: status })),
  setSelectedItem: (item) => set(() => ({ selectedItem: item })),
  setPlacementConfirmed: (confirmed) => set(() => ({ placementConfirmed: confirmed })),
  setDeathType: (type) => set(() => ({ deathType: type })),
  togglePrompter: () => set((state) => ({ showPrompter: !state.showPrompter })),
  setCurrentGameMode: (mode) => set(() => ({ currentGameMode: mode })),
  setLobbyCode: (code) => set(() => ({ lobbyCode: code })),
  setPlayerRole: (role) => set(() => ({ playerRole: role })),
  
  // Network state setters
  setNetworkConnected: (connected) => set(() => ({ networkConnected: connected })),
  setErrorMessage: (message) => set(() => ({ errorMessage: message })),
  setClientId: (id) => set(() => ({ clientId: id })),
  
  // Server state setters
  setGameConfig: (config) => set(() => ({ gameConfig: config })),
  updateGameState: (state) => set(() => ({ gameState: state })),
  
  // Game item placement helpers
  handleSelectItem: (item) => {
    set(() => ({ 
      selectedItem: item, 
      gameStatus: 'placement',
      placementConfirmed: false
    }));
    
    // Notify the server about entering placement mode
    const event = new CustomEvent('enter-placement-mode', {
      detail: { type: item }
    });
    window.dispatchEvent(event);
  },
  
  handleCancelPlacement: () => {
    set(() => ({ 
      selectedItem: null, 
      placementConfirmed: false,
      gameStatus: 'select' 
    }));
    
    // Notify the server about exiting placement mode
    const event = new CustomEvent('exit-placement-mode', {
      detail: {}
    });
    window.dispatchEvent(event);
  },
  
  handlePlaceItem: (x, y) => {
    const state = get();
    
    if (!state.selectedItem || state.placementConfirmed) {
      return;
    }
    
    set(() => ({ 
      placementConfirmed: true,
      selectedItem: null,
      gameStatus: 'playing' 
    }));
    
    // Notify the server to place the item
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
    set(() => ({ deathType: null }));
    
    // Notify the server to continue to the next round
    const event = new CustomEvent('continue-to-next-round', {
      detail: {}
    });
    window.dispatchEvent(event);
  },
  
  // Reset game
  resetGame: () => {
    const state = get();
    
    // If in multiplayer, disconnect from the server
    if (state.currentGameMode === 'multiplayer' && state.networkConnected) {
      // This will trigger the NetworkProvider to disconnect
      const event = new CustomEvent('disconnect-network', {
        detail: {}
      });
      window.dispatchEvent(event);
    }
    
    set(() => ({
      gameStatus: 'reset',
      selectedItem: null,
      placementConfirmed: false,
      deathType: null,
      currentGameMode: 'single_player',
      networkConnected: false,
      errorMessage: '',
      gameState: {}
    }));
    
    // Reinitialize the game
    const event = new CustomEvent('reset-game', {
      detail: {
        mode: 'single_player'
      }
    });
    window.dispatchEvent(event);
    
    // Go to mode selection after a short delay
    setTimeout(() => {
      set(() => ({ gameStatus: 'modeSelect' }));
    }, 1000);
  }
}));