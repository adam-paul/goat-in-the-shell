# Physics Synchronization Between Client and Server

## Overview

Our game architecture uses a server-authoritative physics model with client-side rendering. This approach presents unique challenges in synchronizing two different physics engines:

- **Server**: Uses Matter.js for accurate physics simulation and collision detection
- **Client**: Uses Phaser's Arcade Physics for rendering and initial input handling

This document explains how we maintain synchronization between these systems.

## Key Challenges

1. **Different Physics Engines**: Matter.js (server) and Phaser Arcade Physics (client) calculate physics differently
2. **Gravity Scale**: Different default gravity values between engines
3. **Input Processing**: User inputs must affect both client and server physics
4. **Position Reconciliation**: Client positions need to be periodically corrected by the server
5. **Y-Axis Sync**: Vertical movement (jumping, falling) is particularly sensitive to desynchronization

## Architecture

```
┌─────────┐         ┌──────────┐              ┌────────────┐
│  Client  │         │  Server  │              │  Physics   │
│  Input   ├────────►│  Input   ├─────────────►│  Engine    │
│ Handler  │         │ Handler  │              │ (Matter.js)│
└─────────┘         └──────────┘              └─────┬──────┘
     │                                              │
     │                                              │
┌────▼────┐         ┌──────────┐              ┌─────▼──────┐
│ Client   │◄────────┤  State   │◄─────────────┤ Position   │
│ Renderer │         │ Update   │              │ Updates    │
└─────────┘         └──────────┘              └────────────┘
```

## Physics Constants Alignment

We carefully align physics constants between client and server:

```typescript
// Server (Matter.js)
const gravity = 0.8;  // Matter.js units

// Client (Phaser)
const gravity = 0.8 * 300;  // Scaled for Phaser units
```

## Key Synchronization Points

### 1. Input Processing

When a player presses a key:

```typescript
// Client side
gameEvents.publish('PLAYER_INPUT', {
  left: inputState.left,
  right: inputState.right,
  jump: isJumping,
  timestamp: Date.now()
});

// Server side
player.lastInput = processedInput;  // Store on player object
```

### 2. Movement Application

**Server**:
```typescript
// Apply horizontal movement
if (player.lastInput.left) {
  Matter.Body.setVelocity(body, {
    x: -6,                // Fixed velocity
    y: body.velocity.y    // Maintain vertical velocity
  });
}

// Apply jump force
if (player.lastInput.jump && this.isBodyOnGround(body)) {
  Matter.Body.setVelocity(body, {
    x: body.velocity.x,
    y: jumpVelocity       // Apply upward force
  });
}
```

### 3. Position Reconciliation

The most critical part of synchronization occurs during position updates from server to client:

```typescript
// Client code - CRITICAL for keeping player synced
const sprite = this.goatSprite.getSprite();
if (sprite.body) {
  // Force exact position override from server
  sprite.x = player.position.x;
  sprite.y = player.position.y;
  
  // Update the physics body position explicitly
  sprite.body.reset(player.position.x, player.position.y);
  
  // Then explicitly set server-provided velocity
  sprite.body.velocity.x = player.velocity?.x || 0;
  sprite.body.velocity.y = player.velocity?.y || 0;
}
```

## Ground Detection for Jumping

Accurate ground detection is essential for proper jumping mechanics:

```typescript
private isBodyOnGround(body: Matter.Body): boolean {
  // Using a raycast from the bottom of the player body
  const startPoint = {
    x: body.position.x,
    y: body.position.y + (body.bounds.max.y - body.bounds.min.y) / 2 - 1
  };
  
  const endPoint = {
    x: startPoint.x,
    y: startPoint.y + 5  // Check 5px below player
  };
  
  // Do a raycast query
  const rayCollisions = Matter.Query.ray(
    Matter.Composite.allBodies(this.engine.world),
    startPoint,
    endPoint
  );
  
  // Check if we hit any platform
  return rayCollisions.some(collision => 
    collision.body !== body && // Not self
    (collision.body.label.startsWith('platform') || 
     collision.body.label.startsWith('ground'))
  );
}
```

## Common Issues and Troubleshooting

### Y-Axis Desynchronization

If the client and server Y positions diverge:
1. Check gravity settings in both engines
2. Verify ground detection logic
3. Ensure jump velocity is consistent
4. Confirm position reconciliation is working properly

### Jittery Movement

If movement appears jittery:
1. Implement client-side prediction
2. Smooth position updates with interpolation
3. Adjust server update frequency

### Input Lag

If inputs feel delayed:
1. Apply inputs immediately client-side
2. Send inputs to server with timestamps
3. Implement reconciliation when server updates arrive

## Best Practices

1. **Server Authority**: Always treat the server as the source of truth
2. **Explicit Overrides**: Directly set position/velocity rather than relying on physics calculations
3. **Input Validation**: Validate all client inputs server-side
4. **Detailed Logging**: Track positions and velocities for debugging
5. **Consistent Constants**: Use shared constants between client and server physics
6. **Rate Limiting**: Limit update frequency to avoid flooding network
7. **Player Registration**: Ensure player entities exist in both client and server systems