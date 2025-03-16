import Matter from 'matter-js';
import { GameStateManager } from '../game-state';
import { DeathType, Vector2D } from '../../shared/types';
import { gameEvents } from '../game-state/GameEvents';
import { PHYSICS, ITEMS } from '../../shared/constants';
import { PlayerRegistry, Player } from '../registry';

// Constants for physics simulation
const PHYSICS_UPDATE_RATE = 60; // Updates per second
const TIME_STEP = 1000 / PHYSICS_UPDATE_RATE;
const MAX_STEP = 5 * TIME_STEP; // Max step size to prevent spiral of death

// Game physics constants - all from shared constants
const GRAVITY = PHYSICS.GRAVITY;
const PLAYER_MOVE_FORCE = PHYSICS.PLAYER_MOVE_FORCE;
const PLAYER_JUMP_FORCE = PHYSICS.PLAYER_JUMP_FORCE;

// These could be moved to shared constants as well in the future
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 800;

// Game parameters (default values) - all derived from shared constants
const DEFAULT_PARAMETERS = {
  gravity: GRAVITY,
  player_move_speed: PLAYER_MOVE_FORCE,
  player_jump_force: PLAYER_JUMP_FORCE,
  dart_speed: PHYSICS.DART_SPEED,
  dart_frequency: ITEMS.DART_WALL.DART_INTERVAL, // milliseconds between dart shots
  platform_width: ITEMS.PLATFORM.DEFAULT_WIDTH,
  platform_height: ITEMS.PLATFORM.DEFAULT_HEIGHT,
  spike_width: ITEMS.PLATFORM.DEFAULT_WIDTH,
  spike_height: ITEMS.PLATFORM.DEFAULT_HEIGHT,
  oscillator_width: ITEMS.OSCILLATOR.DEFAULT_WIDTH, 
  oscillator_height: ITEMS.OSCILLATOR.DEFAULT_HEIGHT,
  oscillator_distance: ITEMS.OSCILLATOR.DEFAULT_AMPLITUDE_Y,
  shield_width: ITEMS.SHIELD.WIDTH,
  shield_height: ITEMS.SHIELD.HEIGHT,
  dart_wall_height: ITEMS.DART_WALL.HEIGHT,
  tilt: 0 // degrees
};

// Custom collision categories (bit flags)
const CATEGORIES = {
  DEFAULT: 0x0001,
  PLAYER: 0x0002,
  PLATFORM: 0x0004,
  SPIKE: 0x0008,
  DART: 0x0010,
  SHIELD: 0x0020,
  WALL: 0x0040,
  DEATH_ZONE: 0x0080
};

