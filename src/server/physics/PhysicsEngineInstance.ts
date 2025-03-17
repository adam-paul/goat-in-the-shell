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
      console.log(`[PhysicsEngine:${this.instanceId}] Setting up world with ${gameWorldData.platforms.length} platforms`);
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
  
  // Dart timer methods removed
  
  /**
   * Clean up resources when this physics instance is destroyed
   */
  destroy(): void {
    // Clear Matter.js engine
    Matter.Engine.clear(this.engine);
    
    // Clear maps
    this.bodies.clear();
    
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
  
  // Dart update methods removed
  
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
  
  // Dart firing methods removed
  
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
}