# Dart System Implementation

This document explains how the dart system was implemented in the server-authoritative game architecture of "Goat in the Shell".

## Overview

The dart system is a key gameplay mechanic where:
- Dart walls shoot tranquilizer darts at regular intervals
- Darts move horizontally leftward across the screen
- If a dart hits the goat, the player dies
- If a dart hits a shield, the dart is destroyed
- If a dart goes off-screen, it is automatically removed

## Architecture

The system follows the server-authoritative pattern:
1. The server simulates physics using Matter.js
2. The PhysicsEngine creates darts at timed intervals
3. Events are published to notify other components
4. Game state is updated and broadcast to clients
5. Clients render the darts based on server state

## Key Components

### 1. PhysicsEngine

The `PhysicsEngine` class is responsible for:
- Shooting darts at regular intervals
- Managing dart physics (position, velocity, collisions)
- Handling collision detection and responses
- Removing darts when they collide or expire

### 2. GameStateMachine

The `GameStateMachine` ensures darts only fire when:
- The game is in the 'playing' state
- Physics has been activated after countdown

### 3. GameInstanceManager

The `GameInstanceManager` maintains separate instances for different players and provides the connection between the PhysicsEngine and active game instances.

## Implementation Details

### Dart Creation

```typescript
// Create dart body
const dart = Matter.Bodies.rectangle(
  wallX + 15, // Offset from wall
  dartY,
  dartWidth,
  dartHeight,
  {
    label: `dart_${Date.now()}_${Math.random()}`,
    frictionAir: 0,         // No air friction
    friction: 0,            // No friction
    restitution: 0,         // No bounce
    inertia: Infinity,      // Prevent rotation
    isSensor: false,        // Allow physical collisions
    collisionFilter: {
      category: CATEGORIES.DART,
      mask: CATEGORIES.PLAYER | CATEGORIES.PLATFORM | CATEGORIES.SHIELD
    }
  }
);

// Set velocity
Matter.Body.setVelocity(dart, {
  x: -this.parameters.dart_speed,
  y: 0
});

// Add to world
Matter.Composite.add(this.engine.world, dart);
```

### Collision Detection

Darts use Matter.js collision detection with specific collision categories:

```typescript
// Collision categories
const CATEGORIES = {
  PLAYER: 0x0002,
  PLATFORM: 0x0004,
  SPIKE: 0x0008,
  DART: 0x0010,
  SHIELD: 0x0020,
  WALL: 0x0040
};
```

Collision event handler:

```typescript
// Player-dart collision
if (this.isCollisionBetween(bodyA, bodyB, 'player', 'dart')) {
  const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
  if (playerId) {
    this.handlePlayerDeath(playerId, 'dart');
  }
  
  // Destroy the dart
  const dartBody = bodyA.label.startsWith('dart') ? bodyA : bodyB;
  if (dartBody) {
    this.removeDart(dartBody);
  }
}
```

### Dart Timer

The dart shooting timer ensures darts are fired at regular intervals:

```typescript
this.dartTimer = setInterval(() => {
  // Check for active game instances
  const instances = this.instanceManager.getAllInstances();
  const activeInstances = instances.filter(instance => 
    instance.stateMachine.getCurrentState() === 'playing'
  );
  
  // If game is in playing state, shoot darts
  if (activeInstances.length > 0) {
    const activeGameState = activeInstances[0].state;
    this.shootDartsForState(activeGameState);
  }
}, this.parameters.dart_frequency);
```

### Client-Server Communication

Darts are included in regular state updates sent to clients:

1. Darts are tracked in the server's game state
2. When darts are created, they're added to the projectiles collection
3. Game state is broadcast to clients via WebSockets
4. Clients render darts based on the projectile data

## Key Challenges Solved

### 1. State Machine Integration

We needed to ensure darts only fire when a game is in the 'playing' state. The solution uses the GameStateMachine as the authoritative source of game state:

```typescript
if (instance.stateMachine.getCurrentState() === 'playing') {
  // Safe to shoot darts
}
```

### 2. Object Instance Management

The system needed to work with multiple simultaneous game instances. We solved this by:

1. Using an event-based architecture with GameEventBus
2. Broadcasting state changes to the correct clients
3. Tracking instance/client relationships

### 3. Physics-Rendering Sync

To ensure smooth dart movement:
- The server sends regular position updates
- Clients interpolate between updates for smooth rendering
- Collision detection happens server-side only

## Configuration

Dart behavior is configured through shared constants:

```typescript
// In shared/constants/index.ts
export const ITEMS = {
  DART_WALL: {
    WIDTH: 20,
    HEIGHT: 200,
    DART_SPEED: 2, // Horizontal speed
    DART_INTERVAL: 3000 // ms between firing
  }
};

export const PHYSICS = {
  DART_WIDTH: 30,
  DART_HEIGHT: 8
};
```

## Future Improvements

Potential enhancements to the dart system:
- Variable dart speeds based on difficulty
- Different firing patterns (e.g., spread shots)
- Visual effects for dart impacts
- Special darts with unique behaviors