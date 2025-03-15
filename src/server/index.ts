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

// Define types for events
interface PlayerDeathEvent {
  playerId: string;
  cause: string;
  position: { x: number; y: number };
  timestamp: number;
  instanceId?: string; // Added instanceId
}

interface PlayerWinEvent {
  playerId: string;
  position: { x: number; y: number };
  timestamp: number;
  instanceId?: string; // Added instanceId
}

interface GameStateChangedEvent {
  previousState: string;
  currentState: string;
  instanceId: string;
  timestamp: number;
}

interface PhysicsActivateEvent {
  instanceId: string;
  timestamp: number;
}

interface StartCountdownEvent {
  instanceId: string;
  duration: number;
  timestamp: number;
}

// Set up event handling for game events
gameEvents.subscribe<PlayerDeathEvent>('PLAYER_DEATH', (data) => {
  console.log(`SERVER: Player ${data.playerId} died from ${data.cause}`);
  
  // Find which instance the player belongs to
  const instance = instanceManager.getInstanceByPlayer(data.playerId);
  if (instance) {
    // Update instance data with death info
    data.instanceId = instance.id;
    
    // The state machine will handle the state transition
    // The socket server will handle the notification
    console.log(`SERVER: Death event in instance ${instance.id}`);
  }
});

gameEvents.subscribe<PlayerWinEvent>('PLAYER_WIN', (data) => {
  console.log(`SERVER: Player ${data.playerId} won!`);
  
  // Find which instance the player belongs to
  const instance = instanceManager.getInstanceByPlayer(data.playerId);
  if (instance) {
    // Update instance data with instance ID
    data.instanceId = instance.id;
    
    // The state machine will handle the state transition
    // The socket server will handle the notification
    console.log(`SERVER: Win event in instance ${instance.id}`);
  }
});

// Listen for game state changes
gameEvents.subscribe<GameStateChangedEvent>('GAME_STATE_CHANGED', (data) => {
  console.log(`SERVER: Game state changed: ${data.previousState} -> ${data.currentState} for instance ${data.instanceId}`);
  
  // Additional server-side actions based on state transitions could be added here
});

// Listen for physics activation events from the state machine
gameEvents.subscribe<PhysicsActivateEvent>('PHYSICS_ACTIVATE', (data) => {
  console.log(`SERVER: Physics activated for instance ${data.instanceId}`);
  
  // Find the instance and mark it as active for physics updates
  const instance = instanceManager.getInstance(data.instanceId);
  if (instance) {
    instance.isActive = true;
    instance.startTime = Date.now();
  }
});

// Listen for countdown events
gameEvents.subscribe<StartCountdownEvent>('START_COUNTDOWN', (data) => {
  console.log(`SERVER: Countdown started for instance ${data.instanceId}, duration ${data.duration}ms`);
  
  // The socket server will forward this to clients
  // This could trigger visual/audio countdown on clients
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