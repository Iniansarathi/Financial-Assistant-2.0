import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register Service Worker for PWA Offline capabilities
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('MoneyPilot Service Worker registered with scope: ', reg.scope);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Emit custom update available event for UI to display the toast
                window.dispatchEvent(new CustomEvent('sw-update-available', { detail: reg }));
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('Service Worker registration failed: ', err);
      });
  });
}
