# Input Handling Architecture

This document outlines the input handling architecture for Goat in the Shell, focusing on how player inputs are processed, how they affect game state, and how state updates are broadcasted to clients.

## Architectural Overview

The input handling system follows these key principles:

1. **Separation of Concerns**: Clear separation between input handling, physics processing, and state broadcasting
2. **Single Responsibility**: Each component has a focused role in the pipeline
3. **Resource Efficiency**: Avoid redundant operations and excessive network traffic
4. **Consistency**: Provide predictable, regular state updates regardless of input frequency
5. **Event-driven Communication**: Components communicate through a central event bus

The architecture consists of these main components that work together:

### Client-side Architecture

```
┌───────────────┐                                 ┌───────────────┐
│               │                                 │               │
│  Input Handler│───┐                        ┌────▶│ Game Renderer │
│               │   │                        │    │               │
└───────────────┘   │    ┌───────────────┐   │    └───────────────┘
                    └────▶               │   │    
                         │ GameEventBus  │───┤    ┌───────────────┐
                    ┌────▶               │   │    │               │
┌───────────────┐   │    └───────────────┘   └────▶│ SocketProvider│
│               │   │                              │               │
│   UI/Scene    │───┘                              └───────────────┘
│               │                                         │
└───────────────┘                                         ▼
                                                    To Server
```

### Server-side Pipeline

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│               │      │               │      │               │
│  Input Handler│─────▶│ Physics Engine│─────▶│State Broadcast│
│               │      │               │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
```

## Implementation Details

### 1. Input Handling (SocketServer.handlePlayerInput)

The input handler's sole responsibility is to update the player's input state:

- Receives input events from clients via WebSocket
- Validates input format and player state
- Updates the player's input state in the game instance
- Does NOT create any intervals or trigger state broadcasts
- Does NOT process physics or state changes directly

```typescript
private handlePlayerInput(clientId: string, data: any) {
  // Get instance from player registry and perform validation
  
  // Apply input using the instance's state manager - just update the input state
  // The main physics loop will handle the actual physics updates
  instance.state.applyPlayerInput(data, clientId);
  
  // No direct broadcasting or interval creation here
}
```

### 2. Physics Processing (GameInstanceManager.updateInstances)

The physics loop runs at a fixed interval (typically 16ms for 60fps) and is responsible for:

- Processing physics for all active game instances
- Applying forces based on player input states
- Updating game state based on physics results
- Running collision detection and game logic

```typescript
// In server/index.ts
setInterval(() => {
  const deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;
  
  // Update all game instances (physics is handled per-instance)
  instanceManager.updateInstances(deltaTime);
}, PHYSICS_UPDATE_RATE);
```

### 3. State Broadcasting (SocketServer.startFixedBroadcastInterval)

A separate broadcasting system runs at a consistent interval (100ms) and is responsible for:

- Broadcasting current game state to clients
- Ensuring consistent update frequency regardless of input
- Filtering broadcasts to only active instances with players

```typescript
private startFixedBroadcastInterval(): void {
  // Set up a regular interval to broadcast state updates
  this.fixedBroadcastIntervalId = setInterval(() => {
    // Get all active game instances
    const instances = this.instanceManager.getAllInstances();
    
    // Only broadcast for active instances with players
    instances.forEach(instance => {
      if (instance.isActive && instance.stateMachine.isGameplayActive()) {
        const players = this.playerRegistry.getInstancePlayers(instance.id);
        
        if (players.length > 0) {
          this.broadcastGameState(instance);
        }
      }
    });
  }, this.BROADCAST_INTERVAL);
}
```

## Client-Side Implementation

### 1. Input Handler (InputHandler.ts)

The InputHandler's responsibility is to detect and process user inputs:

- Captures keyboard events (keydown, keyup)
- Formats standardized input objects
- Publishes input events to the GameEventBus
- Does NOT directly send data to server
- Handles command input focus states

```typescript
// In InputHandler.ts
const sendInputToServer = () => {
  if (!hasInputChanged()) return;
  
  // Create standardized input object
  const inputToSend = {
    left: inputState.left,
    right: inputState.right,
    jump: isJumping,
    timestamp: Date.now()
  };
  
  // Publish to GameEventBus for both rendering AND server communication
  gameEvents.publish('PLAYER_INPUT', inputToSend);
};
```

### 2. Game Event Bus (GameEventBus.ts)

The GameEventBus serves as the central communication system:

- Provides a publish/subscribe mechanism
- Routes events to all interested components
- Decouples event producers from consumers
- Maintains type safety with generic handlers

```typescript
// In GameEventBus.ts
export class GameEventBus {
  private listeners: Record<string, Listener[]> = {};

  subscribe<T>(event: string, callback: Listener<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback as Listener);
    return () => this.unsubscribe(event, callback as Listener);
  }

  publish<T>(event: string, data: T): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}
