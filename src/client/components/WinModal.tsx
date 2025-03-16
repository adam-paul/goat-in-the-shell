import React, { useEffect, useRef } from 'react';
import { WinModalProps } from '../../shared/types';

const WinModal: React.FC<WinModalProps> = ({ onPlayAgain }) => {
  // Reference for the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw and animate the win icon
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas dimensions
      canvas.width = 100;
      canvas.height = 100;
      
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
        
        // Update rotation
        rotation += 0.01;
        
        // Save context state
        ctx.save();
        
        // Move to center and scale
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.rotate(rotation);
        
        // Draw trophy
        // Base
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.fillRect(-15, 30, 30, 10);
        
        // Trophy body
        ctx.beginPath();
        ctx.moveTo(-15, 30);
        ctx.lineTo(-20, 0);
        ctx.lineTo(20, 0);
        ctx.lineTo(15, 30);
        ctx.closePath();
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.fill();
        
        // Trophy cup
        ctx.beginPath();
        ctx.arc(0, -10, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.fill();
        
        // Inner cup detail
        ctx.beginPath();
        ctx.arc(0, -10, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF8DC'; // Cream color for contrast
        ctx.fill();
        
        // Handles
        ctx.beginPath();
        ctx.arc(-20, 0, 7, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(20, 0, 7, Math.PI * 1.5, Math.PI * 2.5);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        
        // Draw goat silhouette on top of trophy
        ctx.fillStyle = '#F0F0F0'; // Light gray for goat
        
        // Body
        ctx.fillRect(-10, -28, 20, 12);
        
        // Head
        ctx.fillRect(-15, -35, 10, 10);
        
        // Horns
        ctx.fillRect(-15, -38, 2, 5);
        ctx.fillRect(-10, -38, 2, 5);
        
        // Legs
        ctx.fillRect(-8, -16, 3, 6);
        ctx.fillRect(-2, -16, 3, 6);
        ctx.fillRect(4, -16, 3, 6);
        
        // Add sparkle effects around the trophy
        for (let i = 0; i < 8; i++) {
          const angle = rotation + (i * Math.PI / 4);
          const distance = 30 + Math.sin(rotation * 2 + i) * 5;
          
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
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
  }, []);
  
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
        backgroundColor: '#4CAF50', // Green for victory
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
            height={100} 
            style={{ display: 'block', margin: '0 auto' }}
          />
        </div>
        
        <h2 style={{
          fontSize: '32px',
          color: '#ffffff',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          opacity,
          transition: 'opacity 400ms ease-in-out',
          transitionDelay: '100ms'
        }}>
          VICTORY!
        </h2>
        
        <p style={{
          fontSize: '18px',
          color: '#ffffff',
          marginBottom: '30px',
          opacity,
          transition: 'opacity 400ms ease-in-out',
          transitionDelay: '200ms'
        }}>
          Congratulations! Your goat has reached the finish line!
        </p>
        
        <button 
          onClick={onPlayAgain}
          style={{
            padding: '12px 24px',
            backgroundColor: '#FFD700', // Gold for the button
            color: '#000000',
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
            e.currentTarget.style.backgroundColor = '#FFC107';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#FFD700';
          }}
        >
          Play Again
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

export default WinModal;