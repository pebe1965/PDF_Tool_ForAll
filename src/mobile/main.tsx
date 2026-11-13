import React from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import '../index.css';
import './mobile.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
);

// Offline-Fähigkeit: nur im fertigen Build (im Entwicklungsmodus würde der Speicher stören)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* ohne Offline-Speicher funktioniert die App trotzdem */
    });
  });
}
