import { GameStateManager } from '../game-state';
import { gameEvents } from '../game-state/GameEvents';
import { DeathType, Vector2D } from '../../shared/types';
import { PLAYER, GAME_DIMENSIONS } from '../../shared/constants';

class GameLogicProcessor {
  private gameState: GameStateManager;
  
  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
    
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
      position: Vector2D;
    }>('PLAYER_DEATH', (data) => {
      this.handlePlayerDeath(data.playerId, data.cause);
    });
    
    // Handle player win
    gameEvents.subscribe<{
      playerId: string;
      position: Vector2D;
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
    // Validate the input format only - player state checks are done elsewhere 
    // This simplifies the validation logic as player state is now checked at
    // the socket server level using PlayerRegistry
    
    // Check that the input is valid
    if (typeof inputData !== 'object') return false;
    
    // Validate specific input keys
    const validKeys = ['left', 'right', 'jump'];
    for (const key in inputData) {
      if (key === 'timestamp') continue;
      if (key === 'up' || key === 'down') continue;
      
      if (!validKeys.includes(key) && typeof inputData[key] !== 'boolean') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate item placement before adding it to the game state
   */
  validateItemPlacement(itemData: any, clientId: string): boolean {
    console.log(`VALIDATION: Starting validation for item type ${itemData?.type || 'undefined'} from client ${clientId}`);
    console.log(`VALIDATION: Full item data:`, JSON.stringify(itemData));
    
    // Basic structure check
    if (!itemData) {
      console.error(`VALIDATION: Item data is null or undefined`);
      return false;
    }
    
    if (!itemData.type) {
      console.error(`VALIDATION: Item type is missing`);
      return false;
    }
    
    // Check that the client exists
    const state = this.gameState.getState();
    const player = state.players.find((p: any) => p.id === clientId);
    if (!player) {
      console.error(`VALIDATION: Client ${clientId} not found in players list`);
      return false;
    }
    
    // Check that the game is in placement phase (not running)
    // Find what lobby the player is in
    let playerLobby;
    // Handle potentially undefined lobbies due to UniversalGameState type
    if (state.lobbies && Array.isArray(state.lobbies)) {
      for (const lobby of state.lobbies) {
        if (lobby.players?.includes(clientId)) {
          playerLobby = lobby;
          break;
        }
      }
    }
    
    if (!playerLobby) {
      console.error(`VALIDATION: Client ${clientId} not found in any lobby`);
      return false;
    }
    
    if (playerLobby.isGameActive) {
      console.error(`VALIDATION: Can't place items during active gameplay in lobby ${playerLobby.id}`);
      return false; // Can't place items during active gameplay
    }
    
    // Check that the item type is valid
    const validItemTypes = ['platform', 'spike', 'oscillator', 'shield'];
    console.log(`VALIDATION: Checking if ${itemData.type} is a valid item type among:`, validItemTypes);
    if (!validItemTypes.includes(itemData.type)) {
      console.error(`VALIDATION: Invalid item type: ${itemData.type}`);
      return false;
    }
    
    // Check that item position is within valid bounds
    console.log(`VALIDATION: Checking position:`, itemData.position);
    if (!itemData.position) {
      console.error(`VALIDATION: Missing position`);
      return false;
    }
    
    if (
      typeof itemData.position.x !== 'number' ||
      typeof itemData.position.y !== 'number'
    ) {
      console.error(`VALIDATION: Position values must be numbers:`, itemData.position);
      return false;
    }
    
    if (
      itemData.position.x < 0 ||
      itemData.position.x > GAME_DIMENSIONS.WIDTH ||
      itemData.position.y < 0 ||
      itemData.position.y > GAME_DIMENSIONS.HEIGHT
    ) {
      console.error(`VALIDATION: Position out of bounds: (${itemData.position.x}, ${itemData.position.y})`);
      return false;
    }
    
    // Check if properties exist
    console.log(`VALIDATION: Checking properties:`, itemData.properties);
    if (!itemData.properties) {
      console.error(`VALIDATION: Missing properties for item type ${itemData.type}`);
      return false;
    }
    
    // Additional item-specific validations
    switch (itemData.type) {
      case 'platform':
        console.log(`VALIDATION: Validating platform properties width=${itemData.properties.width}, height=${itemData.properties.height}`);
        if (
          typeof itemData.properties.width !== 'number' ||
          typeof itemData.properties.height !== 'number'
        ) {
          console.error(`VALIDATION: Platform width and height must be numbers`);
          return false;
        }
        if (
          itemData.properties.width <= 0 ||
          itemData.properties.height <= 0 ||
          itemData.properties.width > 300 || // Max platform width
          itemData.properties.height > 50    // Max platform height
        ) {
          console.error(`VALIDATION: Invalid platform dimensions - must be within ranges 0-300 width and 0-50 height`);
          return false;
        }
        break;
        
      case 'oscillator':
        console.log(`VALIDATION: Validating oscillator properties width=${itemData.properties.width}, height=${itemData.properties.height}, amplitudeY=${itemData.properties.amplitudeY}`);
        if (typeof itemData.properties.amplitudeY !== 'number') {
          console.error(`VALIDATION: Oscillator amplitudeY must be a number`);
          return false;
        }
        if (
          itemData.properties.amplitudeY < 0 ||
          itemData.properties.amplitudeY > 200 // Max oscillation amplitude
        ) {
          console.error(`VALIDATION: Invalid oscillator amplitudeY - must be within range 0-200`);
          return false;
        }
        break;
        
      case 'shield':
        console.log(`VALIDATION: Validating shield properties width=${itemData.properties.width}, height=${itemData.properties.height}`);
        if (
          typeof itemData.properties.width !== 'number' ||
          typeof itemData.properties.height !== 'number'
        ) {
          console.error(`VALIDATION: Shield width and height must be numbers`);
          return false;
        }
        if (
          itemData.properties.width <= 0 ||
          itemData.properties.height <= 0
        ) {
          console.error(`VALIDATION: Invalid shield dimensions - must be greater than zero`);
          return false;
        }
        break;
        
      case 'spike':
        console.log(`VALIDATION: Validating spike properties width=${itemData.properties.width}, height=${itemData.properties.height}`);
        if (
          typeof itemData.properties.width !== 'number' ||
          typeof itemData.properties.height !== 'number'
        ) {
          console.error(`VALIDATION: Spike width and height must be numbers`);
          return false;
        }
        if (
          itemData.properties.width <= 0 ||
          itemData.properties.height <= 0
        ) {
          console.error(`VALIDATION: Invalid spike dimensions - must be greater than zero`);
          return false;
        }
        break;
        
      case 'dart_wall':
        console.log(`VALIDATION: Validating dart_wall properties height=${itemData.properties.height}`);
        if (typeof itemData.properties.height !== 'number') {
          console.error(`VALIDATION: Dart wall height must be a number`);
          return false;
        }
        if (itemData.properties.height <= 0) {
          console.error(`VALIDATION: Invalid dart wall height - must be greater than zero`);
          return false;
        }
        break;
    }
    
    console.log(`VALIDATION: Item placement of type ${itemData.type} is VALID`);
    return true;
  }
  
  /**
   * Check if a client is authorized to start a game
   */
  canStartGame(clientId: string): boolean {
    const state = this.gameState.getState();
    
    // Check if the client is a host in any lobby
    return !!(state.lobbies && Array.isArray(state.lobbies) && 
      state.lobbies.some((lobby: any) => lobby.hostId === clientId));
  }
  
  /**
   * Check if a game round is complete
   */
  checkRoundComplete(lobbyId: string): boolean {
    const state = this.gameState.getState();
    const lobby = state.lobbies && Array.isArray(state.lobbies) ? 
      state.lobbies.find((lobby: any) => lobby.id === lobbyId) : undefined;
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
    const position: Vector2D = { x: 300, y: 300 };
    return {
      success: true,
      action: {
        type: 'place_item',
        itemType: 'platform',
        position,
        properties: { width: 100, height: 20 }
      }
    };
  }
  
  /**
   * Reset the game state for a new round
   */
  startNewRound(lobbyId: string): void {
    const state = this.gameState.getState();
    const lobby = state.lobbies && Array.isArray(state.lobbies) ?
      state.lobbies.find((lobby: any) => lobby.id === lobbyId) : undefined;
    if (!lobby) return;
    
    // Reset all players in this lobby
    for (const playerId of lobby.players) {
      const player = state.players.find((p: any) => p.id === playerId);
      if (player) {
        player.position = { ...PLAYER.DEFAULT_POSITION };
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
  gameState: GameStateManager
): GameLogicProcessor {
  return new GameLogicProcessor(gameState);
}

export { GameLogicProcessor };