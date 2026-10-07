import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import './index.css';

// Admin panel: #/admin manzilida ochiladi
function Root() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));
  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash.startsWith('#/admin'));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return isAdmin ? <AdminPanel /> : <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);
