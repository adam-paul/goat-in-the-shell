import Matter from 'matter-js';
import { GameStateManager, GameItem, setupGameInstanceManager } from '../game-state';
import { DeathType } from '../../shared/types';
import { gameEvents } from '../game-state/GameEvents';
import { PHYSICS, ITEMS } from '../../shared/constants';
import { PlayerRegistry, Player } from '../registry';
import { Vector2D } from '../../shared/types';
import { GameInstanceManager } from '../game-state/GameInstanceManager';

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

export class PhysicsEngine {
  private engine: Matter.Engine;
  private gameState: GameStateManager;
  private playerRegistry: PlayerRegistry;
  private instanceManager: GameInstanceManager;
  private bodies: Map<string, Matter.Body> = new Map();
  // Track dart objects and their metadata
  private darts: Map<string, {
    body: Matter.Body;
    createdAt: number;
    lifetime: number;
    wallId?: string;  // Reference to the wall that created this dart
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
    gameState: GameStateManager,
    instanceManager: GameInstanceManager,
    playerRegistry: PlayerRegistry,
    parameters = {
      dart_frequency: 2000,
      dart_wall_height: 200
    }
  ) {
    this.gameState = gameState;
    this.instanceManager = instanceManager;
    this.playerRegistry = playerRegistry;
    this.parameters = parameters;

    // Create physics engine
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: PHYSICS.GRAVITY }
    });

    // Create collision categories and collision handling
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart.bind(this));
    
    // Subscribe to game events
    gameEvents.subscribe('PLAYER_MOVE', (data: PlayerMoveEvent) => {
      this.applyForce(data.playerId, data.force);
    });

    gameEvents.subscribe('PLAYER_JUMP', (data: PlayerJumpEvent) => {
      const body = this.bodies.get(data.playerId);
      if (!body) return;

      // Only allow jumping if on ground
      if (this.isBodyOnGround(body)) {
        Matter.Body.applyForce(body, body.position, { x: 0, y: -PHYSICS.PLAYER_JUMP_FORCE });
      }
    });

    // Create world boundaries
    this.createWorldBounds();
    
    // Create platforms and dart walls from game world
    const gameWorldData = this.gameState.getGameWorld();
    if (gameWorldData) {
      console.log(`[PhysicsEngine] Setting up world with ${gameWorldData.platforms.length} platforms and ${gameWorldData.dartWalls.length} dart walls`);
      this.createPlatformsFromGameWorld(gameWorldData);
    }
    
    // Create death zone at bottom of world
    this.createDeathZone();

    // Start dart shooting timer if enabled
    if (parameters.dart_frequency > 0) {
      console.log(`[PhysicsEngine] Starting dart timer with frequency ${parameters.dart_frequency}ms`);
      this.dartTimer = setInterval(() => this.shootDarts(), parameters.dart_frequency);
    }

    // Initial sync
    this.syncGameState();
    
    // Start physics update loop
    this.startPhysicsLoop();
    
    // Log all physics bodies to verify setup
    this.logPhysicsBodies();
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
      console.log(`Start point set at (${gameWorld.startPoint.x}, ${gameWorld.startPoint.y})`);
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
   * Start the physics update loop
   */
  private startPhysicsLoop(): void {
    // Initialize a single dart timer when physics engine starts
    // This ensures we only have one timer running across all instances
    this.startDartTimer();
    console.log(`[PhysicsEngine] Initialized single global dart timer with frequency ${this.parameters.dart_frequency}ms`);
    
    // Debug check for dart walls
    console.log(`[PhysicsEngine] Dart walls initialized: ${this.dartWalls.size} walls in map`);
    if (this.dartWalls.size > 0) {
      console.log(`[PhysicsEngine] First dart wall: ${Array.from(this.dartWalls.keys())[0]}`);
    } else {
      console.log(`[PhysicsEngine] WARNING: No dart walls configured!`);
    }

    const loop = (): void => {
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastUpdateTime;
      this.lastUpdateTime = currentTime;
      
      this.update(deltaTime);
      
      // Schedule next update
      setTimeout(loop, TIME_STEP);
    };
    
    loop();
  }
  
  /**
   * Start dart timer for shooting darts from walls
   */
  private startDartTimer(): void {
    if (this.dartTimer) {
      clearInterval(this.dartTimer);
    }
    
    // Set interval to check for dart walls that need to shoot
    const interval = Math.min(1000, this.parameters.dart_frequency || ITEMS.DART_WALL.DART_INTERVAL);
    this.dartTimer = setInterval(() => this.shootDarts(), interval);
  }
  
  // The previous dart wall detection methods have been replaced
  // with a more streamlined approach using the dartWalls Map
  
  // The previous dart shooting methods have been replaced
  // with a more streamlined approach
  
  // This method has been replaced by a more streamlined createDartsFromWall method
  private processDartWalls(walls: any[], now: number, gameState: GameStateManager): void {
    for (const wall of walls) {
      // Get wall position
      const wallX = wall.position.x;
      const wallY = wall.position.y;
      const wallHeight = wall.height || this.parameters.dart_wall_height;
      
      // Check if last shoot time is tracked for this wall
      const dartWallId = wall.id;
      const lastShootTime = this.dartTimer ? this.darts.get(`lastShoot_${dartWallId}`)?.createdAt || 0 : 0;
      
      // Only shoot if enough time has passed since last shot for this wall
      if (now - lastShootTime < this.parameters.dart_frequency) {
        continue; // Skip this wall until it's time to shoot again
      }
      
      // Update last shoot time
      this.darts.set(`lastShoot_${dartWallId}`, {
        body: null as any, // Not an actual dart body
        createdAt: now,
        lifetime: this.parameters.dart_frequency
      });
      
      // Create three darts per wall at different heights
      const positions = [
        wallY - wallHeight * 0.3, // Top dart
        wallY,                    // Middle dart
        wallY + wallHeight * 0.3  // Bottom dart
      ];
      
      positions.forEach((dartY, index) => {
        // Create dart body
        const dartWidth = PHYSICS.DART_WIDTH;
        const dartHeight = PHYSICS.DART_HEIGHT;
        
        const dart = Matter.Bodies.rectangle(
          wallX + 15, // Offset from wall
          dartY,
          dartWidth,
          dartHeight,
          {
            label: `dart_${Date.now()}_${Math.random()}`,
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
          x: -this.parameters.dart_speed,
          y: 0
        });
        
        // Add to world
        Matter.Composite.add(this.engine.world, dart);
        
        // Track the dart
        const dartId = `dart_${dartWallId}_${now}_${index}`;
        this.darts.set(dartId, {
          body: dart,
          createdAt: now,
          lifetime: 10000 // 10 seconds lifetime
        });
        
        // Add to game state for client rendering
        gameState.addProjectile({
          id: dartId,
          type: 'dart',
          position: { x: wallX + 15, y: dartY },
          velocity: { x: -this.parameters.dart_speed, y: 0 },
          createdAt: now
        });
        
        console.log(`[PhysicsEngine] Created dart from wall ${dartWallId} at (${wallX + 15}, ${dartY})`);
      });
    }
  }
  
  /**
   * Update the physics simulation
   */
  update(deltaTime: number): void {
    // Add deltaTime to accumulator
    this.accumulator += deltaTime;
    
    // Cap accumulator to prevent spiral of death
    if (this.accumulator > MAX_STEP) {
      this.accumulator = MAX_STEP;
    }
    
    // Skip physics updates if engine timeScale is 0 (during countdown)
    if (this.engine.timing.timeScale === 0) {
      // Just clear the accumulator and return
      this.accumulator = 0;
      return;
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
    // Get all active instances
    const instances = this.instanceManager.getAllInstances();
    if (!instances.length) return;
    
    // Process each active instance
    for (const instance of instances) {
      // Skip instances that aren't in playing state
      if (!instance.isActive || !instance.stateMachine.isGameplayActive()) continue;
      
      // Get players for this instance from PlayerRegistry
      const activePlayers = this.playerRegistry.getAllPlayersForInstance(instance.id);
      if (!activePlayers.length) continue;
      
      // Apply forces to each player
      for (const player of activePlayers) {
        // Skip if player is not alive
        if (!player.isAlive) continue;
        
        const body = this.bodies.get(player.id);
        if (!body) continue;
        
        // Get player input state from game state (TODO: Move this to PlayerRegistry)
        const gameState = instance.state.getState();
        const playerState = gameState.players.find((p: { id: string }) => p.id === player.id);
        if (!playerState?.lastInput) continue;
        
        // Apply horizontal movement force - match original implementation behavior
        if (playerState.lastInput.left) {
          // Set a fixed leftward velocity instead of applying force
          Matter.Body.setVelocity(body, {
            x: -6, // Fixed velocity that feels like -200 in Phaser
            y: body.velocity.y // Maintain vertical velocity
          });
        } else if (playerState.lastInput.right) {
          // Set a fixed rightward velocity instead of applying force
          Matter.Body.setVelocity(body, {
            x: 6, // Fixed velocity that feels like 200 in Phaser
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
            y: -this.parameters.player_jump_force * 20 // Scale to match Phaser physics
          });
        }
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
    // Get all active instances
    const instances = this.instanceManager.getAllInstances();
    if (!instances.length) return;
    
    // Process each active instance
    for (const instance of instances) {
      // Skip instances that aren't in playing state
      if (!instance.isActive || !instance.stateMachine.isGameplayActive()) continue;
      
      // Get players for this instance from PlayerRegistry
      const activePlayers = this.playerRegistry.getAllPlayersForInstance(instance.id);
      if (!activePlayers.length) continue;
      
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
      console.log(`Player ${playerId} died from ${cause}`);
      
      // Publish death event to game logic
      gameEvents.publish('PLAYER_DEATH', {
        playerId,
        cause,
        position: { ...player.position },
        timestamp: Date.now()
      });
    }
  }


  private handlePlayerWin(playerId: string): void {
    // Get player from registry
    const player = this.playerRegistry.getPlayer(playerId);
    
    if (player && player.isAlive) {
      console.log(`Player ${playerId} won!`);
      
      // Publish win event to game logic
      gameEvents.publish('PLAYER_WIN', {
        playerId,
        position: { ...player.position },
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
    
    console.log(`[PhysicsEngine] Created physics body for player ${id} at position:`, position);
    
    return body;
  }

  createGameItem(item: GameItem): Matter.Body {
    console.log(`[PhysicsEngine] Creating physics body for item: ${item.type}`);
    
    // Log all existing bodies for debugging
    const existingBodies = Array.from(this.bodies.values());
    const shieldBodies = existingBodies.filter(body => body.label.includes('shield_'));
    console.log(`[PhysicsEngine] Current shield bodies in world: ${shieldBodies.length}`);
    shieldBodies.forEach(body => {
      console.log(`[PhysicsEngine] Shield body: ${body.label} at position (${body.position.x}, ${body.position.y})`);
    });
    
    let body: Matter.Body;
    
    switch (item.type) {
      case 'shield': {
        console.log(`[PhysicsEngine] Creating physics body for shield ${item.id}`);
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
        
        // Log shield creation details
        console.log(`[PhysicsEngine] Created shield body:`, {
          id: item.id,
          label: body.label,
          position: body.position,
          width,
          height,
          category: CATEGORIES.SHIELD,
          mask: CATEGORIES.DART
        });
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
    
    // Verify body was added to world
    const worldBodies = Matter.Composite.allBodies(this.engine.world);
    console.log(`[PhysicsEngine] Total bodies in world after adding ${item.type}: ${worldBodies.length}`);
    
    return body;
  }

  private createDart(x: number, y: number, velocity: Matter.Vector): Matter.Body {
    const dartBody = Matter.Bodies.rectangle(x, y, PHYSICS.DART_WIDTH, PHYSICS.DART_HEIGHT, {
      label: `dart_${Date.now()}_${Math.random()}`,
      frictionAir: 0,
      friction: 0,
      restitution: 0,
      inertia: Infinity, // Prevent rotation
      collisionFilter: {
        category: CATEGORIES.DART,
        mask: COLLISION_MASKS.DART // Already using the consistent mask
      },
      plugin: {
        attractors: [
          // Counter gravity force
          (bodyA: Matter.Body) => ({
            x: 0,
            y: -this.engine.world.gravity.y * bodyA.mass
          })
        ]
      }
    });
    
    // Set the dart's velocity
    Matter.Body.setVelocity(dartBody, velocity);
    
    // Add the dart to the physics world
    Matter.Composite.add(this.engine.world, dartBody);
    
    return dartBody;
  }

  /**
   * Log all physics bodies in the world for debugging
   */
  private logPhysicsBodies(): void {
    // Get all bodies from the physics world
    const allBodies = Matter.Composite.allBodies(this.engine.world);
    
    // Count by type
    const bodyCounts = {
      shield: 0,
      dart: 0,
      platform: 0,
      player: 0,
      wall: 0,
      other: 0
    };
    
    allBodies.forEach(body => {
      if (body.label.includes('shield')) bodyCounts.shield++;
      else if (body.label.includes('dart')) bodyCounts.dart++;
      else if (body.label.includes('platform')) bodyCounts.platform++;
      else if (body.label.includes('player')) bodyCounts.player++;
      else if (body.label.includes('wall')) bodyCounts.wall++;
      else bodyCounts.other++;
    });
    
    console.log(`[PhysicsEngine] Total bodies: ${allBodies.length} (Shields: ${bodyCounts.shield}, Darts: ${bodyCounts.dart}, Walls: ${bodyCounts.wall}, Platforms: ${bodyCounts.platform}, Players: ${bodyCounts.player}, Other: ${bodyCounts.other})`);
  }

  /**
   * Register an item with the physics engine and create its physics body
   * This is a public-facing wrapper around createGameItem for external components
   */
  registerItemWithPhysics(item: GameItem): Matter.Body {
    return this.createGameItem(item);
  }

  /**
   * Handle collision events
   */
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
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
            velocity: dartBody.velocity
          });
          
          // Remove the dart
          this.removeDart(dart[0]);
        }
        // Handle dart hitting player
        else if (otherBody.label.includes('player_')) {
          // Get player ID from body label
          const playerId = otherBody.label.split('_')[1];
          
          // Emit death event
          gameEvents.publish('PLAYER_DEATH', {
            type: 'dart' as DeathType,
            playerId,
            position: otherBody.position,
            timestamp: Date.now()
          });
          
          // Remove the dart
          this.removeDart(dart[0]);
        }
      }
    });
  }

  /**
   * Apply force to a player's physics body
   */
  public applyForce(playerId: string, force: Vector2D): void {
    const body = this.bodies.get(playerId);
    if (!body) {
      console.log(`[PhysicsEngine] No physics body found for player ${playerId}`);
      return;
    }

    // Get player from registry to check if they're alive
    const player = this.playerRegistry.getPlayer(playerId);
    if (!player || !player.isAlive) {
      console.log(`[PhysicsEngine] Player ${playerId} is not alive or not found`);
      return;
    }

    // Apply force at the center of mass
    Matter.Body.applyForce(body, body.position, force);
  }

  /**
   * Shoot darts from walls - simplified implementation
   */
  private shootDarts(): void {
    const now = Date.now();
    const dartFrequency = this.parameters.dart_frequency || ITEMS.DART_WALL.DART_INTERVAL;
    const dartSpeed = this.parameters.dart_speed || PHYSICS.DART_SPEED;
    
    // Only process walls if there are active instances
    const instances = this.instanceManager.getAllInstances();
    const activeInstances = instances.filter(instance => 
      instance.stateMachine.getCurrentState() === 'playing'
    );
    
    if (activeInstances.length === 0) return;
    
    // Debug which gameState we're using
    console.log(`[DART SYSTEM] Root gameState id: ${this.gameState._debugId}, has ${this.gameState.getState().projectiles?.length || 0} projectiles`);
    activeInstances.forEach(instance => {
      console.log(`[DART SYSTEM] Instance ${instance.id} gameState id: ${instance.state._debugId}, has ${instance.state.getState().projectiles?.length || 0} projectiles`);
    });
    
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
      console.log(`\n[DART SYSTEM] ======================================`);
      console.log(`[DART SYSTEM] Creating darts from wall ${wallId} at position (${wallX}, ${wallY})`);
      console.log(`[DART SYSTEM] Wall height: ${wallHeight}, Dart speed: ${dartSpeed}, Game time: ${now}`);
      console.log(`[DART SYSTEM] ======================================\n`);
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
      
      // CRITICAL FIX: Add to EACH active instance's game state, not just the root
      const instances = this.instanceManager.getAllInstances();
      const activeInstances = instances.filter(instance => 
        instance.stateMachine.getCurrentState() === 'playing'
      );
      
      if (activeInstances.length === 0) {
        console.log(`[DART SYSTEM] WARNING: No active instances to add projectile ${dartId}`);
        return; // Skip creating darts if no active instances
      }
      
      console.log(`[DART SYSTEM] Adding projectile ${dartId} to ${activeInstances.length} active instances`);
      
      // Add to each active instance's game state
      activeInstances.forEach(instance => {
        console.log(`[DART SYSTEM] Adding projectile to instance ${instance.id} gameState (${instance.state._debugId})`);
        instance.state.addProjectile(projectile);
      });
      
      // Verify the projectile was added by checking first active instance
      setTimeout(() => {
        if (activeInstances.length > 0) {
          const firstInstance = activeInstances[0];
          const instanceState = firstInstance.state.getState();
          console.log(`[DART VERIFY] After adding projectile ${dartId} - Instance ${firstInstance.id} has ${instanceState.projectiles?.length || 0} projectiles`);
          
          // Check if this specific projectile exists
          const exists = instanceState.projectiles && instanceState.projectiles.some((p: any) => p.id === dartId);
          console.log(`[DART VERIFY] Projectile ${dartId} exists in instance ${firstInstance.id}: ${exists ? 'YES' : 'NO'}`);
        }
      }, 10);
    });
  }
}

/**
 * Create and set up a physics engine instance
 */
export function setupPhysicsEngine(gameState: GameStateManager, playerRegistry: PlayerRegistry, instanceManager?: any): PhysicsEngine {
  return new PhysicsEngine(gameState, instanceManager, playerRegistry);
}