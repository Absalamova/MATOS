import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, User as UserIcon, LogOut, Camera } from 'lucide-react';
import { Language, Currency, UnitSystem, User } from '../types';

interface HeaderProps {
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
  currency: Currency;
  onSelectCurrency: (currency: Currency) => void;
  unit: UnitSystem;
  onToggleUnit: () => void;
  cartCount: number;
  onOpenCart: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  activeSection?: 'home' | 'catalog' | 'studio3d' | 'tailors';
  onNavigate?: (section: 'home' | 'catalog' | 'studio3d' | 'tailors') => void;
  onOpenVisualSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLang,
  onSelectLang,
  currency,
  onSelectCurrency,
  unit,
  onToggleUnit,
  cartCount,
  onOpenCart,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  activeSection = 'home',
  onNavigate,
  onOpenVisualSearch,
}) => {
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const flagMap: Record<Language, string> = {
    uz: '🇺🇿',
    ru: '🇷🇺',
    en: '🇬🇧',
  };

  return (
    <>
      {/* Main Top Bar */}
      <header className="sticky top-0 z-40 bg-[#F9F7F2]/95 backdrop-blur-md border-b border-[#E6DFD3] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-3 group text-left cursor-pointer bg-transparent border-0 p-0"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1C1714] flex items-center justify-center text-[#F9F7F2] font-serif font-black text-xl group-hover:bg-[#B85D3B] transition-all duration-300 shadow-xs">
              m
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-extrabold text-2xl tracking-tight text-[#1C1714] leading-none group-hover:text-[#B85D3B] transition">
                matos
              </span>
              <span className="text-[9px] tracking-[0.28em] uppercase font-bold text-[#B85D3B] mt-0.5">
                haute fabrics
              </span>
            </div>
          </button>

          {/* Zone 2: Clean Typography Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8 text-xs font-bold uppercase tracking-wider text-[#4A3F35]">
            <button
              onClick={() => onNavigate?.('home')}
              className={`transition py-1 cursor-pointer ${
                activeSection === 'home'
                  ? 'text-[#B85D3B] border-b-2 border-[#B85D3B] font-extrabold'
                  : 'hover:text-[#B85D3B]'
              }`}
            >
              {currentLang === 'uz' ? 'Bosh Sahifa' : currentLang === 'ru' ? 'Главная' : 'Home'}
            </button>
            <button
              onClick={() => onNavigate?.('catalog')}
              className={`transition py-1 cursor-pointer ${
                activeSection === 'catalog'
                  ? 'text-[#B85D3B] border-b-2 border-[#B85D3B] font-extrabold'
                  : 'hover:text-[#B85D3B]'
              }`}
            >
              {currentLang === 'uz' ? 'Matolar Katalogi' : currentLang === 'ru' ? 'Каталог Тканей' : 'Fabric Catalog'}
            </button>
            <button
              onClick={() => onNavigate?.('studio3d')}
              className={`transition py-1 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'studio3d'
                  ? 'text-[#B85D3B] border-b-2 border-[#B85D3B] font-extrabold'
                  : 'hover:text-[#B85D3B]'
              }`}
            >
              <span>{currentLang === 'uz' ? '3D Drape Studiyasi' : currentLang === 'ru' ? '3D Ателье Студия' : '3D Drape Studio'}</span>
              <span className="bg-[#B85D3B] text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold">3D</span>
            </button>
            <button
              onClick={() => onNavigate?.('tailors')}
              className={`transition py-1 cursor-pointer ${
                activeSection === 'tailors'
                  ? 'text-[#B85D3B] border-b-2 border-[#B85D3B] font-extrabold'
                  : 'hover:text-[#B85D3B]'
              }`}
            >
              {currentLang === 'uz' ? 'Tikuvchilar Bazasi' : currentLang === 'ru' ? 'База Портных' : 'Bespoke Tailors'}
            </button>
          </nav>

          {/* Zone 3: Primary Actions: Camera Search, Flag-Only Language Selector, Kirish / User, Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Visual Camera Search Trigger Button */}
            {onOpenVisualSearch && (
              <button
                onClick={onOpenVisualSearch}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DDD5C7] hover:border-[#B85D3B] text-xs font-bold text-[#1C1714] transition shadow-xs cursor-pointer group"
                title={currentLang === 'uz' ? 'Kamera & Rasm orqali qidirish' : 'Visual Camera Search'}
              >
                <Camera className="w-4 h-4 text-[#B85D3B] group-hover:scale-110 transition" />
                <span className="hidden xl:inline text-[#65594C] group-hover:text-[#1C1714]">
                  {currentLang === 'uz' ? 'Rasm orqali' : currentLang === 'ru' ? 'Поиск по фото' : 'Camera Search'}
                </span>
              </button>
            )}

            {/* Flag & Currency Language Switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="h-10 px-2.5 rounded-xl bg-white border border-[#DDD5C7] flex items-center gap-1.5 text-base hover:border-[#B85D3B] transition shadow-xs cursor-pointer"
                title="Til & Valyuta / Language & Currency"
                aria-label="Language selector"
              >
                <span>{flagMap[currentLang]}</span>
                <span className="font-mono text-xs font-bold text-[#65594C] uppercase">{currentLang}</span>
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-[#DDD5C7] py-2 z-50 flex flex-col gap-1">
                  {(['uz', 'ru', 'en'] as Language[]).map((code) => {
                    const currLabel = code === 'en' ? 'USD ($)' : "So'm (UZS)";
                    const langLabel = code === 'uz' ? "O'zbek" : code === 'ru' ? 'Русский' : 'English';
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          onSelectLang(code);
                          setLangMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition cursor-pointer ${
                          currentLang === code ? 'bg-[#F4EFEB] font-bold text-[#1C1714]' : 'text-[#65594C] hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{flagMap[code]}</span>
                          <span className="font-medium text-[#1C1714]">{langLabel}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#B85D3B] font-bold bg-[#FAF2EB] px-1.5 py-0.5 rounded">
                          {currLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kirish / Sign In Button or User Dropdown */}
            {currentUser ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DDD5C7] hover:border-[#B85D3B] text-xs font-bold text-[#1C1714] transition shadow-xs"
                >
                  <span className="w-6 h-6 rounded-full bg-[#B85D3B] text-white flex items-center justify-center text-[10px]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[100px]">{currentUser.name.split(' ')[0]}</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-[#DDD5C7] p-2 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-[#EFE9DF] mb-1">
                      <div className="font-bold text-[#1C1714] truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-[#86786A] truncate">{currentUser.identifier}</div>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F6F2EC] text-[#3E342B] font-medium transition"
                    >
                      {currentLang === 'uz' ? 'Shaxsiy Kabinet & O‘lchamlar' : currentLang === 'ru' ? 'Личный кабинет и мерки' : 'Profile & Measurements'}
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-700 font-medium transition flex items-center gap-2 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{currentLang === 'uz' ? 'Chiqish' : currentLang === 'ru' ? 'Выйти' : 'Sign Out'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#DDD5C7] hover:border-[#B85D3B] text-xs font-bold text-[#1C1714] transition shadow-xs"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#B85D3B]" />
                <span>{currentLang === 'uz' ? 'Kirish' : currentLang === 'ru' ? 'Войти' : 'Sign In'}</span>
              </button>
            )}

            {/* Shopping Bag Drawer Button */}
            <button
              onClick={onOpenCart}
              className="relative flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-[#1C1714] text-white hover:bg-[#B85D3B] transition shadow-sm"
              title="Xaridingiz savati"
            >
              <ShoppingBag className="w-4 h-4 text-[#D8CFBF]" />
              <span className="hidden sm:inline font-bold text-xs">
                {currentLang === 'uz' ? 'Savat' : currentLang === 'ru' ? 'Корзина' : 'Bag'}
              </span>
              <span className="bg-[#B85D3B] text-white text-[11px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            </button>

          </div>
        </div>
      </header>
    </>
  );
};
