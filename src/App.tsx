import React, { useEffect } from 'react';
import { AppProvider, useApp } from './state/app';
import { useRoute } from './lib/router';
import { L, UI } from './lib/i18n';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ToastHost } from './components/ui/Toast';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { VisualSearchModal } from './components/VisualSearchModal';
import { StyleAdvisorModal } from './components/StyleAdvisorModal';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { StudioPage } from './pages/StudioPage';
import { TailorsPage } from './pages/TailorsPage';

function Shell() {
  const route = useRoute();
  const { t, fabricById } = useApp();

  useEffect(() => {
    const f = route.name === 'fabric' ? fabricById(route.id ?? '') : undefined;
    const part =
      route.name === 'catalog'
        ? t(UI.catalog)
        : route.name === 'studio'
          ? t(UI.studio)
          : route.name === 'tailors'
            ? t(UI.tailors)
            : f
              ? t(f.name)
              : t(L('mato, namuna, 3D va tikuvchi', 'ткань, образцы, 3D и портные', 'fabric, samples, 3D and tailors'));
    document.title = `${part} — MATOS`;
  }, [route, t, fabricById]);

  useEffect(() => {
    if (route.name !== 'home' && route.name !== 'fabric') window.scrollTo(0, 0);
  }, [route.name]);

  let page: React.ReactNode;
  switch (route.name) {
    case 'catalog':
      page = <CatalogPage route={route} />;
      break;
    case 'fabric':
      page = <ProductPage route={route} />;
      break;
    case 'studio':
      page = <StudioPage route={route} />;
      break;
    case 'tailors':
      page = <TailorsPage key={route.query.get('book') ?? ''} route={route} />;
      break;
    default:
      page = <HomePage route={route} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header route={route.name} />
      <main id="main" className="flex-1" tabIndex={-1}>
        {page}
      </main>
      {route.name !== 'studio' && <Footer />}
      <CartDrawer />
      <AuthModal />
      <ProfileModal />
      <VisualSearchModal />
      <StyleAdvisorModal />
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
