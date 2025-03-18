import Matter from 'matter-js';
import { GameSessionManager } from '../game-state';
import { DeathType, Vector2D, Player } from '../../shared/types';
import { gameEvents } from '../game-state/GameEvents';
import { PHYSICS, ITEMS, PLAYER, GAME_DIMENSIONS, GAME_EVENTS } from '../../shared/constants';

// Constants for physics simulation
const PHYSICS_UPDATE_RATE = 60; // Updates per second
const TIME_STEP = 1000 / PHYSICS_UPDATE_RATE; // 16.66ms per step
const MAX_STEPS = 3; // Maximum steps to prevent spiral of death

/**
 * PhysicsEngineInstance - Simplified physics implementation
 * Handles basic movement, jumping, and collisions
 */
export class PhysicsEngineInstance {
  // Core Matter.js engine
  private engine: Matter.Engine;
  // Map of bodies by player/entity ID
  private bodies = new Map<string, Matter.Body>();
  // Timing variables
  private lastUpdateTime: number = Date.now();
  private accumulator: number = 0;
  // World boundaries
  private worldBounds: Matter.Body[] = [];
  
  constructor(
    private sessionId: string,
    private session: any
  ) {
    // Create Matter.js engine
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 10 }, // Simplified gravity value
      positionIterations: 6,
      velocityIterations: 8,
      enableSleeping: false
    });
    
    // Set up collision events
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart.bind(this));
    
    // Create the game world
    this.createWorldBounds();
    this.createDeathZone();
    
    // Create platforms
    if (session && session.gameWorld) {
      console.log(`PhysicsEngine: Creating platforms from game world`);
      this.createPlatformsFromGameWorld(session.gameWorld);
    }
    
    // Create player bodies
    const players = session.getAllPlayers();
    for (const player of players) {
      this.createPlayerBody(player);
    }
  }
  
  /**
   * Update physics simulation
   */
  update(deltaTime: number): void {
    // Calculate time since last update
    const currentTime = Date.now();
    const frameTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Add frame time to accumulator
    this.accumulator += frameTime;
    
    // Prevent spiral of death by capping accumulator
    if (this.accumulator > MAX_STEPS * TIME_STEP) {
      this.accumulator = MAX_STEPS * TIME_STEP;
    }
    
    // Run physics simulation in fixed time steps
    while (this.accumulator >= TIME_STEP) {
      // Apply player forces based on input
      this.applyPlayerForces();
      
      // Update physics simulation
      Matter.Engine.update(this.engine, TIME_STEP);
      
      // Reduce accumulator by time step
      this.accumulator -= TIME_STEP;
    }
    
    // Sync physics state back to game state
    this.syncGameState();
    
    // Update special items (oscillators)
    this.updateSpecialItems();
    
    // Debug - check for overlaps periodically (every ~5 seconds)
    if (Math.random() < 0.002) {
      this.debugCheckOverlaps();
    }
  }
  
  /**
   * Apply forces to players based on their inputs
   */
  private applyPlayerForces(): void {
    // Get active players
    const activePlayers = this.session.getAllPlayersForInstance(this.sessionId);
    if (!activePlayers.length) return;
    
    // Process each player
    for (const player of activePlayers) {
      // Skip dead players
      if (!player.isAlive) continue;
      
      // Get player body
      const body = this.bodies.get(player.id);
      if (!body) continue;
      
      // Skip if no input
      if (!player.lastInput) continue;
      
      // Check if player is in collision with a shield
      const isCollidingWithShield = this.isCollidingWithShield(body);
      
      // Debug collision detection (only log occasionally)
      if (Math.random() < 0.01) {
        console.log(`SERVER: Player ${player.id} movement check - colliding with shield: ${isCollidingWithShield}`);
        console.log(`SERVER: Current player position: (${body.position.x.toFixed(1)}, ${body.position.y.toFixed(1)}), velocity: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`);
        console.log(`SERVER: Input state: left=${player.lastInput.left}, right=${player.lastInput.right}, jump=${player.lastInput.jump}`);
      }
      
      // === IMPROVED MOVEMENT ===
      
      // Horizontal movement - only change velocity if moving or if not colliding with shield
      if (player.lastInput.left && !isCollidingWithShield) {
        // Only set velocity if not already going left or if changing direction
        if (body.velocity.x >= 0) {
          Matter.Body.setVelocity(body, {
            x: -3,
            y: body.velocity.y
          });
          if (Math.random() < 0.1) console.log(`SERVER: Setting player ${player.id} velocity to LEFT`);
        }
      } else if (player.lastInput.right && !isCollidingWithShield) {
        // Only set velocity if not already going right or if changing direction
        if (body.velocity.x <= 0) {
          Matter.Body.setVelocity(body, {
            x: 3,
            y: body.velocity.y
          });
          if (Math.random() < 0.1) console.log(`SERVER: Setting player ${player.id} velocity to RIGHT`);
        }
      } else if (!player.lastInput.left && !player.lastInput.right) {
        // Stop when not pressing keys, but don't override collision resolution
        Matter.Body.setVelocity(body, {
          x: 0,
          y: body.velocity.y
        });
        if (Math.random() < 0.1) console.log(`SERVER: Setting player ${player.id} velocity to STOP`);
      }
      
      // Additional debug for collision cases
      if (isCollidingWithShield && (player.lastInput.left || player.lastInput.right)) {
        console.log(`SERVER: Player ${player.id} trying to move while colliding with shield - PREVENTING MOVEMENT`);
      }
      
      // Jumping - simplified with ground check
      if (player.lastInput.jump && this.isPlayerOnGround(body)) {
        console.log(`SERVER: Player ${player.id} jumping`);
        Matter.Body.setVelocity(body, {
          x: body.velocity.x,
          y: -12 // Upward velocity for jump
        });
      }
    }
  }
  
  /**
   * Check if a player body is colliding with a shield
   */
  private isCollidingWithShield(playerBody: Matter.Body): boolean {
    // Get all shields in the world
    const shields = Matter.Composite.allBodies(this.engine.world).filter(b => b.label.startsWith('shield'));
    
    // If no shields, return false quickly
    if (shields.length === 0) return false;
    
    // Debug: log all shields in the world
    if (shields.length > 0 && Math.random() < 0.01) { // Only log occasionally to avoid spam
      console.log(`SERVER: Found ${shields.length} shields in the world:`);
      shields.forEach((shield, index) => {
        console.log(`SERVER: Shield #${index}: position (${shield.position.x.toFixed(1)}, ${shield.position.y.toFixed(1)}), bounds: width=${shield.bounds.max.x - shield.bounds.min.x}, height=${shield.bounds.max.y - shield.bounds.min.y}`);
      });
      
      // Log player position
      console.log(`SERVER: Player at position (${playerBody.position.x.toFixed(1)}, ${playerBody.position.y.toFixed(1)}), bounds: width=${playerBody.bounds.max.x - playerBody.bounds.min.x}, height=${playerBody.bounds.max.y - playerBody.bounds.min.y}`);
    }
    
    // Use Matter.js collision detection to find collisions
    const collisions = Matter.Query.collides(playerBody, shields);
    
    // Alternative check using direct collides function instead of Query
    if (collisions.length === 0 && shields.length > 0 && Math.random() < 0.05) {
      // Double-check occasionally with more detailed collision detection
      console.log(`SERVER: Double-checking collision detection with more precise method...`);
      for (const shield of shields) {
        const collision = Matter.Collision.collides(playerBody, shield, undefined);
        if (collision) {
          console.log(`SERVER: Alternative collision check found collision that Query missed!`);
          return true;
        }
      }
    }
    
    if (collisions.length > 0) {
      console.log(`SERVER: Player is colliding with ${collisions.length} shields`);
      collisions.forEach((collision, index) => {
        const shield = collision.bodyA === playerBody ? collision.bodyB : collision.bodyA;
        console.log(`SERVER: Collision #${index} with shield at (${shield.position.x.toFixed(1)}, ${shield.position.y.toFixed(1)})`);
      });
    }
    
    return collisions.length > 0;
  }
  
  /**
   * Check if a player body is on the ground
   */
  private isPlayerOnGround(body: Matter.Body): boolean {
    // Simple ray cast from bottom center of player downward
    const rayStart = { 
      x: body.position.x, 
      y: body.position.y + (PLAYER.HEIGHT / 2) - 2
    };
    const rayEnd = { 
      x: rayStart.x, 
      y: rayStart.y + 5 // Short distance down
    };
    
    // Do raycast
    const hits = Matter.Query.ray(
      Matter.Composite.allBodies(this.engine.world),
      rayStart,
      rayEnd
    );
    
    // Filter out player's own body
    const validHits = hits.filter(hit => 
      hit.bodyA !== body && hit.bodyB !== body
    );
    
    return validHits.length > 0;
  }
  
  /**
   * Sync physics state back to game state
   */
  private syncGameState(): void {
    const activePlayers = this.session.getAllPlayersForInstance(this.sessionId);
    if (!activePlayers.length) return;
    
    for (const player of activePlayers) {
      const body = this.bodies.get(player.id);
      if (!body) continue;
      
      // Debug position sync (only log occasionally)
      if (Math.random() < 0.005) {
        console.log(`SERVER: Syncing player ${player.id} position: (${body.position.x.toFixed(1)}, ${body.position.y.toFixed(1)})`);
        console.log(`SERVER: Player ${player.id} velocity: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`);
        
        // Check if player is colliding with any shields
        const shields = Matter.Composite.allBodies(this.engine.world).filter(b => b.label.startsWith('shield'));
        if (shields.length > 0) {
          // Calculate distances to nearby shields
          shields.forEach((shield, index) => {
            const dx = shield.position.x - body.position.x;
            const dy = shield.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            console.log(`SERVER: Distance to shield #${index}: ${distance.toFixed(1)} units (at ${shield.position.x.toFixed(1)}, ${shield.position.y.toFixed(1)})`);
          });
        }
      }
      
      // Update player position in session
      this.session.updatePlayerPosition(player.id, {
        x: body.position.x,
        y: body.position.y
      });
      
      // Update velocity in session (scaled to match client expectation)
      this.session.updatePlayerVelocity(player.id, {
        x: body.velocity.x * 30,
        y: body.velocity.y * 30
      });
      
      // Update ground status
      const onGround = this.isPlayerOnGround(body);
      this.session.updatePlayerGroundStatus(player.id, onGround);
    }
  }
  
  /**
   * Create a player physics body
   */
  private createPlayerBody(player: Player): Matter.Body {
    const { id, position } = player;
    
    // Ensure position is within valid bounds
    const safePosition = {
      x: position.x,
      y: Math.max(0, Math.min(position.y, GAME_DIMENSIONS.HEIGHT - 50))
    };
    
    // Create player body
    const body = Matter.Bodies.rectangle(
      safePosition.x,
      safePosition.y,
      PLAYER.WIDTH,
      PLAYER.HEIGHT,
      {
        label: `player_${id}`,
        inertia: Infinity, // Prevent rotation
        friction: 0.01,
        frictionAir: 0.05,
        restitution: 0.1, // Slight bounce
        density: 0.001, // Low density for better control
        collisionFilter: {
          category: 0x0001, // Player category
          mask: 0xFFFFFFFF // Collide with everything
        }
      }
    );
    
    // Add to world and tracking
    Matter.Composite.add(this.engine.world, body);
    this.bodies.set(id, body);
    
    return body;
  }
  
  /**
   * Create world boundaries
   */
  private createWorldBounds(): void {
    // Create walls at the edges of the world
    const walls = [
      // Left wall
      Matter.Bodies.rectangle(
        0, GAME_DIMENSIONS.HEIGHT/2, 10, GAME_DIMENSIONS.HEIGHT,
        { isStatic: true, label: 'leftWall' }
      ),
      // Right wall
      Matter.Bodies.rectangle(
        GAME_DIMENSIONS.WIDTH, GAME_DIMENSIONS.HEIGHT/2, 10, GAME_DIMENSIONS.HEIGHT,
        { isStatic: true, label: 'rightWall' }
      ),
      // Top wall
      Matter.Bodies.rectangle(
        GAME_DIMENSIONS.WIDTH/2, 0, GAME_DIMENSIONS.WIDTH, 10,
        { isStatic: true, label: 'topWall' }
      )
    ];
    
    // Add to world and tracking
    this.worldBounds = walls;
    Matter.Composite.add(this.engine.world, this.worldBounds);
  }
  
  /**
   * Create platforms from game world data
   */
  private createPlatformsFromGameWorld(gameWorld: any): void {
    // Create platforms
    if (gameWorld.platforms && Array.isArray(gameWorld.platforms)) {
      gameWorld.platforms.forEach((platform: any) => {
        const platformBody = Matter.Bodies.rectangle(
          platform.position.x,
          platform.position.y,
          platform.width || 100,
          platform.height || 20,
          {
            isStatic: true,
            label: platform.id || 'platform',
            angle: platform.rotation || 0
          }
        );
        
        Matter.Composite.add(this.engine.world, platformBody);
      });
    }
    
    // Create finish area
    if (gameWorld.endPoint) {
      const finishArea = Matter.Bodies.rectangle(
        gameWorld.endPoint.x,
        gameWorld.endPoint.y,
        50,
        50,
        {
          isStatic: true,
          isSensor: true,
          label: 'finish_area'
        }
      );
      
      Matter.Composite.add(this.engine.world, finishArea);
    }
  }
  
  /**
   * Create death zone at the bottom of the world
   */
  private createDeathZone(): void {
    const deathZone = Matter.Bodies.rectangle(
      GAME_DIMENSIONS.WIDTH / 2,
      GAME_DIMENSIONS.HEIGHT + 50,
      GAME_DIMENSIONS.WIDTH,
      100,
      {
        isStatic: true,
        isSensor: true,
        label: 'death_zone'
      }
    );
    
    Matter.Composite.add(this.engine.world, deathZone);
  }
  
  /**
   * Handle collision start events
   */
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Handle player win (finish area)
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'finish_area')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerWin(playerId);
      }
      
      // Handle player death from spikes
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'spike')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerDeath(playerId, 'spike');
      }
      
      // Handle player falling out of world
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'death_zone')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerDeath(playerId, 'fall');
      }
      
      // Handle player-shield collisions
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'shield')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) {
          // Get player body
          const body = this.bodies.get(playerId);
          if (body) {
            // Log collision details
            const shield = bodyA.label.startsWith('shield') ? bodyA : bodyB;
            console.log(`SERVER: COLLISION DETECTED! Player ${playerId} collided with shield at (${shield.position.x.toFixed(1)}, ${shield.position.y.toFixed(1)})`);
            console.log(`SERVER: Player velocity before: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`);
            
            // ADDITIONAL DIAGNOSTICS
            // Calculate penetration depth
            const overlap = this.calculateOverlap(body, shield);
            console.log(`SERVER: Collision overlap: ${overlap.x.toFixed(2)} x ${overlap.y.toFixed(2)}`);
            
            // Apply a more forceful bounce/stop effect
            const bounceMultiplier = 0.8; // Increased bounce effect for visibility
            
            // Reverse velocity or set to zero to prevent movement through shield
            Matter.Body.setVelocity(body, {
              x: -body.velocity.x * bounceMultiplier, // Stronger bounce back
              y: body.velocity.y
            });
            
            // Also try manually separating the bodies to prevent overlap
            this.separateBodies(body, shield);
            
            console.log(`SERVER: Player velocity after: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`);
          }
        }
      }
    });
  }
  
  /**
   * Calculate overlap between two bodies
   */
  private calculateOverlap(bodyA: Matter.Body, bodyB: Matter.Body): { x: number, y: number } {
    const overlapX = Math.max(0, Math.min(bodyA.bounds.max.x, bodyB.bounds.max.x) - Math.max(bodyA.bounds.min.x, bodyB.bounds.min.x));
    const overlapY = Math.max(0, Math.min(bodyA.bounds.max.y, bodyB.bounds.max.y) - Math.max(bodyA.bounds.min.y, bodyB.bounds.min.y));
    return { x: overlapX, y: overlapY };
  }
  
  /**
   * Manually separate two bodies to prevent overlap
   */
  private separateBodies(playerBody: Matter.Body, shieldBody: Matter.Body): void {
    // Calculate penetration
    const dx = playerBody.position.x - shieldBody.position.x;
    const dy = playerBody.position.y - shieldBody.position.y;
    
    // Normalize direction vector
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return; // Avoid division by zero
    
    const dirX = dx / mag;
    const dirY = dy / mag;
    
    // Calculate combined size (approximate)
    const playerRadius = Math.max(playerBody.bounds.max.x - playerBody.bounds.min.x, 
                                 playerBody.bounds.max.y - playerBody.bounds.min.y) / 2;
    const shieldRadius = Math.max(shieldBody.bounds.max.x - shieldBody.bounds.min.x, 
                                 shieldBody.bounds.max.y - shieldBody.bounds.min.y) / 2;
    
    // Amount to move = how much they overlap + a small buffer
    const totalRadius = playerRadius + shieldRadius;
    const moveDistance = totalRadius - mag + 1.0; // Add 1.0 as small buffer
    
    if (moveDistance > 0) {
      console.log(`SERVER: Manually separating player from shield by ${moveDistance.toFixed(2)} units`);
      
      // Only move the player since shields are static
      const newPosX = playerBody.position.x + dirX * moveDistance;
      const newPosY = playerBody.position.y + dirY * moveDistance;
      
      // Use Matter.js function to move the body
      Matter.Body.setPosition(playerBody, { x: newPosX, y: newPosY });
    }
  }
  
  /**
   * Check if collision is between specific object types
   */
  private isCollisionBetween(
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    typeA: string,
    typeB: string
  ): boolean {
    return (
      (bodyA.label.startsWith(typeA) && bodyB.label.startsWith(typeB)) ||
      (bodyB.label.startsWith(typeA) && bodyA.label.startsWith(typeB))
    );
  }
  
  /**
   * Get player ID from body
   */
  private getPlayerIdFromBody(bodyA: Matter.Body, bodyB: Matter.Body): string | null {
    if (bodyA.label.startsWith('player_')) {
      return bodyA.label.substring(7);
    }
    if (bodyB.label.startsWith('player_')) {
      return bodyB.label.substring(7);
    }
    return null;
  }
  
  /**
   * Handle player death
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    const player = this.session.getPlayer(playerId);
    if (!player || !player.isAlive) return;
    
    // Update player alive status
    this.session.setPlayerAliveStatus(playerId, false);
    
    // Publish death event
    gameEvents.publish(GAME_EVENTS.PLAYER_DEATH, {
      playerId,
      cause,
      position: { ...player.position },
      instanceId: this.sessionId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle player win
   */
  private handlePlayerWin(playerId: string): void {
    const player = this.session.getPlayer(playerId);
    if (!player || !player.isAlive) return;
    
    // Publish win event
    gameEvents.publish(GAME_EVENTS.PLAYER_WIN, {
      playerId,
      position: { ...player.position },
      instanceId: this.sessionId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Update special items like oscillators
   */
  private updateSpecialItems(): void {
    const gameState = this.session.getState();
    if (!gameState || !gameState.items) return;
    
    for (const item of gameState.items) {
      const body = this.bodies.get(item.id);
      if (!body) continue;
      
      // Handle oscillator movement
      if (item.type === 'oscillator' || item.type === 'moving') {
        // Initialize oscillator data if needed
        if (!body.plugin) body.plugin = {};
        if (!body.plugin.oscillator) {
          body.plugin.oscillator = {
            startX: item.position.x,
            phase: 0,
            distance: item.properties?.distance || 100
          };
        }
        
        const osc = body.plugin.oscillator;
        
        // Update phase
        osc.phase += 0.016;
        
        // Calculate new position based on sine wave
        const newX = osc.startX + Math.sin(osc.phase * 0.001) * osc.distance;
        
        // Update physics body position
        Matter.Body.setPosition(body, { x: newX, y: body.position.y });
      }
    }
  }
  
  /**
   * Debug method to manually check for overlaps between players and shields
   */
  private debugCheckOverlaps(): void {
    const activePlayers = this.session.getAllPlayersForInstance(this.sessionId);
    if (!activePlayers.length) return;
    
    // CRITICAL DEBUGGING - Check what's actually in the physics world
    const allBodies = Matter.Composite.allBodies(this.engine.world);
    console.log(`SERVER CRITICAL: Total bodies in physics world: ${allBodies.length}`);
    
    // Log body types and counts
    const bodyCounts: Record<string, number> = {};
    allBodies.forEach(body => {
      const label = body.label.split('_')[0]; // Get base type without ID
      bodyCounts[label] = (bodyCounts[label] || 0) + 1;
    });
    console.log(`SERVER CRITICAL: Body types in world:`, JSON.stringify(bodyCounts));
    
    // Specifically list all shields with details
    const allShields = allBodies.filter(b => b.label.startsWith('shield'));
    console.log(`SERVER CRITICAL: Found ${allShields.length} shields in physics world`);
    allShields.forEach((shield, i) => {
      console.log(`SERVER CRITICAL: Shield #${i} - position: (${shield.position.x}, ${shield.position.y}), bounds: (${shield.bounds.min.x}, ${shield.bounds.min.y}) to (${shield.bounds.max.x}, ${shield.bounds.max.y})`);
    });
    
    // Continue with overlap check as before
    const shields = allBodies.filter(b => b.label.startsWith('shield'));
    if (!shields.length) {
      console.log('SERVER DEBUG: No shields in world to check for overlaps');
      return;
    }
    
    console.log(`SERVER CRITICAL: Manual overlap check - Found ${shields.length} shields and ${activePlayers.length} players`);
    
    // For each player, manually check overlaps with each shield
    for (const player of activePlayers) {
      const playerBody = this.bodies.get(player.id);
      if (!playerBody) continue;
      
      console.log(`SERVER CRITICAL: Checking overlaps for player ${player.id} at (${playerBody.position.x.toFixed(1)}, ${playerBody.position.y.toFixed(1)})`);
      console.log(`SERVER CRITICAL: Player bounds: min(${playerBody.bounds.min.x.toFixed(1)}, ${playerBody.bounds.min.y.toFixed(1)}), max(${playerBody.bounds.max.x.toFixed(1)}, ${playerBody.bounds.max.y.toFixed(1)})`);
      
      for (const shield of shields) {
        console.log(`SERVER CRITICAL: Shield at (${shield.position.x.toFixed(1)}, ${shield.position.y.toFixed(1)})`);
        console.log(`SERVER CRITICAL: Shield bounds: min(${shield.bounds.min.x.toFixed(1)}, ${shield.bounds.min.y.toFixed(1)}), max(${shield.bounds.max.x.toFixed(1)}, ${shield.bounds.max.y.toFixed(1)})`);
        
        // Calculate distance
        const dx = shield.position.x - playerBody.position.x;
        const dy = shield.position.y - playerBody.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        console.log(`SERVER CRITICAL: Distance between centers: ${distance.toFixed(1)} units`);
        
        // Manual AABB overlap check
        const overlapX = Math.max(0, Math.min(playerBody.bounds.max.x, shield.bounds.max.x) - Math.max(playerBody.bounds.min.x, shield.bounds.min.x));
        const overlapY = Math.max(0, Math.min(playerBody.bounds.max.y, shield.bounds.max.y) - Math.max(playerBody.bounds.min.y, shield.bounds.min.y));
        
        if (overlapX > 0 && overlapY > 0) {
          console.log(`SERVER CRITICAL: OVERLAP DETECTED! Overlap area: ${overlapX.toFixed(1)} x ${overlapY.toFixed(1)}`);
          
          // Double-check with Matter.js collision detection
          const collisions = Matter.Collision.collides(playerBody, shield, undefined);
          console.log(`SERVER CRITICAL: Matter.js collision detection result: ${collisions ? 'COLLISION' : 'NO COLLISION'}`);
          
          if (collisions) {
            console.log(`SERVER CRITICAL: Collision depth: ${collisions.depth.toFixed(3)}, normal: (${collisions.normal.x.toFixed(3)}, ${collisions.normal.y.toFixed(3)})`);
          }
        } else {
          console.log(`SERVER CRITICAL: No overlap detected`);
        }
      }
    }
  }
  
  /**
   * Create physics body for a game item
   */
  public createGameItem(item: any): Matter.Body {
    try {
      // Ensure item has a valid ID
      if (!item.id) {
        item.id = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      }
      
      // Ensure position is valid
      if (!item.position || typeof item.position.x !== 'number' || typeof item.position.y !== 'number') {
        console.error(`SERVER ERROR: Invalid item position:`, item.position);
        item.position = { x: 500, y: 500 };
      }
      
      // Get item properties with defaults for each type
      let itemWidth = 100;
      let itemHeight = 20;
      
      switch (item.type) {
        case 'platform':
          itemWidth = item.properties?.width || ITEMS.PLATFORM.DEFAULT_WIDTH;
          itemHeight = item.properties?.height || ITEMS.PLATFORM.DEFAULT_HEIGHT;
          break;
        case 'spike':
          itemWidth = item.properties?.width || ITEMS.SPIKE.SIZE;
          itemHeight = item.properties?.height || ITEMS.SPIKE.SIZE;
          break;
        case 'shield':
          itemWidth = item.properties?.width || ITEMS.SHIELD.WIDTH;
          itemHeight = item.properties?.height || ITEMS.SHIELD.HEIGHT;
          break;
        case 'oscillator':
        case 'moving':
          itemWidth = item.properties?.width || ITEMS.OSCILLATOR.DEFAULT_WIDTH;
          itemHeight = item.properties?.height || ITEMS.OSCILLATOR.DEFAULT_HEIGHT;
          break;
        case 'dart_wall':
          itemWidth = 20;
          itemHeight = item.properties?.height || ITEMS.DART_WALL.HEIGHT;
          break;
      }
      
      // Create the physics body based on item type
      let body: Matter.Body;
      
      switch (item.type) {
        case 'platform':
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            { isStatic: true, label: `platform_${item.id}` }
          );
          break;
          
        case 'spike':
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            { isStatic: true, label: `spike_${item.id}` }
          );
          break;
          
        case 'shield':
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            {
              isStatic: true,
              label: `shield_${item.id}`,
              friction: 0,
              restitution: 0.2
            }
          );
          break;
          
        case 'oscillator':
        case 'moving':
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            { 
              isStatic: true, 
              label: `oscillator_${item.id}`,
              plugin: {
                oscillator: {
                  startX: item.position.x,
                  phase: 0,
                  distance: item.properties?.distance || ITEMS.OSCILLATOR.DEFAULT_AMPLITUDE_Y
                }
              }
            }
          );
          break;
          
        case 'dart_wall':
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            { isStatic: true, label: `dart_wall_${item.id}` }
          );
          break;
          
        default:
          body = Matter.Bodies.rectangle(
            item.position.x, item.position.y, itemWidth, itemHeight,
            { isStatic: true, label: `${item.type || 'unknown'}_${item.id}` }
          );
      }
      
      // Apply rotation if specified
      if (item.rotation) {
        Matter.Body.setAngle(body, item.rotation);
      }
      
      // Add body to world
      Matter.Composite.add(this.engine.world, body);
      
      // Store body for tracking
      this.bodies.set(item.id, body);
      
      console.log(`SERVER: Created ${item.type} physics body at (${item.position.x}, ${item.position.y})`);
      return body;
    } catch (error) {
      console.error(`SERVER ERROR: Failed to create physics body for ${item.type}:`, error);
      // Create a simple rectangle as fallback to avoid null return errors
      const fallbackBody = Matter.Bodies.rectangle(
        item?.position?.x || 0,
        item?.position?.y || 0,
        10, 10,
        { isStatic: true, label: `error_${Date.now()}` }
      );
      Matter.Composite.add(this.engine.world, fallbackBody);
      return fallbackBody;
    }
  }
  
  /**
   * Public method to register an item with physics
   */
  registerItemWithPhysics(item: any): Matter.Body {
    return this.createGameItem(item);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    Matter.Engine.clear(this.engine);
    this.bodies.clear();
  }
}