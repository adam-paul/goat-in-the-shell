import { 
  PlayerInputMessage, 
  PlaceItemMessage,
  JoinLobbyMessage,
  StartGameMessage,
  ChatMessage,
  CommandMessage
} from '../../shared/types';

export class NetworkMessenger {
  private socket: WebSocket | null = null;
  
  constructor(socket: WebSocket | null) {
    this.socket = socket;
  }
  
  setSocket(socket: WebSocket | null) {
    this.socket = socket;
  }
  
  // Send a generic message to the server
  sendMessage(type: string, payload?: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    const message = {
      type,
      payload,
      timestamp: Date.now()
    };
    
    console.log('Sending message:', message);
    this.socket.send(JSON.stringify(message));
    
    return true;
  }
  
  // Send player input (movement controls)
  sendPlayerInput(input: { left?: boolean, right?: boolean, jump?: boolean }) {
    const message: PlayerInputMessage = {
      type: 'PLAYER_INPUT',
      payload: {
        ...input,
        timestamp: Date.now()
      }
    };
    
    return this.sendMessage(message.type, message.payload);
  }
  
  // Send player position update (for prediction)
  sendPlayerPosition() {
    return this.sendPlayerInput({
      left: false,
      right: false,
      jump: false
    });
  }
  
  // Send item placement request
  sendPlaceItem(itemType: string, x: number, y: number, rotation: number = 0, properties: Record<string, any> = {}) {
    const message: PlaceItemMessage = {
      type: 'PLACE_ITEM',
      payload: {
        type: itemType,
        position: { x, y },
        rotation,
        properties
      }
    };
    
    return this.sendMessage(message.type, message.payload);
  }
  
  // Send lobby join request
  sendJoinLobby(playerName: string, lobbyId?: string) {
    const message: JoinLobbyMessage = {
      type: 'JOIN_LOBBY',
      payload: {
        lobbyId,
        playerName
      }
    };
    
    return this.sendMessage(message.type, message.payload);
  }
  
  // Send game start request
  sendStartGame() {
    const message: StartGameMessage = {
      type: 'START_GAME'
    };
    
    return this.sendMessage(message.type, {});
  }
  
  // Send chat message
  sendChatMessage(messageText: string, lobbyId: string) {
    const message: ChatMessage = {
      type: 'CHAT_MESSAGE',
      payload: {
        message: messageText,
        lobbyId
      }
    };
    
    return this.sendMessage(message.type, message.payload);
  }
  
  // Send AI command
  sendAICommand(command: string) {
    const message: CommandMessage = {
      type: 'AI_COMMAND',
      payload: {
        command
      }
    };
    
    return this.sendMessage(message.type, message.payload);
  }
}