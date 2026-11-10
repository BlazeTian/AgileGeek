import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';

const host = document.getElementById('root');
if (host === null) throw new Error('#root is missing');

createRoot(host).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
