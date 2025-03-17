import { WebSocketServer } from 'ws';
import http from 'http';
import { createSocketServer } from './network';
import { GameLogicProcessor } from './logic';
import { gameEvents } from './game-state/GameEvents';
import { setupGameSessionManager } from './game-state/GameSessionManager';
import { Vector2D } from '../shared/types';

// Define types for events
interface PlayerDeathEvent {
  playerId: string;
  cause: string;
  position: Vector2D;
  timestamp: number;
  instanceId?: string;
}

interface PlayerWinEvent {
  playerId: string;
  position: Vector2D;
  timestamp: number;
  instanceId?: string;
}

interface GameStateChangedEvent {
  previousState: string;
  currentState: string;
  instanceId: string;
  timestamp: number;
}

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Create the game session manager
const sessionManager = setupGameSessionManager();
console.log(`SERVER: Created GameSessionManager`);

// Initialize game logic processor
const gameLogic = new GameLogicProcessor({});
console.log(`SERVER: Created GameLogicProcessor`);

// Set up session update loop
let lastUpdateTime = Date.now();
const PHYSICS_UPDATE_RATE = 16; // ~60fps
setInterval(() => {
  const now = Date.now();
  const deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;
  
  // Update all game sessions
  sessionManager.updateSessions(deltaTime);
}, PHYSICS_UPDATE_RATE);

// Set up event handling for game events
gameEvents.subscribe<PlayerDeathEvent>('PLAYER_DEATH', (data) => {
  console.log(`SERVER: Player ${data.playerId} died from ${data.cause}`);
  
  // Find which session the player belongs to
  const session = sessionManager.getPlayerSession(data.playerId);
  if (session) {
    // Update event data with session ID
    data.instanceId = session.id;
    
    console.log(`SERVER: Death event in session ${session.id}`);
  }
});

gameEvents.subscribe<PlayerWinEvent>('PLAYER_WIN', (data) => {
  console.log(`SERVER: Player ${data.playerId} won!`);
  
  // Find which session the player belongs to
  const session = sessionManager.getPlayerSession(data.playerId);
  if (session) {
    // Update event data with session ID
    data.instanceId = session.id;
    
    console.log(`SERVER: Win event in session ${session.id}`);
  }
});

// Listen for game state changes
gameEvents.subscribe<GameStateChangedEvent>('GAME_STATE_CHANGED', (data) => {
  console.log(`SERVER: Game state changed: ${data.previousState} -> ${data.currentState} for session ${data.instanceId}`);
});

// Initialize socket server
const socketServer = createSocketServer(wss, sessionManager, gameLogic);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER: WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('SERVER: Shutting down...');
  socketServer.shutdown();
  server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);