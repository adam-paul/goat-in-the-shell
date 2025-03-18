import { GAME_EVENTS } from '../../shared/constants';
import type { NetworkMessage, StateUpdateMessage, InitialStateMessage, UniversalGameState } from '../../shared/types';
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
        console.log('SOCKET EVENTS: Received message:', message.type);
        console.log('SOCKET EVENTS: Message payload:', JSON.stringify(message.payload).substring(0, 200) + '...');
        
        // Process game state updates
        if (message.type === GAME_EVENTS.STATE_UPDATE) {
          // Get the state from the payload
          const stateUpdate = message as StateUpdateMessage;
          const gameState = stateUpdate.payload?.state;
          
          // Debug player positions in state updates (every 30 updates to avoid spam)
          if (gameState && gameState.players && Math.random() < 0.03) {
            const players = Array.isArray(gameState.players) ? gameState.players : Object.values(gameState.players);
            if (players.length > 0) {
              console.log("SOCKET CLIENT: Received player positions:", 
                players.map((p: any) => ({
                  id: p.id,
                  position: p.position,
                  hasInput: p.lastInput ? true : false
                }))
              );
            }
          }
          
          // Update the game state in the store immediately
          const store = (window as any).__game_store_instance__;
          if (store && store.updateGameState && gameState) {
            store.updateGameState(gameState);
          }
        }
        
        // Process and forward the message
        this.forwardToGameEventBus(message);
      } catch (error) {
        console.error('SOCKET EVENTS: Error parsing message:', error);
      }
    };

    // We've removed this handler to prevent duplicate messages
    // Item placement now goes directly to socketInterface rather than through this event bus
  }
  
  /**
   * Forward an incoming message to the GameEventBus
   */
  private forwardToGameEventBus(message: NetworkMessage): void {
    const { type, payload } = message;
    
    // Handle placement success - simplified to just forward the event
    if (type === GAME_EVENTS.EVENT && payload?.eventType === 'PLACEMENT_SUCCESS') {
      // Just forward the event - state is now managed directly by ITEM_PLACED handlers
      gameEvents.publish(type, payload);
    }
    // Generic event handling - forward to event bus
    else if (type === GAME_EVENTS.EVENT) {
      // Just forward the event to the event bus
      gameEvents.publish(type, payload);
    } 
    // Handle game state transition for countdown
    else if (type === GAME_EVENTS.GAME_STARTED || 
        (type === GAME_EVENTS.EVENT && payload?.eventType === 'GAME_STARTED')) {
      // First publish to the game event bus for state update
      gameEvents.publish(type, payload);
      
      // Then trigger countdown after item placement is confirmed
      // Even if this is triggered by a server event, it won't start the countdown twice
      // because the countdown manager checks its own state
      gameEvents.publish('START_COUNTDOWN', { duration: 3000 });
    }
    // Handle state transition result messages
    else if (type === GAME_EVENTS.STATE_TRANSITION_RESULT) {
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
    else if (type === GAME_EVENTS.GAME_STATE_CHANGED) {
      console.log('Game state changed:', payload);
      
      // Special handling for win state
      if (payload.currentState === 'win') {
        console.log('🏆 WIN EVENT DETECTED from server! Transitioning to win state');
        
        // Update the game state in the store
        const store = (window as any).__game_store_instance__;
        if (store && store.setGameStatus) {
          store.setGameStatus('win');
        }
        
        // Also publish to game scene for visual effects
        gameEvents.publish('GAME_STATUS_CHANGE', { 
          status: 'win' 
        });
      }
      // Regular handling for other state changes
      else {
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
      }
      
      // Also publish the message to the game event bus
      gameEvents.publish(type, payload);
    }
    // Handle lobby joined events
    // Handle explicit player win events from server
    else if (type === GAME_EVENTS.EVENT && payload?.eventType === 'PLAYER_WIN') {
      console.log('🏆 PLAYER_WIN event received:', payload);
      
      // Update the game state in the store
      const store = (window as any).__game_store_instance__;
      if (store && store.setGameStatus) {
        store.setGameStatus('win');
      }
      
      // Also publish to game scene for visual effects
      gameEvents.publish('GAME_STATUS_CHANGE', { 
        status: 'win' 
      });
      
      // Publish the original event
      gameEvents.publish(type, payload);
    }
    else if (type === GAME_EVENTS.EVENT && payload?.eventType === 'LOBBY_JOINED') {
      console.log('Joined lobby:', payload);
      
      // Store the instanceId in the game store
      if (payload.instanceId) {
        console.log('Setting instanceId:', payload.instanceId);
        const store = (window as any).__game_store_instance__;
        if (store && store.setInstanceId) {
          store.setInstanceId(payload.instanceId);
        }
      }
      
      // Publish the message to the game event bus
      gameEvents.publish(type, payload);
    }
    // Handle countdown messages from server
    else if (type === GAME_EVENTS.START_COUNTDOWN) {
      // Forward to the countdown manager
      gameEvents.publish('START_COUNTDOWN', payload);
      
      // Also publish the original message
      gameEvents.publish(type, payload);
    }
    // Handle initial state message
    else if (type === GAME_EVENTS.INITIAL_STATE) {
      // Parse as initial state message
      const initialStateMsg = message as InitialStateMessage;
      const state = initialStateMsg.payload?.state;
      const clientId = initialStateMsg.payload?.clientId;
      
      console.log('Received initial state from server with clientId:', clientId);
      
      // Set client ID in the store immediately
      const store = (window as any).__game_store_instance__;
      if (store && store.setClientId && clientId) {
        store.setClientId(clientId);
      }
      
      // Store game config if available
      if (store && store.setGameConfig && state?.gameConfig) {
        store.setGameConfig(state.gameConfig);
      }
      
      // Update the full game state using our unified format
      if (store && store.updateGameState && state) {
        store.updateGameState(state);
      }
      
      // Forward the state to rendering components via SERVER_STATE_UPDATE for immediate rendering
      if (state) {
        console.log('Publishing game world from INITIAL_STATE for immediate rendering');
        console.log('Game world data present:', state.gameWorld ? 'YES' : 'NO');
        console.log('Game world structure:', state.gameWorld ? JSON.stringify(state.gameWorld).substring(0, 200) : 'MISSING');
        gameEvents.publish(GAME_EVENTS.SERVER_STATE_UPDATE, state);
      }
      
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