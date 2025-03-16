import { WebSocketServer } from 'ws';
import { GameStateManager, GameInstanceManager } from '../game-state';
import { GameLogicProcessor } from '../logic';
import { PlayerRegistry } from '../registry';
import { SocketServer } from './SocketServer';

/**
 * Create and return a socket server instance
 */
function createSocketServer(
  wss: WebSocketServer,
  gameState: GameStateManager,
  gameLogic: GameLogicProcessor,
  gameInstanceManager: GameInstanceManager,
  playerRegistry: PlayerRegistry
): SocketServer {
  return new SocketServer(wss, gameState, gameLogic, gameInstanceManager, playerRegistry);
}

export { 
  SocketServer,
  createSocketServer 
};