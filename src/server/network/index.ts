import { WebSocketServer, WebSocket } from 'ws';
import { GameStateManager } from '../game-state';
import { GameLogicProcessor } from '../logic';
import { ServerNetworkListener } from './ServerNetworkListener';
import { ServerNetworkMessenger } from './ServerNetworkMessenger';

// Interface for managing client connections
interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastMessageTime: number;
}

class ServerNetworkManager {
  // WebSocket server instance
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _wss: WebSocketServer;
  private clients: Map<string, ClientConnection>;
  private listener: ServerNetworkListener;
  private messenger: ServerNetworkMessenger;
  
  constructor(
    wss: WebSocketServer, 
    gameState: GameStateManager, 
    gameLogic: GameLogicProcessor
  ) {
    this._wss = wss;
    this.clients = new Map();
    
    this.listener = new ServerNetworkListener(gameState, gameLogic);
    this.messenger = new ServerNetworkMessenger();
    
    // Set up ping interval to check for disconnected clients
    setInterval(this.pingClients.bind(this), 30000);
  }
  
  handleNewConnection(socket: WebSocket, clientId: string): void {
    // Register the new client
    this.clients.set(clientId, {
      id: clientId,
      socket,
      isAlive: true,
      lastMessageTime: Date.now()
    });
    
    // Setup message handling for this client
    socket.on('message', (data: Buffer) => {
      const client = this.clients.get(clientId);
      if (!client) return;
      
      client.lastMessageTime = Date.now();
      client.isAlive = true;
      
      try {
        const message = JSON.parse(data.toString());
        this.listener.handleMessage(message, clientId);
      } catch (err) {
        console.error(`Error processing message from client ${clientId}:`, err);
      }
    });
    
    socket.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) client.isAlive = true;
    });
    
    // Send initial game state to new client
    this.messenger.sendInitialState(socket, clientId);
  }
  
  handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    this.clients.delete(clientId);
    
    // Notify other systems about the disconnection
    this.listener.handleClientDisconnect(clientId);
  }
  
  broadcastToAll(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    });
  }
  
  sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return false;
    
    client.socket.send(JSON.stringify(message));
    return true;
  }
  
  private pingClients(): void {
    const now = Date.now();
    
    this.clients.forEach((client, clientId) => {
      // Check if client hasn't responded to previous ping
      if (!client.isAlive) {
        client.socket.terminate();
        this.clients.delete(clientId);
        this.listener.handleClientDisconnect(clientId);
        return;
      }
      
      // Check if client has been inactive for too long (5 minutes)
      if (now - client.lastMessageTime > 5 * 60 * 1000) {
        client.socket.terminate();
        this.clients.delete(clientId);
        this.listener.handleClientDisconnect(clientId);
        return;
      }
      
      // Mark as not alive until we get pong response
      client.isAlive = false;
      client.socket.ping();
    });
  }
}

export function setupServerNetworkManager(
  wss: WebSocketServer,
  gameState: GameStateManager,
  gameLogic: GameLogicProcessor
): ServerNetworkManager {
  return new ServerNetworkManager(wss, gameState, gameLogic);
}

export { ServerNetworkManager, ServerNetworkListener, ServerNetworkMessenger };