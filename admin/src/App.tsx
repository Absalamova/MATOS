import React from 'react';
import { AuthProvider, useAuth } from './auth';
import { Layout, StatsProvider } from './Layout';
import { UiProvider } from './ui';
import { useRoute } from './lib';
import { API_URL } from './api';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { TailorRequests } from './pages/TailorRequests';
import { Fabrics } from './pages/Fabrics';
import { FabricEditor } from './pages/FabricEditor';
import { Tailors } from './pages/Tailors';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';

function Pages() {
  const route = useRoute();
  const [section, sub] = route.parts;
  switch (section) {
    case 'orders':
      return (
        <Layout active="orders">
          <Orders kind="fabric" route={route} />
        </Layout>
      );
    case 'samples':
      return (
        <Layout active="samples">
          <Orders key="samples" kind="sample" route={route} />
        </Layout>
      );
    case 'tailoring':
      return (
        <Layout active="tailoring">
          <TailorRequests route={route} />
        </Layout>
      );
    case 'fabrics':
      return (
        <Layout active="fabrics">{sub ? <FabricEditor key={sub} id={sub === 'new' ? null : sub} /> : <Fabrics route={route} />}</Layout>
      );
    case 'tailors':
      return (
        <Layout active="tailors">
          <Tailors route={route} />
        </Layout>
      );
    case 'customers':
      return (
        <Layout active="customers">
          <Customers route={route} />
        </Layout>
      );
    case 'settings':
      return (
        <Layout active="settings">
          <Settings />
        </Layout>
      );
    default:
      return (
        <Layout active="dashboard">
          <Dashboard />
        </Layout>
      );
  }
}

function Gate() {
  const { admin, checking, offline, retry, signOut } = useAuth();
  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-graphite" aria-busy="true">
        <span className="font-display text-[28px] lowercase text-ink">matos</span>
      </div>
    );
  }
  if (!admin && offline) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mist px-4">
        <div className="card w-full max-w-[400px] p-6 text-center">
          <p className="font-display text-[26px] lowercase">matos</p>
          <h1 className="mt-4 font-sans text-[17px] font-semibold">Server bilan aloqa yo‘q</h1>
          <p className="mt-2 text-graphite">
            API javob bermayapti: <span className="text-ink">{API_URL.replace(/^https?:\/\//, '')}</span>. Internetni tekshiring yoki serverni ishga tushiring (kompyuterda: <code>npm run dev</code>).
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={retry}>
              Qayta urinish
            </button>
            <button type="button" className="btn btn-ghost" onClick={signOut}>
              Chiqish
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!admin) return <Login />;
  return (
    <StatsProvider>
      <Pages />
    </StatsProvider>
  );
}

export default function App() {
  return (
    <UiProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </UiProvider>
  );
}
