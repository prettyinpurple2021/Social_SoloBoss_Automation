import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PWAManager, OfflineManager } from './utils/pwa';

// Initialize PWA features
const initializePWA = async () => {
  // Initialize offline detection
  OfflineManager.init();
  
  // Register service worker for PWA functionality
  if (PWAManager.canInstall()) {
    const pwaManager = new PWAManager();
    await pwaManager.register();
  }
};

// Initialize PWA features
initializePWA().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);