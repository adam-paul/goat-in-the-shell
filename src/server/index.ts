import express from 'express';
import * as http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { setupServerNetworkManager } from './network';
import { setupPhysicsEngine } from './physics';
import { setupGameStateManager, setupGameInstanceManager } from './game-state';
import { setupGameLogicProcessor } from './logic';

// Constants
const PORT = process.env.SERVER_PORT || 3001;
const CLIENT_PORT = process.env.CLIENT_PORT || 5173; // Default Vite dev server port

// Server setup
const app = express();
app.use(cors({
  origin: `http://localhost:${CLIENT_PORT}`,
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Basic health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Game systems
const gameState = setupGameStateManager();
const gameInstanceManager = setupGameInstanceManager();
const physics = setupPhysicsEngine(gameState);
const gameLogic = setupGameLogicProcessor(gameState, physics);
const networkManager = setupServerNetworkManager(wss, gameState, gameLogic, gameInstanceManager);

// Connection handling
wss.on('connection', (socket, _request) => {
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);
  
  networkManager.handleNewConnection(socket, clientId);

  socket.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    networkManager.handleDisconnection(clientId);
  });
});

// Game update loop
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let lastUpdateTime = Date.now();

function gameLoop() {
  const currentTime = Date.now();
  const deltaTime = currentTime - lastUpdateTime;
  
  // Update all game instances
  gameInstanceManager.updateInstances(deltaTime / 1000); // Convert to seconds
  
  // Schedule next update with timing adjustment to maintain target FPS
  const elapsed = Date.now() - currentTime;
  const delay = Math.max(0, FRAME_TIME - elapsed);
  
  setTimeout(gameLoop, delay);
  
  lastUpdateTime = currentTime;
}

// Start the server
server.listen(PORT, () => {
  console.log(`🎮 Game server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running at ws://localhost:${PORT}`);
  
  // Start game loop
  gameLoop();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close();
  server.close();
  process.exit(0);
});

export { server, wss };