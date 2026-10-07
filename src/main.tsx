import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The seller panel is a separate app now (admin/ → admin.matos.uz). Old #/admin links land on the home page.
if (window.location.hash.startsWith('#/admin')) window.history.replaceState(null, '', window.location.pathname + window.location.search);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
