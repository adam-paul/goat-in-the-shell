import { WebSocket } from 'ws';

class ServerNetworkMessenger {
  /**
   * Send the initial game state to a new client
   */
  sendInitialState(socket: WebSocket, clientId: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    
    const initialStateMessage = {
      type: 'INITIAL_STATE',
      data: {
        clientId,
        timestamp: Date.now(),
        gameConfig: {
          // Game configuration details would go here
          gravity: 1.0,
          moveSpeed: 5.0,
          jumpForce: 10.0,
        }
      }
    };
    
    socket.send(JSON.stringify(initialStateMessage));
  }
  
  /**
   * Send a game state update to a specific client
   */
  sendStateUpdate(socket: WebSocket, gameState: any): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    
    const stateUpdateMessage = {
      type: 'STATE_UPDATE',
      data: {
        timestamp: Date.now(),
        state: gameState
      }
    };
    
    socket.send(JSON.stringify(stateUpdateMessage));
  }
  
  /**
   * Send an event notification to a client
   */
  sendEvent(socket: WebSocket, eventType: string, eventData: any): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    
    const eventMessage = {
      type: 'EVENT',
      data: {
        eventType,
        timestamp: Date.now(),
        ...eventData
      }
    };
    
    socket.send(JSON.stringify(eventMessage));
  }
  
  /**
   * Send an error message to a client
   */
  sendError(socket: WebSocket, errorCode: string, errorMessage: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    
    const errorMsg = {
      type: 'ERROR',
      data: {
        code: errorCode,
        message: errorMessage,
        timestamp: Date.now()
      }
    };
    
    socket.send(JSON.stringify(errorMsg));
  }
  
  /**
   * Send a message to a specific client by ID
   */
  sendToClient(clients: Map<string, {id: string, socket: WebSocket}>, clientId: string, message: any): boolean {
    const client = clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return false;
    
    client.socket.send(JSON.stringify(message));
    return true;
  }
  
  /**
   * Broadcast a message to all connected clients
   */
  broadcastToAll(clients: Map<string, {id: string, socket: WebSocket}>, message: any): void {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    });
  }
  
  /**
   * Prepare a game snapshot for efficient transmission
   * This could include delta compression or other optimizations
   */
  prepareGameSnapshot(fullState: any, _previousState: any): any {
    // In a real implementation, this would create a delta between states
    // For now, we'll just return the full state
    return {
      timestamp: Date.now(),
      entities: fullState.entities,
      // Only send what's absolutely needed
    };
  }
}

export { ServerNetworkMessenger };