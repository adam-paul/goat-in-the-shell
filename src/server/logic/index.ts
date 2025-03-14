import { GameStateManager } from '../game-state';
import { PhysicsEngine } from '../physics';
import { gameEvents } from '../game-state/GameEvents';
import { DeathType } from '../../shared/types';

class GameLogicProcessor {
  private gameState: GameStateManager;
  private physics: PhysicsEngine;
  
  constructor(gameState: GameStateManager, physics: PhysicsEngine) {
    this.gameState = gameState;
    this.physics = physics;
    
    // Set up event listeners for game events
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for game events
   */
  private setupEventListeners(): void {
    // Handle player death
    gameEvents.subscribe<{
      playerId: string;
      cause: DeathType;
      position: { x: number; y: number };
    }>('PLAYER_DEATH', (data) => {
      this.handlePlayerDeath(data.playerId, data.cause);
    });
    
    // Handle player win
    gameEvents.subscribe<{
      playerId: string;
      position: { x: number; y: number };
    }>('PLAYER_WIN', (data) => {
      this.handlePlayerWin(data.playerId);
    });
  }
  
  /**
   * Handle player death
   */
  private handlePlayerDeath(playerId: string, cause: DeathType): void {
    console.log(`GameLogic: Player ${playerId} died from ${cause}`);
    
    // Additional game logic for death can be added here
    // such as determining if the game is over, etc.
  }
  
  /**
   * Handle player win
   */
  private handlePlayerWin(playerId: string): void {
    console.log(`GameLogic: Player ${playerId} won!`);
    
    // Additional game logic for winning can be added here
  }
  
  /**
   * Validate player input before applying it to the game state
   */
  validatePlayerInput(inputData: any, clientId: string): boolean {
    // Check that the client exists
    const state = this.gameState.getState();
    const player = state.players.find((p: any) => p.id === clientId);
    if (!player) return false;
    
    // Check that the game is active
    const activeInAnyLobby = state.lobbies.some((lobby: any) => 
      lobby.isGameActive && lobby.players.includes(clientId)
    );
    if (!activeInAnyLobby) return false;
    
    // Check that the player is alive
    if (!player.isAlive) return false;
    
    // Check that the input is valid
    if (typeof inputData !== 'object') return false;
    
    // Validate specific input keys
    const validKeys = ['left', 'right', 'jump'];
    for (const key in inputData) {
      if (!validKeys.includes(key) || typeof inputData[key] !== 'boolean') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate item placement before adding it to the game state
   */
  validateItemPlacement(itemData: any, clientId: string): boolean {
    // Check that the client exists
    const state = this.gameState.getState();
    const player = state.players.find((p: any) => p.id === clientId);
    if (!player) return false;
    
    // Check that the game is in placement phase (not running)
    // Find what lobby the player is in
    let playerLobby;
    for (const lobby of state.lobbies) {
      if (lobby.players.includes(clientId)) {
        playerLobby = lobby;
        break;
      }
    }
    
    if (!playerLobby || playerLobby.isGameActive) {
      return false; // Can't place items during active gameplay
    }
    
    // Check that the item type is valid
    const validItemTypes = ['platform', 'spike', 'oscillator', 'shield', 'dart_wall'];
    if (!validItemTypes.includes(itemData.type)) return false;
    
    // Check that item position is within valid bounds
    if (
      !itemData.position ||
      typeof itemData.position.x !== 'number' ||
      typeof itemData.position.y !== 'number' ||
      itemData.position.x < 0 ||
      itemData.position.x > 800 ||
      itemData.position.y < 0 ||
      itemData.position.y > 600
    ) {
      return false;
    }
    
    // Additional item-specific validations
    switch (itemData.type) {
      case 'platform':
        if (
          !itemData.properties ||
          typeof itemData.properties.width !== 'number' ||
          typeof itemData.properties.height !== 'number' ||
          itemData.properties.width <= 0 ||
          itemData.properties.height <= 0 ||
          itemData.properties.width > 300 || // Max platform width
          itemData.properties.height > 50    // Max platform height
        ) {
          return false;
        }
        break;
        
      case 'oscillator':
        if (
          !itemData.properties ||
          typeof itemData.properties.amplitudeY !== 'number' ||
          itemData.properties.amplitudeY < 0 ||
          itemData.properties.amplitudeY > 200 // Max oscillation amplitude
        ) {
          return false;
        }
        break;
        
      // Additional validations for other item types would go here
    }
    
    return true;
  }
  
  /**
   * Check if a client is authorized to start a game
   */
  canStartGame(clientId: string): boolean {
    const state = this.gameState.getState();
    
    // Check if the client is a host in any lobby
    return state.lobbies.some((lobby: any) => lobby.hostId === clientId);
  }
  
  /**
   * Check if a game round is complete
   */
  checkRoundComplete(lobbyId: string): boolean {
    const state = this.gameState.getState();
    const lobby = state.lobbies.find((lobby: any) => lobby.id === lobbyId);
    if (!lobby || !lobby.isGameActive) return false;
    
    // Get all players in this lobby
    const lobbyPlayers = state.players.filter((player: any) => 
      lobby.players.includes(player.id)
    );
    
    // Check if all players are dead or if any player reached the goal
    const allDead = lobbyPlayers.every((player: any) => !player.isAlive);
    
    // In a real game, we would also check win conditions here
    // const anyWinner = lobbyPlayers.some(player => 
    //   player.position.x > 750 && player.position.y < 100
    // );
    
    return allDead; // || anyWinner;
  }
  
  /**
   * Process AI commands
   */
  processAICommand(command: string, lobbyId: string, clientId: string): any {
    // This method would integrate with an AI service to process natural language commands
    // For now, it's just a placeholder
    console.log(`Processing AI command: ${command} from ${clientId} in lobby ${lobbyId}`);
    
    // In a real implementation, this would parse the command and return an action
    return {
      success: true,
      action: {
        type: 'place_item',
        itemType: 'platform',
        position: { x: 300, y: 300 },
        properties: { width: 100, height: 20 }
      }
    };
  }
  
  /**
   * Reset the game state for a new round
   */
  startNewRound(lobbyId: string): void {
    const state = this.gameState.getState();
    const lobby = state.lobbies.find((lobby: any) => lobby.id === lobbyId);
    if (!lobby) return;
    
    // Reset all players in this lobby
    for (const playerId of lobby.players) {
      const player = state.players.find((p: any) => p.id === playerId);
      if (player) {
        player.position = { x: 100, y: 100 };
        player.velocity = { x: 0, y: 0 };
        player.isAlive = true;
      }
    }
    
    // Remove temporary items (those that are specific to a round)
    // This would typically include items that were placed during the round
    // but not the permanent level elements
    
    // Start the game
    lobby.isGameActive = true;
  }
}

export function setupGameLogicProcessor(
  gameState: GameStateManager,
  physics: PhysicsEngine
): GameLogicProcessor {
  return new GameLogicProcessor(gameState, physics);
}

export { GameLogicProcessor };