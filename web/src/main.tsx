import './cc-shim'; // MUST run before any legacy/ engine import (JijieData/JJConfigData/JJBData)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/dynres.css';
import './styles/bp-config.css';
import './styles/random-enemy.css';
import './styles/promo-bar.css';
import './styles/home-mode.css';
import './styles/bp.css';
import './styles/code-scheme.css';
import './styles/obs-name.css';
import './styles/ladder.css';
import './styles/login.css';
import './styles/register.css';
import './styles/event-rules.css';
import './styles/home-redesign.css'; // #75 首页重设计:须在 home-mode.css 之后加载(同特异度覆盖靠顺序)

ReactDOM.createRoot(document.getElementById('react-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
