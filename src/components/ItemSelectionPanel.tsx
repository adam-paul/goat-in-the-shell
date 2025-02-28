import React, { useState } from 'react';
import { ItemType } from '../App';

interface ItemSelectionPanelProps {
  onSelectItem: (itemType: ItemType) => void;
}

interface ItemOption {
  type: ItemType;
  name: string;
  description: string;
  color: string;
}

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
      name: 'Moving Platform',
      description: 'A platform that moves back and forth',
      color: '#2196F3' // Blue
    }
  ];

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'rgba(245, 245, 245, 0.9)',
      borderRadius: '8px',
      margin: '0 auto',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Select an Item to Place</h2>
      
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
              backgroundColor: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: hoveredItem === item.type 
                ? '0 5px 15px rgba(0,0,0,0.1)' 
                : '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              transform: hoveredItem === item.type ? 'translateY(-5px)' : 'translateY(0)'
            }}
          >
            <div style={{
              width: '100%',
              height: '50px',
              backgroundColor: item.color,
              borderRadius: '4px',
              marginBottom: '10px'
            }} />
            
            <h3 style={{ margin: '10px 0' }}>{item.name}</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>{item.description}</p>
          </div>
        ))}
      </div>
      
      <p style={{ 
        textAlign: 'center', 
        marginTop: '20px',
        fontSize: '14px',
        color: '#666'
      }}>
        Select an item to place in the level. Try to make it challenging but still possible to complete!
      </p>
    </div>
  );
};

export default ItemSelectionPanel; 