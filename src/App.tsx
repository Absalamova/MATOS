import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FabricCatalog } from './components/FabricCatalog';
import { CatalogPage } from './components/CatalogPage';
import { Studio3DPage } from './components/Studio3DPage';
import { ZeroWasteCalculator } from './components/ZeroWasteCalculator';
import { InternationalStandardsBanner } from './components/InternationalStandardsBanner';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { TailorsDirectory } from './components/TailorsDirectory';
import { CameraSearchModal } from './components/CameraSearchModal';
import { FABRICS } from './data/fabrics';
import { GARMENTS } from './data/garments';
import { Fabric, GarmentSilhouette, ColorOption, CartItem, User, Language, Currency, UnitSystem } from './types';
import { Sparkles, ArrowRight, Check, Scissors, Layers, ShieldCheck, Camera, Sparkle, Shirt, Compass, CheckCircle } from 'lucide-react';

export default function App() {
  // Navigation & Page View State: 'home' | 'catalog' | 'studio3d' | 'tailors'
  const [currentView, setCurrentView] = useState<'home' | 'catalog' | 'studio3d' | 'tailors'>('home');

  // Global App States
  const [lang, setLang] = useState<Language>('uz');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [unit, setUnit] = useState<UnitSystem>('metric');

  // Studio selections
  const [selectedFabric, setSelectedFabric] = useState<Fabric>(FABRICS[0]);
  const [selectedGarment, setSelectedGarment] = useState<GarmentSilhouette>(GARMENTS[0]);
  const [selectedColor, setSelectedColor] = useState<ColorOption>(FABRICS[0].colors[0]);

  // Modals & Drawers
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCameraSearchOpen, setIsCameraSearchOpen] = useState<boolean>(false);
  const [detailModalFabric, setDetailModalFabric] = useState<Fabric | null>(null);

  // User & Cart Persistence in LocalStorage
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize and load saved state from localStorage on startup
  useEffect(() => {
    // 1. Seed demo user if no users exist
    const storedUsers = localStorage.getItem('matos_users');
    if (!storedUsers) {
      const demoUsers: User[] = [
        {
          id: 'user-default-1',
          name: 'Jamshid Davlatov',
          identifier: '+998 90 123 45 67',
          password: '123',
          registeredAt: new Date().toISOString(),
          measurements: {
            heightCm: 178,
            chestCm: 98,
            waistCm: 80,
            hipsCm: 100,
            sizeINT: 'M',
            sizeEU: 'EU 40',
            sizeUS: 'US 8',
            sizeUK: 'UK 12',
          },
        },
      ];
      localStorage.setItem('matos_users', JSON.stringify(demoUsers));
    }

    // 2. Load current session
    try {
      const session = localStorage.getItem('matos_current_user');
      if (session) {
        setCurrentUser(JSON.parse(session));
      }
    } catch {
      setCurrentUser(null);
    }

    // 3. Load cart items
    try {
      const savedCart = localStorage.getItem('matos_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch {
      setCart([]);
    }
  }, []);

  // Save cart changes to localStorage
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem('matos_cart', JSON.stringify(newCart));
    } catch {
      // Ignored
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Cart operations
  const handleAddToCart = (fabric: Fabric, color: ColorOption, meters: number) => {
    const existingIndex = cart.findIndex(
      (item) => item.fabricId === fabric.id && item.color.id === color.id
    );

    const price = currency === 'UZS' ? fabric.priceUZS : currency === 'USD' ? fabric.priceUSD : fabric.priceEUR;
    const roundedMeters = Math.round(meters * 10) / 10;

    let updatedCart: CartItem[];
    if (existingIndex !== -1) {
      updatedCart = [...cart];
      const newQty = Math.round((updatedCart[existingIndex].quantity + roundedMeters) * 10) / 10;
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: newQty,
        totalPrice: Math.round(newQty * price * 10) / 10,
      };
    } else {
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        fabricId: fabric.id,
        fabricName: fabric.name,
        color: color,
        quantity: roundedMeters,
        unit: unit === 'metric' ? 'm' : 'yd',
        pricePerUnit: price,
        totalPrice: Math.round(roundedMeters * price * 10) / 10,
        currency: currency,
        cssClass: fabric.cssClass,
        gsm: fabric.gsm,
        width: unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`,
      };
      updatedCart = [...cart, newItem];
    }

    saveCart(updatedCart);
    showToast(
      lang === 'uz'
        ? `${roundedMeters}${unit === 'metric' ? 'm' : 'yd'} "${fabric.name} (${color.name[lang]})" savatga qo‘shildi!`
        : lang === 'ru'
        ? `${roundedMeters}${unit === 'metric' ? 'м' : 'yd'} "${fabric.name}" добавлено в корзину!`
        : `Added ${roundedMeters}${unit === 'metric' ? 'm' : 'yd'} of ${fabric.name} to your bag!`
    );
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.id === id) {
          const newQty = Math.round((item.quantity + delta) * 10) / 10;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            totalPrice: Math.round(newQty * item.pricePerUnit * 10) / 10,
          };
        }
        return item;
      })
      .filter(Boolean) as CartItem[];

    saveCart(updated);
  };

  const handleRemoveItem = (id: string) => {
    const updated = cart.filter((item) => item.id !== id);
    saveCart(updated);
    showToast(lang === 'uz' ? 'Mato savatdan chiqarildi' : lang === 'ru' ? 'Удалено из корзины' : 'Removed from bag');
  };

  const handleClearCart = () => {
    saveCart([]);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('matos_current_user');
    setIsProfileOpen(false);
    showToast(lang === 'uz' ? 'Akkauntdan chiqildi' : lang === 'ru' ? 'Вы вышли из профиля' : 'Signed out');
  };

  // Transition into dedicated 3D Studio page with specified fabric & color
  const open3DStudioWithFabric = (fabric?: Fabric, color?: ColorOption, garment?: GarmentSilhouette) => {
    if (fabric) setSelectedFabric(fabric);
    if (color) setSelectedColor(color);
    if (garment) setSelectedGarment(garment);
    setCurrentView('studio3d');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLang = (newLang: Language) => {
    setLang(newLang);
    if (newLang === 'en') {
      setCurrency('USD');
    } else {
      setCurrency('UZS');
    }
  };

  const handleNavigate = (section: 'home' | 'catalog' | 'studio3d' | 'tailors') => {
    setCurrentView(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F7F2] text-[#1E1915]">
      
      {/* Universal Header */}
      <Header
        currentLang={lang}
        onSelectLang={handleSelectLang}
        currency={currency}
        onSelectCurrency={(c) => setCurrency(c)}
        unit={unit}
        onToggleUnit={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
        cartCount={cart.length}
        onOpenCart={() => setIsCartOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        activeSection={currentView}
        onNavigate={handleNavigate}
        onOpenVisualSearch={() => setIsCameraSearchOpen(true)}
      />

      <main className="flex-grow">
        
        {/* VIEW 1: Dedicated Full-Page Fabric Catalog */}
        {currentView === 'catalog' && (
          <CatalogPage
            fabrics={FABRICS}
            onSelectFabricForStudio={(fabric, color) => open3DStudioWithFabric(fabric, color)}
            onOpenProductDetail={(fabric) => setDetailModalFabric(fabric)}
            currency={currency}
            unit={unit}
            lang={lang}
            onOpenVisualSearch={() => setIsCameraSearchOpen(true)}
            onBackToHome={() => handleNavigate('home')}
          />
        )}

        {/* VIEW 2: Dedicated Full-Page 3D Drape & Mannequin Studio */}
        {currentView === 'studio3d' && (
          <Studio3DPage
            fabrics={FABRICS}
            garments={GARMENTS}
            selectedFabric={selectedFabric}
            selectedGarment={selectedGarment}
            selectedColor={selectedColor}
            onSelectFabric={(f) => {
              setSelectedFabric(f);
              setSelectedColor(f.colors[0]);
            }}
            onSelectGarment={(g) => setSelectedGarment(g)}
            onSelectColor={(c) => setSelectedColor(c)}
            onAddToCart={handleAddToCart}
            currency={currency}
            unit={unit}
            lang={lang}
            onBackToHome={() => handleNavigate('home')}
            onNavigateToCatalog={() => handleNavigate('catalog')}
          />
        )}

        {/* VIEW 3: Dedicated Tailors Directory */}
        {currentView === 'tailors' && (
          <TailorsDirectory
            lang={lang}
            currency={currency}
            onShowToast={showToast}
            onBackToAtelier={() => handleNavigate('home')}
          />
        )}

        {/* VIEW 4: Main Home Page */}
        {currentView === 'home' && (
          <>
            {/* Hero Section */}
            <section className="relative bg-gradient-to-b from-[#F2ECE1] via-[#F8F5EE] to-[#FAF7F2] py-16 md:py-24 overflow-hidden border-b border-[#E3DBD0]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
                  
                  {/* Left Column: Core Narrative */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 border border-[#DDD5C7] shadow-2xs text-[#1C1714] text-xs font-bold tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-[#B85D3B]"></span>
                      <span className="font-mono text-[#B85D3B] uppercase">Haute Atelier Ecosystem</span>
                      <span className="text-[#887A6D]">·</span>
                      <span>{lang === 'uz' ? 'Yangi Avlod To‘qimachilik Tajribasi' : lang === 'ru' ? 'Текстильный Опыт Нового Поколения' : 'Next-Generation Textile Experience'}</span>
                    </div>

                    <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1C1714] tracking-tight leading-[1.12]">
                      {lang === 'uz' ? (
                        <>
                          Matolarni <br className="hidden sm:inline" />
                          <span className="italic font-normal text-[#B85D3B] underline decoration-[#B85D3B]/40 underline-offset-8">
                            yangi ruhda
                          </span>{' '}
                          his eting.
                        </>
                      ) : lang === 'ru' ? (
                        <>
                          Почувствуйте ткани <br className="hidden sm:inline" />
                          <span className="italic font-normal text-[#B85D3B] underline decoration-[#B85D3B]/40 underline-offset-8">
                            в новом духе
                          </span>{' '}
                          и образе.
                        </>
                      ) : (
                        <>
                          Experience textiles <br className="hidden sm:inline" />
                          <span className="italic font-normal text-[#B85D3B] underline decoration-[#B85D3B]/40 underline-offset-8">
                            in a new spirit
                          </span>{' '}
                          and grace.
                        </>
                      )}
                    </h1>

                    <p className="text-[#5D5043] text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl font-normal">
                      {lang === 'uz'
                        ? 'Har bir tolada tabiiylik va oliy san’at. Libos tikishdan avval matoni alohida 3D virtual manekenda sinab ko‘ring, isrofsiz aniq bichim hisoblagichidan foydalaning va to‘qimani uyingizga bepul namuna qilib buyurtma bering.'
                        : lang === 'ru'
                        ? 'Натуральность и высшее мастерство в каждой нити. Примерьте ткань на реалистичном 3D манекене в нашей отдельной студии, рассчитайте точный метраж без отходов.'
                        : 'Tactile authenticity in every single weave. Test fluid drape behavior on our sculptural 3D mannequin in its dedicated studio, eliminate fabric scraps with zero-waste algorithms.'}
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center gap-3.5 pt-2">
                      <button
                        onClick={() => handleNavigate('studio3d')}
                        className="px-6 py-3.5 rounded-2xl bg-[#1C1714] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#B85D3B] transition-all shadow-lg flex items-center gap-2.5 group cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-[#D4AF37] group-hover:rotate-12 transition-transform" />
                        <span>{lang === 'uz' ? '3D Drape Studiyani Ochish' : lang === 'ru' ? 'Открыть 3D Drape Студию' : 'Open 3D Drape Atelier'}</span>
                      </button>

                      <button
                        onClick={() => setIsCameraSearchOpen(true)}
                        className="px-6 py-3.5 rounded-2xl bg-[#B85D3B] hover:bg-[#9E4D2F] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>{lang === 'uz' ? 'Kamera & Rasm Orqali Qidirish' : lang === 'ru' ? 'Поиск по Фото / Камере' : 'Camera & Photo Search'}</span>
                      </button>

                      <button
                        onClick={() => handleNavigate('catalog')}
                        className="px-6 py-3.5 rounded-2xl bg-white border border-[#DDD5C7] text-[#1C1714] font-bold text-xs uppercase tracking-wider hover:bg-[#F2ECE3] transition shadow-2xs flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-[#7A6D5F]" />
                        <span>{lang === 'uz' ? 'Matolar Katalogi' : lang === 'ru' ? 'Коллекция Тканей' : 'Explore Catalog'}</span>
                      </button>

                      <a
                        href="#calculator"
                        className="px-5 py-3.5 rounded-2xl bg-[#FAF5F0] border border-[#DDD5C7] text-[#B85D3B] font-bold text-xs uppercase tracking-wider hover:bg-[#F2E8DC] transition flex items-center gap-2"
                      >
                        <Scissors className="w-4 h-4" />
                        <span>{lang === 'uz' ? 'Bichim Kalkulyatori' : lang === 'ru' ? 'Калькулятор' : 'Calculator'}</span>
                      </a>
                    </div>

                    {/* Proof Metrics */}
                    <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-6 border-t border-[#DDD5C7] text-left">
                      <div>
                        <span className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1714] block">19 xil</span>
                        <span className="text-[11px] sm:text-xs text-[#7A6D5F]">
                          {lang === 'uz' ? 'Haqiqiy Suratlangan Matolar' : lang === 'ru' ? 'Эксклюзивных Полотен' : 'Curated Natural Weaves'}
                        </span>
                      </div>
                      <div>
                        <span className="font-serif font-bold text-2xl sm:text-3xl text-[#B85D3B] block">-25%</span>
                        <span className="text-[11px] sm:text-xs text-[#7A6D5F]">
                          {lang === 'uz' ? 'Isrofsiz tejalgan mato' : lang === 'ru' ? 'Экономия расхода ткани' : 'Zero-Waste Cutting Standard'}
                        </span>
                      </div>
                      <div>
                        <span className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1714] block">360°</span>
                        <span className="text-[11px] sm:text-xs text-[#7A6D5F]">
                          {lang === 'uz' ? 'Virtual Maneken Simulyatsiyasi' : lang === 'ru' ? '3D Манекен Студия' : 'Real-time 3D Simulation'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Hero Visual Fabric Spotlight */}
                  <div className="lg:col-span-5 relative">
                    <div className="relative mx-auto max-w-md lg:max-w-none">
                      
                      {/* Primary Featured Luxury Atelier Showcase Card */}
                      <div
                        onClick={() => handleNavigate('studio3d')}
                        className="rounded-3xl overflow-hidden shadow-2xl border-2 border-white/80 relative bg-[#181412] text-white transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(184,93,59,0.25)] cursor-pointer group"
                      >
                        <div className="relative aspect-4/3 overflow-hidden">
                          <img
                            src="/images/hero/luxury_atelier_hero.jpg"
                            alt="Haute Couture Atelier & Premium Fabrics"
                            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#14100E] via-[#14100E]/20 to-transparent pointer-events-none"></div>

                          {/* Top floating pill */}
                          <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>{lang === 'uz' ? 'Jonli Draping & Matolar' : lang === 'ru' ? 'Живой Драпинг и Ткани' : 'Live Drape & Textiles'}</span>
                          </div>
                        </div>

                        <div className="p-5 sm:p-6 bg-[#181412]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] font-semibold">
                                Global Haute Atelier • 19 Weaves
                              </span>
                              <h3 className="font-serif font-bold text-xl text-white mt-1 group-hover:text-[#E89274] transition-colors">
                                {lang === 'uz' ? 'Eksklyuziv Tabiiy Matolar Kolleksiyasi' : lang === 'ru' ? 'Коллекция Эксклюзивных Тканей' : 'Exclusive Natural Fabric Collection'}
                              </h3>
                              <p className="text-xs text-[#D8CFBF] mt-1">
                                {lang === 'uz' ? 'Zig‘ir, Ipak, Merinos Juni, Silliq Paxta & Tvil' : 'Linen, Pure Silk, Merino Wool, Cotton & Twill'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-[#A89D8E] block font-mono uppercase">
                                {lang === 'uz' ? 'Boshlang‘ich:' : 'Starting at:'}
                              </span>
                              <span className="font-bold text-base sm:text-lg text-[#D4AF37]">
                                {currency === 'UZS' ? '138 000 so‘m/m' : '$28.50/m'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-[#E8DFD3]">
                            <span className="flex items-center gap-2 text-white font-medium">
                              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                              <span>{lang === 'uz' ? '3D Studiyada sinab ko‘rish' : lang === 'ru' ? 'Примерить в 3D Студии' : 'Try in 3D Drape Studio'}</span>
                            </span>
                            <div className="flex items-center gap-1 text-[#CF6E4C] font-bold group-hover:translate-x-1.5 transition-transform">
                              <span className="text-[11px] uppercase tracking-wider">{lang === 'uz' ? 'Ochish' : 'Open'}</span>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Micro Floating Badge 1 */}
                      <div className="absolute -bottom-6 -left-3 sm:-left-6 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-xl border border-[#DDD5C7] max-w-[210px] z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8D533B] to-[#5A3324] flex-shrink-0 border border-white flex items-center justify-center text-white text-xs font-serif font-bold shadow-xs">
                            100%
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-[#B85D3B] tracking-wider block">
                              {lang === 'uz' ? 'Tabiiy Tolalar' : 'Pure Fibres'}
                            </span>
                            <span className="font-serif font-bold text-xs text-[#1C1714] block">19 xil To‘plam</span>
                            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>{lang === 'uz' ? 'Real Suratlar' : 'Real Photos'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Micro Floating Badge 2 */}
                      <div className="absolute -top-5 -right-2 sm:-right-5 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-[#DDD5C7] flex items-center gap-3 z-10">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF2EB] text-[#B85D3B] flex items-center justify-center text-sm font-bold">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7A6D5F] block uppercase font-bold">GOTS &amp; OEKO-TEX</span>
                          <span className="font-bold text-xs text-[#1C1714]">
                            {lang === 'uz' ? 'Jahon Standarti' : 'Global Standard'}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Interactive 3D Studio Highlight Banner */}
            <section className="bg-gradient-to-r from-[#171412] via-[#221D19] to-[#171412] text-white py-12 border-b border-[#2C241E]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-[#1C1815]/90 border border-[#3A322A] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#CF6E4C] to-[#E89274] flex items-center justify-center text-white shadow-lg shrink-0">
                      <Sparkles className="w-7 h-7 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase font-bold mb-1">
                        <Sparkle className="w-3.5 h-3.5" />
                        <span>Alohida 3D Maydon</span>
                      </div>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                        {lang === 'uz' ? '3D Kiyinish Xonasi & Virtual Maneken' : lang === 'ru' ? 'Отдельная 3D Студия Манекена' : 'Dedicated 3D Mannequin Atelier'}
                      </h3>
                      <p className="text-xs text-[#A89D91] mt-1 max-w-xl">
                        {lang === 'uz'
                          ? '11 xil kutyur fasonlari, 360° burish, shamol tebranishi va yorug‘lik simulyatsiyasi alohida qulay sahifaga ajratildi.'
                          : '11 bespoke garment silhouettes, 360° orbit, and wind physics are now in a dedicated high-performance studio page.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleNavigate('studio3d')}
                    className="px-6 py-3.5 rounded-2xl bg-[#CF6E4C] hover:bg-[#B85D3B] text-white font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 shrink-0 cursor-pointer group"
                  >
                    <span>{lang === 'uz' ? '3D Studiyaga Kirish' : lang === 'ru' ? 'Войти в 3D Студию' : 'Enter 3D Studio'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </section>

            {/* Embedded Fabric Catalog on Home Page */}
            <FabricCatalog
              fabrics={FABRICS}
              onSelectFabricForStudio={(fabric, color) => open3DStudioWithFabric(fabric, color)}
              onOpenProductDetail={(fabric) => setDetailModalFabric(fabric)}
              currency={currency}
              unit={unit}
              lang={lang}
              onOpenVisualSearch={() => setIsCameraSearchOpen(true)}
            />

            {/* Zero-Waste Calculator Section on Home Page */}
            <div id="calculator" className="bg-[#FAF7F2] py-12 border-t border-[#E3DBD0]">
              <ZeroWasteCalculator
                garments={GARMENTS}
                fabrics={FABRICS}
                selectedFabric={selectedFabric}
                onOpenStudioWithGarment={(garment) => open3DStudioWithFabric(undefined, undefined, garment)}
                unit={unit}
                lang={lang}
              />
            </div>

            {/* International Standards Section */}
            <div className="bg-[#FAF7F2] pb-12">
              <InternationalStandardsBanner lang={lang} unit={unit} />
            </div>
          </>
        )}

      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        fabric={detailModalFabric}
        onClose={() => setDetailModalFabric(null)}
        onAddToCart={handleAddToCart}
        onOpen3DStudio={(fabric, color) => open3DStudioWithFabric(fabric, color)}
        currency={currency}
        unit={unit}
        lang={lang}
      />

      {/* Auth Modal (Kirish / Sign In / Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showToast(
            lang === 'uz'
              ? `Xush kelibsiz, ${user.name}!`
              : lang === 'ru'
              ? `Добро пожаловать, ${user.name}!`
              : `Welcome back, ${user.name}!`
          );
        }}
        lang={lang}
      />

      {/* User Profile Modal (Saved measurements & orders) */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            showToast(
              lang === 'uz'
                ? 'O‘lchamlaringiz yangilandi!'
                : lang === 'ru'
                ? 'Мерки сохранены!'
                : 'Measurements updated!'
            );
          }}
          onLogout={handleLogout}
          lang={lang}
          unit={unit}
        />
      )}

      {/* Visual Camera & Photo Search Modal */}
      <CameraSearchModal
        isOpen={isCameraSearchOpen}
        onClose={() => setIsCameraSearchOpen(false)}
        fabrics={FABRICS}
        garments={GARMENTS}
        lang={lang}
        currency={currency}
        onSelectForStudio={(fabric, color, garment) => {
          open3DStudioWithFabric(fabric, color, garment);
          setIsCameraSearchOpen(false);
        }}
        onOpenProductDetail={(fabric) => setDetailModalFabric(fabric)}
        onAddToCart={handleAddToCart}
      />

      {/* Shopping Bag Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        currentUser={currentUser}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        currency={currency}
        unit={unit}
        lang={lang}
        onShowToast={showToast}
      />

      {/* Toast Notification Box */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          <div className="bg-[#1C1714] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#3A322A] flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#B85D3B] flex items-center justify-center text-xs">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Global Atelier Footer */}
      <footer className="bg-[#14110F] text-[#938575] text-xs pt-16 pb-12 border-t border-[#29221D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-[#29221D]">
            
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-serif font-bold text-2xl text-white">matos</span>
                <span className="text-[9px] tracking-widest uppercase text-[#B85D3B] font-bold">
                  haute atelier
                </span>
              </div>
              <p className="text-xs text-[#8C7E6F] leading-relaxed mb-4">
                {lang === 'uz'
                  ? 'Raqamli moda, 3D sun’iy intellekt drape studiyasi va xalqaro tabiiy matolar ekotizimi.'
                  : lang === 'ru'
                  ? 'Цифровая мода, 3D ателье драпировки и экосистема натуральных премиальных тканей.'
                  : 'Digital couture engineering, 3D drape visualization, and international certified natural fabrics.'}
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">
                {lang === 'uz' ? 'To‘plamlar' : lang === 'ru' ? 'Коллекции' : 'Curated Weaves'}
              </h4>
              <ul className="space-y-2 text-[#8C7E6F]">
                <li>The Fabric Store Washed Flax Linen</li>
                <li>GOTS Certified Organic Linen (6 Colors)</li>
                <li>Heavyweight Architectural 295 GSM</li>
                <li>Margilan UNESCO Silk &amp; Adras</li>
                <li>TFS Deadstock Silk Crepe de Chine</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">
                {lang === 'uz' ? 'Sahifalar' : lang === 'ru' ? 'Разделы' : 'Navigation'}
              </h4>
              <ul className="space-y-2 text-[#8C7E6F]">
                <li><button onClick={() => handleNavigate('home')} className="hover:text-white transition cursor-pointer">Bosh Sahifa</button></li>
                <li><button onClick={() => handleNavigate('catalog')} className="hover:text-white transition cursor-pointer">Matolar Katalogi (19 xil to‘qima)</button></li>
                <li><button onClick={() => handleNavigate('studio3d')} className="hover:text-white transition cursor-pointer">3D Virtual Maneken Studiyasi</button></li>
                <li><button onClick={() => handleNavigate('tailors')} className="hover:text-white transition cursor-pointer">Tikuvchilar Bazasi</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">
                {lang === 'uz' ? 'Aloqa & Xizmat' : lang === 'ru' ? 'Контакты' : 'Contact & Atelier'}
              </h4>
              <p className="mb-2 text-[#8C7E6F]">Toshkent sh., Chilonzor • Atelier Showroom</p>
              <p className="mb-2 text-[#8C7E6F]">+998 (71) 200-88-44</p>
              <p className="text-[#8C7E6F]">atelier@matosfabrics.com</p>
            </div>

          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[#6D6255] text-[11px] gap-3">
            <span>© 2026 matos haute textiles. Barcha huquqlar himoyalangan.</span>
            <span>GOTS • OEKO-TEX Standard 100 • European Flax® • UNESCO Heritage</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
