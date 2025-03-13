import { WebSocketServer } from 'ws';
import http from 'http';
import { createSocketServer } from './network';
import { GameStateManager } from './game-state';
import { GameLogicProcessor } from './logic';
import { PhysicsEngine } from './physics';
import { GameInstanceManager } from './game-state/GameInstanceManager';

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Create game managers
const gameState = new GameStateManager();
const physics = new PhysicsEngine(gameState);
const gameLogic = new GameLogicProcessor(gameState, physics);
const instanceManager = new GameInstanceManager();

// Initialize socket server
const socketServer = createSocketServer(wss, gameState, gameLogic, instanceManager);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER: WebSocket server running on port ${PORT}`);
});