export class NetworkMessenger {
  private socket: WebSocket | null = null;
  
  constructor(socket: WebSocket | null) {
    this.socket = socket;
  }
  
  setSocket(socket: WebSocket | null) {
    this.socket = socket;
  }
  
  // Send a message to the server
  sendMessage(type: string, payload?: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    this.socket.send(JSON.stringify({
      type,
      payload
    }));
    
    return true;
  }
  
  // Send player state update
  sendPlayerState(playerState: any) {
    return this.sendMessage('player_state', playerState);
  }
  
  // Send command (e.g., place obstacle)
  sendCommand(type: string, x: number, y: number) {
    return this.sendMessage('command', { type, x, y });
  }
  
  // Send lobby create/join request
  sendLobbyRequest(lobbyCode: string, role: string) {
    return this.sendMessage('join_lobby', { lobbyCode, role });
  }
  
  // Send game start request
  sendStartGame() {
    return this.sendMessage('start_game');
  }
}