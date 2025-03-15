/**
 * A type-safe event bus for game communication
 */
export type Listener<T = unknown> = (data: T) => void;

export class GameEventBus {
  private listeners: Record<string, Listener[]> = {};

  /**
   * Subscribe to an event
   * @param event Event name to subscribe to
   * @param callback Function to call when event is published
   * @returns Unsubscribe function
   */
  subscribe<T>(event: string, callback: Listener<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback as Listener);
    
    return () => this.unsubscribe(event, callback as Listener);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param callback Callback to remove
   */
  unsubscribe(event: string, callback: Listener): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Publish an event to all subscribers
   * @param event Event name
   * @param data Event data
   */
  publish<T>(event: string, data: T): void {
    console.log(`GameEventBus: Publishing event '${event}'`, data);
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Clear all listeners for a specific event
   * @param event Event name to clear
   */
  clear(event: string): void {
    delete this.listeners[event];
  }

  /**
   * Clear all listeners for all events
   */
  clearAll(): void {
    this.listeners = {};
  }
}

// Singleton instance for app-wide use
export const gameEvents = new GameEventBus();

// Set up forwarding of state transition requests to socket
gameEvents.subscribe('REQUEST_STATE_TRANSITION', (data: any) => {
  // This function will be called when components publish REQUEST_STATE_TRANSITION events
  // We need to get the socket instance to forward the request to the server
  const socketFetcher = () => {
    const socket = (window as any).__socket_instance__;
    if (socket && socket.requestStateTransition) {
      socket.requestStateTransition(data.targetState);
    } else {
      console.warn('Socket not available for state transition request');
    }
  };
  
  // Try to send immediately, or retry in 50ms if socket not ready
  try {
    socketFetcher();
  } catch (e) {
    setTimeout(socketFetcher, 50);
  }
});