export class MultiplayerService {
  private static instance: MultiplayerService;
  private socket: WebSocket | null = null;
  private lobbyCode: string = '';
  private playerRole: 'goat' | 'prompter' = 'goat';
  private messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  
  private constructor() {
    // Private constructor for singleton pattern
  }
  
  public static getInstance(): MultiplayerService {
    if (!MultiplayerService.instance) {
      MultiplayerService.instance = new MultiplayerService();
    }
    return MultiplayerService.instance;
  }
  
  // Connect to WebSocket server
  public connect(lobbyCode: string, playerRole: 'goat' | 'prompter'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = API_URL.replace(/^https?:/, wsProtocol);
      
      this.lobbyCode = lobbyCode;
      this.playerRole = playerRole;
      this.socket = new WebSocket(`${wsUrl}/ws/${lobbyCode}/${playerRole}`);
      
      this.socket.onopen = () => {
        console.log(`Connected to lobby ${lobbyCode} as ${playerRole}`);
        this.reconnectAttempts = 0;
        resolve(true);
      };
      
      this.socket.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code}`);
        this.handleDisconnect();
        resolve(false);
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }
  
  // Send message to server
  public sendMessage(type: string, data: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type,
        data,
        playerRole: this.playerRole,
        timestamp: Date.now()
      }));
    } else {
      console.error('Cannot send message, socket not connected');
    }
  }
  
  // Register event handler
  public on(messageType: string, handler: (data: unknown) => void): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)?.push(handler);
  }
  
  // Remove event handler
  public off(messageType: string, handler?: (data: unknown) => void): void {
    if (!this.messageHandlers.has(messageType)) return;
    
    if (!handler) {
      // Remove all handlers for this message type
      this.messageHandlers.delete(messageType);
    } else {
      // Remove specific handler
      const handlers = this.messageHandlers.get(messageType) || [];
      const filteredHandlers = handlers.filter(h => h !== handler);
      this.messageHandlers.set(messageType, filteredHandlers);
    }
  }
  
  // Handle incoming message
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log("Received WebSocket message:", message);
      
      // Handle system messages about player joining
      if (message.type === "system_message" && message.message && message.message.includes("Player joined")) {
        console.log("Player joined message received:", message);
        // Also trigger the player_joined event with the lobby info
        const playerJoinedHandlers = this.messageHandlers.get('player_joined') || [];
        playerJoinedHandlers.forEach(handler => {
          try {
            handler(message.lobby_info || {});
          } catch (error) {
            console.error(`Error in message handler for player_joined:`, error);
          }
        });
      }
      
      // Call the regular type-specific handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      handlers.forEach(handler => {
        try {
          handler(message.data || message);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  // Handle disconnection with reconnect logic
  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
      
      setTimeout(() => {
        this.connect(this.lobbyCode, this.playerRole)
          .catch(error => {
            console.error('Reconnection failed:', error);
          });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      // Notify application about permanent disconnect
      const handlers = this.messageHandlers.get('disconnect') || [];
      handlers.forEach(handler => handler(null));
    }
  }
  
  // Disconnect from server
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  // Get current connection status
  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  
  // Get current lobby code
  public getLobbyCode(): string {
    return this.lobbyCode;
  }
  
  // Get current player role
  public getPlayerRole(): 'goat' | 'prompter' {
    return this.playerRole;
  }
}