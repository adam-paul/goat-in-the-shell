import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage, GameStatus, UniversalGameState } from '../../shared/types';
import { GameStateManager } from '../game-state';
import { GameLogicProcessor } from '../logic';
import { GameInstanceManager } from '../game-state/GameInstanceManager';
import { gameEvents } from '../game-state/GameEvents';
import { PlayerRegistry } from '../registry';

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
  private playerRegistry: PlayerRegistry;
  private pingIntervalId: NodeJS.Timeout | null = null;
  
  private inputBroadcastIntervals: Map<string, { intervalId: NodeJS.Timeout; timeoutId: NodeJS.Timeout }> = new Map();
  private fixedBroadcastIntervalId: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL = 100; // milliseconds
  
  constructor(
    wss: WebSocketServer, 
    gameState: GameStateManager, 
    gameLogic: GameLogicProcessor,
    instanceManager: GameInstanceManager,
    playerRegistry: PlayerRegistry
  ) {
    this.wss = wss;
    this.gameState = gameState;
    this.gameLogic = gameLogic;
    this.instanceManager = instanceManager;
    this.playerRegistry = playerRegistry;
    
    // Initialize WebSocket server
    this.setupWebSocketServer();
    
    // Start health check interval (every 30 seconds)
    this.startPingInterval(30000);
    
    // Start fixed broadcast interval for all active game instances
    this.startFixedBroadcastInterval();
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
      
      // Send initial welcome message with game world data using unified format
      const gameWorld = this.gameState.getGameWorld();
      
      // Create a unified state object that includes the initial game world
      const initialState: UniversalGameState = {
        timestamp: Date.now(),
        clientId: clientId, // Include in state for backward compatibility
        gameStatus: 'tutorial', // Default client-side state
        gameWorld: gameWorld,
        players: [],
        items: [],
        gameConfig: {
          gravity: 1.0,
          moveSpeed: 5.0,
          jumpForce: 10.0,
        }
      };
      
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.INITIAL_STATE,
        payload: {
          clientId,
          state: initialState
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
    
    // Get player instance before cleaning up
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    let instancePlayers: string[] = [];
    
    if (instanceId) {
      instancePlayers = this.playerRegistry.getInstancePlayers(instanceId);
    }
    
    // Clean up game state
    this.gameState.removePlayer(clientId);
    
    // Remove from instance if applicable
    if (instanceId) {
      this.instanceManager.removePlayer(clientId);
      
      // Notify remaining players
      instancePlayers.forEach(playerId => {
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
    
    // Remove from registry
    this.playerRegistry.removePlayer(clientId);
    
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
    
    // Store minimal client info - we'll get everything else from PlayerRegistry
    client.playerName = playerName;
    
    // Default lobby ID if none provided
    const targetLobbyId = lobbyId || 'default';
    
    console.log(`SERVER: Player ${playerName} (${clientId}) joining lobby ${targetLobbyId}`);
    
    // 1. Register player in PlayerRegistry first - single source of truth
    if (!this.playerRegistry.getPlayer(clientId)) {
      this.playerRegistry.addPlayer(clientId, playerName);
    }
    
    // 2. Add player to lobby in GameStateManager
    this.gameState.addPlayerToLobby(clientId, targetLobbyId, playerName);
    
    // 3. Find or create game instance
    let instance = this.instanceManager.getInstanceByLobby(targetLobbyId);
    
    if (!instance) {
      // Create new instance with player information
      const playerNames = { [clientId]: playerName };
      instance = this.instanceManager.createInstance(targetLobbyId, [clientId], playerNames);
      console.log(`SERVER: Created new game instance ${instance.id} for lobby ${targetLobbyId}`);
    } else {
      // Add to existing instance
      this.instanceManager.addPlayerToInstance(instance.id, clientId, playerName);
      console.log(`SERVER: Added player ${playerName} to existing instance ${instance.id}`);
    }
    
    // Get the current game state from the state machine
    const currentGameState = instance.stateMachine.getCurrentState();
    
    // Notify the game state about the status change
    instance.state.handleGameStatusChange(currentGameState);
    
    // Notify player of successful join - use instance ID from PlayerRegistry for consistency
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.EVENT,
      payload: {
        eventType: 'LOBBY_JOINED',
        lobbyId: targetLobbyId,
        instanceId: instanceId, // Use value from PlayerRegistry
        timestamp: Date.now()
      }
    });
    
    console.log(`SERVER: Client ${clientId} joined lobby ${targetLobbyId} with state ${currentGameState}`);
    
    // Notify other players in the same instance - use PlayerRegistry to get the list
    const instancePlayers = this.playerRegistry.getInstancePlayers(instanceId || '');
    instancePlayers.forEach(playerId => {
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
    
    // Publish an event for other components that might need to know
    gameEvents.publish('PLAYER_JOINED_INSTANCE', {
      playerId: clientId,
      playerName,
      instanceId,
      lobbyId: targetLobbyId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle player input from client
   */
  private handlePlayerInput(clientId: string, data: any) {
    console.log(`SERVER INPUT: Received from ${clientId}:`, JSON.stringify(data));
    
    // Get instance from player registry (source of truth)
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    if (!instanceId) {
      console.warn(`SERVER INPUT: ${clientId} not associated with any instance`);
      return;
    }
    
    // Get the game instance
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      console.warn(`SERVER INPUT: Instance ${instanceId} not found`);
      return;
    }
    
    // Validate input format with game logic
    if (!this.gameLogic.validatePlayerInput(data, clientId)) {
      console.warn(`SERVER INPUT: Invalid input format from client ${clientId}`);
      return;
    }
    
    // Check if gameplay is active via state machine
    const currentState = instance.stateMachine.getCurrentState();
    if (!instance.stateMachine.isGameplayActive()) {
      console.log(`SERVER INPUT: Game not active in instance ${instanceId}, state: ${currentState}`);
      return;
    }
    
    // Get player directly from registry (source of truth)
    const player = this.playerRegistry.getPlayer(clientId);
    if (!player) {
      console.error(`SERVER INPUT: Player ${clientId} not found in registry`);
      return;
    }
    
    if (!player.isAlive) {
      console.warn(`SERVER INPUT: Player ${clientId} is not alive, ignoring input`);
      return;
    }
    
    // Log player state before applying input
    console.log(`SERVER INPUT: Player ${clientId} at position (${player.position.x}, ${player.position.y}) processing input:`, JSON.stringify(data));
    
    // Apply input using the instance's state manager
    // This properly stores the input in the player object for physics to use
    instance.state.applyPlayerInput(data, clientId);
    
    // No need for intervals - physics update and broadcast are handled by the game loop
    // This prevents the explosion of intervals we were seeing before
  }
  
  /**
   * Broadcast the current game state to all clients in an instance
   */
  public broadcastGameState(instance: any): void {
    // Get base game state - includes items, etc.
    const baseState = instance.state.getState();
    
    // Get player data from PlayerRegistry - the single source of truth
    const playerState = this.playerRegistry.getInstanceStateSnapshot(instance.id);
    
    // Create a unified game state object conforming to UniversalGameState interface
    const unifiedState = {
      // Version and metadata
      version: baseState.version || 0,
      timestamp: Date.now(),
      instanceId: instance.id,
      lobbyId: instance.lobbyId,
      
      // Game status
      gameStatus: instance.stateMachine.getCurrentState(),
      deathType: baseState.deathType,
      
      // Players and entities
      players: playerState.players,
      
      // Game world definition
      gameWorld: baseState.gameWorld,
      
      // Items and obstacles placed in the game
      items: baseState.items || [],
      
      // Game configuration
      gameConfig: baseState.parameters || {},
      
      // Game parameters
      parameters: baseState.parameters || {}
    };
    
    // Create the network message using the interface's structure
    const stateUpdateMessage = {
      type: MESSAGE_TYPES.STATE_UPDATE,
      payload: {
        state: unifiedState
      }
    };
    
    // Send state update to all clients
    this.broadcastToInstance(instance.id, stateUpdateMessage);
  }
  
  /**
   * Handle item placement
   */
  private handlePlaceItem(clientId: string, data: any) {
    console.log(`SERVER: Handling PLACE_ITEM from client ${clientId}:`, JSON.stringify(data));
    
    // Get instance from player registry
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    if (!instanceId) {
      console.error(`SERVER: Client ${clientId} not associated with any instance`);
      return;
    }
    
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      console.error(`SERVER: Instance ${instanceId} not found`);
      return;
    }
    
    console.log(`SERVER: Player is in instance ${instance.id}, validating placement...`);
    
    // Validate item placement with the correct GameStateManager instance
    const isValid = instance.state.validateItemPlacement(data, clientId);
    console.log(`SERVER: Item placement validation result: ${isValid ? 'VALID' : 'INVALID'}`);
    
    if (isValid) {
      // Place the item in the instance's game state
      const placedItem = instance.state.placeItem(data, clientId);
      
      if (placedItem) {
        console.log(`SERVER: Successfully placed item ${placedItem.id} of type ${placedItem.type}`);
        
        // Publish event for physics engine to register the item
        gameEvents.publish('ITEM_PLACED', { item: placedItem });
        
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
    
    // Get instance from player registry
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    if (!instanceId) {
      console.warn(`SERVER: Client ${clientId} not associated with any instance`);
      return;
    }
    
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      console.warn(`SERVER: Instance ${instanceId} not found`);
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
        const baseState = instance.state.getState();
        const playerState = this.playerRegistry.getInstanceStateSnapshot(instance.id);
        
        // Create a unified game state conforming to UniversalGameState interface
        const unifiedState = {
          version: baseState.version || 0,
          timestamp: Date.now(),
          instanceId: instance.id,
          lobbyId: instance.lobbyId,
          gameStatus: instance.stateMachine.getCurrentState(),
          deathType: baseState.deathType,
          players: playerState.players,
          gameWorld: baseState.gameWorld || instance.state.getGameWorld(),
          items: baseState.items || [],
          gameConfig: baseState.parameters || {},
          parameters: baseState.parameters || {}
        };
        
        // Send initial state message
        this.sendMessage(clientId, {
          type: MESSAGE_TYPES.INITIAL_STATE,
          payload: {
            clientId: clientId,
            state: unifiedState
          }
        });
        return;
      }
    }
    
    // If not in an instance, send global state
    const globalState = this.gameState.getState();
    const gameWorld = this.gameState.getGameWorld();
    
    // Create a unified global state
    const unifiedGlobalState = {
      version: globalState.version || 0,
      timestamp: Date.now(),
      gameStatus: 'tutorial' as GameStatus, // Default state for new connections
      players: globalState.players || [],
      gameWorld: gameWorld,
      items: globalState.items || []
    };
    
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.INITIAL_STATE,
      payload: {
        clientId: clientId,
        state: unifiedGlobalState
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
    if (!lobbyId) {
      console.warn(`SERVER: Cannot broadcast to lobby with empty ID`);
      return;
    }
    
    console.log(`SERVER: Broadcasting to lobby ${lobbyId}`);
    
    // Get the instance associated with this lobby
    const instance = this.instanceManager.getInstanceByLobby(lobbyId);
    if (!instance) {
      console.warn(`SERVER: Cannot broadcast - no instance found for lobby ${lobbyId}`);
      return;
    }
    
    // Use PlayerRegistry to get all players in this instance
    const instanceId = instance.id;
    const players = this.playerRegistry.getInstancePlayers(instanceId);
    
    console.log(`SERVER: Broadcasting to lobby ${lobbyId} (instance ${instanceId}) with ${players.length} players`);
    
    // Send message to each player
    players.forEach(playerId => {
      this.sendMessage(playerId, message);
    });
    
    // Add a debug log for empty lobbies
    if (players.length === 0) {
      console.warn(`SERVER: Broadcast to lobby ${lobbyId} had no players to send to`);
    }
  }
  
  /**
   * Send a message to all clients in a game instance
   */
  broadcastToInstance(instanceId: string, message: NetworkMessage) {
    if (!instanceId) {
      console.warn(`SERVER: Cannot broadcast to instance with empty ID`);
      return;
    }
    
    // Get instance to verify it exists
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      console.warn(`SERVER: Cannot broadcast - instance ${instanceId} not found`);
      return;
    }
    
    // Get all players in this instance directly from PlayerRegistry
    const players = this.playerRegistry.getInstancePlayers(instanceId);
    console.log(`SERVER: Broadcasting to instance ${instanceId} with ${players.length} players`);
    
    // Send message to each player
    players.forEach(playerId => {
      this.sendMessage(playerId, message);
    });
    
    // Add a debug log for empty instances
    if (players.length === 0) {
      console.warn(`SERVER: Broadcast to instance ${instanceId} had no players to send to`);
    }
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
   * Start a fixed interval to broadcast game state for all active instances
   */
  private startFixedBroadcastInterval(): void {
    // Clear any existing interval
    if (this.fixedBroadcastIntervalId) {
      clearInterval(this.fixedBroadcastIntervalId);
    }
    
    // Set up a regular interval to broadcast state updates
    this.fixedBroadcastIntervalId = setInterval(() => {
      // Get all active game instances
      const instances = this.instanceManager.getAllInstances();
      
      // Only broadcast for active instances
      instances.forEach(instance => {
        if (instance.isActive && instance.stateMachine.isGameplayActive()) {
          // Get players in this instance
          const players = this.playerRegistry.getInstancePlayers(instance.id);
          
          // Only broadcast if there are players
          if (players.length > 0) {
            this.broadcastGameState(instance);
          }
        }
      });
    }, this.BROADCAST_INTERVAL);
    
    console.log(`SERVER: Started fixed broadcast interval at ${this.BROADCAST_INTERVAL}ms`);
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
    
    // Clear fixed broadcast interval
    if (this.fixedBroadcastIntervalId) {
      clearInterval(this.fixedBroadcastIntervalId);
      this.fixedBroadcastIntervalId = null;
    }
    
    // Clear any remaining input broadcast intervals
    this.inputBroadcastIntervals.forEach(({ intervalId, timeoutId }) => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    });
    this.inputBroadcastIntervals.clear();
    
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