import { v4 as uuidv4 } from 'uuid';
import { GameStatus, DeathType, GameWorld, Vector2D, Player, UniversalGameState } from '../../shared/types';
import { gameEvents } from './GameEvents';
import { PLAYER, GAME_DIMENSIONS, GAME_STATUS_TRANSITIONS, GAME_EVENTS } from '../../shared/constants';
import { PhysicsEngineInstance } from '../physics/PhysicsEngineInstance';

// Define types for our game entities
interface GameItem {
  id: string;
  type: string;
  position: Vector2D;
  rotation: number;
  placedBy: string;
  // Additional properties depending on item type
  properties: Record<string, any>;
}

interface GameParameters {
  gravity: number;
  player_move_speed: number;
  player_jump_force: number;
  dart_speed: number;
  dart_frequency: number;
  platform_width: number;
  platform_height: number;
  spike_width: number;
  spike_height: number;
  oscillator_width: number;
  oscillator_height: number;
  oscillator_distance: number;
  shield_width: number;
  shield_height: number;
  dart_wall_height: number;
  tilt: number;
}

// Define the GameState interface
interface GameState {
  version: number;
  timestamp: number;
  gameStatus: GameStatus;
  players: Player[];
  gameWorld: GameWorld;
  items: GameItem[];
  parameters: Partial<GameParameters>;
  gameConfig: {
    gravity: number;
    moveSpeed: number;
    jumpForce: number;
  };
}

// Define the GameSession class
class GameSession {
  id: string;
  players = new Map<string, Player>();
  gameState: GameState;
  status: GameStatus = 'select';
  items: GameItem[] = [];
  physics: PhysicsEngineInstance | null = null;
  isActive: boolean = false;
  startTime: number = 0;
  lastUpdateTime: number = Date.now();
  stateVersion: number = 0;
  parameters: Partial<GameParameters> = {};
  gameWorld: GameWorld;
  stateHistory: Array<{state: GameStatus, timestamp: number}> = [];
  timers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(id: string) {
    this.id = id;
    this.gameState = this.createInitialGameState();
    this.gameWorld = {
      platforms: [],
      startPoint: { ...PLAYER.DEFAULT_POSITION },
      endPoint: { x: 2320, y: 120 },
      worldBounds: { width: GAME_DIMENSIONS.WIDTH, height: GAME_DIMENSIONS.HEIGHT }
    };
    
    // Initialize game world with default platforms
    this.initializeGameWorld();
    
    // Record initial state in history
    this.stateHistory.push({
      state: this.status,
      timestamp: Date.now()
    });
    
    console.log(`SESSION: Initialized session ${id} with state: ${this.status}`);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Create initial game state
   */
  private createInitialGameState(): GameState {
    return {
      version: 0,
      timestamp: Date.now(),
      gameStatus: 'select',
      players: [],
      gameWorld: this.gameWorld,
      items: [],
      parameters: this.parameters,
      gameConfig: {
        gravity: this.parameters.gravity || 0.5,
        moveSpeed: this.parameters.player_move_speed || 5,
        jumpForce: this.parameters.player_jump_force || 12
      }
    };
  }
  
  /**
   * Set up event listeners for game events
   */
  private setupEventListeners(): void {
    // Player death events
    gameEvents.subscribe(GAME_EVENTS.PLAYER_DEATH, (data: { 
      playerId: string, 
      cause: DeathType, 
      position: Vector2D, 
      timestamp: number
    }) => {
      // Only handle events for players in this session
      if (this.players.has(data.playerId)) {
        this.handlePlayerDeath(data.playerId, data.cause);
      }
    });
    
    // Player win events
    gameEvents.subscribe(GAME_EVENTS.PLAYER_WIN, (data: { 
      playerId: string, 
      position: Vector2D, 
      timestamp: number 
    }) => {
      // Only handle events for players in this session
      if (this.players.has(data.playerId)) {
        this.handlePlayerWin(data.playerId);
      }
    });
  }
  
  /**
   * Add a player to this session
   */
  addPlayer(playerId: string, playerName: string): Player {
    const player = {
      id: playerId,
      name: playerName,
      position: { ...PLAYER.DEFAULT_POSITION },
      velocity: { x: 0, y: 0 },
      isAlive: true,
      score: 0,
      onGround: true,
      facingLeft: false
    };
    
    this.players.set(playerId, player);
    return player;
  }
  
  /**
   * Remove a player from this session
   */
  removePlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }
  
