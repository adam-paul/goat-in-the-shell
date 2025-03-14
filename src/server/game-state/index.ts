import { v4 as uuidv4 } from 'uuid';
import { GameStatus, DeathType, GameWorld } from '../../shared/types';
import { gameEvents } from './GameEvents';

// Define types for our game entities
interface Vector2 {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  position: Vector2;
  velocity: Vector2;
  isAlive: boolean;
  score: number;
  lastInput: { [key: string]: boolean };
  onGround?: boolean;
  facingLeft?: boolean;
}

interface GameItem {
  id: string;
  type: string;
  position: Vector2;
  rotation: number;
  placedBy: string;
  // Additional properties depending on item type
  properties: Record<string, any>;
}

interface Projectile {
  id: string;
  type: string; // 'dart', etc.
  position: Vector2;
  velocity: Vector2;
  createdAt: number;
}

interface Lobby {
  id: string;
  name: string;
  players: string[];
  isGameActive: boolean;
  hostId: string;
  createdAt: number;
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

class GameStateManager {
  private players: Map<string, Player>;
  private items: Map<string, GameItem>;
  private projectiles: Map<string, Projectile>;
  private lobbies: Map<string, Lobby>;
  private stateVersion: number;
  private lastUpdateTime: number;
  private gameStatus: GameStatus;
  private parameters: Partial<GameParameters>;
  private gameWorld: GameWorld;
  
