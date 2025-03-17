import { v4 as uuidv4 } from 'uuid';
import { GameStatus, DeathType, GameWorld, Vector2D } from '../../shared/types';
import { gameEvents } from './GameEvents';
import { Player, PlayerRegistry } from '../registry';
import { PLAYER } from '../../shared/constants';

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
  private playerRegistry: PlayerRegistry;
  private items: Map<string, GameItem>;
  private lobbies: Map<string, Lobby>;
  private stateVersion: number;
  private lastUpdateTime: number;
  private parameters: Partial<GameParameters>;
  private gameWorld: GameWorld;
  
  // Debug identifier for instance tracking
  public _debugId: string = Math.random().toString(36).substring(2, 7);
  
  constructor(playerRegistry: PlayerRegistry) {
    this.playerRegistry = playerRegistry;
    this.items = new Map();
    this.lobbies = new Map();
    this.stateVersion = 0;
    this.lastUpdateTime = Date.now();
    this.parameters = {};
    
    // Initialize game world with default platforms
    this.gameWorld = {
      platforms: [],
      startPoint: { ...PLAYER.DEFAULT_POSITION }, // Use shared constant
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
      position: Vector2D, 
      timestamp: number
    }) => {
      this.handlePlayerDeath(data.playerId, data.cause);
    });
    
    // Player win events
    gameEvents.subscribe('PLAYER_WIN', (data: { 
      playerId: string, 
      position: Vector2D, 
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
    
    // Update game logic here, but most updates will come from the physics engine
  }
    
  /**
   * Initialize game world with default platforms
   */
  public initializeGameWorld(): void {
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
      players: this.getAllPlayers(),
      items: Array.from(this.items.values()),
      lobbies: Array.from(this.lobbies.values()),
      parameters: this.parameters,
      gameWorld: this.gameWorld
    };
  }
  
  /**
   * Get all players from the registry
   */
  private getAllPlayers(): Player[] {
    // For each lobby managed by this GameStateManager, get all players
    const allPlayerIds = Array.from(this.lobbies.values())
      .flatMap(lobby => lobby.players);
    
    // Get unique player IDs
    const uniquePlayerIds = [...new Set(allPlayerIds)];
    
    // Return all players from registry
    return uniquePlayerIds
      .map(id => this.playerRegistry.getPlayer(id))
      .filter(player => player !== undefined) as Player[];
  }
  
  /**
   * Get a snapshot of the state for a specific lobby
   */
  getLobbyState(lobbyId: string): any {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    
    // Get the instance ID for this lobby from the instance manager
    // The instance manager isn't directly available here, so we'll have to rely on the lobby.players
    // to find players who are in this lobby, then get their instance through PlayerRegistry
    
    let instanceId = '';
    // Find the first player in this lobby and get their instance
    if (lobby.players.length > 0) {
      instanceId = this.playerRegistry.getPlayerInstance(lobby.players[0]) || '';
    }
    
    // Get players in this instance from the registry (single source of truth)
    const lobbyPlayers = instanceId ? 
      this.playerRegistry.getAllPlayersForInstance(instanceId) : 
      // Fallback to the old method if instanceId isn't found
      lobby.players.map(id => this.playerRegistry.getPlayer(id)).filter(Boolean) as Player[];
    
    const lobbyItems = Array.from(this.items.values())
      .filter(item => {
        // Filter items based on which player placed them
        // We'll have to check if the player is in this instance
        return lobbyPlayers.some(player => player.id === item.placedBy);
      });
    
    return {
      version: this.stateVersion,
      timestamp: this.lastUpdateTime,
      lobbyId,
      instanceId, // Include the instance ID for better tracing
      isGameActive: lobby.isGameActive,
      players: lobbyPlayers,
      items: lobbyItems,
      parameters: this.parameters,
      gameWorld: this.gameWorld
    };
  }
  
  /**
   * Get a player by ID - now uses registry
   */
  getPlayer(clientId: string): Player | undefined {
    return this.playerRegistry.getPlayer(clientId);
  }
  
  /**
   * Validate item placement
   */
  validateItemPlacement(itemData: any, clientId: string): boolean {
    console.log(`GAME STATE: Instance validating item placement for ${clientId}`);
    
    // Check that the client exists in the player registry
    if (!this.playerRegistry.getPlayer(clientId)) {
      console.error(`GAME STATE: Player ${clientId} not found in PlayerRegistry`);
      return false;
    }
    
    // Check that the item type is valid
    const validItemTypes = ['platform', 'spike', 'oscillator', 'shield', 'dart_wall'];
    if (!validItemTypes.includes(itemData.type)) {
      console.error(`GAME STATE: Invalid item type: ${itemData.type}`);
      return false;
    }
    
    // Check position and bounds
    if (
      !itemData.position ||
      typeof itemData.position.x !== 'number' ||
      typeof itemData.position.y !== 'number'
    ) {
      console.error(`GAME STATE: Missing or invalid position`);
      return false;
    }
    
    // Check that item position is within valid bounds
    if (
      itemData.position.x < 0 ||
      itemData.position.x > 2400 || 
      itemData.position.y < 0 ||
      itemData.position.y > 800
    ) {
      console.error(`GAME STATE: Position out of bounds: (${itemData.position.x}, ${itemData.position.y})`);
      return false;
    }
    
    // Check properties
    if (!itemData.properties) {
      console.error(`GAME STATE: Missing properties for item type ${itemData.type}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the game world data
   */
  getGameWorld(): GameWorld {
    return this.gameWorld;
  }
  
  /**
   * Add a new player to the game - now delegates to registry
   */
  addPlayer(clientId: string, name: string): Player {
    console.log(`GAME STATE: Adding player ${name} (${clientId}) to GameStateManager via registry`);
    
    // Use registry to add the player
    return this.playerRegistry.addPlayer(clientId, name);
  }
  
  /**
   * Remove a player from the game
   */
  removePlayer(clientId: string): void {
    // First, determine which instance/lobby the player is in
    const instanceId = this.playerRegistry.getPlayerInstance(clientId);
    
    // Remove player from registry - this is now the primary operation
    // All other cleanup is secondary to this
    this.playerRegistry.removePlayer(clientId);
    
    // Clean up lobby references (for backward compatibility)
    for (const [id, lobby] of this.lobbies) {
      const playerIndex = lobby.players.indexOf(clientId);
      if (playerIndex !== -1) {
        // Remove from lobby's player array
        lobby.players.splice(playerIndex, 1);
        
        // If lobby is now empty, consider removing it (except default lobby)
        if (lobby.players.length === 0 && id !== 'default') {
          this.lobbies.delete(id);
        } 
        // Reassign host if needed
        else if (lobby.hostId === clientId && lobby.players.length > 0) {
          lobby.hostId = lobby.players[0];
        }
      }
    }
    
    // We don't need to handle instance cleanup here because GameInstanceManager.removePlayer
    // is responsible for that, and it uses playerRegistry.getPlayerInstance directly
  }
  
  /**
   * Add player to a lobby
   */
  addPlayerToLobby(clientId: string, lobbyId: string, playerName: string): void {
    // Create player if they don't exist in registry
    if (!this.playerRegistry.getPlayer(clientId)) {
      this.playerRegistry.addPlayer(clientId, playerName);
    }
    
    // Use existing or create new lobby
    let lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      lobby = {
        id: lobbyId || uuidv4(),
        name: `Lobby ${this.lobbies.size + 1}`,
        players: [], // Still maintain this array for backward compatibility
        isGameActive: false,
        hostId: clientId, // First player becomes host
        createdAt: Date.now()
      };
      this.lobbies.set(lobby.id, lobby);
    }
    
    // Add player to lobby's player array (this is now just for backward compatibility)
    // The authoritative source is the PlayerRegistry's playerToInstanceMap
    if (!lobby.players.includes(clientId)) {
      lobby.players.push(clientId);
    }
    
    // If no host, set this player as host
    if (!lobby.hostId) {
      lobby.hostId = clientId;
    }
    
    // Note: The actual association of player to instance happens in 
    // GameInstanceManager.addPlayerToInstance which calls playerRegistry.associatePlayerWithInstance
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
          const player = this.playerRegistry.getPlayer(playerId);
          if (player) {
            player.position = { ...PLAYER.DEFAULT_POSITION }; // Reset to start position
            player.velocity = { x: 0, y: 0 };
            this.playerRegistry.setPlayerAliveStatus(playerId, true);
          }
        }
        
        return true;
      }
    }
    return false;
  }
  
  /**
   * Apply player input to update their state
   */
  applyPlayerInput(inputData: any, clientId: string): void {
    const player = this.playerRegistry.getPlayer(clientId);
    if (!player) return;
    
    // Store the input state
    const processedInput = {
      left: !!inputData.left,
      right: !!inputData.right,
      jump: !!inputData.jump || !!inputData.up,
      timestamp: inputData.timestamp || Date.now()
    };
    
    // Update player state based on input
    if (processedInput.left && !processedInput.right) {
      // Update player direction if needed
    } else if (processedInput.right && !processedInput.left) {
      // Update player direction if needed
    }
    
    // Actual movement will be handled by physics engine
  }
  
  /**
   * Place a game item in the world
   */
  placeItem(itemData: any, clientId: string): GameItem | null {
    console.log(`GAME STATE: Placing item of type ${itemData.type} for client ${clientId}`);
    
    // Validate that the player exists in registry
    if (!this.playerRegistry.getPlayer(clientId)) {
      console.error(`GAME STATE: Cannot place item - player ${clientId} not found in registry`);
      return null;
    }
    
    // Generate ID if not provided
    const itemId = itemData.id || uuidv4();
    
    // Create the item with appropriate defaults
    try {
      const item: GameItem = {
        id: itemId,
        type: itemData.type,
        position: itemData.position || { x: 0, y: 0 },
        rotation: itemData.rotation || 0,
        placedBy: clientId,
        properties: itemData.properties ? { ...itemData.properties } : {}
      };
      
      console.log(`GAME STATE: Created item base with properties:`, JSON.stringify(item.properties));
      
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
      
      console.log(`GAME STATE: Final item properties:`, JSON.stringify(item.properties));
      
      // Store the item
      this.items.set(item.id, item);
      console.log(`GAME STATE: Successfully placed item ${item.id} of type ${item.type}`);
      
      // Return the created item
      return item;
    } catch (error) {
      console.error(`GAME STATE: Error placing item:`, error);
      return null;
    }
  }
  
  /**
   * Handle game status changes from GameStateMachine 
   * This method is called by GameInstanceManager when the StateMachine changes state
   */
  handleGameStatusChange(status: GameStatus): void {
    // Handle status-specific logic
    switch (status) {
      case 'reset':
        // Reset game state as needed
        break;
    }
  }
    
  /**
   * Handle player death event
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    this.playerRegistry.setPlayerAliveStatus(playerId, false);
    console.log(`GameState: Player ${playerId} died from ${cause}`);
  }
  
  /**
   * Handle player win event
   */
  private handlePlayerWin(playerId: string): void {
    const player = this.playerRegistry.getPlayer(playerId);
    if (!player || !player.isAlive) return;
    
    // Increment player score
    this.playerRegistry.updatePlayerScore(playerId, (player.score || 0) + 1);
    
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
    // Get all players from instances managed by this GameStateManager
    const allPlayers = this.getAllPlayers();
    
    for (const player of allPlayers) {
      // Reset player position and velocity through registry
      this.playerRegistry.updatePlayerPosition(player.id, { ...PLAYER.DEFAULT_POSITION });
      this.playerRegistry.updatePlayerVelocity(player.id, { x: 0, y: 0 });
      this.playerRegistry.setPlayerAliveStatus(player.id, true);
    }
    
    // Reset game state
    
    console.log('Game state reset');
  }
  
  /**
   * Broadcast a chat message to all players in a lobby
   */
  broadcastChatMessage(senderId: string, message: string, lobbyId: string): void {
    // This method would typically call into the network manager to actually send
    console.log(`Chat in lobby ${lobbyId}: ${senderId} says: ${message}`);
  }
}

import { GameInstanceManager } from './GameInstanceManager';

export function setupGameStateManager(playerRegistry: PlayerRegistry): GameStateManager {
  return new GameStateManager(playerRegistry);
}

export function setupGameInstanceManager(playerRegistry: PlayerRegistry): GameInstanceManager {
  return new GameInstanceManager(playerRegistry);
}

export { GameStateManager, GameInstanceManager };
export type { GameItem, Lobby, GameParameters };