import { WebSocket } from 'ws';
import { GameStateManager } from "../game-state";
import { GameLogicProcessor } from "../logic";

// Define message types
type MessageType = 
  | 'PLAYER_INPUT'
  | 'PLACE_ITEM'
  | 'START_GAME'
  | 'JOIN_LOBBY' 
  | 'CHAT_MESSAGE'
  | 'AI_COMMAND'
  | 'PONG';

interface NetworkMessage {
  type: MessageType;
  data: any;
}

class ServerNetworkListener {
  private gameState: GameStateManager;
  private gameLogic: GameLogicProcessor;
  
  constructor(gameState: GameStateManager, gameLogic: GameLogicProcessor) {
    this.gameState = gameState;
    this.gameLogic = gameLogic;
  }
  
  /**
   * Set up all event listeners for a websocket connection
   */
  setupSocketListeners(socket: WebSocket, clientId: string, clients: Map<string, {id: string, socket: WebSocket, isAlive: boolean, lastMessageTime: number}>): void {
    // Message event handler
    socket.on('message', (data: Buffer) => {
      // Update client tracking info
      const client = clients.get(clientId);
      if (!client) return;
      
      client.lastMessageTime = Date.now();
      client.isAlive = true;
      
      // Process the message
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message, clientId);
      } catch (err) {
        console.error(`Error processing message from client ${clientId}:`, err);
      }
    });
    
    // Pong handler for connection health checks
    socket.on('pong', () => {
      const client = clients.get(clientId);
      if (client) client.isAlive = true;
    });
    
    // Close handler for disconnections
    socket.on('close', () => {
      this.handleClientDisconnect(clientId);
      clients.delete(clientId);
    });
    
    // Error handler
    socket.on('error', (err) => {
      console.error(`Socket error for client ${clientId}:`, err);
      socket.terminate();
      this.handleClientDisconnect(clientId);
      clients.delete(clientId);
    });
  }
  
  /**
   * Handle incoming messages from clients
   */
  handleMessage(message: NetworkMessage, clientId: string): void {
    console.log(`Received message type: ${message.type} from client: ${clientId}`);
    
    switch (message.type) {
      case 'PLAYER_INPUT':
        this.handlePlayerInput(message.data, clientId);
        break;
        
      case 'PLACE_ITEM':
        this.handlePlaceItem(message.data, clientId);
        break;
        
      case 'START_GAME':
        this.handleStartGame(clientId);
        break;
        
      case 'JOIN_LOBBY':
        this.handleJoinLobby(message.data, clientId);
        break;
        
      case 'CHAT_MESSAGE':
        this.handleChatMessage(message.data, clientId);
        break;
        
      case 'AI_COMMAND':
        this.handleAICommand(message.data, clientId);
        break;
        
      case 'PONG':
        // Handled by the pong event listener
        break;
        
      default:
        console.warn(`Unknown message type received: ${(message as any).type}`);
        break;
    }
  }
  
  /**
   * Handle player movement input
   */
  private handlePlayerInput(data: any, clientId: string): void {
    // Validate the input first
    if (!this.gameLogic.validatePlayerInput(data, clientId)) {
      console.warn(`Invalid player input from client ${clientId}`);
      return;
    }
    
    // Apply the input to the game state
    this.gameState.applyPlayerInput(data, clientId);
  }
  
  /**
   * Handle item placement requests
   */
  private handlePlaceItem(data: any, clientId: string): void {
    if (!this.gameLogic.validateItemPlacement(data, clientId)) {
      console.warn(`Invalid item placement from client ${clientId}`);
      return;
    }
    
    this.gameState.placeItem(data, clientId);
  }
  
  /**
   * Handle game start request
   */
  private handleStartGame(clientId: string): void {
    if (!this.gameLogic.canStartGame(clientId)) {
      console.warn(`Client ${clientId} not authorized to start game`);
      return;
    }
    
    this.gameState.startGame(clientId);
  }
  
  /**
   * Handle lobby join request
   */
  private handleJoinLobby(data: any, clientId: string): void {
    const { lobbyId, playerName } = data;
    this.gameState.addPlayerToLobby(clientId, lobbyId, playerName);
  }
  
  /**
   * Handle chat messages
   */
  private handleChatMessage(data: any, clientId: string): void {
    // Simply relay chat messages to other clients in the same lobby
    const { message, lobbyId } = data;
    this.gameState.broadcastChatMessage(clientId, message, lobbyId);
  }
  
  /**
   * Handle AI command processing
   */
  private handleAICommand(data: any, clientId: string): void {
    // This would call the AI service or process AI commands
    // For now just log it
    console.log(`AI command from client ${clientId}: ${data.command}`);
    
    // In a real implementation, we would process the AI command and update the game state
    // For example:
    // this.aiService.processCommand(data.command, gameState);
  }
  
  /**
   * Handle client disconnections
   */
  handleClientDisconnect(clientId: string): void {
    console.log(`Processing disconnect for client: ${clientId}`);
    this.gameState.removePlayer(clientId);
  }
}

export { ServerNetworkListener, NetworkMessage, MessageType };