  /**
   * Get a player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }
  
  /**
   * Get all players in this session
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
  
  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: GameStatus, toState: GameStatus): boolean {
    // Same state is always valid
    if (fromState === toState) return true;
    
    // Check against defined transitions
    const validNextStates = GAME_STATUS_TRANSITIONS[fromState];
    if (!validNextStates) return false;
    return validNextStates.includes(toState);
  }
  
  /**
   * Change game status with validation
   */
  transitionTo(status: GameStatus, force: boolean = false): boolean {
    // Validate transition
    const isValid = force || this.isValidTransition(this.status, status);
    if (!isValid) return false;
    
    // Store previous state for event
    const previousState = this.status;
    
    // Update state
    this.status = status;
    
    // Record in history
    this.stateHistory.push({
      state: status,
      timestamp: Date.now()
    });
    
    // Handle side effects
    this.handleStateEnter(status);
    
    return true;
  }
  
  /**
   * Handle side effects when entering a new state
   */
  private handleStateEnter(state: GameStatus): void {
    switch (state) {
      case 'playing':
        this.startPhysics();
        break;
      case 'game_over' as GameStatus:
        // Handle game over logic
        break;
      case 'victory' as GameStatus:
        // Handle victory logic
        break;
      default:
        // Handle other states
        break;
    }
  }
  
  /**
   * Start the physics engine for this session
   */
  private startPhysics(): void {
    if (!this.physics) {
      // Create physics engine for this session - we'll need to adapt this later
      this.physics = new PhysicsEngineInstance(this.id, {} as any, {} as any);
    }
    
    this.isActive = true;
    this.startTime = Date.now();
    
    // Publish physics activation event
    gameEvents.publish(GAME_EVENTS.PHYSICS_ACTIVATE, {
      instanceId: this.id,
      timestamp: Date.now()
    });
  }
  
  /**
   * Update the physics for this session
   */
  update(deltaTime: number): void {
    const now = Date.now();
    
    // Only update physics if the game is in an active state
    const isGameplayActive = this.isGameplayActive();
    
    if (this.isActive && isGameplayActive) {
      // Update physics for this session
      if (this.physics) {
        this.physics.update(deltaTime);
      }
      
      this.stateVersion++;
      this.lastUpdateTime = now;
    } else if (this.isActive && !isGameplayActive) {
      // Session is active but not in gameplay state
      // Physics is paused during non-gameplay states
      this.lastUpdateTime = now;
    }
  }
  
  /**
   * Check if the current state is a gameplay state
   */
  isGameplayActive(): boolean {
    return this.status === 'playing';
  }
  
  /**
   * Get the current game state
   */
  getCurrentState(): GameStatus {
    return this.status;
  }
  
