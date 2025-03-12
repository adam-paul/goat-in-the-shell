// src/client/network/NetworkProvider.tsx
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { PlayerRole } from '../../shared/types';
import { useGameStore } from '../store/gameStore';
import { NetworkListener } from './NetworkListener';
import { NetworkMessenger } from './NetworkMessenger';

// Define the shape of the NetworkContext
interface NetworkContextType {
  connect: (lobbyCode: string, role: PlayerRole) => Promise<boolean>;
  disconnect: () => void;
  isConnected: () => boolean;
  sendMessage: (type: string, payload?: any) => boolean;
  sendPlayerState: (state: any) => boolean;
  sendCommand: (type: string, x: number, y: number) => boolean;
}

// Create the context
const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

interface NetworkProviderProps {
  children: React.ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Get game store
  const gameStore = useGameStore();
  const { setIsConnected } = gameStore;
  
  // Create messenger
  const messengerRef = useRef<NetworkMessenger>(new NetworkMessenger(null));
  
  // Initialize network listener with the game store
  const listenerRef = useRef<NetworkListener>(new NetworkListener(gameStore));
  
  // Connect to WebSocket server
  const connect = useCallback(async (lobbyCode: string, role: PlayerRole) => {
    if (socket || isConnecting) {
      return false;
    }
    
    setIsConnecting(true);
    
    try {
      // Create WebSocket connection
      const serverUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
      const ws = new WebSocket(`${serverUrl}/lobby/${lobbyCode}?role=${role}`);
      
      return new Promise<boolean>((resolve) => {
        ws.onopen = () => {
          setSocket(ws);
          messengerRef.current.setSocket(ws);
          setIsConnecting(false);
          setIsConnected(true);
          console.log('WebSocket connection established');
          resolve(true);
        };
        
        ws.onclose = () => {
          setSocket(null);
          messengerRef.current.setSocket(null);
          setIsConnecting(false);
          setIsConnected(false);
          console.log('WebSocket connection closed');
          resolve(false);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          setIsConnected(false);
          resolve(false);
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            listenerRef.current.handleMessage(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };
      });
    } catch (error) {
      setIsConnecting(false);
      console.error('Error connecting to WebSocket server:', error);
      return false;
    }
  }, [socket, isConnecting, setIsConnected]);
  
  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      messengerRef.current.setSocket(null);
      setIsConnected(false);
    }
  }, [socket, setIsConnected]);
  
  // Set up DOM event listeners for window events from other components
  useEffect(() => {
    // Listen for disconnect-multiplayer event
    const handleDisconnectMultiplayer = () => {
      disconnect();
    };

    // Add event listeners
    window.addEventListener('disconnect-multiplayer', handleDisconnectMultiplayer);

    // Clean up event listeners
    return () => {
      window.removeEventListener('disconnect-multiplayer', handleDisconnectMultiplayer);
    };
  }, [disconnect]);
  
  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);
  
  const networkValue = {
    connect,
    disconnect,
    isConnected: () => socket !== null && socket.readyState === WebSocket.OPEN,
    sendMessage: (type: string, payload?: any) => messengerRef.current.sendMessage(type, payload),
    sendPlayerState: (state: any) => messengerRef.current.sendPlayerState(state),
    sendCommand: (type: string, x: number, y: number) => messengerRef.current.sendCommand(type, x, y)
  };
  
  return (
    <NetworkContext.Provider value={networkValue}>
      {children}
    </NetworkContext.Provider>
  );
};