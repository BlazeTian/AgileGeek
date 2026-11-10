import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import { ErrorBoundary } from './ErrorBoundary.js';

const host = document.getElementById('root');
if (host === null) throw new Error('#root is missing');

createRoot(host).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);


// Temporary: report the webview's real viewport to the shell, which writes
// it to a file the layout can then be checked against.
import('@tauri-apps/api/core').then(({ invoke }) => {
  const report = () => {
    invoke('report_viewport', {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    }).catch(() => {});
  };
  report();
  window.addEventListener('resize', report);
});
