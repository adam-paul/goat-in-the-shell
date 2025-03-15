# Game State Machine Architecture

This document details the state machine architecture implemented for "Goat in the Shell", explaining the design decisions, implementation details, and guidelines for future development.

## Overview

Our game uses a hybrid state management approach that combines client-side and server-side state machines, providing both responsive UI and authoritative game state. The architecture ensures consistent game states across all clients while maintaining a fluid user experience.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Client UI      │     │  Client-Side    │     │  Server-Side    │
│  Components     │◄────┤  State Store    │◄────┤  State Machine  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       │                       ▲
        │                       ▼                       │
        │               ┌─────────────────┐             │
        └───────────────┤  Event System   ├─────────────┘
                        └─────────────────┘
```

## Core Concepts

### 1. Hybrid State Management

We use a hybrid approach to state management:

* **Client-Side Only States**: 
  * Tutorial and mode select screens (pre-connection)
  * Managed solely by the client
  * No server validation required

* **Server-Authoritative States**: 
  * All game states after connection (select, placement, playing, etc.)
  * Server validates state transitions
  * Client requests transitions, server confirms
  * All clients stay in sync based on server state

### 2. Responsive UI with Server Validation

To maintain both responsiveness and consistency:

1. Client updates UI immediately when user acts
2. Client requests state transition from server
3. Server validates transition against rules
4. Server confirms or rejects the transition
5. Client syncs with server's authoritative state

### 3. State Machine Rules

Valid state transitions are explicitly defined in shared constants:

```typescript
// Game status transitions
export const GAME_STATUS_TRANSITIONS = {
  tutorial: ['modeSelect'],
  modeSelect: ['lobby', 'select', 'reset'],
  lobby: ['playing', 'modeSelect', 'select'],
  select: ['placement', 'modeSelect', 'reset'],
  placement: ['playing', 'select', 'reset'],
  playing: ['win', 'gameover', 'select', 'reset'],
  win: ['reset', 'modeSelect', 'select'],
  gameover: ['reset', 'modeSelect', 'select'],
  reset: ['select', 'placement', 'modeSelect', 'tutorial']
};
```

## Implementation Details

### Server-Side Components

#### 1. GameStateMachine Class

Primary state authority that enforces valid transitions.

```typescript
export class GameStateMachine {
  private currentState: GameStatus;
  private instanceId: string;
  // ...

  isValidTransition(fromState: GameStatus, toState: GameStatus): boolean {
    // Same state is always valid
    if (fromState === toState) return true;
    
    // Check against defined transitions
    const validNextStates = GAME_STATUS_TRANSITIONS[fromState];
    if (!validNextStates) return false;
    return validNextStates.includes(toState);
  }

  transitionTo(newState: GameStatus, force: boolean = false): boolean {
    if (!force && !this.isValidTransition(this.currentState, newState)) {
      return false;
    }
    
    // Update state and trigger side effects
    this.currentState = newState;
    this.handleStateEnter(newState);
    
    // Publish event
    gameEvents.publish('GAME_STATE_CHANGED', {
      previousState,
      currentState: newState,
      // ...
    });
    
    return true;
  }
}
```

#### 2. Game Instance Manager

Associates players with game instances, each with its own state machine.

```typescript
export class GameInstanceManager {
  // Maps for instance tracking
  private instances: Map<string, GameInstance>;
  private lobbyToInstanceMap: Map<string, string>;
  private playerToInstanceMap: Map<string, string>;
  
  createInstance(lobbyId: string, players: string[]): GameInstance {
    // Create game state and state machine
    const state = new GameStateManager();
    const stateMachine = new GameStateMachine('select', instanceId);
    
    // Create instance and store mappings
    const instance = { state, stateMachine, /* ... */ };
    this.instances.set(instanceId, instance);
    
    return instance;
  }
  
  getInstanceByPlayer(playerId: string): GameInstance | null {
    const instanceId = this.playerToInstanceMap.get(playerId);
    if (!instanceId) return null;
    return this.getInstance(instanceId);
  }
  
