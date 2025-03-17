import Matter from 'matter-js';
import { GameSessionManager } from '../game-state';
import { DeathType, Vector2D, Player } from '../../shared/types';
import { gameEvents } from '../game-state/GameEvents';
import { PHYSICS, ITEMS, PLAYER, GAME_DIMENSIONS } from '../../shared/constants';

// Constants for physics simulation
const PHYSICS_UPDATE_RATE = 60; // Updates per second
const TIME_STEP = 1000 / PHYSICS_UPDATE_RATE;
const MAX_STEPS = 5; // Maximum number of steps to avoid spiral of death

// Default physics parameters
const DEFAULT_PARAMETERS = {
  gravity: PHYSICS.GRAVITY,
  player_move_force: PHYSICS.PLAYER_MOVE_FORCE,
  player_jump_force: PHYSICS.PLAYER_JUMP_FORCE,
  ground_friction: PHYSICS.GROUND_FRICTION,
  air_friction: PHYSICS.AIR_FRICTION,
  restitution: PHYSICS.RESTITUTION
};

// Custom collision categories (bit flags)
const CATEGORIES = {
  DEFAULT: 0x0001,
  PLAYER: 0x0002,
  PLATFORM: 0x0004,
  SPIKE: 0x0008,
  SHIELD: 0x0020,
  DEATH_ZONE: 0x0080
};

// Define collision masks for each category
const COLLISION_MASKS = {
  PLAYER: CATEGORIES.DEFAULT | CATEGORIES.PLATFORM | CATEGORIES.SPIKE | CATEGORIES.SHIELD | CATEGORIES.DEATH_ZONE,
  SHIELD: CATEGORIES.PLAYER,
  PLATFORM: CATEGORIES.PLAYER,
  SPIKE: CATEGORIES.PLAYER,
  DEATH_ZONE: CATEGORIES.PLAYER
};

// Define event interfaces
interface PlayerMoveEvent {
  playerId: string;
  force: Vector2D;
}

interface PlayerJumpEvent {
  playerId: string;
}

export class PhysicsEngineInstance {
  private engine: Matter.Engine;
  private bodies: Map<string, Matter.Body> = new Map();
  private lastUpdateTime: number = Date.now();
  private lastDebugTime: number = Date.now(); // Track last debug time for rate-limited logging
  private accumulator: number = 0;
  private worldBounds: Matter.Body[] = [];
  private parameters: Record<string, number>;
  
