# WebSocket Architecture Documentation

This document provides an overview of the WebSocket architecture used in the Goat in the Shell project. The architecture is designed to provide real-time communication between client and server with a focus on simplicity, maintainability, and type safety.

## Architecture Overview

The WebSocket architecture consists of three main parts:

1. **Client-side Socket Implementation**: Handles WebSocket connection and message sending
2. **Event Bus System**: Provides communication between game components and to server
3. **Server-side Socket Implementation**: Handles client connections and game state management

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Components     │   Game Components     │    Server       │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         └──────────┬────────────┘                       │
                    ▼                                    ▼
            ┌───────────────┐                    ┌───────────────┐
            │               │                    │               │
            │  GameEventBus │                    │  SocketServer │
            │               │                    │               │
            └───┬───────────┘                    └───────┬───────┘
                │                                        │
                ▼                                        │
         ┌──────────────┐                                │
         │              │                                │
         │SocketProvider│◄───────────WebSockets─────────►│
         │              │                                │
         └──────────────┘                                │
```

This new architecture follows an event-driven approach where:

1. All client components publish to the central GameEventBus
2. SocketProvider subscribes to relevant events and handles server communication
3. All client-side subscribers get events for local updates
4. Server processes inputs and broadcasts state updates

## Client-Side Implementation

### 1. SocketProvider (src/client/network/SocketProvider.tsx)

The `SocketProvider` is a React context provider that manages the WebSocket connection and handles client-server communication based on events from the GameEventBus.

**Key responsibilities:**
- Establish and maintain WebSocket connection
- Provide connection status to components
- Subscribe to GameEventBus events (like PLAYER_INPUT, ITEM_PLACEMENT)
- Send messages to the server based on those events
- Handle reconnection logic (when implemented)
- Initiate ping messages every 30 seconds to keep the connection alive

**Implementation:**
```tsx
// In SocketProvider.tsx
// Set up event listeners for game events
useEffect(() => {
  // This handler listens for PLAYER_INPUT events and sends them to server
  const handlePlayerInput = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendPlayerInput(data);
    }
  };
  
  // This handler listens for ITEM_PLACEMENT events and sends them to server
  const handleItemPlacement = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendPlaceItem(data.type, data.x, data.y);
    }
  };
  
  // Subscribe to events
  const unsubInput = gameEvents.subscribe('PLAYER_INPUT', handlePlayerInput);
  const unsubPlacement = gameEvents.subscribe('ITEM_PLACEMENT', handleItemPlacement);
  
  // Clean up subscriptions when component unmounts
  return () => {
    unsubInput();
    unsubPlacement();
  };
}, []);
```

**Usage example:**
```tsx
// In a component - for checking status only, NOT for direct sending!
import { useSocket } from '../network';

