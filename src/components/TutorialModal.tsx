import React from 'react';
import { TutorialModalProps } from '../shared/types';

const TutorialModal: React.FC<TutorialModalProps> = ({ onStart }) => {
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000
    }}>
      <div style={{
        width: '80%',
        maxWidth: '700px',
        padding: '30px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '15px',
        boxShadow: '0 0 30px rgba(233, 69, 96, 0.5)',
        border: '2px solid #e94560',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Grid background similar to coming-soon page */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px),
            linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          animation: 'grid 15s linear infinite',
          zIndex: -1
        }} />
        
        <h2 style={{
          fontFamily: "'Press Start 2P', cursive, sans-serif",
          fontSize: '24px',
          marginBottom: '20px',
          color: '#e94560',
          textShadow: '0 0 10px rgba(233, 69, 96, 0.7)',
          textAlign: 'center'
        }}>
          Welcome to Goat In The Shell!
        </h2>
        
        <div style={{
          textAlign: 'left',
          marginBottom: '25px',
          fontSize: '16px',
          lineHeight: '1.6',
          fontFamily: "'Courier New', Courier, monospace",
        }}>
          <h3 style={{ 
            color: '#e94560', 
            marginBottom: '10px',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '16px',
            textShadow: '0 0 5px rgba(233, 69, 96, 0.5)'
          }}>
            Game Mechanics:
          </h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Goal:</strong> Guide your goat from the start point to the finish line while avoiding obstacles.</li>
            <li><strong>Controls:</strong> Use arrow keys to move and space bar to jump.</li>
            <li><strong>Dangers:</strong> Watch out for darts shooting from walls and dangerous platforms!</li>
          </ul>
          
          <h3 style={{ 
            color: '#e94560', 
            marginTop: '20px', 
            marginBottom: '10px',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            fontSize: '16px',
            textShadow: '0 0 5px rgba(233, 69, 96, 0.5)'
          }}>
            Level Building:
          </h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Each Round:</strong> You'll place one item to help (or challenge) your goat.</li>
            <li><strong>Item Types:</strong>
              <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                <li><strong>Platform:</strong> A safe surface for your goat to stand on.</li>
                <li><strong>Spike:</strong> A dangerous platform that will hurt your goat if touched.</li>
                <li><strong>Moving Platform:</strong> A platform that moves back and forth horizontally.</li>
              </ul>
            </li>
            <li><strong>Strategy:</strong> Think carefully about where to place each item to create a path to the finish!</li>
          </ul>
        </div>
        
        <button 
          onClick={onStart}
          style={{
            padding: '12px 30px',
            backgroundColor: 'rgba(233, 69, 96, 0.2)',
            color: 'white',
            border: '2px solid #e94560',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(233, 69, 96, 0.5)',
            transition: 'all 0.3s ease',
            fontFamily: "'Press Start 2P', cursive, sans-serif",
            textShadow: '0 0 5px rgba(233, 69, 96, 0.7)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.4)';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 7px 20px rgba(233, 69, 96, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

export default TutorialModal; 