// src/client/store/gameStore.ts
import { create } from 'zustand';
import { 
  GameStatus, 
  DeathType, 
  ItemType, 
  GameMode, 
  PlayerRole,
  UniversalGameState,
  GAME_EVENTS
} from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';
import { ITEMS, GAME_DIMENSIONS } from '../../shared/constants';

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
  gameConfig: {
    gravity: number;
    moveSpeed: number;
    jumpForce: number;
    [key: string]: any;
  };
  gameState: UniversalGameState;
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
  handlePlacementSuccess?: () => void;
  
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
  
  // Server state with defaults
  gameConfig: {
    gravity: 0.5,
    moveSpeed: 5,
    jumpForce: 12
  },
  gameState: {
    version: 0,
    timestamp: Date.now(),
    gameStatus: 'tutorial',
    players: [],
    gameWorld: {
      platforms: [],
      startPoint: { x: 100, y: 100 },
      endPoint: { x: 2320, y: 120 },
      worldBounds: { width: GAME_DIMENSIONS.WIDTH, height: GAME_DIMENSIONS.HEIGHT }
    },
    items: []
  } as UniversalGameState,
  
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
  updateGameState: (state: UniversalGameState) => set((current) => {
    // Log what we're receiving
    console.log(`STORE: Updating game state with server state:`, 
      state.gameStatus ? `gameStatus=${state.gameStatus}, ` : '',
      `items=${state.items?.length || 0}`
    );
    
    // Update local game status if it's provided in the universal state
    if (state.gameStatus && state.gameStatus !== current.gameStatus) {
      console.log(`STORE: Updating game status from ${current.gameStatus} to ${state.gameStatus}`);
      
      // Handle transition to countdown state by ensuring countdown starts
      if (state.gameStatus === 'countdown') {
        // Make sure countdown is triggered (even if we already triggered it locally)
        gameEvents.publish(GAME_EVENTS.START_COUNTDOWN, { duration: 3000 });
      }
      
      return { 
        gameState: state,
        gameStatus: state.gameStatus
      };
    }
    
    return { gameState: state };
  }),
  
  
  // Simple item selection/placement handlers
  handleSelectItem: (item: ItemType) => {
    // Just update the UI state to placement mode with the selected item
    set(() => ({ 
      selectedItem: item,
      gameStatus: 'placement'
    }));
  },
  
  // For backwards compatibility
  handleCancelPlacement: () => {
    // Just reset the state
    set(() => ({ 
      selectedItem: null,
      gameStatus: 'select'
    }));
  },
  
  // For backwards compatibility
  handlePlacementSuccess: () => {
    set(() => ({ 
      selectedItem: null,
      gameStatus: 'countdown'
    }));
  },
  
  // Centralized handler for item placement that goes directly to the socket interface 
  // This avoids duplicate messages through the event bus
  handlePlaceItem: (x: number, y: number) => {
    const state = get();
    
    if (!state.selectedItem) {
      return;
    }
    
    console.log(`STORE: Processing item placement at (${x}, ${y}) for item type: ${state.selectedItem}`);
    
    // Update state immediately
    set(() => ({ 
      selectedItem: null,
      gameStatus: 'countdown'
    }));
    
    // Send to socket interface first, so server receives the item placement
    // before countdown starts
    const socketInterface = (window as any).__socket_instance__;
    if (socketInterface) {
      socketInterface.sendPlaceItem(state.selectedItem, x, y);
    } else {
      console.error('Socket interface not available for item placement');
      return; // Don't proceed if we can't communicate with server
    }
    
    // Start countdown locally after sending item to server
    // The server will broadcast back a START_COUNTDOWN event that will be handled
    // by CountdownManager
    gameEvents.publish(GAME_EVENTS.START_COUNTDOWN, { duration: 3000 });
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
      gameState: {
        version: 0,
        timestamp: Date.now(),
        gameStatus: 'modeSelect',
        players: [],
        gameWorld: {
          platforms: [],
          startPoint: { x: 100, y: 100 },
          endPoint: { x: 2320, y: 120 },
          worldBounds: { width: GAME_DIMENSIONS.WIDTH, height: GAME_DIMENSIONS.HEIGHT }
        },
        items: []
      }
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
  
  // Subscribe to item placement events
  gameEvents.subscribe(GAME_EVENTS.ITEM_PLACEMENT, (data: any) => {
    // Call the existing handlePlaceItem method which handles both UI state
    // and publishes the PLACE_ITEM event for server communication via SocketEvents
    store.handlePlaceItem(data.x, data.y);
  });
  
  return store;
});