# Game World Architecture

This document outlines the architecture of the game world in Goat in the Shell, focusing on how game objects are defined, communicated, and rendered.

## Core Architecture Principles

The game architecture follows a **server-authoritative model** with a **single source of truth**. This means:

1. The server maintains the definitive state of the game world
2. Physics simulations run on the server
3. Clients receive state updates from the server
4. Clients render the game world based on server data but don't manage core game logic

## System Components

### 1. Game State Manager (`src/server/game-state/index.ts`)

The GameStateManager is the central repository for game state:

- Maintains the canonical game world definition
- Stores details of all static objects (platforms, dart walls, etc.)
- Defines start and end points
- Sets world boundaries
- Initializes the default game world

Key data structure:
```typescript
gameWorld: {
  platforms: Array<Platform>,
  dartWalls: Array<DartWall>,
  startPoint: { x, y },
  endPoint: { x, y },
  worldBounds: { width, height }
}
```

### 2. Physics Engine (`src/server/physics/index.ts`)

The PhysicsEngine:

- Creates Matter.js physics bodies based on the game state
- Handles collision detection and response
- Manages dart shooting mechanics
- Updates entity positions based on physics simulations
- Reports collisions and events back to the game state

### 3. Network Layer (`src/server/network/SocketServer.ts`)

The network layer:

- Transmits game world definitions to clients
- Sends continuous state updates during gameplay
- Handles client input and commands
- Ensures all clients receive synchronized game state

### 4. Client Renderer (`src/client/rendering/BasicGameScene.ts`)

The client renderer:

- Receives game world data from server
- Creates visual representations of game objects
- Handles animations and visual effects
- Processes user input for sending to server
- Updates visual state based on server updates

## Data Flow

1. **Initialization**:
   - GameStateManager initializes the default game world
   - PhysicsEngine creates physics bodies from game world data
   - Server transmits complete game world to connecting clients
   - Client creates visual representations based on received data

2. **Runtime**:
   - Physics engine updates object positions and detects collisions
   - Game state updates based on physics and game rules
   - Server sends state updates to all clients
   - Clients render the updated state

3. **Modifications**:
   - When a game object is added/modified, it's updated in the game state
   - Physics engine receives updated game world data
   - Server transmits changes to all clients
   - Clients update their visual representations

## Game Object Implementation

Each type of game object follows a consistent pattern:

### 1. Type Definition (`src/shared/types/index.ts`)

Game objects are defined in shared types for consistent use on both server and client:

```typescript
// For platforms
interface Platform {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  rotation: number;
  isStatic: boolean;
}

// For dart walls
interface DartWall {
  id: string;
  position: { x: number; y: number };
  height: number;
  isStatic: boolean;
}
```

### 2. Server-Side Game State

Game objects are initialized and stored in the GameStateManager:

```typescript
// Example: Adding platforms and dart walls
this.gameWorld.platforms.push({
  id: `platform_initial_${index}`,
  position: { x: pos.x, y: pos.y },
  width: 100,
  height: 20,
  rotation: 0,
  isStatic: true
});

this.gameWorld.dartWalls.push({
  id: `dart_wall_initial_${index}`,
  position: { x: pos.x, y: pos.y },
  height: 100,
  isStatic: true
});
```

### 3. Physics Engine Integration

The PhysicsEngine creates Matter.js bodies for each game object:

```typescript
// For platforms
const platformBody = Matter.Bodies.rectangle(
  platform.position.x,
  platform.position.y,
  platform.width,
  platform.height,
  {
    isStatic: platform.isStatic,
    label: platform.id,
    angle: platform.rotation || 0,
    collisionFilter: {
      category: CATEGORIES.PLATFORM,
      mask: CATEGORIES.DEFAULT | CATEGORIES.PLAYER | CATEGORIES.DART
    }
  }
);

// For dart walls
const wallBody = Matter.Bodies.rectangle(
  wall.position.x,
  wall.position.y,
  20, // Fixed width
  wall.height,
  {
    isStatic: wall.isStatic,
    label: wall.id,
    collisionFilter: {
      category: CATEGORIES.WALL,
      mask: CATEGORIES.PLAYER | CATEGORIES.DART
    },
    plugin: { itemType: 'dart_wall' }
  }
);
```

### 4. Client-Side Rendering

The client renders game objects based on server data:

```typescript
// For platforms
platformSprite = this.platforms.create(
  platform.position.x, 
  platform.position.y, 
  'platform'
);
platformSprite.setScale(platform.width / 100, platform.height / 20);

// For dart walls
wallSprite = this.walls.create(
  wall.position.x,
  wall.position.y,
  'wall'
);
wallSprite.setScale(1, wall.height / 100);
```

## Adding a New Game Object Type

To add a new game object type:

1. **Update shared types**:
   - Add the new object type to `GameWorld` interface
   - Define its properties and structure

2. **Update GameStateManager**:
   - Add the new object type to the gameWorld initialization
   - Create initialization logic for the default instances
   - Update getters/setters if needed

3. **Update PhysicsEngine**:
   - Add logic to create physics bodies for the new object type
   - Define collision categories and behaviors
   - Implement any special physics behavior

4. **Update Client Renderer**:
   - Create visual assets/textures for the new object type
   - Add rendering logic to display the object based on server data
   - Implement any special visual effects

## Benefits of Current Architecture

1. **Consistency**: All clients see the exact same game world
2. **Extensibility**: Easy to add new object types
3. **Maintainability**: Single source of truth means changes only need to be made once
4. **Performance**: Server handles heavy physics calculations
5. **Modularity**: Clear separation between state, physics, and rendering

## Future Improvements

1. **Dynamic Object Creation**: Enhance the ability to create and modify game objects at runtime
2. **Object Pooling**: Implement object pooling for frequently created/destroyed objects like darts
3. **Level Serialization**: Add ability to save/load level designs
4. **More Object Types**: Implement additional game object types using the established pattern
5. **Optimization**: Reduce network traffic by sending only changed data