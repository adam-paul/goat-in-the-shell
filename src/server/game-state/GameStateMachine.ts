import { GameStatus } from '../../shared/types';
import { GAME_STATUS_TRANSITIONS } from '../../shared/constants';
import { gameEvents } from './GameEvents';

/**
 * A state machine to manage game phase transitions and enforce valid state changes
 */
export class GameStateMachine {
  private currentState: GameStatus;
  private instanceId: string;
  private stateHistory: Array<{state: GameStatus, timestamp: number}> = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Create a new GameStateMachine instance
   * @param initialState The starting game status
   * @param instanceId The ID of the game instance this state machine belongs to
   */
  constructor(initialState: GameStatus = 'tutorial', instanceId: string) {
    this.currentState = initialState;
    this.instanceId = instanceId;
    this.stateHistory.push({
      state: initialState,
      timestamp: Date.now()
    });
    
    console.log(`STATE MACHINE: Initialized for instance ${instanceId} with state: ${initialState}`);
    
    // Set up state transition event handlers
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for game events that may affect state
   */
  private setupEventListeners(): void {
    // Listen for player death events to transition to gameover
    gameEvents.subscribe('PLAYER_DEATH', (data: any) => {
      if (data.instanceId === this.instanceId) {
        this.transitionTo('gameover');
      }
    });
    
    // Listen for player win events to transition to win
    gameEvents.subscribe('PLAYER_WIN', (data: any) => {
      if (data.instanceId === this.instanceId) {
        this.transitionTo('win');
      }
    });
  }
  
  /**
   * Get the current game state
   * @returns Current game status
   */
  getCurrentState(): GameStatus {
    return this.currentState;
  }
  
  /**
   * Get state history
   * @returns Array of state transitions with timestamps
   */
  getStateHistory(): Array<{state: GameStatus, timestamp: number}> {
    return [...this.stateHistory];
  }
  
  /**
   * Check if a transition is valid based on defined rules
   * @param fromState Current state
   * @param toState Target state
   * @returns True if the transition is allowed
   */
  isValidTransition(fromState: GameStatus, toState: GameStatus): boolean {
    // Same state is always valid (no-op transition)
    if (fromState === toState) return true;
    
    // Use the transitions defined in constants
    const validNextStates = GAME_STATUS_TRANSITIONS[fromState];
    
    // If no valid transitions defined, disallow transition
    if (!validNextStates) return false;
    
    return validNextStates.includes(toState);
  }
  
  /**
   * Transition to a new state if valid
   * @param newState The target game status
   * @param force If true, bypass transition validation (use with caution)
   * @returns True if transition was successful
   */
  transitionTo(newState: GameStatus, force: boolean = false): boolean {
    // Check if this is a valid transition
    if (!force && !this.isValidTransition(this.currentState, newState)) {
      console.warn(`STATE MACHINE: Invalid transition rejected: ${this.currentState} -> ${newState}`);
      return false;
    }
    
    // Clear any pending timers for the current state
    if (this.timers.has(this.currentState)) {
      clearTimeout(this.timers.get(this.currentState)!);
      this.timers.delete(this.currentState);
    }
    
    // Update current state
    const prevState = this.currentState;
    this.currentState = newState;
    
    // Add to history
    this.stateHistory.push({
      state: newState,
      timestamp: Date.now()
    });
    
    // Keep history at a reasonable size
    if (this.stateHistory.length > 50) {
      this.stateHistory.shift();
    }
    
    console.log(`STATE MACHINE: State transition: ${prevState} -> ${newState} for instance ${this.instanceId}`);
    
    // Handle state-specific actions
    this.handleStateEnter(newState, prevState);
    
    // Publish state change event
    gameEvents.publish('GAME_STATE_CHANGED', {
      instanceId: this.instanceId,
      previousState: prevState,
      currentState: newState,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Handle actions when entering a specific state
   * @param state The state being entered
   * @param prevState The previous state
   */
  private handleStateEnter(state: GameStatus, prevState: GameStatus): void {
    switch (state) {
      case 'placement':
        // No specific actions needed for placement
        break;
        
      case 'playing':
        // When transitioning to playing, initialize a countdown before starting
        // But only if coming from placement state
        if (prevState === 'placement') {
          this.startCountdown();
        }
        break;
        
      case 'gameover':
        // No specific actions needed for gameover
        break;
        
      case 'win':
        // No specific actions needed for win
        break;
        
      case 'reset':
        // Schedule transition to select after reset
        this.timers.set('reset', setTimeout(() => {
          this.transitionTo('select');
        }, 1000));
        break;
        
      default:
        // No special handling for other states
        break;
    }
  }
  
  /**
   * Start a countdown before gameplay begins
   */
  private startCountdown(): void {
    console.log(`STATE MACHINE: Starting countdown for instance ${this.instanceId}`);
    
    // Publish countdown start event
    gameEvents.publish('START_COUNTDOWN', {
      instanceId: this.instanceId,
      duration: 3000,
      timestamp: Date.now()
    });
    
    // After countdown, activate physics and enable gameplay
    this.timers.set('countdown', setTimeout(() => {
      gameEvents.publish('PHYSICS_ACTIVATE', {
        instanceId: this.instanceId,
        timestamp: Date.now()
      });
      
      console.log(`STATE MACHINE: Countdown complete, physics activated for instance ${this.instanceId}`);
    }, 3000)); // 3 seconds countdown
  }
  
  /**
   * Check if the game is in an active gameplay state
   * @returns True if in an active gameplay state
   */
  isGameplayActive(): boolean {
    return this.currentState === 'playing';
  }
  
  /**
   * Reset the state machine to initial state
   * @param initialState The state to reset to (default: 'tutorial')
   */
  reset(initialState: GameStatus = 'tutorial'): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    // Reset state
    this.currentState = initialState;
    
    // Clear history except for initial state
    this.stateHistory = [{
      state: initialState,
      timestamp: Date.now()
    }];
    
    console.log(`STATE MACHINE: Reset to ${initialState} for instance ${this.instanceId}`);
    
    // Publish reset event
    gameEvents.publish('GAME_STATE_RESET', {
      instanceId: this.instanceId,
      state: initialState,
      timestamp: Date.now()
    });
  }
  
  /**
   * Set a timer for automatic state transition
   * @param duration Time in ms before transition
   * @param nextState State to transition to
   * @param timerKey Unique key for the timer
   */
  scheduleTransition(duration: number, nextState: GameStatus, timerKey: string): void {
    // Clear existing timer with this key if it exists
    if (this.timers.has(timerKey)) {
      clearTimeout(this.timers.get(timerKey)!);
    }
    
    // Set new timer
    this.timers.set(timerKey, setTimeout(() => {
      this.transitionTo(nextState);
    }, duration));
    
    console.log(`STATE MACHINE: Scheduled transition to ${nextState} in ${duration}ms for instance ${this.instanceId}`);
  }
  
  /**
   * Clean up resources when the state machine is no longer needed
   */
  destroy(): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    console.log(`STATE MACHINE: Destroyed for instance ${this.instanceId}`);
  }
}