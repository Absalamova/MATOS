import React, { useState, useEffect } from 'react';
import { Fabric, ColorOption, Currency, UnitSystem, Language } from '../types';
import { X, Check, Sparkles, ShoppingBag, ShieldCheck, Image as ImageIcon, Sparkle, ArrowRight } from 'lucide-react';

interface ProductDetailModalProps {
  fabric: Fabric | null;
  initialColor?: ColorOption | null;
  onClose: () => void;
  onAddToCart: (fabric: Fabric, color: ColorOption, meters: number) => void;
  onOpen3DStudio: (fabric: Fabric, color: ColorOption) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
}

type PhotoTab = 'swatch' | 'hang' | 'roll' | 'ruler';

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  fabric,
  initialColor,
  onClose,
  onAddToCart,
  onOpen3DStudio,
  currency,
  unit,
  lang,
}) => {
  if (!fabric) return null;

  const [selectedColor, setSelectedColor] = useState<ColorOption>(initialColor || fabric.colors[0]);
  const [selectedMeters, setSelectedMeters] = useState<number>(2.0);
  const [activePhotoTab, setActivePhotoTab] = useState<PhotoTab>('swatch');

  useEffect(() => {
    if (initialColor) {
      setSelectedColor(initialColor);
    } else if (fabric) {
      setSelectedColor(fabric.colors[0]);
    }
  }, [fabric, initialColor]);

  const price = currency === 'UZS' ? fabric.priceUZS : currency === 'USD' ? fabric.priceUSD : fabric.priceEUR;
  const subtotal = Math.round(price * selectedMeters * 10) / 10;

  const formatPrice = (val: number) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(val)} so‘m`;
    if (currency === 'USD') return `$${val.toFixed(2)}`;
    return `€${val.toFixed(2)}`;
  };

  // Resolve active photo based on selected color variant and photo tab (Uzum Market style)
  const currentPhotoUrl = (() => {
    if (activePhotoTab === 'hang') {
      return selectedColor.hangImage || fabric.images?.hang || selectedColor.image || fabric.featuredImage;
    }
    if (activePhotoTab === 'roll') {
      return selectedColor.rollImage || fabric.images?.roll || selectedColor.image;
    }
    if (activePhotoTab === 'ruler') {
      return selectedColor.rulerImage || fabric.images?.ruler || selectedColor.image;
    }
    // Default 'swatch'
    return selectedColor.image || fabric.featuredImage || fabric.images?.swatch || selectedColor.hangImage;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-[#DDD5C7] overflow-hidden flex flex-col md:flex-row relative max-h-[94vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-white/95 shadow-md text-[#4E4135] hover:text-[#1C1714] flex items-center justify-center transition border border-[#DDD5C7] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Hero Textile Photo Stage */}
        <div className="md:w-1/2 flex flex-col relative border-r border-[#E3DBD0] min-h-[360px] md:min-h-[520px] justify-between bg-[#151311] overflow-hidden">
          
          {/* Main Photo Display with Color & Angle Preview */}
          <div className="relative w-full flex-grow flex items-center justify-center overflow-hidden min-h-[280px]">
            {currentPhotoUrl ? (
              <div className="relative w-full h-full min-h-[320px] max-h-[440px] flex items-center justify-center bg-[#151311]">
                <img
                  key={currentPhotoUrl}
                  src={currentPhotoUrl}
                  alt={`${fabric.name} - ${selectedColor.name[lang]}`}
                  className="w-full h-full object-cover object-center transition-all duration-300 animate-fadeIn"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none"></div>
              </div>
            ) : (
              <div className={`w-full h-full min-h-[320px] ${fabric.cssClass} flex flex-col justify-between p-8 relative`}>
                <div className="drape-fold-overlay absolute inset-0 opacity-45 pointer-events-none"></div>
                <div className="relative z-10 text-white">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">Procedural Weave Canvas</span>
                  <h3 className="font-serif text-2xl font-bold mt-1">{fabric.name}</h3>
                </div>
              </div>
            )}

            {/* Top Texture Badge */}
            <div className="absolute top-4 left-4 z-20 flex justify-between items-start right-4 pointer-events-none">
              <span className="bg-black/75 backdrop-blur-md text-white text-xs font-mono px-3 py-1.5 rounded-xl border border-white/20">
                {fabric.gsm} GSM • {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`}
              </span>
              <span
                className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: selectedColor.hex }}
                title={selectedColor.name[lang]}
              ></span>
            </div>

            {/* Bottom Photo Angle Tabs */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20">
              <button
                onClick={() => setActivePhotoTab('swatch')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer ${
                  activePhotoTab === 'swatch' ? 'bg-[#B85D3B] text-white' : 'text-[#DDD5C7] hover:text-white'
                }`}
              >
                {lang === 'uz' ? 'Mato Yuzi' : lang === 'ru' ? 'Текстура' : 'Macro'}
              </button>
              <button
                onClick={() => setActivePhotoTab('hang')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer ${
                  activePhotoTab === 'hang' ? 'bg-[#B85D3B] text-white' : 'text-[#DDD5C7] hover:text-white'
                }`}
              >
                {lang === 'uz' ? 'To‘kilishi' : lang === 'ru' ? 'Драпировка' : 'Drape'}
              </button>
              <button
                onClick={() => setActivePhotoTab('roll')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer ${
                  activePhotoTab === 'roll' ? 'bg-[#B85D3B] text-white' : 'text-[#DDD5C7] hover:text-white'
                }`}
              >
                {lang === 'uz' ? 'Rulon' : lang === 'ru' ? 'Рулон' : 'Roll'}
              </button>
              <button
                onClick={() => setActivePhotoTab('ruler')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer ${
                  activePhotoTab === 'ruler' ? 'bg-[#B85D3B] text-white' : 'text-[#DDD5C7] hover:text-white'
                }`}
              >
                {lang === 'uz' ? 'Masshtab' : lang === 'ru' ? 'Линейка' : 'Scale'}
              </button>
            </div>
          </div>

          {/* Certifications Ribbon */}
          <div className="p-4 bg-[#1C1815] border-t border-[#2C241E] flex flex-wrap gap-1.5 justify-center">
            {fabric.certifications.map((cert) => (
              <span key={cert} className="bg-black/70 backdrop-blur-md text-[#E8DFD3] text-[10px] px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                <span>{cert}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right Product Ordering Controls */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col overflow-y-auto">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#B85D3B] mb-1">
              <Sparkle className="w-3.5 h-3.5" />
              <span>{fabric.categoryLabel[lang]}</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1714]">
              {fabric.name}
            </h2>
            <p className="text-xs text-[#7A6D5F] font-medium mt-1">
              {fabric.origin} • {fabric.composition[lang]}
            </p>
          </div>

          {/* Color Switcher - Changes photo and details instantly (Uzum Market style) */}
          <div className="mb-5 pt-3 border-t border-[#F2ECE3]">
            <div className="flex items-center justify-between text-xs font-bold text-[#3B322A] mb-2">
              <span>{lang === 'uz' ? 'Rang tanlovi (Variantlar):' : lang === 'ru' ? 'Выберите цвет:' : 'Colorway Selection:'}</span>
              <span className="text-[#B85D3B] font-mono text-[11px] font-bold">{selectedColor.name[lang]}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fabric.colors.map((c) => {
                const isActive = selectedColor.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedColor(c)}
                    className={`p-2 rounded-xl border text-left transition flex flex-col items-center gap-1 cursor-pointer ${
                      isActive ? 'border-[#B85D3B] bg-[#FAF5F0] ring-2 ring-[#B85D3B]/40' : 'border-[#DDD5C7] hover:border-[#998C7F] bg-white'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full border border-black/10 flex items-center justify-center shadow-xs" style={{ backgroundColor: c.hex }}>
                      {isActive && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </span>
                    <span className="text-[10px] text-[#4E4135] truncate max-w-full text-center font-medium">
                      {c.name[lang].split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fabric Specifications */}
          <div className="grid grid-cols-3 gap-2 text-xs py-3 border-y border-[#F2ECE3] mb-4">
            <div className="bg-[#FAF7F2] p-2.5 rounded-xl text-center">
              <span className="text-[10px] font-mono uppercase text-[#887A6D] block">Vazn</span>
              <span className="font-bold text-[#1C1714] text-xs">{fabric.gsm} gsm</span>
            </div>
            <div className="bg-[#FAF7F2] p-2.5 rounded-xl text-center">
              <span className="text-[10px] font-mono uppercase text-[#887A6D] block">Eni</span>
              <span className="font-bold text-[#1C1714] text-xs">
                {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`}
              </span>
            </div>
            <div className="bg-[#FAF7F2] p-2.5 rounded-xl text-center">
              <span className="text-[10px] font-mono uppercase text-[#887A6D] block">Drape</span>
              <span className="font-bold text-[#B85D3B] text-xs">{fabric.drapeFactor} / 10</span>
            </div>
          </div>

          <p className="text-xs text-[#5D5043] leading-relaxed mb-5">
            {fabric.description[lang]}
          </p>

          {/* Meterage Adjustment */}
          <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E3DBD0] mb-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-[#1C1714]">
                {lang === 'uz' ? 'Buyurtma metraji:' : lang === 'ru' ? 'Необходимый метраж:' : 'Required Yardage:'}
              </span>
              <span className="font-serif font-bold text-base text-[#B85D3B]">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedMeters((m) => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                className="w-10 h-10 rounded-xl bg-white border border-[#DDD5C7] font-bold text-base hover:bg-[#F2ECE3] transition flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <div className="flex-grow bg-white border border-[#DDD5C7] rounded-xl py-2 text-center">
                <span className="font-mono font-bold text-base text-[#1C1714]">{selectedMeters.toFixed(1)}</span>
                <span className="text-xs text-[#887A6D] ml-1">{unit === 'metric' ? 'metr' : 'yard'}</span>
              </div>
              <button
                onClick={() => setSelectedMeters((m) => Math.round((m + 0.5) * 10) / 10)}
                className="w-10 h-10 rounded-xl bg-white border border-[#DDD5C7] font-bold text-base hover:bg-[#F2ECE3] transition flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <button onClick={() => setSelectedMeters(1.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B] cursor-pointer">
                1.5 {unit === 'metric' ? 'm' : 'yd'} (Top)
              </button>
              <button onClick={() => setSelectedMeters(2.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B] cursor-pointer">
                2.5 {unit === 'metric' ? 'm' : 'yd'} (Libos)
              </button>
              <button onClick={() => setSelectedMeters(3.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B] cursor-pointer">
                3.5 {unit === 'metric' ? 'm' : 'yd'} (Palto)
              </button>
            </div>
          </div>

          {/* Action CTAs: 3D Drape & Add to Bag */}
          <div className="mt-auto space-y-2">
            <button
              onClick={() => {
                onAddToCart(fabric, selectedColor, selectedMeters);
                onClose();
              }}
              className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{lang === 'uz' ? 'Savatga qo‘shish' : lang === 'ru' ? 'Добавить в корзину' : 'Add to Shopping Bag'}</span>
            </button>

            <button
              onClick={() => {
                onOpen3DStudio(fabric, selectedColor);
                onClose();
              }}
              className="w-full bg-[#FAF5F0] hover:bg-[#F2E8DC] border border-[#DDD5C7] text-[#B85D3B] font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>{lang === 'uz' ? '3D Manekenda kiyintirish' : lang === 'ru' ? 'Примерить на 3D манекене' : 'Preview in 3D Atelier'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
