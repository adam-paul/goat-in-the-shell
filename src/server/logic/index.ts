import { Vector2D } from '../../shared/types';
import { GameSessionManager, setupGameSessionManager } from '../game-state';

/**
 * Handles game logic processing
 */
export class GameLogicProcessor {
  private sessionManager: GameSessionManager;
  private updateIntervalId: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = Date.now();
  private readonly PHYSICS_UPDATE_RATE = 16; // ~60fps
  
  constructor(options: any) {
    // Store reference to the session manager
    this.sessionManager = options.sessionManager;
  }
  
  /**
   * Start the game update loop
   */
  startUpdateLoop(): void {
    if (this.updateIntervalId !== null) {
      // Clear existing interval if it exists
      clearInterval(this.updateIntervalId);
    }
    
    this.lastUpdateTime = Date.now();
    
    // Set up session update loop
    this.updateIntervalId = setInterval(() => {
      const now = Date.now();
      const deltaTime = now - this.lastUpdateTime;
      this.lastUpdateTime = now;
      
      // Update all game sessions
      this.sessionManager.updateSessions(deltaTime);
    }, this.PHYSICS_UPDATE_RATE);
    
    console.log(`LOGIC: Started game update loop at ${this.PHYSICS_UPDATE_RATE}ms intervals`);
  }
  
  /**
   * Stop the game update loop
   */
  stopUpdateLoop(): void {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
      console.log('LOGIC: Stopped game update loop');
    }
  }
  
  /**
   * Handle player input
   */
  handlePlayerInput(playerId: string, input: any): void {
    if (!this.sessionManager) {
      console.error('LOGIC: SessionManager not available');
      return;
    }
    
    // Get the player from the session manager
    const player = this.sessionManager.getPlayer(playerId);
    
    if (player) {
      // Update the player's lastInput property
      player.lastInput = {
        left: input.left || false,
        right: input.right || false,
        jump: input.jump || false,
        timestamp: input.timestamp || Date.now()
      };
    } else {
      console.error(`LOGIC: Player ${playerId} not found for input update`);
    }
  }
  
  /**
   * Handle item placement
   */
  handlePlaceItem(playerId: string, data: any): any {
    // Process item placement
    // This would validate and create the item
    console.log(`LOGIC: Processing item placement from player ${playerId}`);
    
    // Return the created item
    return {
      id: `item_${Date.now()}`,
      type: data.type || 'platform',
      position: data.position || { x: 0, y: 0 },
      rotation: data.rotation || 0,
      placedBy: playerId,
      properties: data.properties || {}
    };
  }
  
  /**
   * Get the session manager instance
   */
  getSessionManager(): GameSessionManager {
    return this.sessionManager;
  }
}

/**
 * Create and initialize the game logic system
 */
export function setupGameLogic(): { 
  gameLogic: GameLogicProcessor, 
  sessionManager: GameSessionManager 
} {
  // Create the game session manager
  const sessionManager = setupGameSessionManager();
  console.log(`LOGIC: Created GameSessionManager`);
  
  // Initialize game logic processor
  const gameLogic = new GameLogicProcessor({ sessionManager });
  console.log(`LOGIC: Created GameLogicProcessor`);
  
  // Start the game update loop
  gameLogic.startUpdateLoop();
  
  return { gameLogic, sessionManager };
}