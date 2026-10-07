import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Admin / seller panel lives at #/admin and is loaded only when opened.
const AdminPanel = lazy(() => import('./components/AdminPanel.tsx'));

const isAdminHash = () => window.location.hash.startsWith('#/admin');

function Root() {
  const [isAdmin, setIsAdmin] = useState(isAdminHash);
  useEffect(() => {
    const onHash = () => setIsAdmin(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return isAdmin ? (
    <Suspense fallback={<div className="p-10 text-center text-graphite">MATOS…</div>}>
      <AdminPanel />
    </Suspense>
  ) : (
    <App />
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