```

### 3. Socket Provider (SocketProvider.tsx)

The SocketProvider handles all network communication:

- Subscribes to relevant GameEventBus events
- Sends formatted messages to the server
- Manages the WebSocket connection
- Provides socket methods to the application

```typescript
// In SocketProvider.tsx
useEffect(() => {
  // This handler listens for PLAYER_INPUT events and sends them to server
  const handlePlayerInput = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendPlayerInput(data);
    }
  };
  
  // Subscribe to player input events
  const unsubscribe = gameEvents.subscribe('PLAYER_INPUT', handlePlayerInput);
  
  // Clean up subscription when component unmounts
  return () => {
    unsubscribe();
  };
}, []);
```

### 4. Game Renderer (BasicGameScene.ts)

The Game Renderer visualizes game state:

- Subscribes to PLAYER_INPUT events for immediate visual feedback
- Applies local animations and effects
- Creates responsive feel without waiting for server
- Maintains synchronized state with server updates

```typescript
// In BasicGameScene.ts
// Listen for player input
gameEvents.subscribe('PLAYER_INPUT', (data: any) => {
  this.handlePlayerInput(data);
});

private handlePlayerInput(data: any): void {
  // Skip if game is not active
  if (!this.gameStarted || !this.goatSprite) return;

  // Apply immediate visual feedback (actual physics governed by server)
  if (data.left) {
    this.goatSprite.setVelocityX(-200);
    this.goatSprite.faceLeft();
  } else if (data.right) {
    this.goatSprite.setVelocityX(200);
    this.goatSprite.faceRight();
  }
  
  // Handle jump for visual feedback
  if (data.jump && this.goatSprite.isOnGround()) {
    this.goatSprite.setVelocityY(-500);
  }
}
```

## Complete Data Flow 

When a player presses a key, data flows through the system as follows:

### Client-Side Flow
1. **Input Detection**: InputHandler detects keyboard event
2. **Event Publishing**: InputHandler publishes event to GameEventBus
3. **Client Rendering**: Game Renderer receives event and updates visuals
4. **Server Communication**: SocketProvider receives event and sends to server

### Server-Side Flow
5. **Server Receives**: SocketServer receives the WebSocket message
6. **Input Processing**: handlePlayerInput method updates the player's input state 
7. **Physics Update**: On next physics tick, GameInstanceManager applies physics
8. **State Broadcast**: On next broadcast tick, SocketServer sends state to all clients
9. **Client Update**: Client receives state update and reconciles with local state

This creates a clean, decoupled pipeline where each step has a clear responsibility:

## Benefits of This Approach

### 1. Performance Improvements

- No explosion of overlapping intervals during rapid input
- Reduced CPU load on the server
- Consistent memory usage patterns
- More predictable network traffic

### 2. Architecture Benefits

- Clear separation of concerns
- Each component has a single responsibility
- Easier to understand, maintain, and debug
- Better testability of individual components

### 3. Network Efficiency

- Consistent state update frequency
- No duplicate broadcasts during rapid input
- Better client-side interpolation due to predictable update intervals
- Reduced bandwidth usage

### 4. Scalability

- More manageable as player count increases
- More predictable server load
- Easier to adjust broadcast frequency based on server load

## Common Pitfalls Avoided

This architecture explicitly avoids several common pitfalls in networked game development:

1. **Direct Component Coupling**: Using an event bus avoids direct dependencies between components, making the code more modular and testable.

2. **Duplicate Network Messages**: By centralizing all network communication through SocketProvider and using the event bus, we avoid sending the same input multiple times.

3. **Input-triggered State Broadcasts**: Creating intervals or triggering broadcasts directly from input handlers leads to unpredictable and often excessive network traffic.

4. **Mixed Responsibilities**: Each component has a clear single responsibility - InputHandler detects inputs, GameEventBus routes events, SocketProvider handles network communication.

5. **Overlapping Intervals**: Creating multiple intervals that perform the same task wastes resources and can lead to race conditions.

6. **Inconsistent Update Frequency**: Variable update frequencies make client-side interpolation and prediction more difficult.

7. **Poor Separation of Concerns**: The event-based architecture ensures each component can focus on its specific responsibility without needing to know about other components.

## Future Improvements

Potential improvements to this architecture could include:

1. **Client-side prediction**: Implement client-side physics prediction to reduce perceived latency.

2. **Dynamic broadcast rates**: Adjust broadcast frequency based on game activity and server load.

3. **Delta compression**: Only send state changes rather than full state.

4. **Interest management**: Only send relevant portions of state to each client based on what they can see or interact with.

5. **Input buffering**: Implement an input buffer on the server to handle network jitter.

6. **Extend Event-Driven Architecture**: Apply the same event-based pattern to other areas of the codebase for consistency.

7. **Typed Events**: Enhance the GameEventBus with stronger typing for improved type safety across the event system.