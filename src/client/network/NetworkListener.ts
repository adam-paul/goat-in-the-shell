import { 
  GameStatus, 
  DeathType, 
  InitialStateMessage, 
  StateUpdateMessage,
  EventMessage,
  CommandResultMessage,
  ErrorMessage,
  MESSAGE_TYPES,
  EVENT_TYPES
} from '../../shared/types';

// Define the store interface we need - avoids circular dependencies
interface GameStore {
  setGameStatus: (status: GameStatus) => void;
  setDeathType: (type: DeathType) => void;
  updateGameState: (state: any) => void;
  setClientId: (id: string) => void;
  clientId: string; // Add clientId property
  setGameConfig: (config: any) => void;
  setErrorMessage: (message: string) => void;
  setInstanceId?: (id: string) => void; // Optional method to store game instance ID
}

export class NetworkListener {
  private gameStore: GameStore;
  
  constructor(gameStore: GameStore) {
    this.gameStore = gameStore;
  }
  
  handleMessage(message: any) {
    // Log the received message for debugging
    console.log('Received message:', message);
    
    // Determine message type and route to appropriate handler
    switch (message.type) {
      case MESSAGE_TYPES.INITIAL_STATE:
        this.handleInitialState(message as InitialStateMessage);
        break;
        
      case MESSAGE_TYPES.STATE_UPDATE:
        this.handleStateUpdate(message as StateUpdateMessage);
        break;
        
      case MESSAGE_TYPES.EVENT:
        this.handleEvent(message as EventMessage);
        break;
        
      case MESSAGE_TYPES.COMMAND_RESULT:
        this.handleCommandResult(message as CommandResultMessage);
        break;
        
      case MESSAGE_TYPES.ERROR:
        this.handleError(message as ErrorMessage);
        break;
        
      case 'INSTANCE_DETAILS':
        this.handleInstanceDetails(message);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        break;
    }
  }

  private handleInitialState(message: InitialStateMessage) {
    const { clientId, gameConfig, instanceId } = message.payload;
    
    // Store client ID and game configuration
    this.gameStore.setClientId(clientId);
    this.gameStore.setGameConfig(gameConfig);
    
    // Store instance ID if provided and store supports it
    if (instanceId && this.gameStore.setInstanceId) {
      this.gameStore.setInstanceId(instanceId);
    }
    
    console.log('Connection established with client ID:', clientId);
  }
  
  private handleInstanceDetails(message: any) {
    const { id, lobbyId, players, isActive } = message.data;
    
    console.log(`Received game instance details: ID ${id}, lobby ${lobbyId}, active: ${isActive}`);
    
    // Store instance ID if store supports it
    if (this.gameStore.setInstanceId) {
      this.gameStore.setInstanceId(id);
    }
    
    // Notify any components that need to know about instance details
    const instanceEvent = new CustomEvent('game-instance-update', {
      detail: { 
        id, 
        lobbyId, 
        players, 
        isActive 
      }
    });
    window.dispatchEvent(instanceEvent);
  }
  
  private handleStateUpdate(message: StateUpdateMessage) {
    const { state } = message.payload;
    
    // Update the game state in the store
    this.gameStore.updateGameState(state);
    
    // Update game status if provided
    if (state.gameStatus) {
      this.gameStore.setGameStatus(state.gameStatus);
    }
    
    // Dispatch a custom event for the game renderer to update
    const stateUpdateEvent = new CustomEvent('game-state-update', {
      detail: state
    });
    window.dispatchEvent(stateUpdateEvent);
  }
  
  private handleEvent(message: EventMessage) {
    const { eventType } = message.payload;
    
    switch (eventType) {
      case EVENT_TYPES.PLAYER_JOINED:
        console.log(`Player joined: ${message.payload.playerName}`);
        break;
        
      case EVENT_TYPES.PLAYER_LEFT:
        console.log(`Player left: ${message.payload.playerId}`);
        break;
        
      case EVENT_TYPES.GAME_STARTED:
        this.gameStore.setGameStatus('playing');
        break;
        
      case EVENT_TYPES.ROUND_COMPLETE:
        // Handle round completion
        break;
        
      case EVENT_TYPES.PLAYER_DEATH:
        if (message.payload.playerId === this.gameStore.clientId) {
          this.gameStore.setGameStatus('gameover');
          this.gameStore.setDeathType(message.payload.deathType as DeathType);
        }
        break;
        
      case EVENT_TYPES.ITEM_PLACED:
        // Notify renderer to place the item
        const event = new CustomEvent('place-live-item', {
          detail: { 
            type: message.payload.itemType, 
            x: message.payload.position.x, 
            y: message.payload.position.y,
            properties: message.payload.properties
          }
        });
        window.dispatchEvent(event);
        break;
        
      default:
        console.warn('Unknown event type:', eventType);
    }
  }
  
  private handleCommandResult(message: CommandResultMessage) {
    const { success, response, type, x, y, parameter_modifications } = message.payload;
    
    // If command included an item placement
    if (success && type && x !== undefined && y !== undefined) {
      // Notify renderer to place the item
      const event = new CustomEvent('place-live-item', {
        detail: { 
          type, 
          x, 
          y 
        }
      });
      window.dispatchEvent(event);
    }
    
    // If command included parameter modifications
    if (parameter_modifications && parameter_modifications.length > 0) {
      parameter_modifications.forEach(mod => {
        const event = new CustomEvent('parameter-change', {
          detail: {
            key: mod.parameter,
            normalizedValue: mod.normalized_value
          }
        });
        window.dispatchEvent(event);
      });
    }
    
    // Display command response
    const responseEvent = new CustomEvent('command-response', {
      detail: { success, response }
    });
    window.dispatchEvent(responseEvent);
  }
  
  private handleError(message: ErrorMessage) {
    const { code, message: errorMessage } = message.payload;
    
    console.error(`Server error (${code}): ${errorMessage}`);
    this.gameStore.setErrorMessage(`${errorMessage}`);
    
    // Handle specific error codes
    switch (code) {
      case 'UNAUTHORIZED':
        // Handle authorization errors
        break;
        
      case 'INVALID_STATE':
        // Handle invalid game state errors
        break;
        
      default:
        // Generic error handling
    }
  }
}