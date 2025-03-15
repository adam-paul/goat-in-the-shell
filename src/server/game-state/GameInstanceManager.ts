import { v4 as uuidv4 } from 'uuid';
import { GameStateManager, Player, Lobby } from './index';
import { GameStateMachine } from './GameStateMachine';
import { GameStatus } from '../../shared/types';

// Game instance represents an active game with its own independent state
export interface GameInstance {
  id: string;
  lobbyId: string;
  state: GameStateManager;
  stateMachine: GameStateMachine;
  players: string[];
  isActive: boolean;
  startTime: number;
  lastUpdateTime: number;
  updatePlayerActivity: (playerId: string) => void; // Method to update player activity
  playerLastActivity?: Record<string, number>; // Track player activity
}

export class GameInstanceManager {
  // Map of instance ID to game instance
  private instances: Map<string, GameInstance>;
  // Map of lobby ID to instance ID for quick lookups
  private lobbyToInstanceMap: Map<string, string>;
  // Map of player ID to instance ID
  private playerToInstanceMap: Map<string, string>;
  
  constructor() {
    this.instances = new Map();
    this.lobbyToInstanceMap = new Map();
    this.playerToInstanceMap = new Map();
  }
  
  /**
   * Create a new game instance for a lobby
   */
  createInstance(lobbyId: string, players: string[]): GameInstance {
    // Check if there's already an instance for this lobby
    const existingInstanceId = this.lobbyToInstanceMap.get(lobbyId);
    if (existingInstanceId) {
      // Terminate the existing instance
      this.terminateInstance(existingInstanceId);
    }
    
    // Create a new GameStateManager instance for this game
    const state = new GameStateManager();
    
    // Create the new game instance
    const instanceId = uuidv4();
    
    // Create a new GameStateMachine for this instance
    // Always initialize with 'select' for single player or 'lobby' for multiplayer
    // (we handle tutorial and modeSelect on client only)
    const initialGameState: GameStatus = 'select'; // Will be 'select' for all players now
    const stateMachine = new GameStateMachine(initialGameState, instanceId);
    
    // Track player activity
    const playerLastActivity: Record<string, number> = {};
    players.forEach(id => playerLastActivity[id] = Date.now());
    
    const instance: GameInstance = {
      id: instanceId,
      lobbyId,
      state,
      stateMachine,
      players: [...players],
      isActive: false,
      startTime: 0,
      lastUpdateTime: Date.now(),
      playerLastActivity,
      
      // Method to update player activity timestamp
      updatePlayerActivity(playerId: string): void {
        if (this.playerLastActivity && this.players.includes(playerId)) {
          this.playerLastActivity[playerId] = Date.now();
        }
      }
    };
    
    // Store the instance
    this.instances.set(instanceId, instance);
    this.lobbyToInstanceMap.set(lobbyId, instanceId);
    
    // Map all players to this instance
    players.forEach(playerId => {
      this.playerToInstanceMap.set(playerId, instanceId);
    });
    
    return instance;
  }
  
  /**
   * Start a game instance
   */
  startInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    instance.isActive = true;
    instance.startTime = Date.now();
    
    return true;
  }
  
  /**
   * Get a game instance by ID
   */
  getInstance(instanceId: string): GameInstance | null {
    return this.instances.get(instanceId) || null;
  }
  
  /**
   * Get a game instance by lobby ID
   */
  getInstanceByLobby(lobbyId: string): GameInstance | null {
    const instanceId = this.lobbyToInstanceMap.get(lobbyId);
    if (!instanceId) return null;
    
    return this.getInstance(instanceId);
  }
  
  /**
   * Get a game instance by player ID
   */
  getInstanceByPlayer(playerId: string): GameInstance | null {
    const instanceId = this.playerToInstanceMap.get(playerId);
    if (!instanceId) return null;
    
    return this.getInstance(instanceId);
  }
  
  /**
   * Update all active game instances
   */
  updateInstances(deltaTime: number): void {
    const now = Date.now();
    
    // Update each active instance
    for (const [id, instance] of this.instances) {
      // Only update physics if the game is in an active state
      const isGameplayActive = instance.stateMachine.isGameplayActive();
      
      if (instance.isActive && isGameplayActive) {
        // Update instance state
        instance.state.update(deltaTime);
        instance.lastUpdateTime = now;
        
        // Every 100ms (10fps), emit a state update event
        if (now % 100 < 16) { // This ensures we emit at ~10Hz rate
          // We'll let the socket server handle broadcasting
          // The event system or direct calls could broadcast this state
          // to clients in the future
        }
      } else if (instance.isActive && !isGameplayActive) {
        // Instance is active but not in gameplay state
        // No physics updates needed, but still track the time
        instance.lastUpdateTime = now;
      }
    }
  }
  
  /**
   * Terminate a game instance
   */
  terminateInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Remove all player mappings for this instance
    instance.players.forEach(playerId => {
      if (this.playerToInstanceMap.get(playerId) === instanceId) {
        this.playerToInstanceMap.delete(playerId);
      }
    });
    
    // Remove lobby mapping
    if (this.lobbyToInstanceMap.get(instance.lobbyId) === instanceId) {
      this.lobbyToInstanceMap.delete(instance.lobbyId);
    }
    
    // Remove the instance itself
    this.instances.delete(instanceId);
    
    return true;
  }
  
  /**
   * Add a player to a game instance
   */
  addPlayerToInstance(instanceId: string, playerId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Add player to instance
    if (!instance.players.includes(playerId)) {
      instance.players.push(playerId);
    }
    
    // Map player to instance
    this.playerToInstanceMap.set(playerId, instanceId);
    
    return true;
  }
  
  /**
   * Remove a player from their game instance
   */
  removePlayer(playerId: string): boolean {
    const instanceId = this.playerToInstanceMap.get(playerId);
    if (!instanceId) return false;
    
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Remove player from instance
    const index = instance.players.indexOf(playerId);
    if (index !== -1) {
      instance.players.splice(index, 1);
    }
    
    // Remove player mapping
    this.playerToInstanceMap.delete(playerId);
    
    // If instance has no more players, consider removing it
    if (instance.players.length === 0) {
      this.terminateInstance(instanceId);
    }
    
    return true;
  }
  
  /**
   * Restart a game instance
   */
  restartInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Create a new state manager but keep the same instance ID and players
    const state = new GameStateManager();
    
    instance.state = state;
    instance.isActive = false;
    instance.startTime = 0;
    instance.lastUpdateTime = Date.now();
    
    return true;
  }
  
  /**
   * Get all instances for a specific lobby
   */
  getAllInstances(): GameInstance[] {
    return Array.from(this.instances.values());
  }
}