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
  private darts: Map<string, {
    body: Matter.Body;
    createdAt: number;
    lifetime: number;
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

    // Start dart shooting timer if enabled
    if (parameters.dart_frequency > 0) {
      this.dartTimer = setInterval(() => this.shootDarts(), parameters.dart_frequency);
    }

    // Initial sync
    this.syncGameState();
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
        const wallBody = Matter.Bodies.rectangle(
          wall.position.x,
          wall.position.y,
          20, // Fixed width for walls (20px)
          wall.height,
          {
            isStatic: wall.isStatic,
            label: wall.id || `dart_wall_${Math.random().toString(36).substring(2, 9)}`,
            collisionFilter: {
              category: CATEGORIES.WALL,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            },
            plugin: {
              itemType: 'dart_wall',
              lastDartTime: 0
            }
          }
        );
        
        Matter.Composite.add(this.engine.world, wallBody);
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
    
    console.log(`[PhysicsEngine] Starting dart timer to check for active gameplay instances`);
    
    this.dartTimer = setInterval(() => {
      // Check for active game instances using the instance manager passed to constructor
      if (!this.instanceManager) {
        console.log(`[PhysicsEngine] No instance manager available, skipping dart check`);
        return;
      }
      
      const instances = this.instanceManager.getAllInstances();
      const activeInstances = instances.filter((instance: { stateMachine: { getCurrentState: () => string } }) => 
        instance.stateMachine.getCurrentState() === 'playing'
      );
      
      if (activeInstances.length > 0) {
        console.log(`[PhysicsEngine] Found ${activeInstances.length} active playing instances. Using first one's state for darts.`);
        
        // Use the first active instance's state manager as our shooting context
        const activeGameState = activeInstances[0].state;
        const dartWalls = this.getAllDartWalls(activeGameState);
        
        if (dartWalls.length > 0) {
          console.log(`[PhysicsEngine] Shooting darts from ${dartWalls.length} walls in active instance ${activeInstances[0].id}`);
          this.shootDartsForState(activeGameState);
          return; // We found an active instance and shot darts there
        } else {
          console.log(`[PhysicsEngine] No dart walls found in active instance ${activeInstances[0].id}`);
        }
      } else {
        console.log(`[PhysicsEngine] No active 'playing' instances found, not shooting darts`);
      }
    }, this.parameters.dart_frequency);
  }
  
  /**
   * Get all dart walls from a game state
   */
  private getAllDartWalls(gameState: GameStateManager): any[] {
    const state = gameState.getState();
    // Get static walls from game world
    const builtInWalls = state.gameWorld?.dartWalls || [];
    // Get user-placed walls from items
    const placedWalls = state.items.filter((item: { type: string }) => item.type === 'dart_wall');
    
    // Log what we found for debugging
    console.log(`[PhysicsEngine] Found ${builtInWalls.length} built-in dart walls and ${placedWalls.length} placed dart walls`);
    
    // Return all walls together
    return [...builtInWalls, ...placedWalls];
  }
  
  /**
   * Shoot darts for a specific game state
   */
  private shootDartsForState(gameState: GameStateManager): void {
    const state = gameState.getState();
    const now = Date.now();
    
    console.log(`[PhysicsEngine] Shooting darts for active game state`);
    
    // Process built-in dart walls
    if (state.gameWorld && state.gameWorld.dartWalls && state.gameWorld.dartWalls.length > 0) {
      this.processDartWalls(state.gameWorld.dartWalls, now, gameState);
    }
    
    // Process placed dart walls
    const placedWalls = state.items.filter((item: { type: string }) => item.type === 'dart_wall');
    if (placedWalls.length > 0) {
      this.processDartWalls(placedWalls, now, gameState);
    }
    
    // Publish a PROJECTILES_UPDATED event to notify the system that projectiles have been created
    // This follows the event-based architecture - components should communicate via the event system
    gameEvents.publish('PROJECTILES_UPDATED', {
      timestamp: now,
      instanceId: null // We don't know the instance ID here, but server components listening can determine it
    });
  }
  
  /**
   * Process dart walls to shoot darts
   */
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
      // Skip tracking entries that don't have bodies (like our lastShoot trackers)
      if (!dart.body) {
        continue;
      }
      
      // Remove darts that have lived too long
      if (now - dart.createdAt > dart.lifetime) {
        Matter.Composite.remove(this.engine.world, dart.body);
        this.darts.delete(dartId);
        continue;
      }
      
      // Check if dart is out of bounds
      if (
        dart.body.position.x < 0 ||
        dart.body.position.x > WORLD_WIDTH ||
        dart.body.position.y < 0 ||
        dart.body.position.y > WORLD_HEIGHT
      ) {
        Matter.Composite.remove(this.engine.world, dart.body);
        this.darts.delete(dartId);
      }
    }
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

  private removeDart(dartBody: Matter.Body): void {
    if (!dartBody) {
      console.log(`[PhysicsEngine] Attempted to remove null dart body`);
      return;
    }
    
    // Remove from physics engine
    Matter.Composite.remove(this.engine.world, dartBody);
    
    // Remove from dart tracking
    for (const [dartId, dart] of this.darts.entries()) {
      if (dart.body === dartBody) {
        this.darts.delete(dartId);
        
        // Also remove from game state for client
        this.gameState.removeProjectile(dartId);
        break;
      }
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
        const height = item.properties.height || this.parameters.dart_wall_height;
        
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          10, // Fixed width for dart walls
          height,
          {
            isStatic: true,
            label: 'dart_wall',
            collisionFilter: {
              category: CATEGORIES.WALL,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
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
    console.log(`[PhysicsEngine] --- PHYSICS WORLD BODIES ---`);
    
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
    
    console.log(`[PhysicsEngine] Total bodies: ${allBodies.length}`);
    console.log(`[PhysicsEngine] Shields: ${bodyCounts.shield}`);
    console.log(`[PhysicsEngine] Darts: ${bodyCounts.dart}`);
    console.log(`[PhysicsEngine] Platforms: ${bodyCounts.platform}`);
    console.log(`[PhysicsEngine] Players: ${bodyCounts.player}`);
    console.log(`[PhysicsEngine] Walls: ${bodyCounts.wall}`);
    console.log(`[PhysicsEngine] Other: ${bodyCounts.other}`);
    
    // Log shield positions for verification
    const shieldBodies = allBodies.filter(body => body.label.includes('shield'));
    shieldBodies.forEach(shield => {
      console.log(`[PhysicsEngine] Shield at (${shield.position.x}, ${shield.position.y})`);
    });
    
    console.log(`[PhysicsEngine] --- END PHYSICS WORLD BODIES ---`);
  }

  /**
   * Register an item with the physics engine and create its physics body
   */
  registerItemWithPhysics(item: GameItem): Matter.Body {
    console.log(`[PhysicsEngine] Registering item ${item.id} of type ${item.type} with physics engine`);
    
    // Log current state before adding new body
    this.logPhysicsBodies();
    
    let body: Matter.Body;
    
    if (item.type === 'shield') {
      // Create shield physics body
      body = Matter.Bodies.rectangle(
        item.position.x,
        item.position.y,
        item.properties.width || this.parameters.shield_width,
        item.properties.height || this.parameters.shield_height,
        {
          label: `shield_${item.id}`,
          isStatic: true,
          isSensor: false,
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
      
      // Add to physics world
      Matter.Composite.add(this.engine.world, body);
      
      // Track the shield body
      this.bodies.set(item.id, body);
      
      console.log(`[PhysicsEngine] Created shield physics body:`, {
        id: item.id,
        position: body.position,
        width: item.properties.width || this.parameters.shield_width,
        height: item.properties.height || this.parameters.shield_height,
        category: CATEGORIES.SHIELD,
        mask: CATEGORIES.DART
      });
    } else {
      // For other items, use the existing createGameItem method
      body = this.createGameItem(item);
    }
    
    // Log state after adding new body
    this.logPhysicsBodies();
    
    return body;
  }

  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Enhanced collision logging
      console.log(`[PhysicsEngine] Collision detected:`, {
        bodyA: {
          label: bodyA.label,
          position: bodyA.position,
          category: bodyA.collisionFilter.category,
          mask: bodyA.collisionFilter.mask
        },
        bodyB: {
          label: bodyB.label,
          position: bodyB.position,
          category: bodyB.collisionFilter.category,
          mask: bodyB.collisionFilter.mask
        }
      });
      
      // Handle dart collisions
      if (bodyA.label.includes('dart_') || bodyB.label.includes('dart_')) {
        const dart = bodyA.label.includes('dart_') ? bodyA : bodyB;
        const other = bodyA.label.includes('dart_') ? bodyB : bodyA;
        
        // Handle dart hitting shield
        if (other.label.includes('shield_')) {
          console.log(`[PhysicsEngine] SHIELD COLLISION DETECTED:`, {
            dartPosition: dart.position,
            shieldPosition: other.position,
            dartVelocity: dart.velocity
          });
          
          // Remove the dart
          Matter.Composite.remove(this.engine.world, dart);
          // Remove from tracking
          for (const [dartId, dartInfo] of this.darts.entries()) {
            if (dartInfo.body === dart) {
              this.darts.delete(dartId);
              console.log(`[PhysicsEngine] Removed dart ${dartId} after shield collision`);
              break;
            }
          }
          // Emit event for visual effects
          gameEvents.publish('DART_HIT_SHIELD', {
            position: dart.position,
            velocity: dart.velocity
          });
        }
        // Handle dart hitting player
        else if (other.label.includes('player_')) {
          console.log(`[PhysicsEngine] Dart hit player`);
          // Remove the dart
          Matter.Composite.remove(this.engine.world, dart);
          // Remove from tracking
          for (const [dartId, dartInfo] of this.darts.entries()) {
            if (dartInfo.body === dart) {
              this.darts.delete(dartId);
              break;
            }
          }
          // Get player ID from body label
          const playerId = other.label.split('_')[1];
          // Emit death event
          gameEvents.publish('PLAYER_DEATH', {
            type: 'dart' as DeathType,
            playerId,
            position: other.position
          });
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
   * Shoot darts from walls
   */
  private shootDarts(): void {
    const now = Date.now();
    const gameState = this.gameState.getState();
    const players = gameState.players;
    if (!players.length) return;

    const instance = this.instanceManager.getInstanceByPlayer(players[0].id);
    if (!instance) return;
    
    // Log physics world state before shooting darts
    console.log(`[PhysicsEngine] Verifying physics world before shooting darts:`);
    this.logPhysicsBodies();
    
    // Count built-in walls and placed walls
    let builtInWalls = gameState.gameWorld?.dartWalls?.length || 0;
    let placedWalls = gameState.items.filter((item: { type: string }) => item.type === 'dart_wall').length;
    console.log(`[PhysicsEngine] Found ${builtInWalls} built-in dart walls and ${placedWalls} placed dart walls`);

    // Check game world dart walls too
    if (gameState.gameWorld && gameState.gameWorld.dartWalls && gameState.gameWorld.dartWalls.length > 0) {
      console.log(`[PhysicsEngine] Processing ${gameState.gameWorld.dartWalls.length} built-in dart walls`);
      
      for (const wall of gameState.gameWorld.dartWalls) {
        // Get wall position
        const wallX = wall.position.x;
        const wallY = wall.position.y;
        const wallHeight = wall.height || this.parameters.dart_wall_height;
        
        // Check if last shoot time is tracked for this wall
        const dartWallId = wall.id;
        const lastShootTime = this.dartTimer ? this.darts.get(`lastShoot_${dartWallId}`)?.createdAt || 0 : 0;
        
        // Only shoot if enough time has passed since last shot for this wall
        if (now - lastShootTime < this.parameters.dart_frequency) {
          console.log(`[PhysicsEngine] Skipping wall ${dartWallId} - cooldown not elapsed`);
          continue; // Skip this wall until it's time to shoot again
        }
        
        console.log(`[PhysicsEngine] Wall ${dartWallId} ready to shoot darts at position (${wallX}, ${wallY})`);
        
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
          const dart = Matter.Bodies.rectangle(
            wallX + 15, // Offset from wall
            dartY,
            PHYSICS.DART_WIDTH,
            PHYSICS.DART_HEIGHT,
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
          this.gameState.addProjectile({
            id: dartId,
            type: 'dart',
            position: { x: wallX + 15, y: dartY },
            velocity: { x: -this.parameters.dart_speed, y: 0 },
            createdAt: now
          });
          
          console.log(`[PhysicsEngine] Created dart from built-in wall at (${wallX + 15}, ${dartY})`);
        });
      }
    }
    
    // Find all placed dart walls
    for (const item of gameState.items) {
      if (item.type !== 'dart_wall') continue;
      
      // Get wall position
      const wallX = item.position.x;
      const wallY = item.position.y;
      const wallHeight = item.properties.height || this.parameters.dart_wall_height;
      
      // Check if last shoot time is tracked for this wall
      const dartWallId = item.id;
      const lastShootTime = this.dartTimer ? this.darts.get(`lastShoot_${dartWallId}`)?.createdAt || 0 : 0;
      
      // Only shoot if enough time has passed since last shot for this wall
      if (now - lastShootTime < this.parameters.dart_frequency) {
        console.log(`[PhysicsEngine] Skipping wall ${dartWallId} - cooldown not elapsed`);
        continue; // Skip this wall until it's time to shoot again
      }
      
      console.log(`[PhysicsEngine] Wall ${dartWallId} ready to shoot darts at position (${wallX}, ${wallY})`);
      
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
        const dart = Matter.Bodies.rectangle(
          wallX + 15, // Offset from wall
          dartY,
          PHYSICS.DART_WIDTH,
          PHYSICS.DART_HEIGHT,
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
        this.gameState.addProjectile({
          id: dartId,
          type: 'dart',
          position: { x: wallX + 15, y: dartY },
          velocity: { x: -this.parameters.dart_speed, y: 0 },
          createdAt: now
        });
        
        console.log(`[PhysicsEngine] Created dart from placed wall at (${wallX + 15}, ${dartY})`);
      });
    }
  }
}

/**
 * Create and set up a physics engine instance
 */
export function setupPhysicsEngine(gameState: GameStateManager, playerRegistry: PlayerRegistry, instanceManager?: any): PhysicsEngine {
  return new PhysicsEngine(gameState, instanceManager, playerRegistry);
}