  // Other management methods...
}
```

#### 3. Socket Server

Handles client requests for state transitions.

```typescript
private handleStateTransitionRequest(clientId: string, data: any) {
  const { targetState } = data;
  const instance = this.instanceManager.getInstanceByPlayer(clientId);
  
  if (!instance) {
    // No instance found, reject transition
    return this.sendMessage(clientId, {
      type: MESSAGE_TYPES.STATE_TRANSITION_RESULT,
      payload: { success: false, message: 'Not associated with a game instance' }
    });
  }
  
  // Get current state and validate transition
  const currentState = instance.stateMachine.getCurrentState();
  const isValid = instance.stateMachine.isValidTransition(currentState, targetState);
  
  if (!isValid) {
    // Invalid transition, reject
    return this.sendMessage(clientId, {
      type: MESSAGE_TYPES.STATE_TRANSITION_RESULT,
      payload: { success: false, message: `Invalid transition from ${currentState} to ${targetState}` }
    });
  }
  
  // Attempt transition
  const success = instance.stateMachine.transitionTo(targetState);
  
  // Broadcast result to all players in instance
  if (success) {
    this.broadcastToInstance(instance.id, {
      type: MESSAGE_TYPES.GAME_STATE_CHANGED,
      payload: { previousState: currentState, currentState: targetState }
    });
  }
}
```

### Client-Side Components

#### 1. Game Store (Zustand)

```typescript
// Create the store
export const useGameStore = create<GameState>((set, get): GameState => {
  const store: GameState = {
    // Default state
    gameStatus: 'tutorial',
    
    // State setters
    setGameStatus: (status: GameStatus) => set(() => ({ gameStatus: status })),
    requestGameStateTransition: (status: GameStatus) => {
      // Publish event for network layer
      gameEvents.publish('REQUEST_STATE_TRANSITION', { targetState: status });
    },
    
    // UI handlers with optimistic updates
    handleSelectItem: (item: ItemType) => {
      set(() => ({ selectedItem: item, placementConfirmed: false }));
      
      // Optimistic UI update
      set(() => ({ gameStatus: 'placement' }));
      
      // Request server validation
      gameEvents.publish('REQUEST_STATE_TRANSITION', { targetState: 'placement' });
    },
    
    // Other handlers...
  };
  
  return store;
});
```

#### 2. Socket Event Handlers

```typescript
// Handle state transition result messages
else if (type === 'STATE_TRANSITION_RESULT') {
  console.log('Received state transition result:', payload);
  
  // If successful, update store
  if (payload.success) {
    const store = (window as any).__game_store_instance__;
    if (store && store.setGameStatus) {
      store.setGameStatus(payload.currentState);
    }
  }
}

// Handle game state changed notifications
else if (type === 'GAME_STATE_CHANGED') {
  console.log('Game state changed:', payload);
  
  // Update store with server state
  const store = (window as any).__game_store_instance__;
  if (store && store.setGameStatus) {
    store.setGameStatus(payload.currentState);
  }
  
  // Handle special state actions
  if (payload.currentState === 'playing') {
    gameEvents.publish('START_COUNTDOWN', { duration: 3000 });
  }
}
```

## Key Design Decision: Two-Phase Game States

Our implementation distinguishes between two phases of the game:

### Phase 1: Pre-Connection (Client-Only)

* States: tutorial, modeSelect
* Directly managed by client with no server involvement
* Use direct state setter: `setGameStatus()`
* Only UI interactions, no game logic

### Phase 2: Post-Connection (Server-Authoritative)

* States: select, placement, playing, win, gameover
* Server validates all transitions
* Client requests transitions: `requestGameStateTransition()`
* Client immediately updates UI for responsiveness
* Server confirms or corrects final state

## Flow Diagram

```
┌─────────┐        ┌────────────┐        ┌────────────┐
│         │───────▶│            │───────▶│            │
│ Tutorial│        │ Mode Select│        │Connect to  │
│         │        │            │        │  Server    │
└─────────┘        └────────────┘        └────────────┘
     ▲                                          │
     │                                          ▼
┌────────────┐      ┌────────────┐        ┌────────────┐
│            │◀─────│            │◀───────│            │
│  Game Over │      │   Playing  │        │  Placement │
│            │      │            │        │            │
└────────────┘      └────────────┘        └────────────┘
                          ▲                     ▲
                          │                     │
                    ┌────────────┐        ┌────────────┐
                    │            │        │            │
                    │    Win     │◀───────│   Select   │
                    │            │        │            │
                    └────────────┘        └────────────┘
