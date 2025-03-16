import { GameStateManager } from '../game-state';
import { PlayerRegistry } from '../registry';
import { PhysicsEngineInstance } from './PhysicsEngineInstance';

/**
 * Create a new physics engine for a specific game instance
 */
export function createPhysicsEngine(
  instanceId: string,
  gameState: GameStateManager,
  playerRegistry: PlayerRegistry
): PhysicsEngineInstance {
  return new PhysicsEngineInstance(instanceId, gameState, playerRegistry);
}

export { PhysicsEngineInstance };