  constructor() {
    this.players = new Map();
    this.items = new Map();
    this.projectiles = new Map();
    this.lobbies = new Map();
    this.stateVersion = 0;
    this.lastUpdateTime = Date.now();
    this.gameStatus = 'tutorial';
    this.parameters = {};
    
    // Initialize game world with default platforms
    this.gameWorld = {
      platforms: [],
      startPoint: { x: 80, y: 650 },
      endPoint: { x: 2320, y: 120 },
      worldBounds: { width: 2400, height: 800 }
    };
    
    // Create initial world platform layout
    this.initializeGameWorld();
    
    // Create a default lobby
    const defaultLobby: Lobby = {
      id: 'default',
      name: 'Default Lobby',
      players: [],
      isGameActive: false,
      hostId: '',
      createdAt: Date.now()
    };
    this.lobbies.set('default', defaultLobby);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for game events
   */
  private setupEventListeners(): void {
    // Player death events
    gameEvents.subscribe('PLAYER_DEATH', (data: { 
      playerId: string, 
      cause: DeathType, 
      position: Vector2, 
      timestamp: number
    }) => {
      this.handlePlayerDeath(data.playerId, data.cause);
    });
    
    // Player win events
    gameEvents.subscribe('PLAYER_WIN', (data: { 
      playerId: string, 
      position: Vector2, 
      timestamp: number 
    }) => {
      this.handlePlayerWin(data.playerId);
    });
  }
  
  /**
   * Update the game state based on elapsed time
   */
  update(_deltaTime: number): void {
    this.stateVersion++;
    this.lastUpdateTime = Date.now();
    
    // Update projectile lifetimes
    this.updateProjectiles();
    
    // Update game logic here, but most updates will come from the physics engine
  }
  
  /**
   * Update projectiles and remove expired ones
   */
  private updateProjectiles(): void {
    const now = Date.now();
    
    for (const [id, projectile] of this.projectiles.entries()) {
      // Remove projectiles older than 10 seconds
      if (now - projectile.createdAt > 10000) {
        this.projectiles.delete(id);
      }
    }
  }
  
  /**
   * Initialize game world with default platforms
   */
  private initializeGameWorld(): void {
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
  getState(): any {
    return {
      version: this.stateVersion,
      timestamp: this.lastUpdateTime,
      players: Array.from(this.players.values()),
      items: Array.from(this.items.values()),
      projectiles: Array.from(this.projectiles.values()),
      lobbies: Array.from(this.lobbies.values()),
      gameStatus: this.gameStatus,
      parameters: this.parameters,
      gameWorld: this.gameWorld // Include game world data
    };
  }
  
  /**
   * Get a snapshot of the state for a specific lobby
   */
  getLobbyState(lobbyId: string): any {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    
    const lobbyPlayers = Array.from(this.players.values())
      .filter(player => lobby.players.includes(player.id));
    
    const lobbyItems = Array.from(this.items.values())
      .filter(item => {
        // Filter items based on which player placed them
        // This is a simplified approach - in reality, items would be associated with a lobby
        return lobby.players.includes(item.placedBy);
      });
    
    return {
      version: this.stateVersion,
      timestamp: this.lastUpdateTime,
      lobbyId,
      isGameActive: lobby.isGameActive,
      players: lobbyPlayers,
      items: lobbyItems,
      projectiles: Array.from(this.projectiles.values()),
      gameStatus: this.gameStatus,
      parameters: this.parameters,
      gameWorld: this.gameWorld // Include game world data
    };
  }
  
  /**
   * Get the game world data
   */
  getGameWorld(): GameWorld {
    return this.gameWorld;
  }
  
  /**
   * Add a new player to the game
   */
  addPlayer(clientId: string, name: string): Player {
    // Starting position matches the original game's start point
    const player: Player = {
      id: clientId,
      name: name || `Player-${clientId.substring(0, 4)}`,
      position: { x: 80, y: 650 }, // Starting position from original game
      velocity: { x: 0, y: 0 },
      isAlive: true,
      score: 0,
      lastInput: {},
      onGround: false,
      facingLeft: false
    };
    
    this.players.set(clientId, player);
    return player;
  }
  
  /**
   * Remove a player from the game
   */
  removePlayer(clientId: string): void {
    this.players.delete(clientId);
    
    // Remove player from all lobbies
    for (const [id, lobby] of this.lobbies) {
      const playerIndex = lobby.players.indexOf(clientId);
      if (playerIndex !== -1) {
        lobby.players.splice(playerIndex, 1);
        
        // If lobby is now empty, consider removing it
        if (lobby.players.length === 0 && id !== 'default') {
          this.lobbies.delete(id);
        } 
        // Reassign host if needed
        else if (lobby.hostId === clientId && lobby.players.length > 0) {
          lobby.hostId = lobby.players[0];
        }
      }
    }
  }
  
  /**
   * Add player to a lobby
   */
  addPlayerToLobby(clientId: string, lobbyId: string, playerName: string): void {
    // Create player if they don't exist
    if (!this.players.has(clientId)) {
      this.addPlayer(clientId, playerName);
    }
    
    // Use existing or create new lobby
    let lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      lobby = {
        id: lobbyId || uuidv4(),
        name: `Lobby ${this.lobbies.size + 1}`,
        players: [],
        isGameActive: false,
        hostId: clientId, // First player becomes host
        createdAt: Date.now()
      };
      this.lobbies.set(lobby.id, lobby);
    }
    
    // Add player to lobby if not already there
    if (!lobby.players.includes(clientId)) {
      lobby.players.push(clientId);
    }
    
    // If no host, set this player as host
    if (!lobby.hostId) {
      lobby.hostId = clientId;
    }
  }
  
  /**
   * Start a game in a lobby
   */
  startGame(hostId: string): boolean {
    // Find which lobby this host belongs to
    for (const [lobbyId, lobby] of this.lobbies) {
      if (lobby.hostId === hostId) {
        lobby.isGameActive = true;
        
        // Reset all players in this lobby
        for (const playerId of lobby.players) {
          const player = this.players.get(playerId);
          if (player) {
            player.position = { x: 80, y: 650 }; // Reset to start position
            player.velocity = { x: 0, y: 0 };
            player.isAlive = true;
            player.facingLeft = false;
          }
        }
        
        // Update game status
        this.gameStatus = 'playing';
        
        return true;
      }
    }
    return false;
  }
  
  /**
   * Apply player input to update their state
   */
  applyPlayerInput(inputData: any, clientId: string): void {
    const player = this.players.get(clientId);
    if (!player) return;
    
    // Store the input state
    const processedInput = {
      left: !!inputData.left,
      right: !!inputData.right,
      jump: !!inputData.jump || !!inputData.up,
      timestamp: inputData.timestamp || Date.now()
    };
    
    player.lastInput = processedInput;
    
    // Update facing direction based on input
    if (processedInput.left && !processedInput.right) {
      player.facingLeft = true;
    } else if (processedInput.right && !processedInput.left) {
      player.facingLeft = false;
    }
    
    // Actual movement will be handled by physics engine
  }
  
  /**
   * Place a game item in the world
   */
  placeItem(itemData: any, clientId: string): GameItem | null {
    // Validate that the player exists
    if (!this.players.has(clientId)) return null;
    
    // Generate ID if not provided
    const itemId = itemData.id || uuidv4();
    
    // Create the item with appropriate defaults
    const item: GameItem = {
      id: itemId,
      type: itemData.type,
      position: itemData.position || { x: 0, y: 0 },
      rotation: itemData.rotation || 0,
      placedBy: clientId,
      properties: itemData.properties ? { ...itemData.properties } : {}
    };
    
    // Add width/height properties based on parameters if not specified
    switch (item.type) {
      case 'platform':
        if (!item.properties.width) item.properties.width = this.parameters.platform_width || 100;
        if (!item.properties.height) item.properties.height = this.parameters.platform_height || 20;
        break;
      case 'spike':
        if (!item.properties.width) item.properties.width = this.parameters.spike_width || 100;
        if (!item.properties.height) item.properties.height = this.parameters.spike_height || 20;
        break;
      case 'oscillator':
      case 'moving':
        if (!item.properties.width) item.properties.width = this.parameters.oscillator_width || 100;
        if (!item.properties.height) item.properties.height = this.parameters.oscillator_height || 20;
        if (!item.properties.distance) item.properties.distance = this.parameters.oscillator_distance || 100;
        break;
      case 'shield':
        if (!item.properties.width) item.properties.width = this.parameters.shield_width || 60;
        if (!item.properties.height) item.properties.height = this.parameters.shield_height || 60;
        break;
      case 'dart_wall':
        if (!item.properties.height) item.properties.height = this.parameters.dart_wall_height || 100;
        break;
    }
    
    // Store the item
    this.items.set(item.id, item);
    
    // Return the created item
    return item;
  }
  
  /**
   * Update the game status
   */
  setGameStatus(status: GameStatus): void {
    this.gameStatus = status;
    
    // Handle status-specific logic
    switch (status) {
      case 'reset':
        // Clear all projectiles
        this.projectiles.clear();
        break;
    }
  }
  
  /**
   * Add a projectile to the game state
   */
  addProjectile(projectile: Partial<Projectile>): Projectile {
    const id = projectile.id || uuidv4();
    
    const newProjectile: Projectile = {
      id,
      type: projectile.type || 'dart',
      position: projectile.position || { x: 0, y: 0 },
      velocity: projectile.velocity || { x: 0, y: 0 },
      createdAt: projectile.createdAt || Date.now()
    };
    
    this.projectiles.set(id, newProjectile);
    return newProjectile;
  }
  
  /**
   * Update a projectile's position
   */
  updateProjectile(id: string, update: Partial<Projectile>): Projectile | null {
    const projectile = this.projectiles.get(id);
    if (!projectile) return null;
    
    // Update properties
    if (update.position) {
      projectile.position = update.position;
    }
    
    if (update.velocity) {
      projectile.velocity = update.velocity;
    }
    
    return projectile;
  }
  
  /**
   * Remove a projectile
   */
  removeProjectile(id: string): boolean {
    return this.projectiles.delete(id);
  }
  
  /**
   * Handle player death event
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    player.isAlive = false;
    
    // Update game status if needed
    if (this.gameStatus !== 'gameover') {
      this.gameStatus = 'gameover';
    }
    
    console.log(`GameState: Player ${playerId} died from ${cause}`);
  }
  
  /**
   * Handle player win event
   */
  private handlePlayerWin(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // Update game status
    this.gameStatus = 'win';
    
    // Increment player score
    player.score += 1;
    
    console.log(`GameState: Player ${playerId} won!`);
  }
  
  /**
   * Update game parameters
   */
  updateGameParameters(parameters: Partial<GameParameters>): void {
    // Merge new parameters with existing ones
    this.parameters = { ...this.parameters, ...parameters };
    
    console.log('Game parameters updated:', parameters);
  }
  
  /**
   * Get current game parameters
   */
  getGameParameters(): Partial<GameParameters> {
    return { ...this.parameters };
  }
  
  /**
   * Reset the game state
   */
  resetGameState(): void {
    // Reset players
    for (const player of this.players.values()) {
      player.position = { x: 80, y: 650 };
      player.velocity = { x: 0, y: 0 };
      player.isAlive = true;
      player.lastInput = {};
    }
    
    // Clear projectiles
    this.projectiles.clear();
    
    // Reset game status
    this.gameStatus = 'select';
    
    console.log('Game state reset');
  }
  
  /**
   * Broadcast a chat message to all players in a lobby
   */
  broadcastChatMessage(senderId: string, message: string, lobbyId: string): void {
    // This method would typically call into the network manager to actually send
    // For now, we just store the message in the lobby state
    console.log(`Chat in lobby ${lobbyId}: ${senderId} says: ${message}`);
    
    // In a real implementation, this would trigger sending a message via the network manager
  }
}

import { GameInstanceManager } from './GameInstanceManager';

export function setupGameStateManager(): GameStateManager {
  return new GameStateManager();
}

export function setupGameInstanceManager(): GameInstanceManager {
  return new GameInstanceManager();
}

export { GameStateManager, GameInstanceManager };
export type { Player, GameItem, Projectile, Lobby, GameParameters };