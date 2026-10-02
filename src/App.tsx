import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Mannequin3DStudio } from './components/Mannequin3DStudio';
import { FabricCatalog } from './components/FabricCatalog';
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
import { Sparkles, ArrowRight, Check, Scissors, Layers, ShieldCheck, UserCheck, Camera } from 'lucide-react';

export default function App() {
  // Navigation & Page State
  const [currentView, setCurrentView] = useState<'atelier' | 'tailors'>('atelier');
  const [studioTab, setStudioTab] = useState<'3d' | 'calculator' | 'standards'>('3d');

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

  const scrollToStudio = (fabric?: Fabric, color?: ColorOption, garment?: GarmentSilhouette) => {
    setCurrentView('atelier');
    setStudioTab('3d');
    if (fabric) setSelectedFabric(fabric);
    if (color) setSelectedColor(color);
    if (garment) setSelectedGarment(garment);

    setTimeout(() => {
      const el = document.getElementById('studio3d');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleNavigate = (section: 'catalog' | 'studio3d' | 'tailors') => {
    if (section === 'tailors') {
      setCurrentView('tailors');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setCurrentView('atelier');
      if (section === 'studio3d') {
        setStudioTab('3d');
      }
      setTimeout(() => {
        const el = document.getElementById(section === 'studio3d' ? 'studio3d' : 'catalog');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F7F2] text-[#1E1915]">
      
      {/* Universal Header with Top Bar Contract compliance */}
      <Header
        currentLang={lang}
        onSelectLang={(l) => setLang(l)}
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
        activeSection={currentView === 'tailors' ? 'tailors' : 'catalog'}
        onNavigate={handleNavigate}
        onOpenVisualSearch={() => setIsCameraSearchOpen(true)}
      />

      <main className="flex-grow">
        {currentView === 'tailors' ? (
          <TailorsDirectory
            lang={lang}
            currency={currency}
            onShowToast={showToast}
            onBackToAtelier={() => setCurrentView('atelier')}
          />
        ) : (
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
                    ? 'Har bir tolada tabiiylik va oliy san’at. Libos tikishdan avval matoni virtual 3D manekenda sinab ko‘ring, isrofsiz aniq bichim hisoblagichidan foydalaning va to‘qimani uyingizga bepul namuna qilib buyurtma bering.'
                    : lang === 'ru'
                    ? 'Натуральность и высшее мастерство в каждой нити. Примерьте ткань на реалистичном 3D манекене перед раскроем, рассчитайте точный метраж без отходов и закажите бесплатные образцы.'
                    : 'Tactile authenticity in every single weave. Test fluid drape behavior on our sculptural 3D mannequin before cutting, eliminate fabric scraps with zero-waste algorithms, and request doorstep swatches.'}
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <a
                    href="#studio3d"
                    className="px-6 py-3.5 rounded-2xl bg-[#1C1714] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#B85D3B] transition-all shadow-lg flex items-center gap-2.5 group cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#D4AF37] group-hover:rotate-12 transition-transform" />
                    <span>{lang === 'uz' ? '3D Drape Studiyani Ochish' : lang === 'ru' ? 'Открыть 3D Drape Студию' : 'Open 3D Drape Atelier'}</span>
                  </a>

                  <button
                    onClick={() => setIsCameraSearchOpen(true)}
                    className="px-6 py-3.5 rounded-2xl bg-[#B85D3B] hover:bg-[#9E4D2F] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2.5 cursor-pointer group"
                  >
                    <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>{lang === 'uz' ? 'Kamera & Rasm Orqali Qidirish' : lang === 'ru' ? 'Поиск по Фото / Камере' : 'Camera & Photo Search'}</span>
                  </button>

                  <a
                    href="#catalog"
                    className="px-6 py-3.5 rounded-2xl bg-white border border-[#DDD5C7] text-[#1C1714] font-bold text-xs uppercase tracking-wider hover:bg-[#F2ECE3] transition shadow-2xs flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-[#7A6D5F]" />
                    <span>{lang === 'uz' ? 'Matolar Katalogi' : lang === 'ru' ? 'Коллекция Тканей' : 'Explore Catalog'}</span>
                  </a>

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
                    <span className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1714] block">100%</span>
                    <span className="text-[11px] sm:text-xs text-[#7A6D5F]">
                      {lang === 'uz' ? 'GOTS & OEKO-TEX Sertifikatlangan' : lang === 'ru' ? 'Сертифицированная органика' : 'Certified Natural Flax & Silk'}
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
                  
                  {/* Primary Featured Card */}
                  <div
                    onClick={() => scrollToStudio(FABRICS[0], FABRICS[0].colors[0])}
                    className="rounded-3xl overflow-hidden shadow-2xl border-2 border-white relative weave-cinnamon p-6 text-white transition-all duration-500 hover:scale-[1.02] cursor-pointer group"
                  >
                    <div className="drape-fold-overlay absolute inset-0 opacity-45"></div>
                    <div className="relative z-10 flex justify-between items-start mb-24 sm:mb-28">
                      <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 border border-white/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>215 GSM • Enzyme Softened</span>
                      </div>
                      <span className="w-7 h-7 rounded-full bg-[#8D533B] border-2 border-white shadow-md"></span>
                    </div>

                    <div className="relative z-10 bg-black/65 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#D4AF37]">
                            Belgian Pure Linen
                          </span>
                          <h3 className="font-serif font-bold text-lg text-white">Cinnamon Terracotta</h3>
                          <p className="text-[11px] text-[#D8CFBF] mt-0.5">Yuvilgan sof tola, xushsurat burmalar</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#A89D8E] block font-mono">1 metr:</span>
                          <span className="font-bold text-sm text-[#D4AF37]">135 000 so‘m</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Micro Floating Badge 1 */}
                  <div className="absolute -bottom-6 -left-4 sm:-left-8 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-[#DDD5C7] max-w-[220px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl weave-silk flex-shrink-0 border border-white"></div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-[#B85D3B] tracking-wider block">Marg‘ilon Ipag‘i</span>
                        <span className="font-serif font-bold text-xs text-[#1C1714] block">UNESCO Merosi</span>
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Tabiiy Bo‘yoq</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro Floating Badge 2 */}
                  <div className="absolute -top-5 -right-3 sm:-right-6 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-[#DDD5C7] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF2EB] text-[#B85D3B] flex items-center justify-center text-sm font-bold">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#7A6D5F] block uppercase font-bold">OEKO-TEX 100</span>
                      <span className="font-bold text-xs text-[#1C1714]">Jahon Standarti</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

            {/* Fabric Catalog (Curated from wearethefabricstore.com) */}
            <FabricCatalog
              fabrics={FABRICS}
              onSelectFabricForStudio={(fabric, color) => scrollToStudio(fabric, color)}
              onOpenProductDetail={(fabric) => setDetailModalFabric(fabric)}
              currency={currency}
              unit={unit}
              lang={lang}
              onOpenVisualSearch={() => setIsCameraSearchOpen(true)}
            />

            {/* Unified 3D Atelye & Bichim Studiyasi Section */}
            <div id="studio3d" className="bg-[#141210] border-t border-[#2A2420] pt-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Unified Studio Sub-Tabs Navigation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#2C241F]">
                  <div>
                    <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-widest font-bold block mb-1">
                      {lang === 'uz' ? 'Yagona Atelye Maydoni' : lang === 'ru' ? 'Единая Студия Ателье' : 'Unified Haute Atelier Workspace'}
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-white">
                      {lang === 'uz' ? '3D Atelye Studiyasi' : lang === 'ru' ? '3D Ателье Студия' : '3D Drape & Yardage Studio'}
                    </h2>
                  </div>

                  {/* Sub-Tabs: 3D Mannequin | Zero Waste Calculator | International Standards */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#1C1815] border border-[#302821] self-start md:self-auto flex-wrap">
                    <button
                      onClick={() => setStudioTab('3d')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        studioTab === '3d'
                          ? 'bg-[#CF6E4C] text-white shadow-md'
                          : 'text-[#A89D91] hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'uz' ? '3D Virtual Maneken' : lang === 'ru' ? '3D Манекен' : '3D Drape Studio'}</span>
                    </button>

                    <button
                      onClick={() => setStudioTab('calculator')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        studioTab === 'calculator'
                          ? 'bg-[#CF6E4C] text-white shadow-md'
                          : 'text-[#A89D91] hover:text-white'
                      }`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>{lang === 'uz' ? 'Isrofsiz Bichim Kalkulyatori' : lang === 'ru' ? 'Калькулятор Кроя' : 'Yardage Calculator'}</span>
                    </button>

                    <button
                      onClick={() => setStudioTab('standards')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        studioTab === 'standards'
                          ? 'bg-[#CF6E4C] text-white shadow-md'
                          : 'text-[#A89D91] hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{lang === 'uz' ? 'Xalqaro Standartlar' : lang === 'ru' ? 'Размеры & Стандарты' : 'Global Standards'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Sub-Tab 1: 3D Mannequin Drape Studio */}
              {studioTab === '3d' && (
                <Mannequin3DStudio
                  fabrics={FABRICS}
                  garments={GARMENTS}
                  selectedFabric={selectedFabric}
                  selectedGarment={selectedGarment}
                  selectedColor={selectedColor}
                  onSelectFabric={(f) => setSelectedFabric(f)}
                  onSelectGarment={(g) => setSelectedGarment(g)}
                  onSelectColor={(c) => setSelectedColor(c)}
                  onAddToCart={handleAddToCart}
                  currency={currency}
                  unit={unit}
                  lang={lang}
                />
              )}

              {/* Sub-Tab 2: Zero-Waste Fabric & Sizing Calculator */}
              {studioTab === 'calculator' && (
                <div className="bg-[#FAF7F2] py-8">
                  <ZeroWasteCalculator
                    garments={GARMENTS}
                    fabrics={FABRICS}
                    selectedFabric={selectedFabric}
                    onOpenStudioWithGarment={(garment) => scrollToStudio(undefined, undefined, garment)}
                    unit={unit}
                    lang={lang}
                  />
                </div>
              )}

              {/* Sub-Tab 3: Global Standards & Size Matrix Banner */}
              {studioTab === 'standards' && (
                <div className="bg-[#FAF7F2] py-8">
                  <InternationalStandardsBanner lang={lang} unit={unit} />
                </div>
              )}

            </div>
          </>
        )}
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        fabric={detailModalFabric}
        onClose={() => setDetailModalFabric(null)}
        onAddToCart={handleAddToCart}
        onOpen3DStudio={(fabric, color) => scrollToStudio(fabric, color)}
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
          scrollToStudio(fabric, color, garment);
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
                <li>Belgian Washed Pure Flax Linen</li>
                <li>Normandy Architectural Heavyweight</li>
                <li>Baltic GOTS Certified Organic</li>
                <li>Margilan UNESCO Silk &amp; Adras</li>
                <li>Biella S130 Virgin Wool &amp; Cashmere</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-3">
                {lang === 'uz' ? 'Imkoniyatlar' : lang === 'ru' ? 'Возможности' : 'Atelier Capabilities'}
              </h4>
              <ul className="space-y-2 text-[#8C7E6F]">
                <li><button onClick={() => handleNavigate('studio3d')} className="hover:text-white transition cursor-pointer">Three.js 3D Virtual Mannequin</button></li>
                <li><button onClick={() => handleNavigate('catalog')} className="hover:text-white transition cursor-pointer">The Fabric Store Collections</button></li>
                <li><button onClick={() => handleNavigate('tailors')} className="hover:text-white transition cursor-pointer">Verified Bespoke Tailors Database</button></li>
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
            <span>GOTS • OEKO-TEX Standard 100 • Masters of Linen • UNESCO Heritage</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
