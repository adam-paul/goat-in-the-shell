import { WebSocketServer } from 'ws';
import http from 'http';
import { createSocketServer } from './network';
import { setupGameStateManager, setupGameInstanceManager } from './game-state';
import { GameLogicProcessor } from './logic';
import { setupPhysicsEngine } from './physics';
import { gameEvents } from './game-state/GameEvents';

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Create game managers
const gameState = setupGameStateManager();
const instanceManager = setupGameInstanceManager();
const physics = setupPhysicsEngine(gameState);
const gameLogic = new GameLogicProcessor(gameState, physics);

// Set up physics-state synchronization
let lastUpdateTime = Date.now();
const PHYSICS_UPDATE_RATE = 16; // ~60fps
setInterval(() => {
  const now = Date.now();
  const deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;
  
  // Update game instances
  instanceManager.updateInstances(deltaTime);
}, PHYSICS_UPDATE_RATE);

// Set up event handling for game events
gameEvents.subscribe<{
  playerId: string;
  cause: string;
  position: { x: number; y: number };
  timestamp: number;
}>('PLAYER_DEATH', (data) => {
  console.log(`SERVER: Player ${data.playerId} died from ${data.cause}`);
  
  // Find which instance the player belongs to
  const instance = instanceManager.getInstanceByPlayer(data.playerId);
  if (instance) {
    // The socket server will handle the notification
    console.log(`SERVER: Death event in instance ${instance.id}`);
  }
});

gameEvents.subscribe<{
  playerId: string;
  position: { x: number; y: number };
  timestamp: number;
}>('PLAYER_WIN', (data) => {
  console.log(`SERVER: Player ${data.playerId} won!`);
  
  // Find which instance the player belongs to
  const instance = instanceManager.getInstanceByPlayer(data.playerId);
  if (instance) {
    // The socket server will handle the notification
    console.log(`SERVER: Win event in instance ${instance.id}`);
  }
});

// Initialize socket server
const socketServer = createSocketServer(wss, gameState, gameLogic, instanceManager);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER: WebSocket server running on port ${PORT}`);
  
  // Setup game world parameters
  physics.updateParameters({
    gravity: 0.9,
    dart_speed: 5,
    dart_frequency: 3000 // 3 seconds between dart firings
  });
  
  console.log(`SERVER: Physics engine initialized`);
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