  /**
   * Initialize game world with default platforms
   */
  initializeGameWorld(): void {
    // Create ground segments
    const segmentWidth = 200;
    const gapWidth = 100;
    const groundY = 768;
    
    const totalSegments = Math.ceil(this.gameWorld.worldBounds.width / (segmentWidth + gapWidth)) + 1;
    
    for (let i = 0; i < totalSegments; i++) {
      const segmentX = i * (segmentWidth + gapWidth) + (segmentWidth / 2);
      this.gameWorld.platforms.push({
        id: `ground_segment_${i}`,
        position: { x: segmentX, y: groundY },
        width: segmentWidth,
        height: 20,
        rotation: 0,
        isStatic: true
      });
    }
    
    // Define platform positions matching the original implementation
    const platformPositions = [
      // Left section - initial platforms
      // Lower level platforms
      { x: 200, y: 650 },
      { x: 400, y: 550 },
      { x: 600, y: 600 },
      { x: 800, y: 500 },
      
      // Middle level platforms
      { x: 150, y: 450 },
      { x: 350, y: 350 },
      { x: 550, y: 400 },
      { x: 750, y: 300 },
      { x: 950, y: 350 },
      
      // Upper level platforms
      { x: 300, y: 200 },
      { x: 500, y: 150 },
      { x: 700, y: 200 },
      { x: 900, y: 150 },
      { x: 1100, y: 200 },
      
      // Right section - extending platforms (from 1200 to 2400)
      // Lower level platforms
      { x: 1300, y: 650 },
      { x: 1500, y: 550 },
      { x: 1700, y: 600 },
      { x: 1900, y: 500 },
      { x: 2100, y: 550 },
      
      // Middle level platforms
      { x: 1350, y: 450 },
      { x: 1550, y: 350 },
      { x: 1750, y: 400 },
      { x: 1950, y: 300 },
      { x: 2150, y: 400 },
      
      // Upper level platforms leading to finish
      { x: 1400, y: 250 },
      { x: 1600, y: 200 },
      { x: 1800, y: 150 },
      { x: 2000, y: 180 },
      { x: 2200, y: 150 }
    ];
    
    // Create each platform
    platformPositions.forEach((pos, index) => {
      const platform = {
        id: `platform_initial_${index}`,
        position: { x: pos.x, y: pos.y },
        width: this.parameters.platform_width || 100,
        height: this.parameters.platform_height || 20,
        rotation: 0,
        isStatic: true
      };
      
      this.gameWorld.platforms.push(platform);
    });
  }
  
  /**
   * Get the complete game state
   */
  getState(): GameState {
    return {
      // Version and metadata
      version: this.stateVersion,
      timestamp: this.lastUpdateTime,
      
      // Game status
      gameStatus: this.status,
      
      // Players and world elements
      players: this.getAllPlayers(),
      gameWorld: this.gameWorld,
      
      // Items placed in the game
      items: this.items,
      
      // Game parameters and configuration
      parameters: this.parameters,
      gameConfig: {
        gravity: this.parameters.gravity || 0.5,
        moveSpeed: this.parameters.player_move_speed || 5,
        jumpForce: this.parameters.player_jump_force || 12
      }
    };
  }
  
  /**
   * Handle player death
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isAlive = false;
    }
  }
  
  /**
   * Handle player win
   */
  private handlePlayerWin(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.score += 1;
    }
  }
}

/**
 * A single class that handles all game sessions
 */
export class GameSessionManager {
  // Direct mapping of session IDs to game sessions
  private sessions = new Map<string, GameSession>();
  
  /**
   * Create or join a session
   */
  joinSession(sessionId: string, playerId: string, playerName: string): GameSession {
    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new GameSession(sessionId);
      this.sessions.set(sessionId, session);
    }
    
    // Add player to session
    session.addPlayer(playerId, playerName);
    
    return session;
  }
  
  /**
   * Get a session by ID
   */
  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get a player's session
   */
  getPlayerSession(playerId: string): GameSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.players.has(playerId)) {
        return session;
      }
    }
    return undefined;
  }
  
  /**
   * Remove a player from their session
   */
  removePlayer(playerId: string): boolean {
    const session = this.getPlayerSession(playerId);
    if (session) {
      return session.removePlayer(playerId);
    }
    return false;
  }
  
  /**
   * Get a player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    const session = this.getPlayerSession(playerId);
    if (session) {
      return session.getPlayer(playerId);
    }
    return undefined;
  }
  
  /**
   * Update all active sessions
   */
  updateSessions(deltaTime: number): void {
    for (const session of this.sessions.values()) {
      session.update(deltaTime);
    }
  }
  
  /**
   * Get all players for a session
   */
  getSessionPlayers(sessionId: string): Player[] {
    const session = this.sessions.get(sessionId);
    if (session) {
      return session.getAllPlayers();
    }
    return [];
  }
  
  /**
   * Get a complete snapshot of player state for a specific session
   */
  getSessionStateSnapshot(sessionId: string): {
    players: Player[];
    timestamp: number;
  } {
    const players = this.getSessionPlayers(sessionId);
    
    return {
      players,
      timestamp: Date.now()
    };
  }
}

/**
 * Create a new GameSessionManager
 */
export function setupGameSessionManager(): GameSessionManager {
  return new GameSessionManager();
} 