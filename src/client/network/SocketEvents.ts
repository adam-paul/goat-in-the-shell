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
    // Handle state transition result messages
    else if (type === 'STATE_TRANSITION_RESULT') {
      console.log('Received state transition result:', payload);
      
      // If the transition was successful, update local game state
      if (payload.success) {
        // Update the game state in the store
        const store = (window as any).__game_store_instance__;
        if (store && store.setGameStatus) {
          store.setGameStatus(payload.currentState);
        } else {
          // Fallback using game events
          gameEvents.publish('UPDATE_GAME_STATUS', {
            status: payload.currentState
          });
        }
      } else {
        console.warn(`State transition failed: ${payload.message}`);
      }
      
      // Also publish the message to the game event bus
      gameEvents.publish(type, payload);
    }
    // Handle game state changed notifications
    else if (type === 'GAME_STATE_CHANGED') {
      console.log('Game state changed:', payload);
      
      // Update the game state in the store
      const store = (window as any).__game_store_instance__;
      if (store && store.setGameStatus) {
        store.setGameStatus(payload.currentState);
      } else {
        // Fallback using game events
        gameEvents.publish('UPDATE_GAME_STATUS', {
          status: payload.currentState
        });
      }
      
      // Also publish the message to the game event bus
      gameEvents.publish(type, payload);
      
      // Handle special state-specific actions
      if (payload.currentState === 'playing') {
        // For playing state, make sure countdown is triggered
        gameEvents.publish('START_COUNTDOWN', { duration: 3000 });
      }
    }
    // Handle lobby joined events
    else if (type === 'EVENT' && payload?.eventType === 'LOBBY_JOINED') {
      console.log('Joined lobby:', payload);
      
      // We let the client handle state transitions after lobby is joined
      // The client will request transitions based on game mode selected
      
      // Just publish the message to the game event bus
      gameEvents.publish(type, payload);
    }
    // Handle countdown messages from server
    else if (type === 'START_COUNTDOWN') {
      // Forward to the countdown manager
      gameEvents.publish('START_COUNTDOWN', payload);
      
      // Also publish the original message
      gameEvents.publish(type, payload);
    }
    // Handle initial state message
    else if (type === 'INITIAL_STATE') {
      // We don't update game status from initial state anymore - tutorial and mode select are client-side
      // Just store the clientId and other config data
      console.log('Received initial state from server');
      
      // Publish the original message to the game event bus
      gameEvents.publish(type, payload);
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