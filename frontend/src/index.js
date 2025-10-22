import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/global.css';
import App from './App';
import env from './config/environment';

// Log startup info
console.log('🚀 Frontend Starting...');
console.log('📍 Current URL:', window.location.href);
console.log('🔧 API Base URL:', env.api.baseUrl);
console.log('🌐 Environment:', env.app.environment);
console.log('🐛 Debug Mode:', env.app.debug);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);