  constructor(
    private sessionId: string,
    private session: any,
    parameters = DEFAULT_PARAMETERS
  ) {
    // Initialize Matter.js engine
    this.engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: parameters.gravity || DEFAULT_PARAMETERS.gravity
      }
    });
    
    // Store parameters
    this.parameters = { ...DEFAULT_PARAMETERS, ...parameters };
    
    // Create world boundaries
    this.createWorldBounds();
    
    // Create death zone at the bottom of the world
    this.createDeathZone();
    
    // Set up collision event handlers
    this.setupEventHandlers();
    
    // Create platforms from game world
    const gameWorld = session.gameWorld;
    if (gameWorld) {
      this.createPlatformsFromGameWorld(gameWorld);
    }
    
    // Create player bodies
    const players = session.getAllPlayers();
    for (const player of players) {
      this.createPlayerBody(player);
    }
    
    console.log(`PHYSICS: Initialized physics engine for session ${sessionId}`);
  }

  /**
   * Set up event handlers specific to this instance
   */
  private setupEventHandlers(): void {
    // Subscribe to game events with instance filtering
    gameEvents.subscribe('PLAYER_MOVE', (data: PlayerMoveEvent) => {
      // Check if this event is for a player in this instance
      const playerInstanceId = this.session.getPlayerInstance(data.playerId);
      if (playerInstanceId === this.sessionId) {
        this.applyForce(data.playerId, data.force);
      }
    });

    gameEvents.subscribe('PLAYER_JUMP', (data: PlayerJumpEvent) => {
      // Check if this event is for a player in this instance
      const playerInstanceId = this.session.getPlayerInstance(data.playerId);
      if (playerInstanceId === this.sessionId) {
        const body = this.bodies.get(data.playerId);
        if (!body) return;

        // Only allow jumping if on ground
        if (this.isBodyOnGround(body)) {
          Matter.Body.applyForce(body, body.position, { x: 0, y: -PHYSICS.PLAYER_JUMP_FORCE });
        }
      }
    });
  }
  
  /**
   * Clean up resources when this physics instance is destroyed
   */
  destroy(): void {
    // Clear Matter.js engine
    Matter.Engine.clear(this.engine);
    
    // Clear maps
    this.bodies.clear();
    
    console.log(`[PhysicsEngine:${this.sessionId}] Physics engine instance destroyed`);
  }
  
  /**
   * Create world boundaries
   */
  private createWorldBounds(): void {
    // Create invisible walls at the edges of the world (left, right, and top)
    const leftWall = Matter.Bodies.rectangle(
      0, GAME_DIMENSIONS.HEIGHT/2, 10, GAME_DIMENSIONS.HEIGHT, 
      { isStatic: true, label: 'leftWall' }
    );
    
    const rightWall = Matter.Bodies.rectangle(
      GAME_DIMENSIONS.WIDTH, GAME_DIMENSIONS.HEIGHT/2, 10, GAME_DIMENSIONS.HEIGHT, 
      { isStatic: true, label: 'rightWall' }
    );
    
    const topWall = Matter.Bodies.rectangle(
      GAME_DIMENSIONS.WIDTH/2, 0, GAME_DIMENSIONS.WIDTH, 10, 
      { isStatic: true, label: 'topWall' }
    );
    
    // Add to world bounds array
    this.worldBounds = [leftWall, rightWall, topWall];
    
    // Add to physics world
    Matter.Composite.add(this.engine.world, this.worldBounds);
  }
  
  /**
   * Create platforms from game world data
   */
  private createPlatformsFromGameWorld(gameWorld: any): void {
    // Create platforms based on game world data
    if (gameWorld.platforms && Array.isArray(gameWorld.platforms)) {
      gameWorld.platforms.forEach((platform: any) => {
        const platformBody = Matter.Bodies.rectangle(
          platform.position.x,
          platform.position.y,
          platform.width,
          platform.height,
          {
            isStatic: platform.isStatic,
            label: platform.id || `platform_${Math.random().toString(36).substring(2, 9)}`,
            angle: platform.rotation || 0,
            collisionFilter: {
              category: CATEGORIES.PLATFORM,
              mask: CATEGORIES.DEFAULT | CATEGORIES.PLAYER
            }
          }
        );
        
        Matter.Composite.add(this.engine.world, platformBody);
      });
    }
    
    // Create start and finish areas
    if (gameWorld.startPoint) {
      // Start point is just for visuals, no physics needed
      console.log(`[PhysicsEngine:${this.sessionId}] Start point set at (${gameWorld.startPoint.x}, ${gameWorld.startPoint.y})`);
    }
    
    if (gameWorld.endPoint) {
      // Create finish area with collision sensor
      const finishArea = Matter.Bodies.rectangle(
        gameWorld.endPoint.x, 
        gameWorld.endPoint.y, 
        50, 
        50,
        {
          isStatic: true,
          isSensor: true, // Doesn't physically block but detects collisions
          label: 'finish_area',
          collisionFilter: {
            category: CATEGORIES.DEFAULT,
            mask: CATEGORIES.PLAYER
          }
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
      GAME_DIMENSIONS.HEIGHT + 50, // Below the visible world
      GAME_DIMENSIONS.WIDTH, 
      100,
      {
        isStatic: true,
        isSensor: true, // Doesn't block physically, just detects
        label: 'death_zone',
        collisionFilter: {
          category: CATEGORIES.DEATH_ZONE,
          mask: CATEGORIES.PLAYER
        }
      }
    );
    
    Matter.Composite.add(this.engine.world, deathZone);
  }
  
  /**
   * Update the physics simulation
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
      // Apply forces to players
      this.applyPlayerForces();
      
      // Update physics simulation
      Matter.Engine.update(this.engine, TIME_STEP);
      
      // Reduce accumulator by time step
      this.accumulator -= TIME_STEP;
    }
    
    // Sync game state after physics update
    this.syncGameState();
    
    // Update special items (oscillators, etc.)
    this.updateSpecialItemPhysics();
    
    // Debug logging (rate-limited)
    if (currentTime - this.lastDebugTime > 5000) {
      this.debugPhysicsState();
      this.lastDebugTime = currentTime;
    }
  }
  
  /**
   * Apply forces to players based on their inputs
   */
  private applyPlayerForces(): void {
    // Get players DIRECTLY from PlayerRegistry (source of truth)
    const activePlayers = this.session.getAllPlayersForInstance(this.sessionId);
    
    // Log detailed player information for debugging
    console.log(`PHYSICS: Found ${activePlayers.length} players for instance ${this.sessionId}`);
    for (const p of activePlayers) {
      console.log(`PHYSICS: Player ${p.id} at (${p.position.x}, ${p.position.y}) with input:`, 
        p.lastInput ? JSON.stringify(p.lastInput) : "No input");
    }
    
    if (!activePlayers.length) return;
    
    // Apply forces to each player
    for (const player of activePlayers) {
      // Skip if player is not alive
      if (!player.isAlive) continue;
      
      const body = this.bodies.get(player.id);
      if (!body) {
        console.error(`PHYSICS: No body found for player ${player.id}`);
        continue;
      }
      
      // DIRECTLY access lastInput from the player object in registry
      // This avoids the need to find the player in gameState.players which may be empty
      if (!player.lastInput) {
        // Still keep track of physics even without input
        console.log(`PHYSICS: No input for player ${player.id}`);
        continue;
      }
      
      // Apply horizontal movement force - match original implementation behavior
      if (player.lastInput.left) {
        // Set a fixed leftward velocity instead of applying force
        Matter.Body.setVelocity(body, {
          x: -6, // Fixed velocity
          y: body.velocity.y // Maintain vertical velocity
        });
        console.log(`PHYSICS: Moving player ${player.id} LEFT`);
      } else if (player.lastInput.right) {
        // Set a fixed rightward velocity instead of applying force
        Matter.Body.setVelocity(body, {
          x: 6, // Fixed velocity
          y: body.velocity.y // Maintain vertical velocity
        });
        console.log(`PHYSICS: Moving player ${player.id} RIGHT`);
      } else {
        // In original implementation, player comes to a full stop when not pressing keys
        Matter.Body.setVelocity(body, {
          x: 0, // Full stop (no sliding)
          y: body.velocity.y // Maintain vertical velocity
        });
      }
      
      // Apply jump force if on ground and jump pressed
      if (player.lastInput.jump && this.isBodyOnGround(body)) {
        // In Phaser, the default jump velocity would be around -PLAYER.JUMP_FORCE * gravity scaling
        // We need to ensure consistency across both physics systems
        const jumpVelocity = -10; // Use a consistent value that works well in both systems
        
        console.log(`PHYSICS: Player ${player.id} JUMPING with velocity ${jumpVelocity}`);
        
        Matter.Body.setVelocity(body, {
          x: body.velocity.x,
          y: jumpVelocity
        });
      }
    }
  }
  
  /**
   * Update physics for special items like oscillating platforms
   */
  private updateSpecialItemPhysics(): void {
    const gameState = this.session.getState();
    
    for (const item of gameState.items) {
      const body = this.bodies.get(item.id);
      if (!body) continue;
      
      // Handle oscillator movement
      if (item.type === 'oscillator' || item.type === 'moving') {
        // Use custom properties or default values
        const distance = item.properties.distance || this.parameters.oscillator_distance;
        const frequency = item.properties.frequency || 0.001;
        
        // Get or initialize phase
        if (!body.plugin) body.plugin = {};
        if (!body.plugin.oscillator) {
          body.plugin.oscillator = {
            startX: item.position.x,
            startY: item.position.y,
            amplitudeX: distance,
            amplitudeY: 0, // Default to horizontal movement
            frequency: frequency,
            phase: 0
          };
        }
        
        const osc = body.plugin.oscillator;
        
        // Update phase
        osc.phase += 0.016; // Time step increment (60fps)
        
        // Calculate new position based on oscillation
        const newX = osc.startX + Math.sin(osc.phase * osc.frequency) * osc.amplitudeX;
        const newY = osc.startY + Math.sin(osc.phase * osc.frequency) * osc.amplitudeY;
        
        // Update physics body position
        Matter.Body.setPosition(body, { x: newX, y: newY });
      }
    }
  }
  
  /**
   * Sync physics state with game state
   */
  private syncGameState(): void {
    // Get players DIRECTLY from PlayerRegistry (source of truth)
    const activePlayers = this.session.getAllPlayersForInstance(this.sessionId);
    
    // Log player counts and details for debugging
    console.log(`PHYSICS: Syncing ${activePlayers.length} players for instance ${this.sessionId}`);
    
    if (!activePlayers.length) return;
    
    // Sync player positions
    for (const player of activePlayers) {
      const body = this.bodies.get(player.id);
      
      // Create body if it doesn't exist and player is alive
      if (!body && player.isAlive) {
        console.log(`PHYSICS: Creating new body for player ${player.id} at position (${player.position.x}, ${player.position.y})`);
        this.createPlayerBody(player);
        continue;
      }
      
      // Update player state from physics
      if (body) {
        // Log position changes for debugging
        const oldPosition = { x: player.position.x, y: player.position.y };
        const newPosition = { x: body.position.x, y: body.position.y };
        
        // Update player position in registry
        this.session.updatePlayerPosition(player.id, newPosition);
        
        // Update velocity in registry
        this.session.updatePlayerVelocity(player.id, {
          x: body.velocity.x,
          y: body.velocity.y
        });
        
        // Update onGround status
        const onGround = this.isBodyOnGround(body);
        this.session.updatePlayerGroundStatus(player.id, onGround);
        
        // Log meaningful position changes only (avoid spam)
        if (Math.abs(newPosition.x - oldPosition.x) > 0.01 || 
            Math.abs(newPosition.y - oldPosition.y) > 0.01) {
          console.log(
            `PHYSICS: Updated player ${player.id} position from (${oldPosition.x.toFixed(2)}, ${oldPosition.y.toFixed(2)}) ` +
            `to (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}) with velocity (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`
          );
        }
      } else if (player.isAlive) {
        console.error(`PHYSICS: Missing body for alive player ${player.id}`);
      }
    }
  }
  
  private isBodyOnGround(body: Matter.Body): boolean {
    // Using a raycast from the bottom of the player body down a short distance
    // This is more reliable than a point query
    
    // Calculate the bottom center of the player body
    const startPoint = {
      x: body.position.x,
      y: body.position.y + (body.bounds.max.y - body.bounds.min.y) / 2 - 1
    };
    
    // Create an end point 5px below the player
    const endPoint = {
      x: startPoint.x,
      y: startPoint.y + 5
    };
    
    // Do a raycast query
    const rayCollisions = Matter.Query.ray(
      Matter.Composite.allBodies(this.engine.world),
      startPoint,
      endPoint
    );
    
    // Check if we hit any platform
    const onGround = rayCollisions.some(collision => {
      // Matter.js raycast returns objects with bodyA and bodyB
      const hitBody = collision.bodyA || collision.bodyB;
      return hitBody !== body && // Not self
        (hitBody.label.startsWith('platform') || 
         hitBody.label.startsWith('ground'));
    });
    
    // Only log changes in ground status to avoid spam
    if (body.plugin && body.plugin.wasOnGround !== onGround) {
      console.log(`PHYSICS: Player ${body.label.substring(7)} ground status changed to ${onGround}`);
      
      if (!body.plugin) body.plugin = {};
      body.plugin.wasOnGround = onGround;
    }
    
    return onGround;
  }
  
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Handle player collisions with finish area
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'finish_area')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) {
          this.handlePlayerWin(playerId);
        }
      }
      
      // Handle player death from spikes
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'spike')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) {
          this.handlePlayerDeath(playerId, 'spike');
        }
      }
      
      // Handle player falling out of world
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'death_zone')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) {
          this.handlePlayerDeath(playerId, 'fall');
        }
      }
    });
  }
  
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
  
  private getPlayerIdFromBody(bodyA: Matter.Body, bodyB: Matter.Body): string | null {
    if (bodyA.label.startsWith('player_')) {
      return bodyA.label.substring(7); // Remove 'player_' prefix
    }
    
    if (bodyB.label.startsWith('player_')) {
      return bodyB.label.substring(7); // Remove 'player_' prefix
    }
    
    return null;
  }
  
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    // Get player from registry
    const player = this.session.getPlayer(playerId);
    
    if (player && player.isAlive) {
      // Update player alive state via registry
      this.session.setPlayerAliveStatus(playerId, false);
      console.log(`[PhysicsEngine:${this.sessionId}] Player ${playerId} died from ${cause}`);
      
      // Publish death event to game logic
      gameEvents.publish('PLAYER_DEATH', {
        playerId,
        cause,
        position: { ...player.position },
        instanceId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }

  private handlePlayerWin(playerId: string): void {
    // Get player from registry
    const player = this.session.getPlayer(playerId);
    
    if (player && player.isAlive) {
      console.log(`[PhysicsEngine:${this.sessionId}] Player ${playerId} won!`);
      
      // Publish win event to game logic
      gameEvents.publish('PLAYER_WIN', {
        playerId,
        position: { ...player.position },
        instanceId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }
  
  private createPlayerBody(player: Player): Matter.Body {
    const { id, position } = player;
    
    // Log detailed info about initial position
    console.log(`PHYSICS: Creating body for player ${id} at position (${position.x}, ${position.y})`);
    
    // Ensure position is within valid bounds
    const safePosition = {
      x: position.x,
      y: Math.max(0, Math.min(position.y, GAME_DIMENSIONS.HEIGHT - 50)) // Prevent out-of-bounds
    };
    
    if (safePosition.y !== position.y) {
      console.warn(`PHYSICS: Adjusted Y position from ${position.y} to ${safePosition.y} to keep in bounds`);
      // Update player position in registry if needed
      this.session.updatePlayerPosition(id, safePosition);
    }
    
    // Create player body with standard dimensions
    const body = Matter.Bodies.rectangle(
      safePosition.x,
      safePosition.y,
      PLAYER.WIDTH, // Use constant from shared config
      PLAYER.HEIGHT, // Use constant from shared config
      {
        label: `player_${id}`,
        inertia: Infinity, // Prevent rotation
        friction: PHYSICS.GROUND_FRICTION,
        frictionAir: PHYSICS.AIR_FRICTION,
        restitution: PHYSICS.RESTITUTION,
        collisionFilter: {
          category: CATEGORIES.PLAYER,
          mask: COLLISION_MASKS.PLAYER
        }
      }
    );
    
    // Add to world and track
    Matter.Composite.add(this.engine.world, body);
    this.bodies.set(id, body);
    
    console.log(`PHYSICS: Created physics body for player ${id} at (${safePosition.x}, ${safePosition.y}) with size ${PLAYER.WIDTH}x${PLAYER.HEIGHT}`);
    
    return body;
  }
  
  /**
   * Apply force to a player's physics body
   */
  public applyForce(playerId: string, force: Vector2D): void {
    const body = this.bodies.get(playerId);
    if (!body) {
      console.log(`[PhysicsEngine:${this.sessionId}] No physics body found for player ${playerId}`);
      return;
    }

    // Get player from registry to check if they're alive
    const player = this.session.getPlayer(playerId);
    if (!player || !player.isAlive) {
      console.log(`[PhysicsEngine:${this.sessionId}] Player ${playerId} is not alive or not found`);
      return;
    }

    // Apply force at the center of mass
    Matter.Body.applyForce(body, body.position, force);
  }
  
  /**
   * Create physics body for a game item
   */
  createGameItem(item: any): Matter.Body {
    console.log(`[PhysicsEngine:${this.sessionId}] Creating physics body for item: ${item.type}`);
    
    let body: Matter.Body;
    
    switch (item.type) {
      case 'shield': {
        console.log(`[PhysicsEngine:${this.sessionId}] Creating physics body for shield ${item.id}`);
        const width = item.properties.width || this.parameters.shield_width;
        const height = item.properties.height || this.parameters.shield_height;
        
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          width,
          height,
          {
            isStatic: true,
            label: `shield_${item.id}`,
            collisionFilter: {
              category: CATEGORIES.SHIELD,
              mask: CATEGORIES.PLAYER
            },
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            restitution: 0
          }
        );
        break;
      }
      case 'platform': {
        const width = item.properties.width || this.parameters.platform_width;
        const height = item.properties.height || this.parameters.platform_height;
        
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          width,
          height,
          {
            isStatic: true,
            label: 'platform',
            collisionFilter: {
              category: CATEGORIES.PLATFORM,
              mask: CATEGORIES.PLAYER
            }
          }
        );
        break;
      }
      case 'spike': {
        const width = item.properties.width || this.parameters.spike_width;
        const height = item.properties.height || this.parameters.spike_height;
        
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          width,
          height,
          {
            isStatic: true,
            label: 'spike',
            collisionFilter: {
              category: CATEGORIES.SPIKE,
              mask: CATEGORIES.PLAYER
            }
          }
        );
        break;
      }
      default:
        throw new Error(`Unknown item type: ${item.type}`);
    }
    
    // Add the body to the physics world
    Matter.Composite.add(this.engine.world, body);
    
    // Store the body with the item ID for later reference
    this.bodies.set(item.id, body);
    
    return body;
  }
  
  /**
   * Register an item with the physics engine and create its physics body
   * Public-facing wrapper around createGameItem for external components
   */
  registerItemWithPhysics(item: any): Matter.Body {
    return this.createGameItem(item);
  }

  /**
   * Debug method to log physics state information
   */
  private debugPhysicsState(): void {
    // Get all players directly from session for debugging
    const players = this.session.getAllPlayersForInstance(this.sessionId);
    const activeBodies = Array.from(this.bodies.keys());
    
    console.log(`PHYSICS ENGINE [${this.sessionId}]: Status update`);
    console.log(`- Players in session: ${players.length}`);
    console.log(`- Bodies tracked: ${activeBodies.length}`);
    console.log(`- Physics accumulator: ${this.accumulator.toFixed(2)}ms`);
  }
}