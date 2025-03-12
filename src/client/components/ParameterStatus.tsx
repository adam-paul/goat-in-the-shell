import React, { useState, useEffect } from 'react';
import { GameParameter } from '../../shared/types';
// These imports will be fixed when we migrate the parameter system
import { 
  GAME_PARAMETERS, 
  ParameterManager
} from '../game/parameters';

/**
 * Component to display current parameter status
 */
const ParameterStatus: React.FC = () => {
  // Track which parameters are modified
  const [modifiedParameters, setModifiedParameters] = useState<string[]>([]);
  
  // Track all parameter values
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  
  // Listen for parameter changes
  useEffect(() => {
    // Initialize parameter values
    const initialValues: Record<string, number> = {};
    Object.keys(GAME_PARAMETERS).forEach(key => {
      initialValues[key] = GAME_PARAMETERS[key].normalizedValue;
    });
    setParameterValues(initialValues);
    
    // Update modified parameters list
    const modified = Object.keys(GAME_PARAMETERS).filter(
      key => GAME_PARAMETERS[key].normalizedValue !== 0
    );
    setModifiedParameters(modified);
    
    // Add global listener for parameter changes
    const handleParameterChange = (
      _newValue: number, 
      normalizedValue: number, 
      parameter: GameParameter
    ) => {
      // Update parameter values
      setParameterValues(prev => ({
        ...prev,
        [parameter.key]: normalizedValue
      }));
      
      // Update modified parameters list
      if (normalizedValue === 0) {
        setModifiedParameters(prev => 
          prev.filter(key => key !== parameter.key)
        );
      } else if (!modifiedParameters.includes(parameter.key)) {
        setModifiedParameters(prev => [...prev, parameter.key]);
      }
    };
    
    // Listen for all parameter changes
    ParameterManager.onParameterChanged('*', handleParameterChange);
    
    // Listen for window events (for communication between components)
    const handleWindowEvent = (e: Event) => {
      const event = e as CustomEvent;
      if (event.detail) {
        const { key, normalizedValue } = event.detail;
        
        // Update parameter values
        setParameterValues(prev => ({
          ...prev,
          [key]: normalizedValue
        }));
        
        // Update modified parameters list
        if (normalizedValue === 0) {
          setModifiedParameters(prev => 
            prev.filter(k => k !== key)
          );
        } else if (!modifiedParameters.includes(key)) {
          setModifiedParameters(prev => [...prev, key]);
        }
      }
    };
    
    window.addEventListener('parameter-change', handleWindowEvent);
    
    return () => {
      // Remove event listeners on cleanup
      window.removeEventListener('parameter-change', handleWindowEvent);
    };
  }, []);
  
  // Don't render if no parameters are modified
  if (modifiedParameters.length === 0) {
    return null;
  }
  
  // Helper function to format parameter name
  const formatParameterName = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Helper function to format parameter value display
  const getValueDisplay = (key: string): string => {
    const normalizedValue = parameterValues[key] || 0;
    
    // Format as percentage change
    const percentage = Math.round(normalizedValue * 100);
    return `${percentage > 0 ? '+' : ''}${percentage}%`;
  };
  
  // Helper function to get parameter color
  const getParameterColor = (key: string): string => {
    const value = parameterValues[key] || 0;
    
    // Red for negative values, green for positive
    if (value < 0) return '#ff6666';
    if (value > 0) return '#66ff66';
    return '#ffffff';
  };
  
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '10px',
      borderRadius: '5px',
      border: '1px solid #444',
      maxWidth: '200px',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      zIndex: 1000
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
        Active Parameters
      </div>
      <div>
        {modifiedParameters.map(key => (
          <div key={key} style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '3px',
            padding: '2px',
            borderRadius: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
          }}>
            <span>{formatParameterName(key)}</span>
            <span style={{ color: getParameterColor(key) }}>
              {getValueDisplay(key)}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() => ParameterManager.resetAllParameters()}
        style={{
          marginTop: '8px',
          padding: '3px 6px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '10px',
          width: '100%'
        }}
      >
        Reset All
      </button>
    </div>
  );
};

export default ParameterStatus;