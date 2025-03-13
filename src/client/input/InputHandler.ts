// src/client/input/InputHandler.ts
import { useEffect, useState } from 'react';
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
  
  // Set up keyboard event listeners
  useEffect(() => {
    const inputState: InputState = { ...initialInputState };
    
    // Track last sent state to reduce network traffic
    let lastSentState: InputState = { ...initialInputState };
    
    // Function to check if input state has changed
    const hasInputChanged = () => {
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
      if (hasInputChanged()) {
        // Publish to game event bus for Phaser
        gameEvents.publish('PLAYER_INPUT', inputState);
        
        // Update last sent state
        lastSentState = { ...inputState };
      }
    };
    
    // Set up polling interval for sending input state
    const intervalId = setInterval(sendInputToServer, 50); // 20 times per second
    
    // Keydown event handler
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if command input is focused
      if (isCommandInputFocused) return;
      
      // Prevent default browser actions for game keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 
           'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        event.preventDefault();
      }
      
      // Update input state based on key pressed
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          inputState.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputState.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
          inputState.up = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          inputState.down = true;
          break;
        case 'Space':
          inputState.jump = true;
          break;
      }
      
      // Send input state immediately on keydown
      sendInputToServer();
    };
    
    // Keyup event handler
    const handleKeyUp = (event: KeyboardEvent) => {
      // Skip if command input is focused
      if (isCommandInputFocused) return;
      
      // Update input state based on key released
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          inputState.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputState.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          inputState.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          inputState.down = false;
          break;
        case 'Space':
          inputState.jump = false;
          break;
      }
      
      // Send input state immediately on keyup
      sendInputToServer();
    };
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(intervalId);
    };
  }, [isCommandInputFocused]);
  
  return null;
};

export default useInputHandler;