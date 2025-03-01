import { useState, useRef, useEffect } from 'react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Process the command entered in the prompt
  const processCommand = (command: string) => {
    // Convert to lowercase and trim whitespace
    const normalizedCommand = command.toLowerCase().trim();
    
    // Add to command history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    
    // Parse the command
    if (normalizedCommand === 'darts' || normalizedCommand === 'dart wall') {
      // Place a dart wall at a reasonable position
      // We'll place it ahead of the player's current position
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      
      // Place the wall a bit ahead of the player
      onPlaceObstacle('dart_wall', playerX + 300, playerY);
      return `Creating dart wall ahead of player at position (${playerX + 300}, ${playerY})`;
    } 
    else if (normalizedCommand === 'platform') {
      // Place a platform near the player
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      const isOnGround = window.playerPosition?.isOnGround || false;
      
      // If player is on the ground, place at ground level, otherwise place below
      const yOffset = isOnGround ? 0 : 100;
      
      // Place the platform a bit ahead and at appropriate height
      onPlaceObstacle('platform', playerX + 200, playerY + yOffset);
      return `Creating platform ahead of player at position (${playerX + 200}, ${playerY + yOffset})`;
    }
    else if (normalizedCommand === 'spike') {
      // Place a spike platform near the player
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      const isOnGround = window.playerPosition?.isOnGround || false;
      
      // If player is on the ground, place at ground level, otherwise place below
      const yOffset = isOnGround ? 0 : 100;
      
      // Place the spike a bit ahead at appropriate height
      onPlaceObstacle('spike', playerX + 250, playerY + yOffset);
      return `Creating spike ahead of player at position (${playerX + 250}, ${playerY + yOffset})`;
    }
    else if (normalizedCommand === 'oscillator') {
      // Place a moving platform near the player
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      
      // Place the moving platform a bit ahead and above the player
      onPlaceObstacle('oscillator', playerX + 200, playerY - 50);
      return `Creating moving platform ahead of player at position (${playerX + 200}, ${playerY - 50})`;
    }
    else if (normalizedCommand === 'shield') {
      // Place a shield near the player
      const playerX = window.playerPosition?.x || 800;
      const playerY = window.playerPosition?.y || 400;
      
      // Place the shield a bit ahead of the player
      onPlaceObstacle('shield', playerX + 150, playerY);
      return `Creating shield ahead of player at position (${playerX + 150}, ${playerY})`;
    }
    else if (normalizedCommand === 'help') {
      return `Available commands: darts, platform, spike, oscillator, shield, help`;
    }
    else {
      return `Unknown command: ${command}. Type 'help' for available commands.`;
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || disabled) return;
    
    const response = processCommand(promptText);
    
    // Add the response to the command history
    setCommandHistory(prev => [...prev, `> ${response}`]);
    
    // Clear the input
    setPromptText('');
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
        marginBottom: '15px'
      }}>
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
              color: cmd.startsWith('>') ? '#0f0' : '#fff',
              marginBottom: '5px'
            }}>
              {cmd}
            </div>
          ))
        )}
      </div>
      
      {/* Command input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#e94560', marginRight: '5px', display: 'flex', alignItems: 'center' }}>{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a command..."
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
          disabled={disabled}
          style={{
            marginLeft: '10px',
            padding: '8px 15px',
            backgroundColor: disabled ? '#333' : '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '12px',
            transition: 'all 0.3s ease'
          }}
        >
          Execute
        </button>
      </form>
      
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#0f0', textAlign: 'center' }}>
        <p>Type commands to add obstacles in real-time. Try 'darts', 'platform', 'spike', 'oscillator', or 'shield'.</p>
      </div>
    </div>
  );
};

export default PrompterControls;