```

## Extending the Architecture

### Adding New States

1. Define the state in the `GameStatus` type:
   ```typescript
   export type GameStatus = 'tutorial' | 'modeSelect' | ... | 'newState';
   ```

2. Add valid transitions in `GAME_STATUS_TRANSITIONS`:
   ```typescript
   export const GAME_STATUS_TRANSITIONS = {
     // Existing transitions...
     existingState: ['newState', ...],
     newState: ['state1', 'state2', ...],
   };
   ```

3. Handle the new state in `handleStateEnter()` if it requires special actions:
   ```typescript
   private handleStateEnter(state: GameStatus): void {
     switch (state) {
       // Existing cases...
       case 'newState':
         // Special initialization logic
         break;
     }
   }
   ```

4. Update UI components to render appropriate content for the new state:
   ```typescript
   switch (gameStatus) {
     // Existing cases...
     case 'newState':
       return <NewStateComponent onAction={handleAction} />;
   }
   ```

### Adding State-Specific Side Effects

1. Add event handling for state transition in `GameStateMachine`:
   ```typescript
   private handleStateEnter(state: GameStatus): void {
     switch (state) {
       case 'yourState':
         // Trigger actions when entering this state
         gameEvents.publish('SPECIAL_EVENT', { /* data */ });
         break;
     }
   }
   ```

2. Listen for state changes on client side:
   ```typescript
   else if (type === 'GAME_STATE_CHANGED') {
     // Update UI state
     
     // Handle special state-specific actions
     if (payload.currentState === 'yourState') {
       // Trigger special actions for this state
     }
   }
   ```

### Implementing Features That Span Multiple States

For features like a player progression system that persists across states:

1. Store progression data in `GameInstanceManager` or a separate manager class
2. Update progression in state transitions as needed
3. Pass progression data with state updates to clients
4. Render appropriate UI based on progression and current state

## Best Practices

### 1. Server Authority with Optimistic UI

* **DO** update client UI immediately for responsiveness
* **DO** send state transition request to server for validation
* **DO** fall back to server state if request is rejected
* **DON'T** rely solely on client-side state for game logic

### 2. Clear State Ownership

* **DO** manage pre-connection states (tutorial, modeSelect) on client only
* **DO** manage gameplay states on server with client sync
* **DO** document which states are client-only vs. server-authoritative
* **DON'T** mix client and server authority within the same game phase

### 3. State Transitioning

* **DO** define valid transitions explicitly in `GAME_STATUS_TRANSITIONS`
* **DO** enforce valid transitions on the server side
* **DO** handle failed transitions gracefully (show error or fallback)
* **DON'T** directly set states that should be server-validated

### 4. Error Handling

* **DO** handle failed state transitions gracefully
* **DO** provide feedback when transitions are rejected
* **DO** log all transition attempts and results
* **DON'T** leave clients in inconsistent states

## Troubleshooting

### Common Issues

1. **Client stuck in wrong state**:
   * Check if client properly requested transition
   * Verify if server rejected transition (check logs)
   * Ensure client is associated with a game instance

2. **Invalid transitions**:
   * Check `GAME_STATUS_TRANSITIONS` for allowed paths
   * Ensure client is requesting allowed transitions
   * Check if server has correct transition rules

3. **Server-client desynchronization**:
   * Verify client is properly handling `GAME_STATE_CHANGED` events
   * Check if transition request has proper parameters
   * Ensure client is connected to correct game instance

## Future Improvements

1. **Enhanced State Typing**: Stronger TypeScript types for state-specific data
2. **Persistent States**: Save and restore game states for session persistence
3. **State Transition History**: Track and analyze player progression
4. **UI State System**: Separate view states from game logic states
5. **Testing Utilities**: Mock server-side state machine for unit testing

## Conclusion

The hybrid state machine architecture provides a robust foundation for game state management, balancing responsiveness with server authority. By clearly separating pre-connection from post-connection states and implementing optimistic UI updates with server validation, we create a system that's both reliable and user-friendly.

When extending the game, always consider where state management belongs (client or server) and follow the established patterns for state transitions, ensuring that your additions integrate seamlessly with the existing architecture.