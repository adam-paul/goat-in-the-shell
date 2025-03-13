import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage } from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';

// Type for event handlers
type EventHandler = (payload: unknown) => void;
type EventHandlerMap = Record<string, EventHandler[]>;

class SocketEvents {
  private socket: WebSocket | null = null;
  private eventHandlers: EventHandlerMap = {};
  
  /**
   * Initialize the SocketEvents with a WebSocket instance
   */
  initialize(socket: WebSocket): void {
    this.socket = socket;
    
    // Set up message listener
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as NetworkMessage;
        console.log('SOCKET EVENTS: Received message:', message);
        
        // Process event handlers
        this.processMessage(message);
      } catch (error) {
        console.error('SOCKET EVENTS: Error parsing message:', error);
      }
    };
  }
  
  /**
   * Add an event handler for a specific message type
   */
  on(messageType: string, handler: EventHandler): this {
    if (!this.eventHandlers[messageType]) {
      this.eventHandlers[messageType] = [];
    }
    
    this.eventHandlers[messageType].push(handler);
    return this; // For chaining
  }
  
  /**
   * Remove an event handler for a specific message type
   */
  off(messageType: string, handler?: EventHandler): this {
    if (!handler) {
      // Remove all handlers for this message type
      delete this.eventHandlers[messageType];
    } else if (this.eventHandlers[messageType]) {
      // Remove specific handler
      this.eventHandlers[messageType] = this.eventHandlers[messageType]
        .filter(h => h !== handler);
    }
    return this; // For chaining
  }
  
  /**
   * Process an incoming message, publish to event bus and dispatch to handlers
   */
  private processMessage(message: NetworkMessage): void {
    const { type, payload, data } = message;
    const messageData = payload || data;
    
    // First publish to the game event bus for any game components
    gameEvents.publish(type, messageData);
    
    // Then call any registered handlers for this message type
    const handlers = this.eventHandlers[type];
    
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler(messageData);
        } catch (error) {
          console.error(`SOCKET EVENTS: Error in handler for ${type}:`, error);
        }
      });
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.socket = null;
    this.eventHandlers = {};
    // We don't clear gameEvents here as it might be used by other components
  }
}

// Create a singleton instance
const socketEvents = new SocketEvents();

/**
 * Hook to use SocketEvents with the current socket
 */
export function useSocketEvents() {
  // Only expose a subset of methods for components
  return {
    on: (messageType: string, handler: EventHandler) => 
      socketEvents.on(messageType, handler),
    off: (messageType: string, handler?: EventHandler) => 
      socketEvents.off(messageType, handler),
  };
}

// Export the singleton for initialization
export default socketEvents;