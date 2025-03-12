import { WebSocketServer, WebSocket } from 'ws';
import { GameStateManager } from '../game-state';
import { GameLogicProcessor } from '../logic';
import { ServerNetworkListener, NetworkMessage } from './ServerNetworkListener';
import { ServerNetworkMessenger } from './ServerNetworkMessenger';
import { randomUUID } from 'crypto';

// Interface for managing client connections
interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastMessageTime: number;
}

/**
 * Main network coordinator - responsible for:
 * - Setting up the WebSocket server
 * - Managing client connections 
 * - Creating instances of listener and messenger
 * - Delegating message handling and sending to the appropriate components
 */
function setupNetworking(
  wss: WebSocketServer,
  gameState: GameStateManager,
  gameLogic: GameLogicProcessor
): { 
  listener: ServerNetworkListener, 
  messenger: ServerNetworkMessenger 
} {
  const clients = new Map<string, ClientConnection>();
  const listener = new ServerNetworkListener(gameState, gameLogic);
  const messenger = new ServerNetworkMessenger();
  
  // Set up ping interval to check for disconnected clients
  setInterval(() => pingClients(clients, listener), 30000);
  
  // Set up WebSocketServer connection handler
  wss.on('connection', (socket: WebSocket) => {
    const clientId = randomUUID();
    
    // Register the new client
    clients.set(clientId, {
      id: clientId,
      socket,
      isAlive: true,
      lastMessageTime: Date.now()
    });
    
    // Set up all socket event listeners
    listener.setupSocketListeners(socket, clientId, clients);
    
    // Send initial game state to new client
    messenger.sendInitialState(socket, clientId);
  });
  
  return { listener, messenger };
}

/**
 * Ping all clients to check for disconnections
 */
function pingClients(
  clients: Map<string, ClientConnection>, 
  listener: ServerNetworkListener
): void {
  const now = Date.now();
  
  clients.forEach((client, clientId) => {
    // Check if client hasn't responded to previous ping
    if (!client.isAlive) {
      client.socket.terminate();
      clients.delete(clientId);
      listener.handleClientDisconnect(clientId);
      return;
    }
    
    // Check if client has been inactive for too long (5 minutes)
    if (now - client.lastMessageTime > 5 * 60 * 1000) {
      client.socket.terminate();
      clients.delete(clientId);
      listener.handleClientDisconnect(clientId);
      return;
    }
    
    // Mark as not alive until we get pong response
    client.isAlive = false;
    client.socket.ping();
  });
}

export { setupNetworking, ServerNetworkListener, ServerNetworkMessenger, NetworkMessage };