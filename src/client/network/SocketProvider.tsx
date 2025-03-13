import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { MESSAGE_TYPES } from '../../shared/constants';
import type { NetworkMessage } from '../../shared/types';
import socketEvents from './SocketEvents';

// Socket context with all the methods needed for network communication
export interface SocketContextType {
  connected: boolean;
  connect: (playerName: string, lobbyId?: string) => Promise<boolean>;
  disconnect: () => void;
  sendMessage: (type: string, payload?: unknown) => boolean;
  sendPlayerInput: (input: unknown) => boolean;
  sendPlaceItem: (itemType: string, x: number, y: number) => boolean;
  sendStartGame: () => boolean;
  sendChatMessage: (message: string, lobbyId: string) => boolean;
  sendAICommand: (command: string) => boolean;
}

// Create the context with default values
const SocketContext = createContext<SocketContextType>({
  connected: false,
  connect: () => Promise.resolve(false),
  disconnect: () => {},
  sendMessage: () => false,
  sendPlayerInput: () => false,
  sendPlaceItem: () => false,
  sendStartGame: () => false,
  sendChatMessage: () => false,
  sendAICommand: () => false
});

// Hook to use socket throughout the app
export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

// Declare the Vite environment variables we're using
declare global {
  interface ImportMetaEnv {
    VITE_WS_URL?: string;
  }
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  
  // Create WebSocket connection on component mount
  useEffect(() => {
    // Environment-aware server URL
    const serverUrl = (import.meta.env.VITE_WS_URL as string) || 'ws://localhost:3001';
    console.log('SOCKET: Connecting to', serverUrl);
    
    const ws = new WebSocket(serverUrl);
    socketRef.current = ws;
    
    // Basic connection handlers
    ws.onopen = () => {
      console.log('SOCKET: WebSocket connection established');
      setConnected(true);
      
      // Send an initial ping after connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log('SOCKET: Sending initial ping');
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.PING, timestamp: Date.now() }));
        }
      }, 1000);
    };
    
    ws.onclose = (event) => {
      console.log('SOCKET: WebSocket connection closed', {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean
      });
      setConnected(false);
      socketRef.current = null;
    };
    
    ws.onerror = (error) => {
      console.error('SOCKET: WebSocket error:', error);
    };
    
    // Initialize the socket events handler with this socket
    socketEvents.initialize(ws);
    
    // Clean up on unmount
    return () => {
      console.log('SOCKET: Cleaning up WebSocket connection');
      socketEvents.destroy();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);
  
  // Connect to a specific lobby
  const connect = async (playerName: string, lobbyId?: string) => {
    console.log(`SOCKET: Connecting player ${playerName} to lobby ${lobbyId || 'default'}`);
    
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('SOCKET: Cannot connect - socket not open');
      return false;
    }
    
    try {
      socketRef.current.send(JSON.stringify({
        type: MESSAGE_TYPES.JOIN_LOBBY,
        payload: { playerName, lobbyId }
      }));
      return true;
    } catch (err) {
      console.error('SOCKET: Error sending join lobby message:', err);
      return false;
    }
  };
  
  // Disconnect from server
  const disconnect = () => {
    console.log('SOCKET: Disconnecting');
    if (socketRef.current) {
      socketRef.current.close();
    }
  };
  
  // Generic message sender
  const sendMessage = (type: string, payload?: unknown) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error(`SOCKET: Cannot send message type ${type} - socket not open`);
      return false;
    }
    
    try {
      const message: NetworkMessage = {
        type,
        payload,
        timestamp: Date.now()
      };
      socketRef.current.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error(`SOCKET: Error sending message type ${type}:`, err);
      return false;
    }
  };
  
  // Specialized message senders
  const sendPlayerInput = (input: unknown) => {
    return sendMessage(MESSAGE_TYPES.PLAYER_INPUT, input);
  };
  
  const sendPlaceItem = (itemType: string, x: number, y: number) => {
    return sendMessage(MESSAGE_TYPES.PLACE_ITEM, {
      type: itemType,
      position: { x, y }
    });
  };
  
  const sendStartGame = () => {
    return sendMessage(MESSAGE_TYPES.START_GAME);
  };
  
  const sendChatMessage = (message: string, lobbyId: string) => {
    return sendMessage(MESSAGE_TYPES.CHAT_MESSAGE, { message, lobbyId });
  };
  
  const sendAICommand = (command: string) => {
    return sendMessage(MESSAGE_TYPES.AI_COMMAND, { command });
  };
  
  return (
    <SocketContext.Provider value={{
      connected,
      connect,
      disconnect,
      sendMessage,
      sendPlayerInput,
      sendPlaceItem,
      sendStartGame,
      sendChatMessage,
      sendAICommand
    }}>
      {children}
    </SocketContext.Provider>
  );
};