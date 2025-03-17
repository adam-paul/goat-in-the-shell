import { WebSocketServer } from 'ws';
import { GameLogicProcessor } from '../logic';
import { GameSessionManager } from '../game-state/GameSessionManager';
import { SocketServer } from './SocketServer';

/**
 * Create and return a socket server instance
 */
function createSocketServer(
  wss: WebSocketServer,
  sessionManager: GameSessionManager,
  gameLogic: GameLogicProcessor
): SocketServer {
  return new SocketServer(wss, sessionManager, gameLogic);
}

export { 
  SocketServer,
  createSocketServer 
};