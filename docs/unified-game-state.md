# Unified Game State Architecture

## Overview

The Unified Game State architecture implements a consistent, predictable state management system for Goat in the Shell. This document explains the key components, data flow, and benefits of the architecture.

## Core Problem Solved

Prior to this architecture, the game suffered from inconsistent state management where:

1. Multiple competing state formats existed (global state, instance state, client state)
2. State requests could return data from inconsistent sources
3. Players would experience position "snapping" issues due to global state overriding instance-specific state
4. State was organized differently depending on which component requested it

## Unified State Structure

The core of the architecture is the `UnifiedGameState` interface:

```typescript
export interface UnifiedGameState {
  // Metadata
  timestamp: number;
  version: number;
  
  // World configuration (static)
  world: GameWorld;
  
  // Instance-specific data (null for global state)
  instance: {
    id: string;
    status: GameStatus;
    items: GameItem[];
    players: Player[];
    parameters: GameParameters;
  } | null;
  
  // Client-specific data (populated by server before sending)
  client: {
    id: string;
    playerData: Player | null; // This client's player data for convenience
  };
}
```

This structure clearly separates concerns:

- **World**: Static configuration data (platforms, world bounds, start/end points)
- **Instance**: Game-specific data (players, items, status, parameters)
- **Client**: Data specific to the receiving client

## Server-Side Implementation

### GameStateManager

The `GameStateManager` provides methods for building unified state:

- `getState(instanceId?, clientId?)`: Returns the appropriate state level
- `getGlobalState()`: Returns world configuration only
- `getInstanceState(instanceId)`: Returns world + instance data
- `getClientState(clientId, baseState)`: Adds client-specific data

### State Generation Flow

1. Start with global state (world configuration)
2. If an instanceId is provided, add instance-specific data
3. If a clientId is provided, add client-specific data

### Critical Fix

The critical fix was ensuring `client.instanceId` is stored when a player joins a lobby:

```javascript
// Store the instanceId in the client object to ensure future request_initial_state calls
// return instance-specific state instead of global state
client.instanceId = instanceId;
```

This ensures that when a client requests state later, the server can associate it with the correct instance.

## Client-Side Implementation

### Socket Events Handler

The Socket Events handler processes unified state from both initial connection and state updates:

```javascript
if (message.type === 'STATE_UPDATE' || message.type === 'INITIAL_STATE') {
  // Handle unified state format
  const store = (window as any).__game_store_instance__;
  if (store && store.updateGameState && message.payload) {
    // Store the entire unified state object
    store.updateGameState(message.payload);
  }
}
```

### Game Store

The game store extracts relevant information from the unified state:

```javascript
updateGameState: (unifiedState: any) => {
  // Update the store with unified state
  set(() => ({ gameState: unifiedState }));
  
  // Update client ID if provided
  if (unifiedState.client && unifiedState.client.id) {
    set(state => ({...}));
  }
  
  // Update instance ID if provided
  if (unifiedState.instance && unifiedState.instance.id) {
    set(state => ({...}));
  }
  
  // Update game status if provided in instance data
  if (unifiedState.instance && unifiedState.instance.status) {
    set(state => ({...}));
  }
}
```

### Scene Rendering

The `BasicGameScene` processes unified state in a structured way:

1. Update world configuration from `unifiedState.world`
2. If no instance data, stop processing (this is global state only)
3. Process instance data (players, items, status)
4. Update the player's goat sprite based on server position

## Benefits

1. **Predictable Data Structure**: Everyone knows exactly what shape the state will have
2. **Single Source of Truth**: Server maintains authoritative state
3. **Clear Separation of Concerns**: World vs. instance vs. client data
4. **Fixed Position Issues**: No more position snapping due to global state overrides
5. **Extensible Structure**: Easy to add new state elements in appropriate sections
6. **Efficient Updates**: Only send the state relevant to each client

## Example Data Flow

1. Player connects → Receives global state (world configuration)
2. Player selects game mode → Client stored in game instance
3. Client requests state → Server returns instance-specific state
4. Physics updates player position → State is synchronized to client
5. Client receives personalized state updates relevant to their instance

---

This architecture ensures that all game state flows consistently through the system, preventing the position sync issues and providing a solid foundation for future development.
