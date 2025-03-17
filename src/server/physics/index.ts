import { GameSessionManager } from '../game-state';
import { PhysicsEngineInstance } from './PhysicsEngineInstance';

/**
 * Create a new physics engine for a specific game session
 */
export function createPhysicsEngine(
  sessionId: string,
  session: any
): PhysicsEngineInstance {
  return new PhysicsEngineInstance(sessionId, session);
}

export { PhysicsEngineInstance };