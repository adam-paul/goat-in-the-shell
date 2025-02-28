import React from 'react';

interface DeathModalProps {
  deathType: 'dart' | 'spike';
  onContinue: () => void;
}

const DeathModal: React.FC<DeathModalProps> = ({ deathType, onContinue }) => {
  // Define death-specific content
  const title = deathType === 'dart' ? 'TRANQUILIZED!' : 'BUSTED GOAT ANKLES!';
  const description = deathType === 'dart' 
    ? 'Your goat was hit by a dart!' 
    : 'Your goat landed on a dangerous platform!';
  const backgroundColor = deathType === 'dart' ? '#333333' : '#d32f2f';
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000
    }}>
      <div style={{
        width: '400px',
        padding: '30px',
        backgroundColor,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        border: '3px solid #ffffff',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '32px',
          color: '#ffffff',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
        }}>
          {title}
        </h2>
        
        <p style={{
          fontSize: '18px',
          color: '#ffffff',
          marginBottom: '30px'
        }}>
          {description}
        </p>
        
        <button 
          onClick={onContinue}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#66BB6A';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
          }}
        >
          Continue to Next Round
        </button>
      </div>
    </div>
  );
};

export default DeathModal; 