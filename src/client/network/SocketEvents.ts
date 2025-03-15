import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage } from '../../shared/types';
import { gameEvents } from '../utils/GameEventBus';

/**
 * Handles WebSocket messages and forwards them to GameEventBus
 */
class SocketEvents {
  private socket: WebSocket | null = null;
  
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
        
        // Process and forward the message
        this.forwardToGameEventBus(message);
      } catch (error) {
        console.error('SOCKET EVENTS: Error parsing message:', error);
      }
    };
  }
  
  /**
   * Forward an incoming message to the GameEventBus
   */
  private forwardToGameEventBus(message: NetworkMessage): void {
    const { type, payload } = message;
    
    // Handle special case for item placement to trigger countdown
    if (type === 'EVENT' && payload?.eventType === 'ITEM_PLACED') {
      // First trigger the item placement event for rendering
      gameEvents.publish('ITEM_PLACED', payload);
      
      // Then publish the message to the game event bus
      gameEvents.publish(type, payload);
    } 
    // Handle game state transition for countdown
    else if (type === 'GAME_STARTED' || 
        (type === 'EVENT' && payload?.eventType === 'GAME_STARTED')) {
      // First publish to the game event bus for state update
      gameEvents.publish(type, payload);
      
      // Then trigger countdown after item placement is confirmed
      // Even if this is triggered by a server event, it won't start the countdown twice
      // because the countdown manager checks its own state
      gameEvents.publish('START_COUNTDOWN', { duration: 3000 });
    }
    else {
      // For all other events, just publish to the game event bus
      gameEvents.publish(type, payload);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.socket = null;
  }
}

// Create a singleton instance
const socketEvents = new SocketEvents();

// Export the singleton for initialization
export default socketEvents;