import Matter from 'matter-js';
import { GameStateManager, Player, GameItem, setupGameInstanceManager } from '../game-state';
import { DeathType } from '../../shared/types';
import { gameEvents } from '../game-state/GameEvents';
import { PHYSICS } from '../../shared/constants';

// Constants for physics simulation
const PHYSICS_UPDATE_RATE = 60; // Updates per second
const TIME_STEP = 1000 / PHYSICS_UPDATE_RATE;
const MAX_STEP = 5 * TIME_STEP; // Max step size to prevent spiral of death

// Game physics constants - these are calibrated for Matter.js 
// to match Phaser's feel from original implementation
const GRAVITY = 0.9; // Calibrated to match Phaser's 300
const PLAYER_MOVE_FORCE = 0.012;
const PLAYER_JUMP_FORCE = 0.025;
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 800;

// Game parameters (default values)
const DEFAULT_PARAMETERS = {
  gravity: GRAVITY,
  player_move_speed: PLAYER_MOVE_FORCE,
  player_jump_force: PLAYER_JUMP_FORCE,
  dart_speed: 5,
  dart_frequency: 3000, // milliseconds between dart shots
  platform_width: 100,
  platform_height: 20,
  spike_width: 100,
  spike_height: 20,
  oscillator_width: 100, 
  oscillator_height: 20,
  oscillator_distance: 100,
  shield_width: 60,
  shield_height: 60,
  dart_wall_height: 100,
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

class PhysicsEngine {
  private engine: Matter.Engine;
  private gameState: GameStateManager;
  private instanceManager: any;
  private bodies: Map<string, Matter.Body>;
  private lastUpdateTime: number;
  private accumulator: number;
  private worldBounds: Matter.Body[];
  private parameters: Record<string, number>;
  private dartTimer: NodeJS.Timeout | null = null;
  private lastDartTime: number = 0;
  private darts: Map<string, {
    body: Matter.Body;
    createdAt: number;
    lifetime: number;
  }> = new Map();

  constructor(gameState: GameStateManager, instanceManager?: any) {
    this.instanceManager = instanceManager;
    this.gameState = gameState;
    console.log(`[PhysicsEngine] Initialized with GameStateManager: ${gameState.constructor.name}@${gameState.toString().split('\n')[0]}`);
    this.bodies = new Map();
    this.lastUpdateTime = Date.now();
    this.accumulator = 0;
    this.worldBounds = [];
    this.parameters = { ...DEFAULT_PARAMETERS };
    
    // Listen for physics activation events, which might trigger dart shooting
    gameEvents.subscribe('PHYSICS_ACTIVATE', (data: any) => {
      console.log(`[PhysicsEngine] Physics activated for instance ${data.instanceId}, ready for dart shooting`);
      // Initially pause the physics until the countdown completes
      this.engine.timing.timeScale = 0;
      
      // Schedule physics to start after a delay to match countdown
      setTimeout(() => {
        console.log(`[PhysicsEngine] Starting physics simulation and enabling dart shooting`);
        this.engine.timing.timeScale = 1;
        this.startDartTimer(); // Start dart timer only after countdown completes
      }, 3000); // Match the 3-second countdown duration
    });
    
    // Create a Matter.js engine
    this.engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: this.parameters.gravity
      }
    });

    // Add collision event handling
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart.bind(this));
    
    // Request game world data from GameStateManager
    const gameWorld = gameState.getGameWorld();
    
    // Add world bounds
    this.createWorldBounds();
    
    // Create physics bodies from game world data
    this.createPlatformsFromGameWorld(gameWorld);
    
    // Create death zone at bottom
    this.createDeathZone();
    
    // Start the engine update loop
    this.startPhysicsLoop();
    
    // NOTE: We don't start the dart timer here anymore
    // It will be started after the countdown completes via the PHYSICS_ACTIVATE event
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
    const gameState = this.gameState.getState();
    
    for (const player of gameState.players) {
      // Skip if player is not alive
      if (!player.isAlive) continue;
      
      const body = this.bodies.get(player.id);
      if (!body) continue;
      
      // Apply horizontal movement force - match original implementation behavior
      if (player.lastInput.left) {
        // Set a fixed leftward velocity instead of applying force
        // This creates more responsive movement matching original implementation
        Matter.Body.setVelocity(body, {
          x: -6, // Fixed velocity that feels like -200 in Phaser
          y: body.velocity.y // Maintain vertical velocity
        });
      } else if (player.lastInput.right) {
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
      if (player.lastInput.jump && this.isBodyOnGround(body)) {
        Matter.Body.setVelocity(body, {
          x: body.velocity.x,
          y: -this.parameters.player_jump_force * 20 // Scale to match Phaser physics
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
   * Shoot darts from walls
   */
  private shootDarts(): void {
    const gameState = this.gameState.getState();
    const now = Date.now();
    
    console.log(`[PhysicsEngine] shootDarts checking with GameStateManager: ${this.gameState.constructor.name}@${this.gameState.toString().split('\n')[0]}`);
    console.log(`[PhysicsEngine] Root GameStateManager is: ${(global as any).rootGameState.constructor.name}@${(global as any).rootGameState.toString().split('\n')[0]}`);
    
    // Access the global instance manager
    const instanceManager = (global as any).gameInstanceManager;
    if (!instanceManager) {
      console.log('[PhysicsEngine] No global instance manager found');
      return;
    }
    
    // Find the instance that contains this gameState
    const instances = instanceManager.getAllInstances();
    console.log(`[PhysicsEngine] Found ${instances.length} game instances. Looking for matching state object...`);
    
    let stateMachine = null;
    let found = false;
    
    for (const instance of instances) {
      console.log(`[PhysicsEngine] Checking instance ${instance.id}: ${instance.state.constructor.name}@${instance.state.toString().split('\n')[0]}`);
      
      if (instance.state === this.gameState) {
        found = true;
        stateMachine = instance.stateMachine;
        console.log(`[PhysicsEngine] Found matching instance ${instance.id} with state ${stateMachine.getCurrentState()}`);
        break;
      }
    }
    
    if (!found) {
      console.log(`[PhysicsEngine] No matching instance found for this GameStateManager!`);
    }
    
    // Check if game is currently in playing state
    if (!stateMachine || stateMachine.getCurrentState() !== 'playing') {
      console.log(`[PhysicsEngine] Not shooting darts - game status is not 'playing'`);
      return;
    }
    
    console.log(`[PhysicsEngine] Looking for dart walls to shoot from. Game status is 'playing'`);
    
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
        
        // Create three darts per wall at different heights (matching original implementation)
        const positions = [
          wallY - wallHeight * 0.3, // Top dart
          wallY,                    // Middle dart
          wallY + wallHeight * 0.3  // Bottom dart
        ];
        
        positions.forEach((dartY, index) => {
          // Create dart body (small rectangle)
          const dartWidth = PHYSICS.DART_WIDTH;
          const dartHeight = PHYSICS.DART_HEIGHT;
          
          const dart = Matter.Bodies.rectangle(
            wallX + 15, // Offset from wall
            dartY,
            dartWidth,  // Width from constants
            dartHeight, // Height from constants
            {
              label: `dart_${Date.now()}_${Math.random()}`,
              frictionAir: 0,         // No air friction to maintain velocity
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
          
          // Set velocity exactly as in original implementation
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
            lifetime: 10000 // 10 seconds lifetime, same as original
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
      // This mimics the original implementation's timing system
      if (now - lastShootTime < this.parameters.dart_frequency) {
        console.log(`[PhysicsEngine] Skipping placed wall ${dartWallId} - cooldown not elapsed`);
        continue; // Skip this wall until it's time to shoot again
      }
      
      console.log(`[PhysicsEngine] Placed wall ${dartWallId} ready to shoot darts at position (${wallX}, ${wallY})`);
      
      // Update last shoot time
      this.darts.set(`lastShoot_${dartWallId}`, {
        body: null as any, // Not an actual dart body
        createdAt: now,
        lifetime: this.parameters.dart_frequency
      });
      
      // Create three darts per wall at different heights (matching original implementation)
      const positions = [
        wallY - wallHeight * 0.3, // Top dart
        wallY,                    // Middle dart
        wallY + wallHeight * 0.3  // Bottom dart
      ];
      
      positions.forEach((dartY, index) => {
        // Create dart body (small rectangle)
        const dartWidth = PHYSICS.DART_WIDTH;
        const dartHeight = PHYSICS.DART_HEIGHT;
        
        const dart = Matter.Bodies.rectangle(
          wallX + 15, // Offset from wall
          dartY,
          dartWidth,  // Width from constants
          dartHeight, // Height from constants
          {
            label: `dart_${Date.now()}_${Math.random()}`,
            frictionAir: 0,         // No air friction to maintain velocity
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
        
        // Set velocity exactly as in original implementation
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
          lifetime: 10000 // 10 seconds lifetime, same as original
        });
        
        // Add to game state for client rendering
        this.gameState.addProjectile({
          id: dartId,
          type: 'dart',
          position: { x: wallX + 15, y: dartY },
          velocity: { x: -this.parameters.dart_speed, y: 0 },
          createdAt: now
        });
      });
    }
  }
  
  /**
   * Check if a body is touching the ground
   */
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
  
  /**
   * Handle collision events
   */
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    const pairs = event.pairs;
    
    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Player-spike collision
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'spike')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerDeath(playerId, 'spike');
      }
      
      // Player-dart collision
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'dart')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerDeath(playerId, 'dart');
        
        // Destroy the dart
        const dartBody = bodyA.label.startsWith('dart') ? bodyA : bodyB;
        if (dartBody) {
          this.removeDart(dartBody);
        }
      }
      
      // Dart-shield collision
      if (this.isCollisionBetween(bodyA, bodyB, 'dart', 'shield')) {
        // Destroy the dart
        const dartBody = bodyA.label.startsWith('dart') ? bodyA : bodyB;
        if (dartBody) {
          this.removeDart(dartBody);
        }
      }
      
      // Player-finish area collision
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'finish')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerWin(playerId);
      }
      
      // Player-death zone collision
      if (this.isCollisionBetween(bodyA, bodyB, 'player', 'death_zone')) {
        const playerId = this.getPlayerIdFromBody(bodyA, bodyB);
        if (playerId) this.handlePlayerDeath(playerId, 'fall');
      }
    }
  }
  
  /**
   * Check if a collision is between two specific types of bodies
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
   * Get player ID from a collision between player and another object
   */
  private getPlayerIdFromBody(bodyA: Matter.Body, bodyB: Matter.Body): string | null {
    if (bodyA.label.startsWith('player_')) {
      return bodyA.label.substring(7); // Remove 'player_' prefix
    }
    
    if (bodyB.label.startsWith('player_')) {
      return bodyB.label.substring(7); // Remove 'player_' prefix
    }
    
    return null;
  }
  
  /**
   * Remove a dart from the physics world
   */
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
  
  /**
   * Create a physics body for a player
   */
  createPlayerBody(player: Player): void {
    // Create a rectangular body for the player with goat-like dimensions
    const body = Matter.Bodies.rectangle(
      player.position.x,
      player.position.y,
      30, // width - similar to original goat hitbox
      40, // height - similar to original goat hitbox
      {
        label: `player_${player.id}`,
        friction: 0.01,
        frictionAir: 0.05,
        restitution: 0.2,
        collisionFilter: {
          category: CATEGORIES.PLAYER,
          mask: CATEGORIES.DEFAULT | CATEGORIES.PLATFORM | CATEGORIES.SPIKE | CATEGORIES.DART | CATEGORIES.DEATH_ZONE
        }
      }
    );
    
    // Store the body
    this.bodies.set(player.id, body);
    
    // Add the body to the physics world
    Matter.Composite.add(this.engine.world, body);
  }
  
  /**
   * Create a physics body for a game item
   */
  createItemBody(item: GameItem): void {
    let body: Matter.Body;
    
    switch (item.type) {
      case 'platform':
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          item.properties.width || this.parameters.platform_width,
          item.properties.height || this.parameters.platform_height,
          {
            isStatic: true,
            label: `platform_${item.id}`,
            angle: item.rotation || 0,
            collisionFilter: {
              category: CATEGORIES.PLATFORM,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        break;
        
      case 'spike':
        // Dangerous platform (rectangle with special collision handling)
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          item.properties.width || this.parameters.spike_width,
          item.properties.height || this.parameters.spike_height,
          {
            isStatic: true,
            label: `spike_${item.id}`,
            angle: item.rotation || 0,
            collisionFilter: {
              category: CATEGORIES.SPIKE,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            },
            // Store item type for collisions
            plugin: {
              itemType: 'spike'
            }
          }
        );
        break;
        
      case 'oscillator':
      case 'moving':
        // Create an oscillating platform
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          item.properties.width || this.parameters.oscillator_width,
          item.properties.height || this.parameters.oscillator_height,
          {
            isStatic: true, // Will be moved programmatically
            label: `oscillator_${item.id}`,
            angle: item.rotation || 0,
            collisionFilter: {
              category: CATEGORIES.PLATFORM,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            },
            plugin: {
              itemType: 'oscillator',
              // Store oscillation properties
              oscillator: {
                startX: item.position.x,
                startY: item.position.y,
                amplitudeX: item.properties.distance || this.parameters.oscillator_distance,
                amplitudeY: 0, // By default, only horizontal oscillation
                frequency: item.properties.frequency || 0.001,
                phase: 0
              }
            }
          }
        );
        break;
        
      case 'shield':
        // Shield block that blocks darts
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          item.properties.width || this.parameters.shield_width,
          item.properties.height || this.parameters.shield_height,
          {
            isStatic: true,
            label: `shield_${item.id}`,
            collisionFilter: {
              category: CATEGORIES.SHIELD,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            },
            plugin: {
              itemType: 'shield'
            }
          }
        );
        break;
        
      case 'dart_wall':
        // Dart wall that shoots darts
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          20, // Fixed width for walls (20px)
          item.properties.height || this.parameters.dart_wall_height,
          {
            isStatic: true,
            label: `dart_wall_${item.id}`,
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
        break;
        
      default:
        // Default to a static rectangle
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          50,
          50,
          {
            isStatic: true,
            label: `item_${item.id}`,
            collisionFilter: {
              category: CATEGORIES.DEFAULT,
              mask: CATEGORIES.PLAYER | CATEGORIES.DART
            }
          }
        );
        break;
    }
    
    // Store the body
    this.bodies.set(item.id, body);
    
    // Add the body to the physics world
    Matter.Composite.add(this.engine.world, body);
  }
  
  /**
   * Remove a physics body
   */
  removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    
    Matter.Composite.remove(this.engine.world, body);
    this.bodies.delete(id);
  }
  
  /**
   * Sync the game state with the physics state
   */
  private syncGameState(): void {
    const gameState = this.gameState.getState();
    
    // Sync player positions
    for (const player of gameState.players) {
      const body = this.bodies.get(player.id);
      
      // Create body if it doesn't exist and player is alive
      if (!body && player.isAlive) {
        this.createPlayerBody(player);
        continue;
      }
      
      // Update player state from physics
      if (body) {
        player.position.x = body.position.x;
        player.position.y = body.position.y;
        player.velocity.x = body.velocity.x;
        player.velocity.y = body.velocity.y;
        player.onGround = this.isBodyOnGround(body);
      }
    }
    
    // Check for item-specific physics updates
    for (const item of gameState.items) {
      const body = this.bodies.get(item.id);
      
      // Create body if it doesn't exist
      if (!body) {
        this.createItemBody(item);
        continue;
      }
      
      // Update item positions from physics (needed for non-static items)
      if (item.type === 'oscillator' || item.type === 'moving') {
        item.position.x = body.position.x;
        item.position.y = body.position.y;
        item.rotation = body.angle;
      }
    }
    
    // Update projectile positions (darts)
    for (const [dartId, dart] of this.darts.entries()) {
      // Skip entries that don't have actual bodies (like lastShoot trackers)
      if (!dart.body) continue;
      
      this.gameState.updateProjectile(dartId, {
        position: { 
          x: dart.body.position.x, 
          y: dart.body.position.y 
        },
        velocity: { 
          x: dart.body.velocity.x, 
          y: dart.body.velocity.y 
        }
      });
    }
  }
  
  /**
   * Handle player death
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    const gameState = this.gameState.getState();
    const players = gameState.players as Array<{
      id: string;
      isAlive: boolean;
      position: { x: number; y: number };
    }>;
    
    const player = players.find(p => p.id === playerId);
    
    if (player && player.isAlive) {
      player.isAlive = false;
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
  
  /**
   * Handle player win
   */
  private handlePlayerWin(playerId: string): void {
    const gameState = this.gameState.getState();
    const players = gameState.players as Array<{
      id: string;
      isAlive: boolean;
      position: { x: number; y: number };
    }>;
    
    const player = players.find(p => p.id === playerId);
    
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
  
  /**
   * Update physics parameters
   */
  updateParameters(parameters: Record<string, number>): void {
    // Update stored parameters
    for (const [key, value] of Object.entries(parameters)) {
      this.parameters[key] = value;
    }
    
    // Update gravity if changed
    if (parameters.gravity !== undefined) {
      this.engine.gravity.y = parameters.gravity;
    }
    
    // Update dart timer if frequency changed
    if (parameters.dart_frequency !== undefined) {
      this.startDartTimer(); // Will clear and restart with new frequency
    }
    
    // Log parameter updates
    console.log('Physics parameters updated:', parameters);
  }
  
  /**
   * Get current physics parameters
   */
  getParameters(): Record<string, number> {
    return { ...this.parameters };
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear dart timer
    if (this.dartTimer) {
      clearInterval(this.dartTimer);
      this.dartTimer = null;
    }
    
    // Clear all bodies
    Matter.Composite.clear(this.engine.world, false, true);
    this.bodies.clear();
    this.darts.clear();
    
    // Clear all event listeners
    Matter.Events.off(this.engine, 'collisionStart');
  }
}

export function setupPhysicsEngine(gameState: GameStateManager, instanceManager?: any): PhysicsEngine {
  return new PhysicsEngine(gameState, instanceManager);
}

export { PhysicsEngine };