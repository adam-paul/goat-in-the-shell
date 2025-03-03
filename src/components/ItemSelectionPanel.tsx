import React, { useState } from 'react';
import { ItemType, ItemOption, ItemSelectionPanelProps } from '../types';

const ItemSelectionPanel: React.FC<ItemSelectionPanelProps> = ({ onSelectItem }) => {
  // Track which item is being hovered
  const [hoveredItem, setHoveredItem] = useState<ItemType | null>(null);

  // Define the available items
  const items: ItemOption[] = [
    {
      type: 'platform',
      name: 'Platform',
      description: 'A solid platform to stand on',
      color: '#4CAF50' // Green
    },
    {
      type: 'spike',
      name: 'Spike',
      description: 'Dangerous! Will kill the player on contact',
      color: '#f44336' // Red
    },
    {
      type: 'moving',
      name: 'Oscillator',
      description: 'A platform that moves back and forth',
      color: '#2196F3' // Blue
    },
    {
      type: 'shield',
      name: 'Shield',
      description: 'A small block that can block arrows',
      color: '#FF9800' // Orange
    }
  ];

  return (
    <div style={{
      padding: '30px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '15px',
      margin: '0 auto',
      boxShadow: '0 0 30px rgba(233, 69, 96, 0.5)',
      border: '2px solid #e94560',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Grid background similar to TutorialModal */}
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
        textAlign: 'center', 
        marginBottom: '20px',
        fontFamily: "'Press Start 2P', cursive, sans-serif",
        fontSize: '24px',
        color: '#e94560',
        textShadow: '0 0 10px rgba(233, 69, 96, 0.7)'
      }}>
        Select an Item to Place
      </h2>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        {items.map((item) => (
          <div 
            key={item.type}
            onClick={() => onSelectItem(item.type)}
            onMouseEnter={() => setHoveredItem(item.type)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              width: '200px',
              padding: '15px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
              cursor: 'pointer',
              border: `2px solid ${item.color}`,
              boxShadow: hoveredItem === item.type 
                ? `0 0 15px ${item.color}` 
                : `0 0 5px ${item.color}`,
              transition: 'all 0.3s ease',
              transform: hoveredItem === item.type ? 'translateY(-5px)' : 'translateY(0)'
            }}
          >
            <div style={{
              width: '100%',
              height: '50px',
              backgroundColor: `${item.color}33`, // Add transparency
              borderRadius: '4px',
              marginBottom: '10px',
              border: `1px solid ${item.color}`
            }} />
            
            <h3 style={{ 
              margin: '10px 0',
              fontFamily: "'Press Start 2P', cursive, sans-serif",
              fontSize: '14px',
              color: item.color,
              textShadow: `0 0 5px ${item.color}99`
            }}>
              {item.name}
            </h3>
            
            <p style={{ 
              fontSize: '14px', 
              color: 'white',
              fontFamily: "'Courier New', Courier, monospace"
            }}>
              {item.description}
            </p>
          </div>
        ))}
      </div>
      
      <p style={{ 
        textAlign: 'center', 
        marginTop: '20px',
        fontSize: '14px',
        color: 'white',
        fontFamily: "'Courier New', Courier, monospace"
      }}>
        Select an item to place in the level. Try to make it challenging but still possible to complete!
      </p>
    </div>
  );
};

export default ItemSelectionPanel; 