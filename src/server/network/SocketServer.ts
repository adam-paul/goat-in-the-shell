import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage } from '../../shared/types';
import { GameStateManager } from '../game-state';
import { GameLogicProcessor } from '../logic';
import { GameInstanceManager } from '../game-state/GameInstanceManager';

// Client connection tracking
interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastMessageTime: number;
  playerName?: string;
  instanceId?: string;
  lobbyId?: string;
}

class SocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private gameState: GameStateManager;
  private gameLogic: GameLogicProcessor;
  private instanceManager: GameInstanceManager;
  private pingIntervalId: NodeJS.Timeout | null = null;
  
  constructor(
    wss: WebSocketServer, 
    gameState: GameStateManager, 
    gameLogic: GameLogicProcessor,
    instanceManager: GameInstanceManager
  ) {
    this.wss = wss;
    this.gameState = gameState;
    this.gameLogic = gameLogic;
    this.instanceManager = instanceManager;
    
    // Initialize WebSocket server
    this.setupWebSocketServer();
    
    // Start health check interval (every 30 seconds)
    this.startPingInterval(30000);
  }
  
  /**
   * Set up the WebSocket server with connection handlers
   */
  private setupWebSocketServer() {
    this.wss.on('connection', (socket: WebSocket) => {
      const clientId = randomUUID();
      console.log(`SERVER: New client connected with ID ${clientId}`);
      
      // Register new client
      this.clients.set(clientId, {
        id: clientId,
        socket,
        isAlive: true,
        lastMessageTime: Date.now()
      });
      
      // Set up message handler
      socket.on('message', (data: Buffer) => this.handleMessage(clientId, data));
      
      // Set up connection health check handlers
      socket.on('pong', () => this.handlePongResponse(clientId));
      
      // Set up disconnect handlers
      socket.on('close', (code, reason) => 
        this.handleDisconnect(clientId, code, reason?.toString()));
        
      socket.on('error', (err) => this.handleError(clientId, err));
      
      // Send initial welcome message with game world data
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.INITIAL_STATE,
        payload: {
          clientId,
          timestamp: Date.now(),
          gameConfig: {
            gravity: 1.0,
            moveSpeed: 5.0,
            jumpForce: 10.0,
          },
          gameWorld: this.gameState.getGameWorld(), // Include game world data
          // We don't set gameStatus here because the tutorial and mode select are client-side only
          // The server will set proper state machine status when player joins a lobby
        }
      });
    });
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(clientId: string, data: Buffer) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Update client activity tracking
    client.lastMessageTime = Date.now();
    client.isAlive = true;
    
    // Parse and process message
    try {
      const message = JSON.parse(data.toString()) as NetworkMessage;
      console.log(`SERVER: Received message type: ${message.type} from client: ${clientId}`);
      
      // Process based on message type
      switch (message.type) {
        case MESSAGE_TYPES.PING:
          this.handlePing(clientId);
          break;
          
        case MESSAGE_TYPES.PONG:
          this.handleClientPong(clientId);
          break;
          
        case MESSAGE_TYPES.JOIN_LOBBY:
          this.handleJoinLobby(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.PLAYER_INPUT:
          this.handlePlayerInput(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.PLACE_ITEM:
          this.handlePlaceItem(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.START_GAME:
          this.handleStartGame(clientId);
          break;
          
        case MESSAGE_TYPES.CHAT_MESSAGE:
          this.handleChatMessage(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.AI_COMMAND:
          this.handleAICommand(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.REQUEST_INITIAL_STATE:
          this.handleRequestInitialState(clientId);
          break;
          
        case MESSAGE_TYPES.REQUEST_STATE_TRANSITION:
          this.handleStateTransitionRequest(clientId, message.payload);
          break;
          
        default:
          console.warn(`SERVER: Unknown message type received from client ${clientId}: ${message.type}`);
          break;
      }
    } catch (err) {
      console.error(`SERVER: Error processing message from client ${clientId}:`, err);
    }
  }
  
  /**
   * Handle ping from client
   */
  private handlePing(clientId: string) {
    console.log(`SERVER: Received ping from client ${clientId}, sending pong...`);
    
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.PONG,
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle pong message from client
   */
  private handleClientPong(clientId: string) {
    console.log(`SERVER: Received pong from client ${clientId}`);
    
    const client = this.clients.get(clientId);
    if (client) client.isAlive = true;
    
    // Update activity in game instance if applicable
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (instance) {
      instance.updatePlayerActivity(clientId);
    }
  }
  
  /**
   * Handle WebSocket pong response (protocol level)
   */
  private handlePongResponse(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) client.isAlive = true;
  }
  
  /**
   * Handle client disconnection
   */
  private handleDisconnect(clientId: string, code?: number, reason?: string) {
    console.log(`SERVER: Client ${clientId} disconnected. Code: ${code}, Reason: ${reason || 'none'}`);
    
    // Clean up game state
    this.gameState.removePlayer(clientId);
    
    // Remove from instance if applicable
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (instance) {
      this.instanceManager.removePlayer(clientId);
      
      // Notify remaining players
      instance.players.forEach(playerId => {
        if (playerId !== clientId) {
          this.sendMessage(playerId, {
            type: MESSAGE_TYPES.EVENT,
            payload: {
              eventType: 'PLAYER_LEFT',
              playerId: clientId,
              timestamp: Date.now()
            }
          });
        }
      });
    }
    
    // Remove from tracked clients
    this.clients.delete(clientId);
  }
  
  /**
   * Handle socket error
   */
  private handleError(clientId: string, error: Error) {
    console.error(`SERVER: Socket error for client ${clientId}:`, error);
    
    const client = this.clients.get(clientId);
    if (client?.socket) {
      client.socket.terminate();
    }
    
    this.handleDisconnect(clientId, 1006, 'Socket error');
  }
  
  /**
   * Handle join lobby request
   */
  private handleJoinLobby(clientId: string, data: any) {
    const { playerName, lobbyId } = data;
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`SERVER: Client ${clientId} not found when joining lobby`);
      return;
    }
    
    // Update client info
    client.playerName = playerName;
    client.lobbyId = lobbyId || 'default';
    
    console.log(`SERVER: Player ${playerName} (${clientId}) joining lobby ${client.lobbyId}`);
    
    // Make sure we have a lobby ID
    const targetLobbyId = client.lobbyId || 'default';
    
    // Add to global lobby tracking (root GameStateManager)
    this.gameState.addPlayerToLobby(clientId, targetLobbyId, playerName);
    
    // Find or create game instance
    let instance = this.instanceManager.getInstanceByLobby(targetLobbyId);
    
    if (!instance) {
      // Create new instance with player information
      const playerNames = { [clientId]: playerName };
      instance = this.instanceManager.createInstance(targetLobbyId, [clientId], playerNames);
      console.log(`SERVER: Created new game instance ${instance.id} for lobby ${targetLobbyId}`);
      
      // Double check player registration
      if (!instance.state.getPlayer(clientId)) {
        console.error(`SERVER: Player ${clientId} not found in instance ${instance.id} after creation - doing direct registration`);
        instance.state.addPlayer(clientId, playerName);
      }
    } else {
      // Add to existing instance with player name
      this.instanceManager.addPlayerToInstance(instance.id, clientId, playerName);
      console.log(`SERVER: Added player ${playerName} to existing instance ${instance.id}`);
      
      // Double check player registration
      if (!instance.state.getPlayer(clientId)) {
        console.error(`SERVER: Player ${clientId} still not registered in instance ${instance.id} - doing direct registration`);
        instance.state.addPlayer(clientId, playerName);
      }
    }
    
    // Update client with instance ID
    client.instanceId = instance.id;
    
    // Get the current game state from the state machine
    const currentGameState = instance.stateMachine.getCurrentState();
    
    // Notify the game state about the status change
    instance.state.handleGameStatusChange(currentGameState);
    
    // Notify player of successful join
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.EVENT,
      payload: {
        eventType: 'LOBBY_JOINED',
        lobbyId: client.lobbyId,
        instanceId: instance.id,
        // Don't send gameStatus here, as client is already in mode select
        timestamp: Date.now()
      }
    });
    
    // We don't send a state update yet - client will request transitions when needed
    console.log(`SERVER: Client ${clientId} joined lobby ${client.lobbyId} with state ${currentGameState}`);
    
    // Notify other players in the lobby
    instance.players.forEach(playerId => {
      if (playerId !== clientId) {
        this.sendMessage(playerId, {
          type: MESSAGE_TYPES.EVENT,
          payload: {
            eventType: 'PLAYER_JOINED',
            playerId: clientId,
            playerName,
            timestamp: Date.now()
          }
        });
      }
    });
  }
  
  /**
   * Handle player input
   */
  private handlePlayerInput(clientId: string, data: any) {
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.warn(`CLIENT: ${clientId} not in a game instance`);
      return;
    }
    
    // Validate the input
    if (!this.gameLogic.validatePlayerInput(data, clientId)) {
      console.warn(`SERVER: Invalid player input from client ${clientId}`);
      return;
    }
    
    // Apply the input to the instance's game state
    instance.state.applyPlayerInput(data, clientId);
    
    // Send state update to client faster for better responsiveness (50ms)
    // on input received. This helps reduce perceived latency.
    const stateBroadcast = setInterval(() => {
      this.broadcastGameState(instance);
    }, 50);
    
    // Stop the fast update after 200ms
    setTimeout(() => {
      clearInterval(stateBroadcast);
    }, 200);
  }
  
  /**
   * Broadcast the current game state to all clients in an instance
   */
  public broadcastGameState(instance: any): void {
    // Get the game state
    const state = instance.state.getState();
    
    // Add the current game status from the state machine
    state.gameStatus = instance.stateMachine.getCurrentState();
    
    // Log projectiles count for debugging
    const projectileCount = state.projectiles ? state.projectiles.length : 0;
    if (projectileCount > 0) {
      console.log(`[SocketServer] Broadcasting state with ${projectileCount} projectiles`);
    }
    
    // Send state update to all clients
    this.broadcastToInstance(instance.id, {
      type: MESSAGE_TYPES.STATE_UPDATE,
      payload: {
        state,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Handle item placement
   */
  private handlePlaceItem(clientId: string, data: any) {
    console.log(`SERVER: Handling PLACE_ITEM from client ${clientId}:`, JSON.stringify(data));
    
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.error(`SERVER: Client ${clientId} not associated with a game instance`);
      return;
    }
    
    console.log(`SERVER: Player is in instance ${instance.id}, validating placement...`);
    
    // Debug log unique identifiers for the GameStateManager instances
    console.log(`SERVER: Instance state GameStateManager identity: ${instance.state.constructor.name}@${instance.state.toString().split('\n')[0]}`);
    console.log(`SERVER: Root GameStateManager identity: ${this.gameState.constructor.name}@${this.gameState.toString().split('\n')[0]}`);
    
    // Make sure the player exists in the instance's GameStateManager 
    // (This should have happened when joining the lobby)
    if (!instance.state.getPlayer(clientId)) {
      console.error(`SERVER DEBUG: Player ${clientId} not found in instance ${instance.id}'s GameStateManager, trying to register...`);
      const playerName = this.clients.get(clientId)?.playerName || `Player-${clientId.substring(0, 4)}`;
      
      // Register the player directly in the instance's GameStateManager 
      instance.state.addPlayer(clientId, playerName);
      console.log(`SERVER DEBUG: Player ${clientId} manually registered to instance ${instance.id}`);
    }
    
    // Validate item placement with the correct GameStateManager instance
    const isValid = instance.state.validateItemPlacement(data, clientId);
    console.log(`SERVER: Item placement validation result: ${isValid ? 'VALID' : 'INVALID'}`);
    
    if (isValid) {
      // Place the item in the instance's game state
      const placedItem = instance.state.placeItem(data, clientId);
      
      if (placedItem) {
        console.log(`SERVER: Successfully placed item ${placedItem.id} of type ${placedItem.type}`);
        
        // Send success confirmation back to the client
        this.sendMessage(clientId, {
          type: MESSAGE_TYPES.EVENT,
          payload: {
            eventType: 'PLACEMENT_SUCCESS',
            message: 'Item placed successfully',
            timestamp: Date.now()
          }
        });
        
        // Notify all players in the instance about the successful item placement
        this.broadcastToInstance(instance.id, {
          type: MESSAGE_TYPES.EVENT,
          payload: {
            eventType: 'ITEM_PLACED',
            placedBy: clientId,
            itemData: placedItem,
            timestamp: Date.now()
          }
        });
      } else {
        console.error(`SERVER: Item placement failed after validation passed - placeItem returned null`);
        this.sendMessage(clientId, {
          type: MESSAGE_TYPES.EVENT,
          payload: {
            eventType: 'PLACEMENT_FAILED',
            message: 'Item placement failed after validation',
            timestamp: Date.now()
          }
        });
      }
    } else {
      console.error(`SERVER: Invalid item placement from client ${clientId} - validation failed`);
      // Send failure response to client
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.EVENT,
        payload: {
          eventType: 'PLACEMENT_FAILED',
          message: 'Invalid item placement',
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle game start request
   */
  private handleStartGame(clientId: string) {
    if (!this.gameLogic.canStartGame(clientId)) {
      console.warn(`SERVER: Client ${clientId} not authorized to start game`);
      return;
    }
    
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.warn(`SERVER: Client ${clientId} not associated with a game instance`);
      return;
    }
    
    // Start the game - update both state machine and game state
    const success = instance.stateMachine.transitionTo('playing');
    if (success) {
      this.gameState.startGame(clientId);
      this.instanceManager.startInstance(instance.id);
      
      console.log(`SERVER: Game instance ${instance.id} started by player ${clientId}`);
      
      // Notify all players in the instance
      this.broadcastToInstance(instance.id, {
        type: MESSAGE_TYPES.EVENT,
        payload: {
          eventType: 'GAME_STARTED',
          startedBy: clientId,
          instanceId: instance.id,
          timestamp: Date.now()
        }
      });
    } else {
      console.warn(`SERVER: Could not transition to playing state for instance ${instance.id}`);
      
      // Send error response to client
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot transition to playing state',
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle chat message
   */
  private handleChatMessage(clientId: string, data: any) {
    const { message, lobbyId } = data;
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`SERVER: Client ${clientId} not found when sending chat message`);
      return;
    }
    
    const targetLobbyId = lobbyId || client.lobbyId || 'default';
    
    // Broadcast the chat message to the lobby
    this.broadcastToLobby(targetLobbyId, {
      type: MESSAGE_TYPES.CHAT_MESSAGE,
      payload: {
        senderId: clientId,
        senderName: client.playerName || 'Unknown',
        message,
        lobbyId: targetLobbyId,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Handle AI command
   */
  private handleAICommand(clientId: string, data: any) {
    const { command } = data;
    console.log(`SERVER: AI command from client ${clientId}: ${command}`);
    
    // This would call the AI service or process AI commands
    // For now just log it and send a fake response
    
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.COMMAND_RESULT,
      payload: {
        response: `Processed command: ${command}`,
        success: true,
        parameter_modifications: []
      }
    });
  }
  
  /**
   * Handle state transition request from client
   */
  private handleStateTransitionRequest(clientId: string, data: any) {
    // Get target state from request
    const targetState = data.targetState;
    if (!targetState) {
      console.warn(`SERVER: Invalid state transition request from client ${clientId} - missing target state`);
      return;
    }
    
    // Get the game instance this player belongs to
    const instance = this.instanceManager.getInstanceByPlayer(clientId);
    if (!instance) {
      console.warn(`SERVER: Client ${clientId} not associated with a game instance`);
      return;
    }
    
    // Get current state
    const currentState = instance.stateMachine.getCurrentState();
    
    // Check if transition is valid
    const isValid = instance.stateMachine.isValidTransition(currentState, targetState);
    
    if (!isValid) {
      console.warn(`SERVER: Invalid state transition from ${currentState} to ${targetState} requested by client ${clientId}`);
      
      // Send error response to client
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.STATE_TRANSITION_RESULT,
        payload: {
          success: false,
          message: `Invalid transition from ${currentState} to ${targetState}`,
          requestedState: targetState,
          currentState: currentState
        }
      });
      return;
    }
    
    // Attempt the transition
    const success = instance.stateMachine.transitionTo(targetState);
    
    // Send result to client
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.STATE_TRANSITION_RESULT,
      payload: {
        success,
        message: success ? 'State transition successful' : 'State transition failed',
        requestedState: targetState,
        currentState: instance.stateMachine.getCurrentState()
      }
    });
    
    if (success) {
      // Notify the game state about the status change
      instance.state.handleGameStatusChange(targetState);
      
      // Broadcast state change to all players in the instance
      this.broadcastToInstance(instance.id, {
        type: MESSAGE_TYPES.GAME_STATE_CHANGED,
        payload: {
          previousState: currentState,
          currentState: targetState,
          timestamp: Date.now()
        }
      });
      
      console.log(`SERVER: State transition successful: ${currentState} -> ${targetState} for instance ${instance.id}`);
    }
  }

  /**
   * Handle request for initial state
   */
  private handleRequestInitialState(clientId: string) {
    console.log(`SERVER: Received request for initial state from client ${clientId}`);
    
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // If client is in a game instance, send that instance's state
    if (client.instanceId) {
      const instance = this.instanceManager.getInstance(client.instanceId);
      if (instance) {
        const state = instance.state.getState();
        
        // Send state update including game world
        this.sendMessage(clientId, {
          type: MESSAGE_TYPES.STATE_UPDATE,
          payload: {
            state: state,
            timestamp: Date.now(),
            gameWorld: instance.state.getGameWorld(), // Include game world data
            gameStatus: instance.stateMachine.getCurrentState() // Include current game status from state machine
          }
        });
        return;
      }
    }
    
    // If not in an instance, send global state
    const globalState = this.gameState.getState();
    
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.STATE_UPDATE,
      payload: {
        state: globalState,
        timestamp: Date.now(),
        gameWorld: this.gameState.getGameWorld() // Include game world data
      }
    });
  }
  
  /**
   * Send a message to a specific client
   */
  sendMessage(clientId: string, message: NetworkMessage): boolean {
    const client = this.clients.get(clientId);
    
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      console.warn(`SERVER: Cannot send message to client ${clientId} - socket not open`);
      return false;
    }
    
    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error(`SERVER: Error sending message to client ${clientId}:`, err);
      return false;
    }
  }
  
  /**
   * Send a message to all clients in a lobby
   */
  broadcastToLobby(lobbyId: string, message: NetworkMessage) {
    console.log(`SERVER: Broadcasting to lobby ${lobbyId}`);
    
    this.clients.forEach(client => {
      if (client.lobbyId === lobbyId && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }
  
  /**
   * Send a message to all clients in a game instance
   */
  broadcastToInstance(instanceId: string, message: NetworkMessage) {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) return;
    
    console.log(`SERVER: Broadcasting to instance ${instanceId} with ${instance.players.length} players`);
    
    instance.players.forEach(playerId => {
      this.sendMessage(playerId, message);
    });
  }
  
  /**
   * Broadcast a message to all connected clients
   */
  broadcastToAll(message: NetworkMessage) {
    const messageString = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageString);
      }
    });
  }
  
  /**
   * Start interval to ping clients and check for disconnections
   */
  startPingInterval(intervalMs: number) {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    
    this.pingIntervalId = setInterval(() => this.pingClients(), intervalMs);
  }
  
  /**
   * Check clients for connection status
   */
  private pingClients() {
    const now = Date.now();
    // Only log when there's a potential issue
    const clientCount = this.clients.size;
    
    if (clientCount === 0) {
      return; // No logging needed when no clients are connected
    }
    
    this.clients.forEach((client, clientId) => {
      // Check socket readyState first
      if (client.socket.readyState !== WebSocket.OPEN) {
        console.log(`SERVER: Client ${clientId} socket is not open. ReadyState: ${client.socket.readyState}. Removing client.`);
        this.handleDisconnect(clientId, 1006, 'Socket not open during health check');
        return;
      }
      
      // Check if client has been inactive for too long (5 minutes)
      if (now - client.lastMessageTime > 5 * 60 * 1000) {
        console.log(`SERVER: Client ${clientId} inactive for too long. Terminating connection.`);
        client.socket.terminate();
        this.handleDisconnect(clientId, 1006, 'Inactivity timeout');
        return;
      }
    });
  }
  
  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get connected clients
   */
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }
  
  /**
   * Shutdown the socket server
   */
  shutdown() {
    console.log('SERVER: Shutting down socket server');
    
    // Clear ping interval
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      try {
        client.socket.close(1000, 'Server shutting down');
      } catch (err) {
        console.error(`SERVER: Error closing connection for client ${clientId}:`, err);
      }
    });
    
    // Clear client map
    this.clients.clear();
  }
}

export { SocketServer };
export type { ClientConnection };