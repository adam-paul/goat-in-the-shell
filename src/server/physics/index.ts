import Matter from 'matter-js';
import { GameStateManager, Player, GameItem } from '../game-state';

// Constants for physics simulation
const PHYSICS_UPDATE_RATE = 60; // Updates per second
const TIME_STEP = 1000 / PHYSICS_UPDATE_RATE;
const MAX_STEP = 5 * TIME_STEP; // Max step size to prevent spiral of death

// Game physics constants
const GRAVITY = 0.8;
const PLAYER_MOVE_FORCE = 0.008;
const PLAYER_JUMP_FORCE = 0.016;

class PhysicsEngine {
  private engine: Matter.Engine;
  private gameState: GameStateManager;
  private bodies: Map<string, Matter.Body>;
  private lastUpdateTime: number;
  private accumulator: number;
  
  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
    this.bodies = new Map();
    this.lastUpdateTime = Date.now();
    this.accumulator = 0;
    
    // Create a Matter.js engine
    this.engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: GRAVITY
      }
    });
    
    // Add ground
    this.addStaticGround();
    
    // Start the engine update loop
    this.startPhysicsLoop();
  }
  
  /**
   * Add the static ground to the physics world
   */
  private addStaticGround(): void {
    const ground = Matter.Bodies.rectangle(400, 590, 800, 20, {
      isStatic: true,
      label: 'ground'
    });
    
    Matter.Composite.add(this.engine.world, ground);
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
   * Update the physics simulation
   */
  update(deltaTime: number): void {
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
      const body = this.bodies.get(player.id);
      if (!body) continue;
      
      // Apply horizontal movement force
      if (player.lastInput.left) {
        Matter.Body.applyForce(body, body.position, { x: -PLAYER_MOVE_FORCE, y: 0 });
      }
      
      if (player.lastInput.right) {
        Matter.Body.applyForce(body, body.position, { x: PLAYER_MOVE_FORCE, y: 0 });
      }
      
      // Apply jump force if on ground and jump pressed
      if (player.lastInput.jump && this.isBodyOnGround(body)) {
        Matter.Body.applyForce(body, body.position, { x: 0, y: -PLAYER_JUMP_FORCE });
      }
    }
  }
  
  /**
   * Check if a body is touching the ground
   */
  private isBodyOnGround(body: Matter.Body): boolean {
    const bodies = Matter.Query.point(
      Matter.Composite.allBodies(this.engine.world),
      { x: body.position.x, y: body.position.y + 30 }
    );
    
    return bodies.some(b => b.label === 'ground' || b.label.startsWith('platform'));
  }
  
  /**
   * Create a physics body for a player
   */
  createPlayerBody(player: Player): void {
    // Create a rectangular body for the player
    const body = Matter.Bodies.rectangle(
      player.position.x,
      player.position.y,
      30, // width
      50, // height
      {
        label: `player_${player.id}`,
        friction: 0.01,
        frictionAir: 0.05,
        restitution: 0.2
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
          item.properties.width || 100,
          item.properties.height || 20,
          {
            isStatic: true,
            label: `platform_${item.id}`,
            angle: item.rotation
          }
        );
        break;
        
      case 'spike':
        // Create a triangle shape for spikes
        const spikeWidth = item.properties.width || 30;
        
        body = Matter.Bodies.polygon(
          item.position.x,
          item.position.y,
          3, // triangle
          spikeWidth,
          {
            isStatic: true,
            label: `spike_${item.id}`,
            angle: item.rotation,
            // Store custom data for collision detection
            plugin: {
              itemType: 'spike'
            }
          }
        );
        break;
        
      case 'oscillator':
        // Create an oscillating platform
        body = Matter.Bodies.rectangle(
          item.position.x,
          item.position.y,
          item.properties.width || 100,
          item.properties.height || 20,
          {
            isStatic: false, // Will be moved programmatically
            label: `oscillator_${item.id}`,
            angle: item.rotation,
            plugin: {
              itemType: 'oscillator',
              // Store oscillation properties
              oscillator: {
                startX: item.position.x,
                startY: item.position.y,
                amplitudeX: item.properties.amplitudeX || 0,
                amplitudeY: item.properties.amplitudeY || 100,
                frequency: item.properties.frequency || 0.001,
                phase: 0
              }
            }
          }
        );
        
        // For oscillators, we need to manually move them
        Matter.Body.setStatic(body, true);
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
            label: `item_${item.id}`
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
      
      // Create body if it doesn't exist
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
      }
    }
    
    // Check for item-specific physics updates (like oscillators)
    for (const item of gameState.items) {
      const body = this.bodies.get(item.id);
      
      // Create body if it doesn't exist
      if (!body) {
        this.createItemBody(item);
        continue;
      }
      
      // Handle special item types
      if (item.type === 'oscillator' && body.plugin?.oscillator) {
        const osc = body.plugin.oscillator;
        osc.phase += 0.016; // Time step increment
        
        // Calculate new position based on oscillation
        const newX = osc.startX + Math.sin(osc.phase * osc.frequency) * osc.amplitudeX;
        const newY = osc.startY + Math.sin(osc.phase * osc.frequency) * osc.amplitudeY;
        
        Matter.Body.setPosition(body, { x: newX, y: newY });
      }
      
      // Update item positions from physics (needed for non-static items)
      if (!body.isStatic || item.type === 'oscillator') {
        item.position.x = body.position.x;
        item.position.y = body.position.y;
        item.rotation = body.angle;
      }
    }
    
    // Check for collisions
    this.checkCollisions();
  }
  
  /**
   * Check for collisions between physics bodies
   */
  private checkCollisions(): void {
    const pairs = this.engine.pairs.list;
    
    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Check for player-spike collisions
      if (
        (bodyA.label.startsWith('player_') && bodyB.plugin?.itemType === 'spike') ||
        (bodyB.label.startsWith('player_') && bodyA.plugin?.itemType === 'spike')
      ) {
        const playerId = bodyA.label.startsWith('player_') 
          ? bodyA.label.substring(7)
          : bodyB.label.substring(7);
          
        this.handlePlayerDeath(playerId, 'spike');
      }
      
      // Check for player falling off screen
      for (const [playerId, body] of this.bodies.entries()) {
        if (body.label.startsWith('player_') && body.position.y > 600) {
          this.handlePlayerDeath(playerId, 'fall');
        }
      }
    }
  }
  
  /**
   * Handle player death
   */
  private handlePlayerDeath(playerId: string, cause: string): void {
    const gameState = this.gameState.getState();
    const player = gameState.players.find((p: any) => p.id === playerId);
    
    if (player && player.isAlive) {
      player.isAlive = false;
      console.log(`Player ${playerId} died from ${cause}`);
      
      // In a real implementation, this would trigger an event to the game logic
    }
  }
}

export function setupPhysicsEngine(gameState: GameStateManager): PhysicsEngine {
  return new PhysicsEngine(gameState);
}

export { PhysicsEngine };