function MyComponent() {
  const socket = useSocket();
  
  // Check connection status
  if (socket.connected) {
    console.log('Connected to server');
  }
  
  // Get the connection status for UI
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

The Event Bus system serves as the central communication hub for all components in the application, including client-server communication. Both client and server use consistent implementations.

### Client-side: GameEventBus (src/client/utils/GameEventBus.ts)

The `GameEventBus` provides a type-safe pub/sub system that acts as the core of our event-driven architecture.

**Key responsibilities:**
- Serve as the single event bus for all client components
- Route events to both client-side components AND the SocketProvider for server communication
- Provide type-safe event subscription and publishing
- Connect WebSocket messages to application components through SocketEvents
- Enable a clean, decoupled architecture with separation of concerns

**Usage example:**
```tsx
// Publishing events from input components
import { gameEvents } from '../utils/GameEventBus';

// In an input handler
const handleKeyDown = (event: KeyboardEvent) => {
  // Create standardized input data
  const inputData = {
    left: event.code === 'ArrowLeft',
    right: event.code === 'ArrowRight',
    jump: event.code === 'Space',
    timestamp: Date.now()
  };
  
  // Publish to GameEventBus - this will go to BOTH:
  // 1. Local components (like Phaser scene) for immediate visual feedback
  // 2. SocketProvider for sending to server
  gameEvents.publish('PLAYER_INPUT', inputData);
};

// Subscribing to events in a game component
useEffect(() => {
  // Subscribe with type information
  const unsubscribe = gameEvents.subscribe<{x: number, y: number}>(
    'PLAYER_POSITION_UPDATE', 
    (position) => {
      // Update local rendering based on position
      updatePlayerSprite(position.x, position.y);
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

## Event-Driven Architecture for Client Communication

Our architecture follows a consistent event-driven pattern for both user input and item placement. This section outlines the general approach and specific implementations.

### General Pattern

All client-side communication follows this pattern:

1. **Input Detection**: UI/Input component detects user action
2. **Event Publication**: Component publishes standardized event to GameEventBus
3. **Multiple Subscribers**:
   - Game rendering components subscribe for immediate visual feedback
   - SocketProvider subscribes for sending to server
   - Other components subscribe as needed

This pattern ensures:
- Separation of concerns
- Single source of truth
- No duplicate network messages
- Consistent architecture

### Player Input Flow Example

```typescript
// 1. In InputHandler.ts - Detect keyboard input
const handleKeyDown = (event: KeyboardEvent) => {
  // Format standardized input data
  const inputData = {
    left: event.code === 'ArrowLeft',
    right: event.code === 'ArrowRight',
    jump: event.code === 'Space',
    timestamp: Date.now()
  };
  
  // Publish to GameEventBus
  gameEvents.publish('PLAYER_INPUT', inputData);
};

// 2. In BasicGameScene.ts - Subscribe for visual feedback
gameEvents.subscribe('PLAYER_INPUT', (data) => {
  // Update player sprite for immediate feedback
  handlePlayerMovement(data);
});

// 3. In SocketProvider.tsx - Subscribe to send to server
gameEvents.subscribe('PLAYER_INPUT', (data) => {
  if (socketRef.current?.readyState === WebSocket.OPEN) {
    sendPlayerInput(data);
  }
});
```

### Item Placement Flow Example

```typescript
// 1. In BasicGameScene.ts - Detect placement click
this.input.on('pointerdown', (pointer) => {
  if (this.itemPlacementMode) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    // Publish item placement event
    gameEvents.publish('ITEM_PLACEMENT', {
      type: this.itemToPlace,
      x: worldPoint.x,
      y: worldPoint.y
    });
  }
});

// 2. In gameStore.ts - Subscribe to update UI state
gameEvents.subscribe('ITEM_PLACEMENT', (data) => {
  // Update game store state and publish follow-up events
  store.handlePlaceItem(data.x, data.y);
});

// 3. In GameRenderer.tsx - Subscribe for visual feedback
gameEvents.subscribe('ITEM_PLACEMENT', (data) => {
  // Show immediate visual feedback
  updateRendering(data);
});

// 4. In SocketProvider.tsx - Subscribe to send to server
gameEvents.subscribe('ITEM_PLACEMENT', (data) => {
  if (socketRef.current?.readyState === WebSocket.OPEN) {
    sendPlaceItem(data.type, data.x, data.y);
  }
});
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

5. **Follow the correct event-driven communication path**:
   - Input components → `gameEvents.publish` for publishing user actions
   - SocketProvider → `gameEvents.subscribe` for sending to server
   - Game components → `gameEvents.subscribe` for visual/local updates
   - All components → `gameEvents.publish` for sending events locally
   - Server components → `gameEvents.publish` for server events
   - Server components → `socketServer` methods for network communication
   - **Never** directly call socket.send* methods from UI components

6. **Standardize message format**: Always use the `payload` property for message data, never use alternatives like `data`.

7. **Keep message types in a central location**: Use MESSAGE_TYPES from constants for consistency.

8. **Always include a timestamp** with messages for better debugging and state management.

9. **Maintain consistent event-driven pattern**: Apply the same pattern to all types of user input (keyboard, mouse, item placement, etc).

10. **Format data before publishing**: Format standardized data objects in the component that detects the input before publishing to GameEventBus.

## Integration with Game State

The WebSocket architecture integrates with the game state through the GameStateManager, GameLogicProcessor, and GameInstanceManager on the server side. The client side uses the Zustand store (gameStore) to maintain local state.

## Future Improvements

Potential future improvements to the WebSocket architecture:

1. Implement automatic reconnection logic
2. Add message compression for large game state updates
3. Implement message acknowledgments for critical operations
4. Add message queuing for offline/reconnection scenarios
5. Implement WebSocket message rate limiting to prevent abuse