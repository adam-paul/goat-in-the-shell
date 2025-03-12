// src/client/network/NetworkProvider.tsx
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { NETWORK } from '../../shared/constants';
import { useGameStore } from '../store/gameStore';
import { NetworkListener } from './NetworkListener';
import { NetworkMessenger } from './NetworkMessenger';

// Define the shape of the NetworkContext
interface NetworkContextType {
  connect: (playerName: string, lobbyId?: string) => Promise<boolean>;
  disconnect: () => void;
  isConnected: () => boolean;
  sendMessage: (type: string, payload?: any) => boolean;
  sendPlayerInput: (input: { left?: boolean, right?: boolean, jump?: boolean }) => boolean;
  sendPlaceItem: (itemType: string, x: number, y: number, rotation?: number, properties?: Record<string, any>) => boolean;
  sendStartGame: () => boolean;
  sendChatMessage: (message: string, lobbyId: string) => boolean;
  sendAICommand: (command: string) => boolean;
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
  const { setNetworkConnected, setErrorMessage } = gameStore;
  
  // Create messenger
  const messengerRef = useRef<NetworkMessenger>(new NetworkMessenger(null));
  
  // Initialize network listener with the game store
  const listenerRef = useRef<NetworkListener>(new NetworkListener(gameStore));
  
  // Disconnect from WebSocket server - defined once
  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      messengerRef.current.setSocket(null);
      setNetworkConnected(false);
    }
  }, [socket, setNetworkConnected]);

  // Connect to WebSocket server
  const connect = useCallback(async (playerName: string, lobbyId?: string) => {
    if (socket || isConnecting) {
      disconnect();
    }
    
    setIsConnecting(true);
    
    try {
      // Create WebSocket connection
      const serverPort = process.env.SERVER_PORT || NETWORK.DEFAULT_SERVER_PORT;
      const serverUrl = `ws://localhost:${serverPort}`;
      const ws = new WebSocket(serverUrl);
      
      return new Promise<boolean>((resolve) => {
        let connectionTimeout: NodeJS.Timeout | null = setTimeout(() => {
          console.error('WebSocket connection timeout');
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            setIsConnecting(false);
            setErrorMessage('Connection timeout. Server might be down.');
            resolve(false);
          }
        }, 5000);
        
        ws.onopen = () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          setSocket(ws);
          messengerRef.current.setSocket(ws);
          setIsConnecting(false);
          setNetworkConnected(true);
          console.log('WebSocket connection established');
          
          // Send join lobby message
          messengerRef.current.sendJoinLobby(playerName, lobbyId);
          
          resolve(true);
        };
        
        ws.onclose = () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          setSocket(null);
          messengerRef.current.setSocket(null);
          setIsConnecting(false);
          setNetworkConnected(false);
          console.log('WebSocket connection closed');
          resolve(false);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          setNetworkConnected(false);
          setErrorMessage('Failed to connect to server.');
          
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
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
      setErrorMessage(`Connection error: ${error}`);
      console.error('Error connecting to WebSocket server:', error);
      return false;
    }
  }, [socket, isConnecting, setNetworkConnected, setErrorMessage, disconnect]);
  
  // Second declaration removed
  
  // Set up ping to keep connection alive
  useEffect(() => {
    let pingInterval: NodeJS.Timeout | null = null;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      pingInterval = setInterval(() => {
        try {
          // Send a simple ping message to keep connection alive
          socket.send(JSON.stringify({ type: 'PING' }));
        } catch (err) {
          console.error('Error sending ping:', err);
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 30000); // Every 30 seconds
    }
    
    return () => {
      if (pingInterval) clearInterval(pingInterval);
    };
  }, [socket]);
  
  // Set up DOM event listeners for window events from other components
  useEffect(() => {
    // Listen for disconnect event
    const handleDisconnectEvent = () => {
      disconnect();
    };

    // Add event listeners
    window.addEventListener('disconnect-network', handleDisconnectEvent);

    // Clean up event listeners
    return () => {
      window.removeEventListener('disconnect-network', handleDisconnectEvent);
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
  
  const networkValue: NetworkContextType = {
    connect,
    disconnect,
    isConnected: () => socket !== null && socket.readyState === WebSocket.OPEN,
    sendMessage: (type: string, payload?: any) => messengerRef.current.sendMessage(type, payload),
    sendPlayerInput: (input) => messengerRef.current.sendPlayerInput(input),
    sendPlaceItem: (itemType, x, y, rotation, properties) => 
      messengerRef.current.sendPlaceItem(itemType, x, y, rotation, properties),
    sendStartGame: () => messengerRef.current.sendStartGame(),
    sendChatMessage: (message, lobbyId) => messengerRef.current.sendChatMessage(message, lobbyId),
    sendAICommand: (command) => messengerRef.current.sendAICommand(command)
  };
  
  return (
    <NetworkContext.Provider value={networkValue}>
      {children}
    </NetworkContext.Provider>
  );
};