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
      if (hasInputChanged()) {
        const inputState = inputStateRef.current;
        
        // Publish to game event bus for Phaser
        gameEvents.publish('PLAYER_INPUT', inputState);
        
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
          inputStateRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputStateRef.current.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
          inputStateRef.current.up = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          inputStateRef.current.down = true;
          break;
        case 'Space':
          inputStateRef.current.jump = true;
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
          inputStateRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputStateRef.current.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          inputStateRef.current.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          inputStateRef.current.down = false;
          break;
        case 'Space':
          inputStateRef.current.jump = false;
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
  }, [isCommandInputFocused, socket.connected]);
  
  return null;
};

export default useInputHandler;