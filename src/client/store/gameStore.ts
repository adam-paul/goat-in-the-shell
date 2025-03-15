// src/client/store/gameStore.ts
import { create } from 'zustand';
import { 
  GameStatus, 
  DeathType, 
  ItemType, 
  GameMode, 
  PlayerRole 
} from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';

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
  instanceId: string;
  
  // Server state
  gameConfig: any;
  gameState: any;
}

// Define the complete store interface with actions
interface GameState extends GameStateData {
  // State setters
  setGameStatus: (status: GameStatus) => void;
  requestGameStateTransition: (status: GameStatus) => void; // Request state change via server
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
  setInstanceId: (id: string) => void;
  
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
export const useGameStore = create<GameState>((set, get): GameState => {
  // Create store object that we'll return and also expose globally
  const store: GameState = {
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
  instanceId: '',
  
  // Server state
  gameConfig: {},
  gameState: {},
  
  // State setters
  setGameStatus: (status: GameStatus) => set(() => ({ gameStatus: status })),
  requestGameStateTransition: (status: GameStatus) => {
    // Publish event to network layer to request state transition from server
    gameEvents.publish('REQUEST_STATE_TRANSITION', { targetState: status });
  },
  setSelectedItem: (item: ItemType | null) => set(() => ({ selectedItem: item })),
  setPlacementConfirmed: (confirmed: boolean) => set(() => ({ placementConfirmed: confirmed })),
  setDeathType: (type: DeathType) => set(() => ({ deathType: type })),
  togglePrompter: () => set((state) => ({ showPrompter: !state.showPrompter })),
  setCurrentGameMode: (mode: GameMode) => set(() => ({ currentGameMode: mode })),
  setLobbyCode: (code: string) => set(() => ({ lobbyCode: code })),
  setPlayerRole: (role: PlayerRole) => set(() => ({ playerRole: role })),
  
  // Network state setters
  setNetworkConnected: (connected: boolean) => set(() => ({ networkConnected: connected })),
  setErrorMessage: (message: string) => set(() => ({ errorMessage: message })),
  setClientId: (id: string) => set(() => ({ clientId: id })),
  setInstanceId: (id: string) => set(() => ({ instanceId: id })),
  
  // Server state setters
  setGameConfig: (config: any) => set(() => ({ gameConfig: config })),
  updateGameState: (state: any) => set(() => ({ gameState: state })),
  
  
  // Game item placement helpers
  handleSelectItem: (item: ItemType) => {
    set(() => ({ 
      selectedItem: item,
      placementConfirmed: false
    }));
    
    // Now we're connected to a server instance, use the state machine
    // Request state transition to placement via server
    gameEvents.publish('REQUEST_STATE_TRANSITION', { 
      targetState: 'placement',
      itemType: item
    });
    
    // Also directly update the local state for immediate UI feedback
    // This will be overwritten by server confirmation, but gives immediate response
    set(() => ({ gameStatus: 'placement' }));
    
    // Notify the server about entering placement mode
    gameEvents.publish('PLACEMENT_MODE_START', { itemType: item });
  },
  
  handleCancelPlacement: () => {
    set(() => ({ 
      selectedItem: null, 
      placementConfirmed: false
    }));
    
    // Request state transition back to select via server
    gameEvents.publish('REQUEST_STATE_TRANSITION', { 
      targetState: 'select'
    });
    
    // Also directly update the local state for immediate UI feedback
    set(() => ({ gameStatus: 'select' }));
    
    // Notify the server about exiting placement mode
    gameEvents.publish('PLACEMENT_MODE_EXIT', {});
  },
  
  handlePlaceItem: (x: number, y: number) => {
    const state = get();
    
    if (!state.selectedItem || state.placementConfirmed) {
      return;
    }
    
    set(() => ({ 
      placementConfirmed: true,
      selectedItem: null
    }));
    
    // Request state transition to playing via server
    gameEvents.publish('REQUEST_STATE_TRANSITION', { 
      targetState: 'playing'
    });
    
    // Also directly update the local state for immediate UI feedback
    set(() => ({ gameStatus: 'playing' }));
    
    // Notify the server to place the item
    gameEvents.publish('PLACEMENT_CONFIRMED', { 
      type: state.selectedItem, 
      x, 
      y 
    });
  },
  
  handleContinueToNextRound: () => {
    set(() => ({ deathType: null }));
    
    // Request state transition to select via server
    gameEvents.publish('REQUEST_STATE_TRANSITION', { 
      targetState: 'select'
    });
    
    // Also directly update the local state for immediate UI feedback
    set(() => ({ gameStatus: 'select' }));
    
    // Notify the server to continue to the next round
    gameEvents.publish('CONTINUE_NEXT_ROUND', {});
  },
  
  // Reset game
  resetGame: () => {
    const state = get();
    
    // If in multiplayer, disconnect from the server
    if (state.currentGameMode === 'multiplayer' && state.networkConnected) {
      // This will trigger the NetworkProvider to disconnect
      gameEvents.publish('DISCONNECT_NETWORK', {});
    }
    
    // This is a full reset, so we go back to client-side flow (tutorial/modeSelect)
    set(() => ({
      gameStatus: 'modeSelect', // Go directly to mode select screen, no need for tutorial again
      selectedItem: null,
      placementConfirmed: false,
      deathType: null,
      currentGameMode: 'single_player', 
      networkConnected: false,
      errorMessage: '',
      instanceId: '',
      gameState: {}
    }));
    
    // Reinitialize the game
    gameEvents.publish('RESET_GAME', {
      mode: 'single_player'
    });
    
    // If we're still connected to server, also send the transition request
    // But we've already updated UI to avoid waiting
    if (state.networkConnected) {
      gameEvents.publish('REQUEST_STATE_TRANSITION', {
        targetState: 'reset'
      });
    }
  }
  };
  
  // Expose the store instance globally for access from other modules
  // This helps us avoid circular dependencies
  (window as any).__game_store_instance__ = store;
  
  return store;
});