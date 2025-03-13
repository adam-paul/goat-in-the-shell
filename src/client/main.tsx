import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { NetworkProvider } from './network/NetworkProvider'

// Font loading detection
const root = document.documentElement;

// Create a promise that resolves when the font is loaded
const fontPromise = document.fonts.load('1em "Press Start 2P"');
const timeout = new Promise(resolve => setTimeout(resolve, 2000)); // 2 second backup timeout

// Race the font loading against a timeout
Promise.race([fontPromise, timeout])
  .then(() => {
    // Add class to show the app is ready
    root.classList.add('fonts-ready');
    
    // Remove the preloader element
    const preloader = document.querySelector('.fonts-loaded');
    if (preloader) {
      preloader.remove();
    }
    
    // Render the app
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <NetworkProvider>
          <App />
        </NetworkProvider>
      </StrictMode>,
    );
  });
