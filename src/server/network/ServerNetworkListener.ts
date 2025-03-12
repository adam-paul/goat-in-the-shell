import { WebSocket } from 'ws';
import { GameStateManager, GameInstanceManager } from "../game-state";
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
  private instanceManager: GameInstanceManager;
  
  constructor(
    gameState: GameStateManager, 
    gameLogic: GameLogicProcessor, 
    instanceManager: GameInstanceManager
  ) {
    this.gameState = gameState;
    this.gameLogic = gameLogic;
    this.instanceManager = instanceManager;
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
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance || !instance.isActive) {
      console.warn(`Client ${clientId} not in an active game instance`);
      return;
    }
    
    // Validate the input first
    if (!this.gameLogic.validatePlayerInput(data, clientId)) {
      console.warn(`Invalid player input from client ${clientId}`);
      return;
    }
    
    // Apply the input to the instance's game state
    instance.state.applyPlayerInput(data, clientId);
  }
  
  /**
   * Handle item placement requests
   */
  private handlePlaceItem(data: any, clientId: string): void {
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.warn(`Client ${clientId} not associated with a game instance`);
      return;
    }
    
    if (!this.gameLogic.validateItemPlacement(data, clientId)) {
      console.warn(`Invalid item placement from client ${clientId}`);
      return;
    }
    
    // Place the item in the instance's game state
    instance.state.placeItem(data, clientId);
  }
  
  /**
   * Handle game start request
   */
  private handleStartGame(clientId: string): void {
    if (!this.gameLogic.canStartGame(clientId)) {
      console.warn(`Client ${clientId} not authorized to start game`);
      return;
    }
    
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.warn(`Client ${clientId} not associated with a game instance`);
      return;
    }
    
    // Start both the game state and the instance
    this.gameState.startGame(clientId);
    this.instanceManager.startInstance(instance.id);
    
    console.log(`Game instance ${instance.id} started by player ${clientId}`);
  }
  
  /**
   * Handle lobby join request
   */
  private handleJoinLobby(data: any, clientId: string): void {
    const { lobbyId, playerName } = data;
    
    // First add the player to the lobby in the game state
    this.gameState.addPlayerToLobby(clientId, lobbyId, playerName);
    
    // Find the lobby
    let targetLobbyId = lobbyId;
    if (!targetLobbyId) {
      // If no lobby ID provided, create a new one or use default
      targetLobbyId = 'default';
    }
    
    // Get or create a game instance for this lobby
    let instance = this.instanceManager.getInstanceByLobby(targetLobbyId);
    
    // If instance doesn't exist, create it
    if (!instance) {
      // Get all players in the lobby
      const lobby = Array.from(this.gameState['lobbies'].values())
        .find(l => l.id === targetLobbyId);
      
      if (lobby) {
        instance = this.instanceManager.createInstance(targetLobbyId, lobby.players);
      } else {
        // Fallback - create instance with just this player
        instance = this.instanceManager.createInstance(targetLobbyId, [clientId]);
      }
    } else {
      // Add player to existing instance
      this.instanceManager.addPlayerToInstance(instance.id, clientId);
    }
    
    console.log(`Player ${playerName} (${clientId}) joined lobby ${targetLobbyId}`);
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

export { ServerNetworkListener };
export type { NetworkMessage, MessageType };