import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './state/app';
import { useRoute } from './lib/router';
import { L, UI } from './lib/i18n';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ToastHost } from './components/ui/Toast';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { HomePage } from './pages/HomePage';

// Only the home page ships in the first download; other pages and the photo tools load when opened.
const CatalogPage = lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const ProductPage = lazy(() => import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const StudioPage = lazy(() => import('./pages/StudioPage').then((m) => ({ default: m.StudioPage })));
const TailorsPage = lazy(() => import('./pages/TailorsPage').then((m) => ({ default: m.TailorsPage })));
const VisualSearchModal = lazy(() => import('./components/VisualSearchModal').then((m) => ({ default: m.VisualSearchModal })));
const StyleAdvisorModal = lazy(() => import('./components/StyleAdvisorModal').then((m) => ({ default: m.StyleAdvisorModal })));

/** Mounts a lazy overlay the first time it opens and keeps it mounted so its close animation still runs. */
function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened;
}

function PageFallback() {
  return <div className="min-h-[70vh]" aria-busy="true" />;
}

function Shell() {
  const route = useRoute();
  const { t, fabricById, overlay } = useApp();
  const searchLoaded = useOpenedOnce(overlay === 'search');
  const styleLoaded = useOpenedOnce(overlay === 'style');

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
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </main>
      {route.name !== 'studio' && <Footer />}
      <CartDrawer />
      <AuthModal />
      <ProfileModal />
      <Suspense fallback={null}>
        {searchLoaded && <VisualSearchModal />}
        {styleLoaded && <StyleAdvisorModal />}
      </Suspense>
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
