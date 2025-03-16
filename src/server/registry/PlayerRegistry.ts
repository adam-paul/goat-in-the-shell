import { Vector2D } from '../../shared/types';
import { PLAYER } from '../../shared/constants';
import { gameEvents } from '../game-state/GameEvents';

export interface Player {
  id: string;
  name: string;
  position: Vector2D;
  velocity: Vector2D;
  isAlive: boolean;
  score: number;
  onGround?: boolean;
  facingLeft?: boolean;
}

export class PlayerRegistry {
  private players: Map<string, Player> = new Map();
  private playerToInstanceMap: Map<string, string> = new Map();

  // Player management
  addPlayer(id: string, name: string): Player {
    const player = {
      id,
      name,
      position: { ...PLAYER.DEFAULT_POSITION },
      velocity: { x: 0, y: 0 },
      isAlive: true,
      score: 0,
      onGround: true,
      facingLeft: false
    };
    this.players.set(id, player);
    return player;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  removePlayer(id: string): boolean {
    const removed = this.players.delete(id);
    this.playerToInstanceMap.delete(id);
    return removed;
  }

  // Instance association
  associatePlayerWithInstance(playerId: string, instanceId: string): void {
    this.playerToInstanceMap.set(playerId, instanceId);
  }

  getPlayerInstance(playerId: string): string | undefined {
    return this.playerToInstanceMap.get(playerId);
  }

  getInstancePlayers(instanceId: string): string[] {
    const players: string[] = [];
    this.playerToInstanceMap.forEach((instance, player) => {
      if (instance === instanceId) {
        players.push(player);
      }
    });
    return players;
  }

  getAllPlayersForInstance(instanceId: string): Player[] {
    return this.getInstancePlayers(instanceId)
      .map(id => this.getPlayer(id))
      .filter(player => player !== undefined) as Player[];
  }

  updatePlayerPosition(id: string, position: Vector2D): void {
    const player = this.players.get(id);
    if (player) {
      const oldPosition = { ...player.position };
      player.position = position;
      
      // Publish event for position change
      gameEvents.publish('PLAYER_POSITION_CHANGED', {
        playerId: id,
        oldPosition,
        newPosition: position,
        instanceId: this.playerToInstanceMap.get(id),
        timestamp: Date.now()
      });
    }
  }

  updatePlayerVelocity(id: string, velocity: Vector2D): void {
    const player = this.players.get(id);
    if (player) {
      const oldVelocity = { ...player.velocity };
      player.velocity = velocity;
      
      // Publish event for velocity change
      gameEvents.publish('PLAYER_VELOCITY_CHANGED', {
        playerId: id,
        oldVelocity,
        newVelocity: velocity,
        instanceId: this.playerToInstanceMap.get(id),
        timestamp: Date.now()
      });
    }
  }

  setPlayerAliveStatus(id: string, isAlive: boolean): void {
    const player = this.players.get(id);
    if (player) {
      // Only publish event if status actually changes
      if (player.isAlive !== isAlive) {
        const oldStatus = player.isAlive;
        player.isAlive = isAlive;
        
        // Publish event for alive status change
        gameEvents.publish('PLAYER_ALIVE_STATUS_CHANGED', {
          playerId: id,
          oldStatus,
          isAlive,
          instanceId: this.playerToInstanceMap.get(id),
          timestamp: Date.now()
        });
      } else {
        // Still update the value even if it's the same
        player.isAlive = isAlive;
      }
    }
  }

  updatePlayerScore(id: string, score: number): void {
    const player = this.players.get(id);
    if (player) {
      const oldScore = player.score;
      player.score = score;
      
      // Publish event for score change
      gameEvents.publish('PLAYER_SCORE_CHANGED', {
        playerId: id,
        oldScore,
        newScore: score,
        instanceId: this.playerToInstanceMap.get(id),
        timestamp: Date.now()
      });
    }
  }

  updatePlayerGroundStatus(id: string, isOnGround: boolean): void {
    const player = this.players.get(id);
    if (player) {
      const oldGroundStatus = player.onGround;
      player.onGround = isOnGround;
      
      // Only emit event if the status changed
      if (oldGroundStatus !== isOnGround) {
        // Publish event for ground status change
        gameEvents.publish('PLAYER_GROUND_STATUS_CHANGED', {
          playerId: id,
          isOnGround,
          instanceId: this.playerToInstanceMap.get(id),
          timestamp: Date.now()
        });
      }
    }
  }

  updatePlayerFacingDirection(id: string, facingLeft: boolean): void {
    const player = this.players.get(id);
    if (player) {
      const oldDirection = player.facingLeft;
      player.facingLeft = facingLeft;
      
      // Only emit event if the direction changed
      if (oldDirection !== facingLeft) {
        // Publish event for facing direction change
        gameEvents.publish('PLAYER_FACING_CHANGED', {
          playerId: id,
          facingLeft,
          instanceId: this.playerToInstanceMap.get(id),
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Get a complete snapshot of player state for a specific instance
   * This is useful for client synchronization
   */
  getInstanceStateSnapshot(instanceId: string): {
    players: Player[];
    timestamp: number;
  } {
    // Get all players in this instance
    const players = this.getAllPlayersForInstance(instanceId);
    
    return {
      players,
      timestamp: Date.now()
    };
  }
}