// Define collision masks for each category
const COLLISION_MASKS = {
  PLAYER: CATEGORIES.DEFAULT | CATEGORIES.PLATFORM | CATEGORIES.SPIKE | CATEGORIES.DART | CATEGORIES.SHIELD | CATEGORIES.WALL | CATEGORIES.DEATH_ZONE,
  DART: CATEGORIES.PLAYER | CATEGORIES.SHIELD,
  SHIELD: CATEGORIES.PLAYER | CATEGORIES.DART,
  PLATFORM: CATEGORIES.PLAYER,
  SPIKE: CATEGORIES.PLAYER,
  WALL: CATEGORIES.PLAYER,
  DEATH_ZONE: CATEGORIES.PLAYER
};

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
  private darts: Map<string, {
    body: Matter.Body;
    createdAt: number;
    lifetime: number;
    wallId?: string;
  }> = new Map();

  // Track dart walls and their metadata
  private dartWalls: Map<string, {
    body: Matter.Body | null;
    lastShotTime: number;
    isBuiltIn: boolean;
  }> = new Map();

  private dartTimer: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = Date.now();
  private accumulator: number = 0;
  private worldBounds: Matter.Body[] = [];
  private parameters: Record<string, number>;

  constructor(
    private instanceId: string,
    private gameState: GameStateManager,
    private playerRegistry: PlayerRegistry,
    parameters = DEFAULT_PARAMETERS
  ) {
    this.gameState = gameState;
    this.playerRegistry = playerRegistry;
    this.parameters = { ...DEFAULT_PARAMETERS, ...parameters };

    // Create physics engine for this instance
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: PHYSICS.GRAVITY }
    });

    // Create collision categories and collision handling
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart.bind(this));
    
    // Subscribe to game events for this instance
    this.setupEventHandlers();
    
    // Create world boundaries
    this.createWorldBounds();
    
    // Create platforms and dart walls from game world
    const gameWorldData = this.gameState.getGameWorld();
    if (gameWorldData) {
      console.log(`[PhysicsEngine:${this.instanceId}] Setting up world with ${gameWorldData.platforms.length} platforms and ${gameWorldData.dartWalls.length} dart walls`);
      this.createPlatformsFromGameWorld(gameWorldData);
    }
    
    // Create death zone at bottom of world
    this.createDeathZone();

    // Initial sync
    this.syncGameState();
    
    console.log(`[PhysicsEngine:${this.instanceId}] Physics engine instance created successfully`);
  }

  /**
   * Set up event handlers specific to this instance
   */
  private setupEventHandlers(): void {
    // Subscribe to game events with instance filtering
    gameEvents.subscribe('PLAYER_MOVE', (data: PlayerMoveEvent) => {
      // Check if this event is for a player in this instance
      const playerInstanceId = this.playerRegistry.getPlayerInstance(data.playerId);
      if (playerInstanceId === this.instanceId) {
        this.applyForce(data.playerId, data.force);
      }
    });

    gameEvents.subscribe('PLAYER_JUMP', (data: PlayerJumpEvent) => {
      // Check if this event is for a player in this instance
      const playerInstanceId = this.playerRegistry.getPlayerInstance(data.playerId);
      if (playerInstanceId === this.instanceId) {
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
   * Start the dart timer for this instance
   */
  startDartTimer(): void {
    if (this.dartTimer) {
      clearInterval(this.dartTimer);
    }
    
    // Set interval for dart shooting
    const interval = Math.min(1000, this.parameters.dart_frequency || ITEMS.DART_WALL.DART_INTERVAL);
    this.dartTimer = setInterval(() => this.shootDarts(), interval);
    
    console.log(`[PhysicsEngine:${this.instanceId}] Started dart timer with interval: ${interval}ms`);
  }
  
  /**
   * Stop the dart timer for this instance
   */
  stopDartTimer(): void {
    if (this.dartTimer) {
      clearInterval(this.dartTimer);
      this.dartTimer = null;
      console.log(`[PhysicsEngine:${this.instanceId}] Stopped dart timer`);
    }
  }
  
  /**
   * Clean up resources when this physics instance is destroyed
   */
  destroy(): void {
    // Stop timers
    this.stopDartTimer();
    
    // Clear Matter.js engine
    Matter.Engine.clear(this.engine);
    
    // Clear maps
    this.bodies.clear();
    this.darts.clear();
    this.dartWalls.clear();
    
    console.log(`[PhysicsEngine:${this.instanceId}] Physics engine instance destroyed`);
  }
  
  /**
   * Create world boundaries
   */
  private createWorldBounds(): void {
    // Create invisible walls at the edges of the world (left, right, and top)
    const leftWall = Matter.Bodies.rectangle(
      0, WORLD_HEIGHT/2, 10, WORLD_HEIGHT, 
      { isStatic: true, label: 'leftWall' }
    );
    
    const rightWall = Matter.Bodies.rectangle(
      WORLD_WIDTH, WORLD_HEIGHT/2, 10, WORLD_HEIGHT, 
      { isStatic: true, label: 'rightWall' }
    );
    
    const topWall = Matter.Bodies.rectangle(
      WORLD_WIDTH/2, 0, WORLD_WIDTH, 10, 
      { isStatic: true, label: 'topWall' }
    );
    
    // Add to world bounds array
    this.worldBounds = [leftWall, rightWall, topWall];
    
    // Add to physics world
    Matter.Composite.add(this.engine.world, this.worldBounds);
  }
  
  /**
   * Create platforms and dart walls from game world data
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
              mask: CATEGORIES.DEFAULT | CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        
        Matter.Composite.add(this.engine.world, platformBody);
      });
    }
    
    // Create dart walls based on game world data
    if (gameWorld.dartWalls && Array.isArray(gameWorld.dartWalls)) {
      gameWorld.dartWalls.forEach((wall: any) => {
        const wallId = wall.id || `dart_wall_${Math.random().toString(36).substring(2, 9)}`;
        
        // Create wall body
        const wallBody = Matter.Bodies.rectangle(
          wall.position.x,
          wall.position.y,
          20, // Fixed width for walls (20px)
          wall.height,
          {
            isStatic: wall.isStatic,
            label: wallId,
            collisionFilter: {
              category: CATEGORIES.WALL,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        
        // Add wall to physics world
        Matter.Composite.add(this.engine.world, wallBody);
        
        // Register in dart walls tracking map
        this.dartWalls.set(wallId, {
          body: wallBody,
          lastShotTime: 0,
          isBuiltIn: true
        });
      });
    }
    
    // Create start and finish areas
    if (gameWorld.startPoint) {
      // Start point is just for visuals, no physics needed
      console.log(`[PhysicsEngine:${this.instanceId}] Start point set at (${gameWorld.startPoint.x}, ${gameWorld.startPoint.y})`);
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
      WORLD_WIDTH / 2, 
      WORLD_HEIGHT + 50, // Below the visible world
      WORLD_WIDTH, 
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
    // Skip physics updates if the state machine isn't in playing state
    if (deltaTime <= 0) return;
    
    // Add deltaTime to accumulator
    this.accumulator += deltaTime;
    
    // Cap accumulator to prevent spiral of death
    if (this.accumulator > MAX_STEP) {
      this.accumulator = MAX_STEP;
    }
    
    // Update physics in fixed time steps
    while (this.accumulator >= TIME_STEP) {
      // Apply forces based on player inputs
      this.applyPlayerForces();
      
      // Update special item physics (oscillators)
      this.updateSpecialItemPhysics();
      
      // Update dart physics
      this.updateDarts();
      
      // Step the physics simulation forward
      Matter.Engine.update(this.engine, TIME_STEP);
      
      this.accumulator -= TIME_STEP;
    }
    
    // Sync game state with physics state
    this.syncGameState();
  }
  
  /**
   * Apply forces to players based on their inputs
   */
  private applyPlayerForces(): void {
    // Get players for this instance from PlayerRegistry
    const activePlayers = this.playerRegistry.getAllPlayersForInstance(this.instanceId);
    if (!activePlayers.length) return;
    
    // Apply forces to each player
    for (const player of activePlayers) {
      // Skip if player is not alive
      if (!player.isAlive) continue;
      
      const body = this.bodies.get(player.id);
      if (!body) continue;
      
      // Get player input state from game state 
      const gameState = this.gameState.getState();
      const playerState = gameState.players.find((p: { id: string }) => p.id === player.id);
      if (!playerState?.lastInput) continue;
      
      // Apply horizontal movement force - match original implementation behavior
      if (playerState.lastInput.left) {
        // Set a fixed leftward velocity instead of applying force
        Matter.Body.setVelocity(body, {
          x: -6, // Fixed velocity
          y: body.velocity.y // Maintain vertical velocity
        });
      } else if (playerState.lastInput.right) {
        // Set a fixed rightward velocity instead of applying force
        Matter.Body.setVelocity(body, {
          x: 6, // Fixed velocity
          y: body.velocity.y // Maintain vertical velocity
        });
      } else {
        // In original implementation, player comes to a full stop when not pressing keys
        Matter.Body.setVelocity(body, {
          x: 0, // Full stop (no sliding)
          y: body.velocity.y // Maintain vertical velocity
        });
      }
      
      // Apply jump force if on ground and jump pressed
      if (playerState.lastInput.jump && this.isBodyOnGround(body)) {
        Matter.Body.setVelocity(body, {
          x: body.velocity.x,
          y: -this.parameters.player_jump_force * 20 // Scale to match original physics
        });
      }
    }
  }
  
  /**
   * Update physics for special items like oscillating platforms
   */
  private updateSpecialItemPhysics(): void {
    const gameState = this.gameState.getState();
    
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
   * Update dart positions and check lifetime
   */
  private updateDarts(): void {
    const now = Date.now();
    
    // Check each dart
    for (const [dartId, dart] of this.darts.entries()) {
      // Skip entries without bodies
      if (!dart.body) continue;
      
      // Remove darts that have lived too long
      if (now - dart.createdAt > dart.lifetime) {
        this.removeDart(dartId);
        continue;
      }
      
      // Check if dart is out of bounds
      if (
        dart.body.position.x < 0 ||
        dart.body.position.x > WORLD_WIDTH ||
        dart.body.position.y < 0 ||
        dart.body.position.y > WORLD_HEIGHT
      ) {
        this.removeDart(dartId);
      }
    }
  }
  
  /**
   * Helper to properly remove darts from all tracking systems
   */
  private removeDart(dartId: string): void {
    const dart = this.darts.get(dartId);
    if (!dart || !dart.body) return;
    
    // Remove from physics world
    Matter.Composite.remove(this.engine.world, dart.body);
    
    // Remove from dart tracking
    this.darts.delete(dartId);
    
    // Remove from game state projectiles
    this.gameState.removeProjectile(dartId);
  }
  
  /**
   * Sync physics state with game state
   */
  private syncGameState(): void {
    // Get players for this instance from PlayerRegistry
    const activePlayers = this.playerRegistry.getAllPlayersForInstance(this.instanceId);
    if (!activePlayers.length) return;
    
    // Sync player positions
    for (const player of activePlayers) {
      const body = this.bodies.get(player.id);
      
      // Create body if it doesn't exist and player is alive
      if (!body && player.isAlive) {
        this.createPlayerBody(player);
        continue;
      }
      
      // Update player state from physics
      if (body) {
        this.playerRegistry.updatePlayerPosition(player.id, {
          x: body.position.x,
          y: body.position.y
        });
        this.playerRegistry.updatePlayerVelocity(player.id, {
          x: body.velocity.x,
          y: body.velocity.y
        });
        
        // Update onGround status using PlayerRegistry
        const onGround = this.isBodyOnGround(body);
        this.playerRegistry.updatePlayerGroundStatus(player.id, onGround);
      }
    }
  }
  
  private isBodyOnGround(body: Matter.Body): boolean {
    // Create a small rectangle below the player to check for collisions
    const point = { 
      x: body.position.x, 
      y: body.position.y + body.bounds.max.y - body.bounds.min.y + 2 // Just below the body
    };
    
    // Query for any bodies at this point
    const bodies = Matter.Query.point(
      Matter.Composite.allBodies(this.engine.world),
      point
    );
    
    // Filter out the player's own body and non-platform bodies
    return bodies.some(b => 
      b !== body && 
      (b.label.startsWith('platform') || 
       b.label.startsWith('ground'))
    );
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
      
      // Handle dart collisions
      if (bodyA.label.startsWith('dart_') || bodyB.label.startsWith('dart_')) {
        const dartBody = bodyA.label.startsWith('dart_') ? bodyA : bodyB;
        const otherBody = bodyA.label.startsWith('dart_') ? bodyB : bodyA;
        const dartId = dartBody.label;
        
        // Get the dart from our tracking map
        const dart = Array.from(this.darts.entries())
          .find(([id, data]) => data.body === dartBody);
          
        if (!dart) return; // Dart not found in tracking map
        
        // Handle dart hitting shield
        if (otherBody.label.includes('shield_')) {
          // Emit event for visual effects
          gameEvents.publish('DART_HIT_SHIELD', {
            position: dartBody.position,
            velocity: dartBody.velocity,
            instanceId: this.instanceId
          });
          
          // Remove the dart
          this.removeDart(dart[0]);
        }
        // Handle dart hitting player
        else if (otherBody.label.includes('player_')) {
          // Get player ID from body label
          const playerId = otherBody.label.split('_')[1];
          
          // Handle player death
          this.handlePlayerDeath(playerId, 'dart');
          
          // Remove the dart
          this.removeDart(dart[0]);
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
    const player = this.playerRegistry.getPlayer(playerId);
    
    if (player && player.isAlive) {
      // Update player alive state via registry
      this.playerRegistry.setPlayerAliveStatus(playerId, false);
      console.log(`[PhysicsEngine:${this.instanceId}] Player ${playerId} died from ${cause}`);
      
      // Publish death event to game logic
      gameEvents.publish('PLAYER_DEATH', {
        playerId,
        cause,
        position: { ...player.position },
        instanceId: this.instanceId,
        timestamp: Date.now()
      });
    }
  }

  private handlePlayerWin(playerId: string): void {
    // Get player from registry
    const player = this.playerRegistry.getPlayer(playerId);
    
    if (player && player.isAlive) {
      console.log(`[PhysicsEngine:${this.instanceId}] Player ${playerId} won!`);
      
      // Publish win event to game logic
      gameEvents.publish('PLAYER_WIN', {
        playerId,
        position: { ...player.position },
        instanceId: this.instanceId,
        timestamp: Date.now()
      });
    }
  }
  
  private createPlayerBody(player: Player): Matter.Body {
    const { id, position } = player;
    
    // Create player body with standard dimensions
    const body = Matter.Bodies.rectangle(
      position.x,
      position.y,
      30, // width - standard player hitbox width
      40, // height - standard player hitbox height
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
    
    console.log(`[PhysicsEngine:${this.instanceId}] Created physics body for player ${id} at position:`, position);
    
    return body;
  }
  
  /**
   * Shoot darts from walls for this instance
   */
  shootDarts(): void {
    const now = Date.now();
    const dartFrequency = this.parameters.dart_frequency || ITEMS.DART_WALL.DART_INTERVAL;
    const dartSpeed = this.parameters.dart_speed || PHYSICS.DART_SPEED;
    
    // Process all tracked dart walls
    for (const [wallId, wallData] of this.dartWalls.entries()) {
      // Skip if cooldown hasn't elapsed
      if (now - wallData.lastShotTime < dartFrequency) continue;
      
      // Get wall position data
      let wallX = 0;
      let wallY = 0;
      let wallHeight = 0;
      
      // If this is a built-in wall, get position from game world
      if (wallData.isBuiltIn) {
        const gameState = this.gameState.getState();
        const wall = gameState.gameWorld?.dartWalls?.find((w: any) => w.id === wallId);
        if (!wall) continue; // Skip if wall not found
        
        wallX = wall.position.x;
        wallY = wall.position.y;
        wallHeight = wall.height || this.parameters.dart_wall_height || ITEMS.DART_WALL.HEIGHT;
      } 
      // Otherwise get position from physics body
      else if (wallData.body) {
        wallX = wallData.body.position.x;
        wallY = wallData.body.position.y;
        
        // Approximate height from body bounds
        wallHeight = wallData.body.bounds.max.y - wallData.body.bounds.min.y;
      } 
      else {
        continue; // Skip if we don't have position data
      }
      
      // Update last shoot time
      wallData.lastShotTime = now;
      
      // Create three darts per wall
      this.createDartsFromWall(wallId, wallX, wallY, wallHeight, dartSpeed);
    }
  }
  
  /**
   * Helper method to create darts from a wall
   */
  private createDartsFromWall(
    wallId: string, 
    wallX: number, 
    wallY: number, 
    wallHeight: number,
    dartSpeed: number
  ): void {
    const now = Date.now();
    
    // Create three darts per wall at different heights
    const positions = [
      wallY - wallHeight * 0.3, // Top dart
      wallY,                    // Middle dart
      wallY + wallHeight * 0.3  // Bottom dart
    ];
    
    positions.forEach((dartY, index) => {
      const dartId = `dart_${wallId}_${now}_${index}`;
      
      // Create dart body
      const dart = Matter.Bodies.rectangle(
        wallX + 15, // Offset from wall
        dartY,
        PHYSICS.DART_WIDTH,
        PHYSICS.DART_HEIGHT,
        {
          label: dartId,
          frictionAir: 0,
          friction: 0,
          restitution: 0,
          inertia: Infinity,
          isSensor: false,
          collisionFilter: {
            category: CATEGORIES.DART,
            mask: COLLISION_MASKS.DART
          }
        }
      );
      
      // Set velocity
      Matter.Body.setVelocity(dart, {
        x: -dartSpeed,
        y: 0
      });
      
      // Add to world
      Matter.Composite.add(this.engine.world, dart);
      
      // Track the dart
      this.darts.set(dartId, {
        body: dart,
        createdAt: now,
        lifetime: 10000, // 10 seconds lifetime
        wallId
      });
      
      // Add to game state for client rendering
      const projectile = {
        id: dartId,
        type: 'dart',
        position: { x: wallX + 15, y: dartY },
        velocity: { x: -dartSpeed, y: 0 },
        createdAt: now
      };
      
      // Add to this instance's game state
      this.gameState.addProjectile(projectile);
      
      console.log(`[PhysicsEngine:${this.instanceId}] Created dart ${dartId} from wall ${wallId}`);
    });
  }
  
  /**
   * Apply force to a player's physics body
   */
  public applyForce(playerId: string, force: Vector2D): void {
    const body = this.bodies.get(playerId);
    if (!body) {
      console.log(`[PhysicsEngine:${this.instanceId}] No physics body found for player ${playerId}`);
      return;
    }

    // Get player from registry to check if they're alive
    const player = this.playerRegistry.getPlayer(playerId);
    if (!player || !player.isAlive) {
      console.log(`[PhysicsEngine:${this.instanceId}] Player ${playerId} is not alive or not found`);
      return;
    }

    // Apply force at the center of mass
    Matter.Body.applyForce(body, body.position, force);
  }
  
  /**
   * Create physics body for a game item
   */
  createGameItem(item: any): Matter.Body {
    console.log(`[PhysicsEngine:${this.instanceId}] Creating physics body for item: ${item.type}`);
    
    let body: Matter.Body;
    
    switch (item.type) {
      case 'shield': {
        console.log(`[PhysicsEngine:${this.instanceId}] Creating physics body for shield ${item.id}`);
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
              mask: CATEGORIES.DART // Direct specification of what shield can collide with
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
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
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
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        break;
      }
      case 'dart_wall': {
        const height = item.properties.height || this.parameters.dart_wall_height || ITEMS.DART_WALL.HEIGHT;
        
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          10, // Fixed width for dart walls
          height,
          {
            isStatic: true,
            label: `dart_wall_${item.id}`,
            collisionFilter: {
              category: CATEGORIES.WALL,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        
        // Register this wall in dart walls tracking
        this.dartWalls.set(item.id, {
          body: body,
          lastShotTime: 0,
          isBuiltIn: false
        });
        
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
}