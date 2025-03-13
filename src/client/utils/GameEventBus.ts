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
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
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