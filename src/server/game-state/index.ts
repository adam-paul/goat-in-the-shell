import { v4 as uuidv4 } from 'uuid';

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

interface Lobby {
  id: string;
  name: string;
  players: string[];
  isGameActive: boolean;
  hostId: string;
  createdAt: number;
}

class GameStateManager {
  private players: Map<string, Player>;
  private items: Map<string, GameItem>;
  private lobbies: Map<string, Lobby>;
  private stateVersion: number;
  private lastUpdateTime: number;
  
  constructor() {
    this.players = new Map();
    this.items = new Map();
    this.lobbies = new Map();
    this.stateVersion = 0;
    this.lastUpdateTime = Date.now();
    
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
   * Get the complete game state
   */
  getState(): any {
    return {
      version: this.stateVersion,
      timestamp: this.lastUpdateTime,
      players: Array.from(this.players.values()),
      items: Array.from(this.items.values()),
      lobbies: Array.from(this.lobbies.values())
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
      items: lobbyItems
    };
  }
  
  /**
   * Add a new player to the game
   */
  addPlayer(clientId: string, name: string): Player {
    const player: Player = {
      id: clientId,
      name: name || `Player-${clientId.substring(0, 4)}`,
      position: { x: 100, y: 100 }, // Starting position
      velocity: { x: 0, y: 0 },
      isAlive: true,
      score: 0,
      lastInput: {}
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
            player.position = { x: 100, y: 100 };
            player.velocity = { x: 0, y: 0 };
            player.isAlive = true;
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
    const player = this.players.get(clientId);
    if (!player) return;
    
    // Store the input state
    player.lastInput = inputData;
    
    // Actual movement will be handled by physics engine
  }
  
  /**
   * Place a game item in the world
   */
  placeItem(itemData: any, clientId: string): GameItem | null {
    // Validate that the player exists
    if (!this.players.has(clientId)) return null;
    
    // Create the item
    const item: GameItem = {
      id: uuidv4(),
      type: itemData.type,
      position: itemData.position,
      rotation: itemData.rotation || 0,
      placedBy: clientId,
      properties: itemData.properties || {}
    };
    
    this.items.set(item.id, item);
    return item;
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
export type { Player, GameItem, Lobby };