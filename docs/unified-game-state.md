# Unified Game State Documentation

## Overview

The UniversalGameState is a central data structure that provides a consistent representation of game state across the client and server. It serves as a single source of truth for synchronization and ensures that all components work with a standardized state format.

## Structure

The `UniversalGameState` interface includes:

```typescript
interface UniversalGameState {
  // Version and metadata
  version?: number;          // Incremental counter for state changes
  timestamp: number;         // When this state was created
  instanceId?: string;       // Game instance identifier
  lobbyId?: string;          // Lobby identifier
  clientId?: string;         // Client identifier (for backward compatibility)
  
  // Game status
  gameStatus: GameStatus;    // Current game state (playing, gameOver, etc.)
  deathType?: DeathType;     // If applicable, how the player died
  
  // Entities
  players: Player[];         // All players in the game instance
  gameWorld: GameWorld;      // World configuration (platforms, bounds, etc.)
  items: GameItem[];         // Placed items (spikes, oscillators, etc.)
  
  // Configuration
  gameConfig?: {             // Game physics parameters
    gravity: number;
    moveSpeed: number;
    jumpForce: number;
    [key: string]: any;
  };
  parameters?: any;          // Additional game parameters
  
  // Game progress
  round?: {                  // Current round information
    number: number;
    startTime: number;
    timeRemaining: number;
    isCompleted: boolean;
  };
  
  // Multiplayer information
  playerRoles?: Record<string, PlayerRole>;
  gameMode?: GameMode;
}
```

## Flow of State 

1. **State Creation**: The server's `GameStateManager.getState()` method creates a properly formatted `UniversalGameState` object.

2. **Network Transport**: State is sent to clients via WebSockets using these message types:
   - `STATE_UPDATE`: Regular game state updates (30-60 times per second)
   - `INITIAL_STATE`: First state sent to new clients on connection

3. **Client Processing**: The client's `SocketEvents` handler processes incoming state:
   ```typescript
   // STATE_UPDATE message handling
   if (message.type === 'STATE_UPDATE') {
     const stateUpdate = message as StateUpdateMessage;
     const gameState = stateUpdate.payload?.state;
     
     // Update the game state store
     if (store.updateGameState && gameState) {
       store.updateGameState(gameState);
     }
   }
   ```

4. **Rendering**: The client's rendering system uses this state to update the game visuals.

## Key Components

### Server-Side

- **GameStateManager**: Creates the initial state structure
- **PlayerRegistry**: Provides the authoritative player data
- **GameInstanceManager**: Associates players with instances
- **PhysicsEngineInstance**: Updates positions based on physics

### Client-Side

- **SocketEvents**: Receives state updates from the server
- **GameStore**: Stores the latest state for components to use
- **BasicGameScene**: Renders the game world based on state
- **UniversalGameState**: Provides type safety through TypeScript

## Best Practices

1. **Always use the formal interface**: When adding new state properties, add them to `UniversalGameState` first.
2. **Avoid state duplication**: Don't store the same data in multiple parts of the state.
3. **Respect data ownership**: The server is the source of truth for positions and physics.
4. **Version tracking**: Use the `version` field to determine if state has changed.
5. **Type safety**: Use TypeScript's type checking to ensure proper state structure.

## Example Usage

```typescript
// Server-side: Creating state
const gameState: UniversalGameState = {
  timestamp: Date.now(),
  gameStatus: 'playing',
  players: getAllPlayers(),
  gameWorld: getGameWorld(),
  items: Array.from(this.items.values())
};

// Client-side: Consuming state
const { gameStatus, players, gameWorld } = gameState;

// Rendering based on state
players.forEach(player => {
  renderPlayer(player.position.x, player.position.y);
});
```