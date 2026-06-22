import './cc-shim'; // MUST run before any legacy/ engine import (JijieData/JJConfigData/JJBData)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/bp-config.css';
import './styles/random-enemy.css';
import './styles/promo-bar.css';
import './styles/home-mode.css';
import './styles/bp.css';
import './styles/code-scheme.css';
import './styles/obs-name.css';

ReactDOM.createRoot(document.getElementById('react-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
