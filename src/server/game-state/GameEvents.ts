/**
 * Server-side event bus for game events
 */
export type EventListener<T = unknown> = (data: T) => void;

class GameEventBus {
  private listeners: Record<string, EventListener[]> = {};

  /**
   * Subscribe to an event
   * @param event Event name to subscribe to
   * @param callback Function to call when event is emitted
   * @returns Unsubscribe function
   */
  subscribe<T>(event: string, callback: EventListener<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback as EventListener);
    
    return () => this.unsubscribe(event, callback as EventListener);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param callback Callback to remove
   */
  unsubscribe(event: string, callback: EventListener): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Publish an event to all subscribers
   * @param event Event name
   * @param data Event data
   */
  publish<T>(event: string, data: T): void {
    console.log(`GameEventBus: Publishing server event '${event}'`, data);
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in server event handler for ${event}:`, error);
      }
    });
  }
  
  /**
   * Alias for publish for backward compatibility
   * @deprecated Use publish instead
   */
  emit<T>(event: string, data: T): void {
    this.publish(event, data);
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

// Singleton instance for server-wide use
export const gameEvents = new GameEventBus();