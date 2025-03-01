import React from 'react';

interface TutorialModalProps {
  onStart: () => void;
}

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
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000
    }}>
      <div style={{
        width: '80%',
        maxWidth: '700px',
        padding: '30px',
        backgroundColor: '#2c3e50',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        border: '3px solid #3498db',
        textAlign: 'center',
        color: 'white'
      }}>
        <h2 style={{
          fontSize: '32px',
          marginBottom: '20px',
          color: '#3498db',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)'
        }}>
          Welcome to Goat In The Shell!
        </h2>
        
        <div style={{
          textAlign: 'left',
          marginBottom: '25px',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>
          <h3 style={{ color: '#3498db', marginBottom: '10px' }}>Game Mechanics:</h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Goal:</strong> Guide your goat from the start point to the finish line while avoiding obstacles.</li>
            <li><strong>Controls:</strong> Use arrow keys to move and space bar to jump.</li>
            <li><strong>Dangers:</strong> Watch out for darts shooting from walls and dangerous platforms!</li>
          </ul>
          
          <h3 style={{ color: '#3498db', marginTop: '20px', marginBottom: '10px' }}>Level Building:</h3>
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
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2980b9';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#3498db';
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

export default TutorialModal; 