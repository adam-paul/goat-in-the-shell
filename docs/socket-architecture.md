# WebSocket Architecture Documentation

This document provides an overview of the WebSocket architecture used in the Goat in the Shell project. The architecture is designed to provide real-time communication between client and server with a focus on simplicity, maintainability, and type safety.

## Architecture Overview

The WebSocket architecture consists of three main parts:

1. **Client-side Socket Implementation**: Handles WebSocket connection and message sending
2. **Event Bus System**: Provides communication between game components
3. **Server-side Socket Implementation**: Handles client connections and game state management

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Components     │   Game Components     │    Server       │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│                │     │                │     │                │
│  SocketProvider│     │  GameEventBus  │     │  SocketServer  │
│                │     │                │     │                │
└────────┬───────┘     └───────▲────────┘     └────────┬───────┘
         │                     │                       │
         │    ┌───────────┐    │                       │
         └────► SocketEvents ──┘                       │
              └───────────┘                            │
                    │                                  │
                    └──────────►WebSockets◄────────────┘
```

## Client-Side Implementation

### 1. SocketProvider (src/client/network/SocketProvider.tsx)

The `SocketProvider` is a React context provider that manages the WebSocket connection and exposes methods for sending messages to the server.

**Key responsibilities:**
- Establish and maintain WebSocket connection
- Provide connection status to components
- Send messages to the server
- Handle reconnection logic (when implemented)
- Initiate ping messages every 30 seconds to keep the connection alive

**Usage example:**
```tsx
// In a component
import { useSocket } from '../network';

function MyComponent() {
  const socket = useSocket();
  
  // Check connection status
  if (socket.connected) {
    console.log('Connected to server');
  }
  
  // Send a message
  socket.sendMessage('CUSTOM_EVENT', { data: 'value' });
  
  // Use specialized methods
  socket.sendPlayerInput({ left: true, jump: true });
  socket.sendPlaceItem('platform', 100, 200);
  
  return <div>Socket status: {socket.connected ? 'Connected' : 'Disconnected'}</div>
}
```

### 2. SocketEvents (src/client/network/SocketEvents.ts)

The `SocketEvents` class serves as a bridge between WebSocket messages and the GameEventBus, forwarding all incoming messages to the appropriate event channels.

**Key responsibilities:**
- Process incoming WebSocket messages
- Convert network messages to event bus messages
- Forward all messages to GameEventBus
- Handle special cases like game state transitions

**Implementation:**
```typescript
// Inside SocketEvents class
private forwardToGameEventBus(message: NetworkMessage): void {
  const { type, payload } = message;
  
  // Forward message to GameEventBus (with special case handling)
  gameEvents.publish(type, payload);
}
```

### 3. Network Exports (src/client/network/index.ts)

The `index.ts` file exports the SocketProvider and hook for using the socket system.

**Usage:**
```tsx
import { SocketProvider, useSocket } from './network';

// Use SocketProvider at the app root
ReactDOM.render(
  <SocketProvider>
    <App />
  </SocketProvider>,
  document.getElementById('root')
);
```

## Event Bus System

The Event Bus system serves as the central communication channel for all components in the application. Both client and server use consistent implementations.

### Client-side: GameEventBus (src/client/utils/GameEventBus.ts)

The `GameEventBus` provides a type-safe pub/sub system for communication between client-side components.

**Key responsibilities:**
- Serve as the single event bus for all client components
- Provide type-safe event subscription and publishing
- Connect WebSocket messages to application components through SocketEvents

**Usage example:**
```tsx
// Publishing events
import { gameEvents } from '../utils/GameEventBus';

// Publish an event with data
gameEvents.publish('PLAYER_MOVE', { x: 100, y: 200 });

// Subscribing to events
import { gameEvents } from '../utils/GameEventBus';

