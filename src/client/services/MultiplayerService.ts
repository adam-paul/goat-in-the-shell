// src/client/services/MultiplayerService.ts
// Stub implementation until we migrate the service properly

/**
 * This is a temporary stub for the MultiplayerService
 * It will be fully implemented as part of the server migration
 */
export class MultiplayerService {
  private static instance: MultiplayerService;
  private eventListeners: Record<string, Function[]> = {};
  
  private constructor() {
    // Private constructor for singleton pattern
    console.warn('MultiplayerService is a stub, pending server implementation');
  }
  
  public static getInstance(): MultiplayerService {
    if (!MultiplayerService.instance) {
      MultiplayerService.instance = new MultiplayerService();
    }
    return MultiplayerService.instance;
  }
  
  public on(eventType: string, callback: Function): void {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
  }
  
  public off(eventType: string, callback?: Function): void {
    if (!this.eventListeners[eventType]) return;
    
    if (callback) {
      // Remove specific callback
      this.eventListeners[eventType] = 
        this.eventListeners[eventType].filter(cb => cb !== callback);
    } else {
      // Remove all callbacks for this event type
      delete this.eventListeners[eventType];
    }
  }
  
  public sendMessage(type: string, data: any): void {
    console.log(`[MultiplayerService Stub] Sending message: ${type}`, data);
    // In the real implementation, this would send the message to the server
  }
}