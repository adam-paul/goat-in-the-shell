import { WebSocketServer } from 'ws';
import http from 'http';
import { createSocketServer } from './network';
import { GameLogicProcessor } from './logic';
import { setupGameSessionManager } from './game-state/GameSessionManager';

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
