import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameEvents } from '../utils/GameEventBus';

/**
 * Component to display client and server position debug information
 */
const PositionDebug: React.FC = () => {
  // Track position data for debug display
  const [positionData, setPositionData] = useState({
    client: { x: 0, y: 0 },
    server: { x: 0, y: 0 }
  });
  
  // Track IDs for debugging
  const [ids, setIds] = useState({
    clientId: '',
    instanceId: '',
    playerId: ''
  });
  
  // Keep refs to both positions for event listeners
  const clientPosRef = useRef({ x: 0, y: 0 });
  const serverPosRef = useRef({ x: 0, y: 0 });
  
  // Access game state for server position
  const gameState = useGameStore(state => state.gameState);
  const clientId = useGameStore(state => state.clientId);
  const instanceId = useGameStore(state => state.instanceId);

  // Listen for realtime client-side position updates
  useEffect(() => {
    // Listen for player position updates from the game scene
    const handlePositionUpdate = (data: any) => {
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        clientPosRef.current = { 
          x: Math.round(data.x), 
          y: Math.round(data.y) 
        };
      }
    };
    
    // Subscribe to position update events
    const unsubscribe = gameEvents.subscribe('PLAYER_POSITION_UPDATE', handlePositionUpdate);
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Listen for server-side position updates
  useEffect(() => {
    // Update server position when game state changes
    if (gameState && gameState.players) {
      // Find the first player in the server state (usually just one in single player)
      const firstPlayer = Object.values(gameState.players)[0] as any;
      if (firstPlayer && firstPlayer.position) {
        serverPosRef.current = {
          x: Math.round(firstPlayer.position.x),
          y: Math.round(firstPlayer.position.y)
        };
        
        // Update player ID if available
        if (firstPlayer.id && firstPlayer.id !== ids.playerId) {
          setIds(prev => ({ ...prev, playerId: firstPlayer.id }));
        }
      }
    }
    
    // Update instance ID if available in game state
    if (gameState && gameState.instanceId && gameState.instanceId !== ids.instanceId) {
      // Force instanceId to be string (avoids TypeScript error)
      const instanceId = String(gameState.instanceId);
      setIds(prev => ({ ...prev, instanceId }));
    }
  }, [gameState, ids.instanceId, ids.playerId]);
  
  // Update client ID from game store
  useEffect(() => {
    if (clientId && clientId !== ids.clientId) {
      setIds(prev => ({ ...prev, clientId }));
    }
    
    if (instanceId && instanceId !== ids.instanceId) {
      setIds(prev => ({ ...prev, instanceId }));
    }
  }, [clientId, instanceId, ids.clientId, ids.instanceId]);

  // Render loop to update UI
  useEffect(() => {
    const updateUI = () => {
      setPositionData({
        client: clientPosRef.current,
        server: serverPosRef.current
      });
      
      requestAnimationFrame(updateUI);
    };
    
    // Start the animation frame loop
    const animFrameId = requestAnimationFrame(updateUI);
    
    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, []);
  
  return (
    <div className="position-debug">
      <div className="debug-container">
        <div className="debug-row">
          <span className="debug-label">Client:</span>
          <span className="debug-value client">
            X:{positionData.client.x} Y:{positionData.client.y}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-label">Server:</span>
          <span className="debug-value server">
            X:{positionData.server.x} Y:{positionData.server.y}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-label">Diff:</span>
          <span className={`debug-value ${Math.abs(positionData.client.x - positionData.server.x) > 5 || 
                   Math.abs(positionData.client.y - positionData.server.y) > 5 ? 
                   'diff-high' : 'diff-low'}`}>
            X:{Math.abs(positionData.client.x - positionData.server.x)} 
            Y:{Math.abs(positionData.client.y - positionData.server.y)}
          </span>
        </div>
        <div className="debug-row id-row">
          <span className="debug-label">ClientID:</span>
          <span className="debug-value id">
            {ids.clientId || 'N/A'}
          </span>
        </div>
        <div className="debug-row id-row">
          <span className="debug-label">InstanceID:</span>
          <span className="debug-value id">
            {ids.instanceId || 'N/A'}
          </span>
        </div>
        <div className="debug-row id-row">
          <span className="debug-label">PlayerID:</span>
          <span className="debug-value id">
            {ids.playerId || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PositionDebug;