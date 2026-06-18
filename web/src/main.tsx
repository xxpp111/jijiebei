import './cc-shim'; // MUST run before any @logic/@jjb import
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/bp-config.css';

ReactDOM.createRoot(document.getElementById('react-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
