import { useState, useRef, useEffect } from 'react';
import { AIService, ParameterModification } from '../services/AIService';
import { ParameterManager } from '../game/parameters';

// Extend the Window interface to include playerPosition
declare global {
  interface Window {
    playerPosition?: {
      x: number;
      y: number;
      isOnGround?: boolean;
    };
  }
}

interface PrompterControlsProps {
  onPlaceObstacle: (type: string, x: number, y: number) => void;
  disabled: boolean;
}

const PrompterControls: React.FC<PrompterControlsProps> = ({ onPlaceObstacle, disabled }) => {
  const [promptText, setPromptText] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Process known obstacle commands locally
  const processLocalCommand = (command: string): { handled: boolean; response?: string } => {
    // Convert to lowercase and trim whitespace
    const normalizedCommand = command.toLowerCase().trim();
    
    // Handle known obstacle commands locally
    if (normalizedCommand === 'darts' || normalizedCommand === 'dart wall') {
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      onPlaceObstacle('dart_wall', playerX + 300, playerY);
      return { 
        handled: true, 
        response: `Creating dart wall ahead of player at position (${playerX + 300}, ${playerY})` 
      };
    } 
    else if (normalizedCommand === 'platform') {
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      const isOnGround = window.playerPosition?.isOnGround || false;
      const yOffset = isOnGround ? 0 : 100;
      onPlaceObstacle('platform', playerX + 200, playerY + yOffset);
      return { 
        handled: true, 
        response: `Creating platform ahead of player at position (${playerX + 200}, ${playerY + yOffset})` 
      };
    }
    else if (normalizedCommand === 'spike') {
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      const isOnGround = window.playerPosition?.isOnGround || false;
      const yOffset = isOnGround ? 0 : 100;
      onPlaceObstacle('spike', playerX + 250, playerY + yOffset);
      return { 
        handled: true, 
        response: `Creating spike ahead of player at position (${playerX + 250}, ${playerY + yOffset})` 
      };
    }
    else if (normalizedCommand === 'oscillator') {
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      onPlaceObstacle('oscillator', playerX + 200, playerY - 50);
      return { 
        handled: true, 
        response: `Creating moving platform ahead of player at position (${playerX + 200}, ${playerY - 50})` 
      };
    }
    else if (normalizedCommand === 'shield') {
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      onPlaceObstacle('shield', playerX + 150, playerY);
      return { 
        handled: true, 
        response: `Creating shield ahead of player at position (${playerX + 150}, ${playerY})` 
      };
    }
    else if (normalizedCommand === 'help') {
      return { 
        handled: true, 
        response: `Available commands:
- Object placement: darts, platform, spike, oscillator, shield
- Parameter adjustment: Try phrases like "make gravity weaker" or "speed up the darts"
- Parameters: gravity, dart_speed, platform_width, and more
- Type "reset parameters" to restore default settings` 
      };
    }
    
    // Command not handled locally
    return { handled: false };
  };
  
  // Handle parameter modifications from AI response
  const applyParameterModifications = (mods: ParameterModification[]) => {
    if (!mods || mods.length === 0) return;
    
    // Validate the modifications
    const validMods = AIService.validateParameterModifications(mods);
    
    // Apply the modifications using ParameterManager
    validMods.forEach(mod => {
      ParameterManager.updateParameterNormalized(mod.parameter, mod.normalized_value);
    });
    
    // Log the modifications
    console.log('Applied parameter modifications:', validMods);
    
    // Create parameter modification messages for the command history
    validMods.forEach(mod => {
      const formattedValue = (mod.normalized_value >= 0 ? '+' : '') + 
        Math.round(mod.normalized_value * 100) + '%';
      
      setCommandHistory(prev => [
        ...prev, 
        `> Parameter ${mod.parameter}: ${formattedValue}`
      ]);
    });
  };
  
  // Process command through the AI service for parameter modifications
  const processWithAI = async (command: string) => {
    try {
      setIsLoading(true);
      
      // Send the command to the AI service
      const result = await AIService.sendCommand(command);
      
      // Add the AI response to the command history
      setCommandHistory(prev => [...prev, `> ${result.response}`]);
      
      // Apply any parameter modifications from the AI
      if (result.parameter_modifications && result.parameter_modifications.length > 0) {
        applyParameterModifications(result.parameter_modifications);
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error processing command with AI:', error);
      setCommandHistory(prev => [...prev, `> Error: Could not process command. Please try again.`]);
      setIsLoading(false);
      return false;
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || disabled || isLoading) return;
    
    // Add the command to history
    setCommandHistory(prev => [...prev, promptText]);
    
    // Try to process the command locally first
    const localResult = processLocalCommand(promptText);
    
    if (localResult.handled) {
      // Command was handled locally
      if (localResult.response) {
        setCommandHistory(prev => [...prev, `> ${localResult.response}`]);
      }
    } else {
      // Send the command to the AI
      await processWithAI(promptText);
    }
    
    // Clear the input and reset history index
    setPromptText('');
    setHistoryIndex(-1);
  };
  
  // Handle keyboard navigation through command history
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        // Only set text if it's a command, not a response
        const historyItem = commandHistory[commandHistory.length - 1 - newIndex];
        if (!historyItem.startsWith('>')) {
          setPromptText(historyItem);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historyItem = commandHistory[commandHistory.length - 1 - newIndex];
        if (!historyItem.startsWith('>')) {
          setPromptText(historyItem);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setPromptText('');
      }
    }
  };
  
  // Handle parameter reset
  const handleResetParameters = () => {
    // Reset all parameters
    ParameterManager.resetAllParameters();
    
    // Add message to command history
    setCommandHistory(prev => [...prev, `> All parameters reset to default values`]);
  };
  
  // Check if the command is a reset command
  useEffect(() => {
    const normalizedCommand = promptText.toLowerCase().trim();
    if (normalizedCommand === 'reset parameters' || normalizedCommand === 'reset all parameters') {
      handleResetParameters();
      setPromptText('');
    }
  }, [promptText]);
  
  return (
    <div className="prompter-controls" style={{
      padding: '15px',
      border: '2px solid #e94560',
      borderRadius: '10px',
      marginTop: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      maxWidth: '800px',
      margin: '20px auto',
      color: '#fff',
      fontFamily: "'Courier New', monospace",
      boxShadow: '0 0 20px rgba(233, 69, 96, 0.5)'
    }}>
      <h3 style={{ 
        color: '#e94560', 
        textAlign: 'center',
        fontFamily: "'Press Start 2P', cursive, sans-serif",
        fontSize: '16px',
        marginBottom: '15px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {isLoading && (
          <span style={{ marginRight: '10px', fontSize: '14px' }}>⚙️</span>
        )}
        Command Terminal
      </h3>
      
      {/* Command history display */}
      <div style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '10px',
        borderRadius: '5px',
        marginBottom: '10px',
        height: '150px',
        overflowY: 'auto',
        fontFamily: "'Courier New', monospace",
        fontSize: '14px',
        color: '#0f0',
        border: '1px solid #444'
      }}>
        {commandHistory.length === 0 ? (
          <p style={{ color: '#666' }}>Type 'help' for available commands.</p>
        ) : (
          commandHistory.map((cmd, index) => (
            <div key={index} style={{ 
              color: cmd.startsWith('> Parameter') ? '#00ccff' : // Parameter changes in blue
                    cmd.startsWith('>') ? '#0f0' : // Responses in green
                    '#fff', // Commands in white
              marginBottom: '5px'
            }}>
              {cmd}
            </div>
          ))
        )}
      </div>
      
      {/* Command input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ 
          color: isLoading ? '#ffcc00' : '#e94560', 
          marginRight: '5px', 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          {isLoading ? '...' : '>'}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={isLoading ? "Processing..." : "Type a command..."}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: '#fff',
            border: '1px solid #444',
            padding: '8px',
            borderRadius: '5px',
            fontFamily: "'Courier New', monospace",
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !promptText.trim()}
          style={{
            marginLeft: '10px',
            padding: '8px 15px',
            backgroundColor: disabled || isLoading || !promptText.trim() ? '#333' : '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: disabled || isLoading || !promptText.trim() ? 'not-allowed' : 'pointer',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '12px',
            transition: 'all 0.3s ease'
          }}
        >
          {isLoading ? "..." : "Execute"}
        </button>
      </form>
      
      {/* Command hints */}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#0f0', textAlign: 'center' }}>
        <p>
          Try placing objects ('platform', 'darts') or modifying parameters ('make gravity stronger').
          Type 'help' for more commands.
        </p>
      </div>
      
      {/* Reset parameters button */}
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        <button
          onClick={handleResetParameters}
          disabled={disabled || isLoading}
          style={{
            padding: '5px 10px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '5px',
            cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            transition: 'all 0.3s ease'
          }}
        >
          Reset Parameters
        </button>
      </div>
    </div>
  );
};

export default PrompterControls;