import { GameStatus } from '../../shared/types';

// Define the store interface we need - avoids circular dependencies
interface GameStore {
  setGameStatus: (status: GameStatus) => void;
  setDeathType: (type: string) => void;
}

export class NetworkListener {
  private gameStore: GameStore;
  
  constructor(gameStore: GameStore) {
    this.gameStore = gameStore;
  }
  
  handleMessage(message: any) {
    // Determine message type and route to appropriate handler
    switch (message.type) {
      case 'player_joined':
        this.handlePlayerJoined();
        break;
        
      case 'start_game':
        this.handleStartGame();
        break;
        
      case 'player_state':
        this.handlePlayerState(message.payload);
        break;
        
      case 'command_result':
        this.handleCommandResult(message.payload);
        break;
        
      case 'game_state':
        this.handleGameState(message.payload);
        break;
        
      case 'disconnect':
        this.handleDisconnect();
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        break;
    }
  }

  private handlePlayerJoined() {
    // Handle player joined event
    console.log('Player joined the lobby');
  }
  
  private handleStartGame() {
    // Game has started
    this.gameStore.setGameStatus('select');
  }
  
  private handlePlayerState(data: any) {
    // Update player state in game by dispatching a custom event
    const playerStateEvent = new CustomEvent('remote-player-update', {
      detail: data
    });
    window.dispatchEvent(playerStateEvent);
  }
  
  private handleCommandResult(data: any) {
    // Handle command results from the prompter
    const commandData = data as {type?: string; x?: number; y?: number};
    if (commandData.type && commandData.x !== undefined && commandData.y !== undefined) {
      // Notify renderer to place the item
      const event = new CustomEvent('place-live-item', {
        detail: { 
          type: commandData.type, 
          x: commandData.x, 
          y: commandData.y 
        }
      });
      window.dispatchEvent(event);
    }
  }
  
  private handleGameState(data: any) {
    // Update game state from server
    if (data?.gameStatus) {
      this.gameStore.setGameStatus(data.gameStatus);
      
      // If the status is 'gameover', set the death type
      if (data.gameStatus === 'gameover' && data.deathType) {
        this.gameStore.setDeathType(data.deathType);
      }
    }
  }
  
  private handleDisconnect() {
    // Handle disconnection
    this.gameStore.setGameStatus('modeSelect');
  }
}