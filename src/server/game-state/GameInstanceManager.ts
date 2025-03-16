import { v4 as uuidv4 } from 'uuid';
import { GameStateManager } from './index';
import { GameStateMachine } from './GameStateMachine';
import { GameStatus } from '../../shared/types';
import { Player, PlayerRegistry } from '../registry';

// Game instance represents an active game with its own independent state
export interface GameInstance {
  id: string;
  lobbyId: string;
  state: GameStateManager;
  stateMachine: GameStateMachine;
  isActive: boolean;
  startTime: number;
  lastUpdateTime: number;
  updatePlayerActivity: (playerId: string) => void; // Method to update player activity
}

export class GameInstanceManager {
  // Map of instance ID to game instance
  private instances: Map<string, GameInstance>;
  // Map of lobby ID to instance ID for quick lookups
  private lobbyToInstanceMap: Map<string, string>;
  // PlayerRegistry as source of truth for players
  private playerRegistry: PlayerRegistry;
  
  constructor(playerRegistry: PlayerRegistry) {
    this.instances = new Map();
    this.lobbyToInstanceMap = new Map();
    this.playerRegistry = playerRegistry;
  }
  
  /**
   * Create a new game instance for a lobby
   */
  createInstance(lobbyId: string, players: string[], playerNames?: Record<string, string>): GameInstance {
    // Check if there's already an instance for this lobby
    const existingInstanceId = this.lobbyToInstanceMap.get(lobbyId);
    if (existingInstanceId) {
      // Terminate the existing instance
      this.terminateInstance(existingInstanceId);
    }
    
    // Create a new GameStateManager instance for this game
    const state = new GameStateManager(this.playerRegistry);
    console.log(`[GameInstanceManager] Created new GameStateManager for instance: ${state.constructor.name}@${state.toString().split('\n')[0]}`);
    
    // Initialize game world with default platforms and dart walls
    state.initializeGameWorld();
    console.log(`[GameInstanceManager] Initialized game world with platforms and dart walls for instance`);
    
    // Create the new game instance
    const instanceId = uuidv4();
    
    // Create a new GameStateMachine for this instance
    const initialGameState: GameStatus = 'select';
    const stateMachine = new GameStateMachine(initialGameState, instanceId);
    
    const instance: GameInstance = {
      id: instanceId,
      lobbyId,
      state,
      stateMachine,
      isActive: false,
      startTime: 0,
      lastUpdateTime: Date.now(),
      updatePlayerActivity: (playerId: string): void => {
        // Just check if player exists in registry and belongs to this instance
        const playerInstanceId = this.playerRegistry.getPlayerInstance(playerId);
        if (playerInstanceId === instanceId) {
          // Update activity if needed (could track in a separate Map if needed)
        }
      }
    };
    
    // Store the instance
    this.instances.set(instanceId, instance);
    this.lobbyToInstanceMap.set(lobbyId, instanceId);
    
    // Associate players with instance in registry
    players.forEach(playerId => {
      const playerName = playerNames?.[playerId] || `Player-${playerId.substring(0, 4)}`;
      
      // Make sure player exists in registry
      if (!this.playerRegistry.getPlayer(playerId)) {
        this.playerRegistry.addPlayer(playerId, playerName);
      }
      
      // Associate with this instance
      this.playerRegistry.associatePlayerWithInstance(playerId, instanceId);
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
    // Use registry instead of local map
    const instanceId = this.playerRegistry.getPlayerInstance(playerId);
    if (!instanceId) return null;
    
    return this.instances.get(instanceId) || null;
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
    
    // Get the players associated with this instance and remove associations
    const instancePlayers = this.playerRegistry.getInstancePlayers(instanceId);
    instancePlayers.forEach(playerId => {
      // Just remove the association, don't delete the player
      // This allows players to be reassigned to another instance
      this.playerRegistry.associatePlayerWithInstance(playerId, '');
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
   * @param instanceId The game instance to add the player to
   * @param playerId The player to add
   * @param playerName The name of the player (optional)
   */
  addPlayerToInstance(instanceId: string, playerId: string, playerName?: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Get or create player in registry
    const name = playerName || `Player-${playerId.substring(0, 4)}`;
    
    if (!this.playerRegistry.getPlayer(playerId)) {
      this.playerRegistry.addPlayer(playerId, name);
    }
    
    // Associate player with this instance
    this.playerRegistry.associatePlayerWithInstance(playerId, instanceId);
    
    return true;
  }
  
  /**
   * Remove a player from their game instance
   */
  removePlayer(playerId: string): boolean {
    const instanceId = this.playerRegistry.getPlayerInstance(playerId);
    if (!instanceId) return false;
    
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    // Remove player association from registry
    this.playerRegistry.associatePlayerWithInstance(playerId, '');
    
    // Check if instance has players left
    const remainingPlayers = this.playerRegistry.getInstancePlayers(instanceId);
    if (remainingPlayers.length === 0) {
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
    
    // Create a new state manager with the player registry
    const state = new GameStateManager(this.playerRegistry);
    
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