// In a React component
useEffect(() => {
  // Subscribe with type information
  const unsubscribe = gameEvents.subscribe<{x: number, y: number}>(
    'PLAYER_MOVE', 
    (position) => {
      console.log('Player moved to:', position.x, position.y);
    }
  );
  
  return unsubscribe; // Clean up subscription
}, []);
```

### Server-side: GameEventBus (src/server/game-state/GameEvents.ts)

The server-side `GameEventBus` provides the same pub/sub system as the client side, but for server components.

**Key responsibilities:**
- Enable communication between server modules
- Provide type-safe event subscription and publishing
- Maintain consistent API with client implementation

**Implementation:**
```typescript
// Server-side event bus using publish (same as client)
publish<T>(event: string, data: T): void {
  console.log(`GameEventBus: Publishing server event '${event}'`, data);
  if (!this.listeners[event]) return;
  this.listeners[event].forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in server event handler for ${event}:`, error);
    }
  });
}
```

## Server-Side Implementation

### 1. SocketServer (src/server/network/SocketServer.ts)

The `SocketServer` class handles WebSocket connections on the server side and integrates with game state, game logic, and game instance management.

**Key responsibilities:**
- Accept and manage WebSocket connections
- Route messages to appropriate handlers
- Track client connections
- Monitor connection health
- Broadcast messages to clients
- Respond to ping messages with pong
- Integrate with game state and logic

### 2. Network Exports (src/server/network/index.ts)

The `index.ts` file exports the SocketServer and utility functions.

**Usage:**
```typescript
import { createSocketServer } from './network';
import { WebSocketServer } from 'ws';

// Create WebSocket server instance
const wss = new WebSocketServer({ server: httpServer });

// Create socket server
const socketServer = createSocketServer(wss, gameState, gameLogic, instanceManager);
```

## Ping-Pong Mechanism

The WebSocket connection is kept alive through a simple ping-pong mechanism:

1. **Client initiates**: The client sends a ping message every 30 seconds
2. **Server responds**: The server responds with a pong message
3. **Monitoring**: The server tracks the last activity time of each client
4. **Timeout**: Clients that don't send any messages for 5 minutes are disconnected

```
Client                        Server
  │                             │
  │          PING               │
  │ ───────────────────────────►│
  │                             │
  │          PONG               │
  │ ◄───────────────────────────│
  │                             │
```

## Message Format

All messages follow a consistent format using a standardized structure. The `payload` field is used exclusively for message data:

```typescript
interface NetworkMessage {
  type: string;       // The message type (e.g., 'PLAYER_INPUT', 'STATE_UPDATE')
  payload?: any;      // The message payload data
  timestamp?: number; // Optional timestamp
}
```

**Important note:** Always use the `payload` field for message data. The legacy `data` field has been removed from the interface to maintain consistency throughout the codebase.

## How to Communicate with the WebSocket Architecture

### From React Components

React components should use the `useSocket` hook to send messages and check connection status:

```typescript
import { useSocket } from '../network';

function MyComponent() {
  const socket = useSocket();
  
  // To send a message:
  const handleSendMessage = () => {
    socket.sendMessage('CUSTOM_EVENT', { data: 'value' });
  };
  
  // To check connection status:
  const isConnected = socket.connected;
  
  // To handle user joining a lobby:
  const handleJoinLobby = (lobbyId: string) => {
    socket.connect('Player1', lobbyId);
  };
}
```

### From Game Components (Phaser, etc.)

Game components should use the `GameEventBus` to communicate:

```typescript
import { gameEvents } from '../utils/GameEventBus';

// Subscribe to events
const unsubscribe = gameEvents.subscribe('PLAYER_INPUT', (input) => {
  // Handle player input in the game
  updatePlayerPosition(input);
});

// Publish events
gameEvents.publish('PLAYER_POSITION_CHANGED', { x: 100, y: 200 });

// Clean up when done
unsubscribe();
```

### From Server Components

Server components should use the SocketServer's methods:

```typescript
// Send message to specific client
socketServer.sendMessage(clientId, {
  type: 'STATE_UPDATE',
  payload: gameState
});

// Broadcast to all clients in a lobby
socketServer.broadcastToLobby(lobbyId, {
  type: 'CHAT_MESSAGE',
  payload: {
    senderId: clientId,
    message: 'Hello everyone!'
  }
});

// Broadcast to all clients in a game instance
socketServer.broadcastToInstance(instanceId, {
  type: 'GAME_STARTED',
  payload: {
    startTime: Date.now()
  }
});
```

## Best Practices

1. **Use a single event system**: Always use GameEventBus for all client-side communication. Avoid creating parallel event systems using DOM CustomEvents or other patterns.

2. **Clean up event subscriptions**: Always clean up event subscriptions when components unmount to prevent memory leaks.

3. **Use typed event data**: Use the `subscribe<T>()` method with explicit types to ensure type safety.

4. **Handle connection errors** gracefully with appropriate UI feedback.

5. **Follow the correct communication path**:
   - React UI components → `useSocket` hook for sending messages to server
   - All components → `gameEvents.subscribe` for receiving events 
   - All components → `gameEvents.publish` for sending events locally
   - Server components → `gameEvents.publish` for server events
   - Server components → `socketServer` methods for network communication

6. **Standardize message format**: Always use the `payload` property for message data, never use alternatives like `data`.

7. **Keep message types in a central location**: Use MESSAGE_TYPES from constants for consistency.

8. **Always include a timestamp** with messages for better debugging and state management.

## Integration with Game State

The WebSocket architecture integrates with the game state through the GameStateManager, GameLogicProcessor, and GameInstanceManager on the server side. The client side uses the Zustand store (gameStore) to maintain local state.

## Future Improvements

Potential future improvements to the WebSocket architecture:

1. Implement automatic reconnection logic
2. Add message compression for large game state updates
3. Implement message acknowledgments for critical operations
4. Add message queuing for offline/reconnection scenarios
5. Implement WebSocket message rate limiting to prevent abuse