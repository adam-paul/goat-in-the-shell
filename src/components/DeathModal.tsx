import React, { useEffect, useRef } from 'react';

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
  
  // Reference for the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw and animate the icon based on death type
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas dimensions
      canvas.width = 100;
      canvas.height = 60;
      
      // Animation variables
      let scale = 1;
      let growing = true;
      let rotation = 0;
      
      // Animation function
      const animate = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update scale for pulsing effect
        if (growing) {
          scale += 0.01;
          if (scale >= 1.1) growing = false;
        } else {
          scale -= 0.01;
          if (scale <= 1) growing = true;
        }
        
        // Save context state
        ctx.save();
        
        // Move to center and scale
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        
        if (deathType === 'dart') {
          // Draw syringe body
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(-25, -6, 50, 12);
          
          // Draw syringe plunger
          ctx.fillStyle = '#d0d0d0';
          ctx.fillRect(20, -10, 10, 20);
          
          // Draw needle
          ctx.fillStyle = '#c0c0c0';
          ctx.fillRect(-35, -1.5, 20, 3);
          
          // Draw liquid in syringe (blue tranquilizer)
          ctx.fillStyle = '#0000ff';
          ctx.fillRect(-15, -4, 30, 8);
        } else {
          // For spike death, draw a broken goat leg
          
          // Update rotation for wobble effect
          rotation = Math.sin(Date.now() / 200) * 0.1;
          ctx.rotate(rotation);
          
          // Draw leg
          ctx.fillStyle = '#E0E0E0'; // Light gray for goat leg
          
          // Upper leg
          ctx.fillRect(-5, -20, 10, 20);
          
          // Break point with jagged edge
          ctx.beginPath();
          ctx.moveTo(-5, 0);
          ctx.lineTo(-3, 2);
          ctx.lineTo(0, -1);
          ctx.lineTo(3, 2);
          ctx.lineTo(5, 0);
          ctx.closePath();
          ctx.fillStyle = '#FF6B6B'; // Red for break point
          ctx.fill();
          
          // Lower leg (broken and offset)
          ctx.fillStyle = '#E0E0E0';
          ctx.save();
          ctx.translate(8, 5); // Offset to show it's broken
          ctx.rotate(Math.PI / 8); // Rotate the broken part
          ctx.fillRect(-5, 0, 10, 20);
          
          // Hoof
          ctx.fillStyle = '#A0A0A0'; // Darker gray for hoof
          ctx.fillRect(-6, 20, 12, 5);
          ctx.restore();
          
          // Draw "pain" lines
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 1;
          
          // Draw several pain lines around the break
          for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i / 4) + (Date.now() / 1000);
            const length = 8 + Math.sin(Date.now() / 200 + i) * 2;
            
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
            ctx.lineTo(Math.cos(angle) * (8 + length), Math.sin(angle) * (8 + length));
            ctx.stroke();
          }
        }
        
        // Restore context state
        ctx.restore();
        
        // Continue animation
        requestAnimationFrame(animate);
      };
      
      // Start animation
      const animationId = requestAnimationFrame(animate);
      
      // Cleanup
      return () => {
        cancelAnimationFrame(animationId);
      };
    }
  }, [deathType]);
  
  // Fade-in animation effect
  const [opacity, setOpacity] = React.useState(0);
  
  useEffect(() => {
    // Start with opacity 0 and fade in
    setOpacity(0);
    const timer = setTimeout(() => {
      setOpacity(1);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);
  
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
      zIndex: 1000,
      opacity,
      transition: 'opacity 400ms ease-in-out'
    }}>
      <div style={{
        width: '400px',
        padding: '30px',
        backgroundColor,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        border: '3px solid #ffffff',
        textAlign: 'center',
        opacity,
        transition: 'opacity 400ms ease-in-out',
        transform: 'translateY(0)',
        animation: 'modalAppear 500ms ease-out'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <canvas 
            ref={canvasRef} 
            width={100} 
            height={60} 
            style={{ display: 'block', margin: '0 auto' }}
          />
        </div>
        
        <h2 style={{
          fontSize: '32px',
          color: '#ff0000',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          opacity,
          transition: 'opacity 400ms ease-in-out',
          transitionDelay: '100ms'
        }}>
          {title}
        </h2>
        
        <p style={{
          fontSize: '18px',
          color: '#ffffff',
          marginBottom: '30px',
          opacity,
          transition: 'opacity 400ms ease-in-out',
          transitionDelay: '200ms'
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
            transition: 'background-color 0.2s, opacity 400ms ease-in-out',
            opacity,
            transitionDelay: '300ms'
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
      
      <style>
        {`
          @keyframes modalAppear {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default DeathModal; 