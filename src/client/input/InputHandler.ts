// src/client/input/InputHandler.ts
import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../network';
import { gameEvents } from '../utils/GameEventBus';

// Input state definition
interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

// Default input state
const initialInputState: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
};

/**
 * Custom hook to handle keyboard inputs and sync with server
 * @returns Object with active input state
 */
export const useInputHandler = () => {
  // Get the socket context for sending input to server
  const socket = useSocket();
  
  // Track command input focus so we don't control the game when typing
  const [isCommandInputFocused, setIsCommandInputFocused] = useState(false);
  
  // Track game state
  const [gameActive, setGameActive] = useState(false);
  const inputStateRef = useRef<InputState>({ ...initialInputState });
  
  // Track last sent state to reduce network traffic
  const lastSentStateRef = useRef<InputState>({ ...initialInputState });
  
  // Subscribe to command input focus state
  useEffect(() => {
    const handleCommandInputFocus = (data: { focused: boolean }) => {
      setIsCommandInputFocused(data.focused);
    };
    
    const unsubscribe = gameEvents.subscribe<{ focused: boolean }>(
      'COMMAND_INPUT_FOCUS', 
      handleCommandInputFocus
    );
    
    return unsubscribe;
  }, []);
  
  // Subscribe to game state changes
  useEffect(() => {
    const handleGameStarted = () => {
      setGameActive(true);
    };
    
    const handleGameEnded = (data: { status: string }) => {
      if (data.status === 'win' || data.status === 'gameover') {
        setGameActive(false);
      }
    };
    
    const startSubscription = gameEvents.subscribe(
      'GAME_STARTED',
      handleGameStarted
    );
    
    const statusSubscription = gameEvents.subscribe(
      'GAME_STATUS_CHANGE',
      handleGameEnded
    );
    
    return () => {
      startSubscription();
      statusSubscription();
    };
  }, []);
  
  // Set up keyboard event listeners
  useEffect(() => {
    console.log('Setting up input handlers, command input focused:', isCommandInputFocused);
    
    // Initialize input state
    inputStateRef.current = { ...initialInputState };
    lastSentStateRef.current = { ...initialInputState };
    
    // Function to check if input state has changed
    const hasInputChanged = () => {
      const inputState = inputStateRef.current;
      const lastSentState = lastSentStateRef.current;
      
      return (
        inputState.left !== lastSentState.left ||
        inputState.right !== lastSentState.right ||
        inputState.up !== lastSentState.up ||
        inputState.down !== lastSentState.down ||
        inputState.jump !== lastSentState.jump
      );
    };
    
    // Function to send input state to server
    const sendInputToServer = () => {
      if (!hasInputChanged()) return;
      
      const inputState = inputStateRef.current;
      console.log('Input state changed, sending to server:', JSON.stringify(inputState));
      
      // Publish to game event bus for Phaser
      gameEvents.publish('PLAYER_INPUT', { ...inputState });
      
      // Send to server if connected
      if (socket.connected) {
        const inputToSend = {
          left: inputState.left,
          right: inputState.right,
          jump: inputState.jump || inputState.up, // Treat up as jump too
          timestamp: Date.now()
        };
        socket.sendPlayerInput(inputToSend);
      }
      
      // Update last sent state
      lastSentStateRef.current = { ...inputState };
    };
    
    // DON'T poll for input changes - only send on actual key events
    // This avoids duplicate messages
    
    // Keydown event handler
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if command input is focused
      if (isCommandInputFocused) return;
      
      // Prevent default browser actions for game keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 
           'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        event.preventDefault();
      }
      
      let changed = false;
      
      // Update input state based on key pressed
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          if (!inputStateRef.current.left) {
            inputStateRef.current.left = true;
            changed = true;
          }
          break;
        case 'ArrowRight':
        case 'KeyD':
          if (!inputStateRef.current.right) {
            inputStateRef.current.right = true;
            changed = true;
          }
          break;
        case 'ArrowUp':
        case 'KeyW':
          if (!inputStateRef.current.up) {
            inputStateRef.current.up = true;
            changed = true;
          }
          break;
        case 'ArrowDown':
        case 'KeyS':
          if (!inputStateRef.current.down) {
            inputStateRef.current.down = true;
            changed = true;
          }
          break;
        case 'Space':
          if (!inputStateRef.current.jump) {
            inputStateRef.current.jump = true;
            changed = true;
          }
          break;
      }
      
      // Only send input if state actually changed
      if (changed) {
        console.log('Key down event changed state:', event.code);
        sendInputToServer();
      }
    };
    
    // Keyup event handler
    const handleKeyUp = (event: KeyboardEvent) => {
      // Skip if command input is focused
      if (isCommandInputFocused) return;
      
      let changed = false;
      
      // Update input state based on key released
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          if (inputStateRef.current.left) {
            inputStateRef.current.left = false;
            changed = true;
          }
          break;
        case 'ArrowRight':
        case 'KeyD':
          if (inputStateRef.current.right) {
            inputStateRef.current.right = false;
            changed = true;
          }
          break;
        case 'ArrowUp':
        case 'KeyW':
          if (inputStateRef.current.up) {
            inputStateRef.current.up = false;
            changed = true;
          }
          break;
        case 'ArrowDown':
        case 'KeyS':
          if (inputStateRef.current.down) {
            inputStateRef.current.down = false;
            changed = true;
          }
          break;
        case 'Space':
          if (inputStateRef.current.jump) {
            inputStateRef.current.jump = false;
            changed = true;
          }
          break;
      }
      
      // Only send input if state actually changed
      if (changed) {
        console.log('Key up event changed state:', event.code);
        sendInputToServer();
      }
    };
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCommandInputFocused, socket.connected]);
  
  return null;
};

export default useInputHandler;