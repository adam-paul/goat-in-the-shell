import { useState } from 'react';

interface PrompterControlsProps {
  onPlaceObstacle: (type: string, x: number, y: number) => void;
  disabled: boolean;
}

const PrompterControls: React.FC<PrompterControlsProps> = ({ onPlaceObstacle, disabled }) => {
  const [obstacleType, setObstacleType] = useState<string>('platform');
  
  // This is a placeholder for future AI-powered obstacle generation
  const handleGenerateObstacle = () => {
    // For now, just place a random obstacle
    const x = Math.floor(Math.random() * 700) + 50; // Random x between 50-750
    const y = Math.floor(Math.random() * 400) + 100; // Random y between 100-500
    
    onPlaceObstacle(obstacleType, x, y);
  };
  
  return (
    <div className="prompter-controls" style={{
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      marginTop: '20px',
      backgroundColor: '#f5f5f5',
      maxWidth: '800px',
      margin: '20px auto'
    }}>
      <h3>Prompter Controls</h3>
      <p>This will be powered by AI in the future to dynamically create obstacles.</p>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
        <select 
          value={obstacleType}
          onChange={(e) => setObstacleType(e.target.value)}
          disabled={disabled}
          style={{ padding: '5px' }}
        >
          <option value="platform">Platform</option>
          <option value="spike">Spike</option>
          <option value="moving">Moving Platform</option>
        </select>
        
        <button
          onClick={handleGenerateObstacle}
          disabled={disabled}
          style={{
            padding: '5px 10px',
            backgroundColor: disabled ? '#cccccc' : '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          Generate Obstacle (Coming Soon)
        </button>
      </div>
      
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <p>In the full version, this panel would allow an AI to generate obstacles in real-time to challenge the player.</p>
      </div>
    </div>
  );
};

export default PrompterControls;