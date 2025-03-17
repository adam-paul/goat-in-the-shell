import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage, GameStatus } from '../../shared/types';
import { GameLogicProcessor } from '../logic';
import { gameEvents } from '../game-state/GameEvents';
import { GameSessionManager } from '../game-state/GameSessionManager';

// Client connection tracking
interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastMessageTime: number;
  playerName?: string;
  sessionId?: string;
}

export class SocketServer {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientConnection>();
  private sessionManager: GameSessionManager;
  private gameLogic: GameLogicProcessor;
  private pingIntervalId: NodeJS.Timeout | null = null;
  private broadcastIntervalId: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL = 100; // milliseconds
  
  constructor(
    wss: WebSocketServer, 
    sessionManager: GameSessionManager, 
    gameLogic: GameLogicProcessor
  ) {
    this.wss = wss;
    this.sessionManager = sessionManager;
    this.gameLogic = gameLogic;
    
    // Initialize WebSocket server
    this.setupWebSocketServer();
    
    // Start ping interval to keep connections alive
    this.startPingInterval(30000); // 30 seconds
    
    // Start fixed broadcast interval for game state updates
    this.startBroadcastInterval();
    
    console.log(`SOCKET: WebSocket server initialized`);
  }
  
  /**
   * Set up WebSocket server event handlers
   */
  private setupWebSocketServer() {
    this.wss.on('connection', (socket: WebSocket) => {
      // Generate a unique client ID
      const clientId = randomUUID();
      
      // Store client connection
      this.clients.set(clientId, {
        id: clientId,
        socket,
        isAlive: true,
        lastMessageTime: Date.now()
      });
      
      console.log(`SOCKET: Client ${clientId} connected`);
      
      // Send welcome message with client ID
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.WELCOME,
        payload: {
          clientId,
          message: 'Welcome to the game server',
          timestamp: Date.now()
        }
      });
      
      // Set up event handlers for this client
      socket.on('message', (data: Buffer) => {
        this.handleMessage(clientId, data);
      });
      
      socket.on('close', (code: number, reason: Buffer) => {
        this.handleDisconnect(clientId, code, reason.toString());
      });
      
      socket.on('error', (error: Error) => {
        this.handleError(clientId, error);
      });
      
      socket.on('pong', () => {
        this.handlePong(clientId);
      });
    });
  }
  
  /**
   * Handle incoming messages from clients
   */
  private handleMessage(clientId: string, data: Buffer) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Update last message time
    client.lastMessageTime = Date.now();
    
    try {
      // Parse message
      const message = JSON.parse(data.toString());
      
      // Handle message based on type
      switch (message.type) {
        case MESSAGE_TYPES.PING:
          this.handlePing(clientId);
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
          
        case MESSAGE_TYPES.STATE_TRANSITION:
          this.handleStateTransition(clientId, message.payload);
          break;
          
        case MESSAGE_TYPES.REQUEST_INITIAL_STATE:
          this.handleRequestInitialState(clientId);
          break;
          
        default:
          console.warn(`SOCKET: Unknown message type from client ${clientId}: ${message.type}`);
      }
    } catch (error) {
      console.error(`SOCKET: Error handling message from client ${clientId}:`, error);
    }
  }
  
  /**
   * Handle ping request from client
   */
  private handlePing(clientId: string) {
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.PONG,
      payload: {
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Handle pong response from client
   */
  private handlePong(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  }
  
  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string, code?: number, reason?: string) {
    console.log(`SOCKET: Client ${clientId} disconnected. Code: ${code}, Reason: ${reason || 'none'}`);
    
    // Get client info before removing
    const client = this.clients.get(clientId);
    
    // Remove client from clients map
    this.clients.delete(clientId);
    
    // If client was in a session, remove them
    if (client && client.sessionId) {
      this.sessionManager.removePlayer(clientId);
      
      // Notify other players in the session
      this.broadcastToSession(client.sessionId, {
        type: MESSAGE_TYPES.PLAYER_LEFT,
        payload: {
          playerId: clientId,
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle client error
   */
  private handleError(clientId: string, error: Error) {
    console.error(`SOCKET: Error with client ${clientId}:`, error);
  }
  
  /**
   * Handle join lobby request
   */
  private handleJoinLobby(clientId: string, data: any) {
    const { playerName, sessionId } = data;
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`SOCKET: Client ${clientId} not found when joining session`);
      return;
    }
    
    // Store client info
    client.playerName = playerName;
    
    // Default session ID if none provided
    const targetSessionId = sessionId || 'default';
    
    console.log(`SOCKET: Player ${playerName} (${clientId}) joining session ${targetSessionId}`);
    
    // Join or create session
    const session = this.sessionManager.joinSession(targetSessionId, clientId, playerName);
    
    // Store session ID in client info
    client.sessionId = session.id;
    
    // Get the current game state
    const currentGameState = session.getCurrentState();
    
    // Notify player of successful join
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.JOIN_SUCCESS,
      payload: {
        clientId,
        sessionId: session.id,
        gameStatus: currentGameState,
        timestamp: Date.now()
      }
    });
    
    // Notify other players in the session
    this.broadcastToSession(session.id, {
      type: MESSAGE_TYPES.PLAYER_JOINED,
      payload: {
        playerId: clientId,
        playerName,
        timestamp: Date.now()
      }
    }, [clientId]); // Exclude the joining player
    
    // Send initial state to the player
    this.sendInitialState(clientId);
  }
  
  /**
   * Handle player input
   */
  private handlePlayerInput(clientId: string, data: any) {
    // Get client info
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;
    
    // Forward input to game logic
    this.gameLogic.handlePlayerInput(clientId, data);
    
    // Broadcast input to other players in the session
    this.broadcastToSession(client.sessionId, {
      type: MESSAGE_TYPES.PLAYER_INPUT,
      payload: {
        playerId: clientId,
        input: data,
        timestamp: Date.now()
      }
    }, [clientId]); // Exclude the player who sent the input
  }
  
  /**
   * Handle place item request
   */
  private handlePlaceItem(clientId: string, data: any) {
    // Get client info
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;
    
    // Forward to game logic
    const item = this.gameLogic.handlePlaceItem(clientId, data);
    
    if (item) {
      // Broadcast item placement to all players in the session
      this.broadcastToSession(client.sessionId, {
        type: MESSAGE_TYPES.ITEM_PLACED,
        payload: {
          item,
          placedBy: clientId,
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle game start request
   */
  private handleStartGame(clientId: string) {
    // Get client info
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;
    
    // Get session
    const session = this.sessionManager.getSession(client.sessionId);
    if (!session) return;
    
    // Start the game - transition to playing state
    const success = session.transitionTo('playing');
    
    if (success) {
      console.log(`SOCKET: Game session ${session.id} started by player ${clientId}`);
      
      // Notify all players in the session
      this.broadcastToSession(session.id, {
        type: MESSAGE_TYPES.EVENT,
        payload: {
          eventType: 'GAME_STARTED',
          startedBy: clientId,
          sessionId: session.id,
          timestamp: Date.now()
        }
      });
    } else {
      console.warn(`SOCKET: Could not transition to playing state for session ${session.id}`);
      
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
    // Get client info
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;
    
    // Broadcast chat message to all players in the session
    this.broadcastToSession(client.sessionId, {
      type: MESSAGE_TYPES.CHAT_MESSAGE,
      payload: {
        senderId: clientId,
        senderName: client.playerName || 'Unknown',
        message: data.message,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Handle state transition request
   */
  private handleStateTransition(clientId: string, data: any) {
    // Get client info
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;
    
    // Get session
    const session = this.sessionManager.getSession(client.sessionId);
    if (!session) return;
    
    // Attempt to transition to the requested state
    const success = session.transitionTo(data.state);
    
    if (success) {
      console.log(`SOCKET: Game session ${session.id} transitioned to ${data.state} by player ${clientId}`);
      
      // State change event will be broadcast by the game events system
    } else {
      console.warn(`SOCKET: Could not transition to ${data.state} for session ${session.id}`);
      
      // Send error response to client
      this.sendMessage(clientId, {
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot transition to ${data.state} state`,
          timestamp: Date.now()
        }
      });
    }
  }
  
  /**
   * Handle request for initial state
   */
  private handleRequestInitialState(clientId: string) {
    this.sendInitialState(clientId);
  }
  
  /**
   * Send initial state to a client
   */
  private sendInitialState(clientId: string) {
    console.log(`SOCKET: Sending initial state to client ${clientId}`);
    
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // If client is in a session, send that session's state
    if (client.sessionId) {
      const session = this.sessionManager.getSession(client.sessionId);
      if (session) {
        const state = session.getState();
        
        // Send initial state message
        this.sendMessage(clientId, {
          type: MESSAGE_TYPES.INITIAL_STATE,
          payload: {
            clientId: clientId,
            state: state
          }
        });
        return;
      }
    }
    
    // If not in a session, send default state
    this.sendMessage(clientId, {
      type: MESSAGE_TYPES.INITIAL_STATE,
      payload: {
        clientId: clientId,
        state: {
          version: 0,
          timestamp: Date.now(),
          gameStatus: 'tutorial' as GameStatus,
          players: [],
          gameWorld: {
            platforms: [],
            startPoint: { x: 100, y: 100 },
            endPoint: { x: 2320, y: 120 },
            worldBounds: { width: 2560, height: 1440 }
          },
          items: []
        }
      }
    });
  }
  
  /**
   * Send a message to a client
   */
  sendMessage(clientId: string, message: NetworkMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`SOCKET: Error sending message to client ${clientId}:`, error);
      return false;
    }
  }
  
  /**
   * Send a message to all clients in a session
   */
  broadcastToSession(sessionId: string, message: NetworkMessage, excludeClients: string[] = []): void {
    if (!sessionId) {
      console.warn(`SOCKET: Cannot broadcast to session with empty ID`);
      return;
    }
    
    // Get session to verify it exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      console.warn(`SOCKET: Cannot broadcast - session ${sessionId} not found`);
      return;
    }
    
    // Get all players in this session
    const players = this.sessionManager.getSessionPlayers(sessionId);
    
    // Send message to each player
    players.forEach(player => {
      // Skip excluded clients
      if (excludeClients.includes(player.id)) return;
      
      this.sendMessage(player.id, message);
    });
  }
  
  /**
   * Send a message to all connected clients
   */
  broadcastToAll(message: NetworkMessage): void {
    for (const clientId of this.clients.keys()) {
      this.sendMessage(clientId, message);
    }
  }
  
  /**
   * Start ping interval to keep connections alive
   */
  startPingInterval(intervalMs: number): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    
    this.pingIntervalId = setInterval(() => this.pingClients(), intervalMs);
  }
  
  /**
   * Ping all clients to check if they're still connected
   */
  private pingClients(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds
    
    for (const [clientId, client] of this.clients.entries()) {
      // Mark as not alive until we get a pong back
      client.isAlive = false;
      
      try {
        // Send ping
        client.socket.ping();
        
        // Check if client has timed out
        if (now - client.lastMessageTime > timeout) {
          console.log(`SOCKET: Client ${clientId} timed out`);
          client.socket.terminate();
          this.clients.delete(clientId);
        }
      } catch (error) {
        console.error(`SOCKET: Error pinging client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }
  
  /**
   * Start broadcast interval for game state updates
   */
  private startBroadcastInterval(): void {
    if (this.broadcastIntervalId) {
      clearInterval(this.broadcastIntervalId);
    }
    
    this.broadcastIntervalId = setInterval(() => {
      // For each active session, broadcast its state to all clients in that session
      for (const client of this.clients.values()) {
        if (client.sessionId) {
          const session = this.sessionManager.getSession(client.sessionId);
          if (session && session.isActive) {
            this.broadcastGameState(client.sessionId);
          }
        }
      }
    }, this.BROADCAST_INTERVAL);
  }
  
  /**
   * Broadcast the current game state to all clients in a session
   */
  private broadcastGameState(sessionId: string): void {
    // Get session
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;
    
    // Get game state
    const gameState = session.getState();
    
    // Create the network message
    const stateUpdateMessage = {
      type: MESSAGE_TYPES.STATE_UPDATE,
      payload: {
        state: gameState
      }
    };
    
    // Send state update to all clients in the session
    this.broadcastToSession(sessionId, stateUpdateMessage);
  }
  
  /**
   * Shutdown the socket server
   */
  shutdown(): void {
    console.log(`SOCKET: Shutting down socket server`);
    
    // Clear intervals
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    
    if (this.broadcastIntervalId) {
      clearInterval(this.broadcastIntervalId);
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.socket.terminate();
      } catch (error) {
        console.error(`SOCKET: Error terminating client socket:`, error);
      }
    }
    
    // Clear clients map
    this.clients.clear();
  }
}