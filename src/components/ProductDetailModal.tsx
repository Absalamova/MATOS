import React, { useState } from 'react';
import { Fabric, ColorOption, Currency, UnitSystem, Language } from '../types';
import { X, Check, Sparkles, ShoppingBag, ShieldCheck } from 'lucide-react';

interface ProductDetailModalProps {
  fabric: Fabric | null;
  onClose: () => void;
  onAddToCart: (fabric: Fabric, color: ColorOption, meters: number) => void;
  onOpen3DStudio: (fabric: Fabric, color: ColorOption) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  fabric,
  onClose,
  onAddToCart,
  onOpen3DStudio,
  currency,
  unit,
  lang,
}) => {
  if (!fabric) return null;

  const [selectedColor, setSelectedColor] = useState<ColorOption>(fabric.colors[0]);
  const [selectedMeters, setSelectedMeters] = useState<number>(2.0);

  const price = currency === 'UZS' ? fabric.priceUZS : currency === 'USD' ? fabric.priceUSD : fabric.priceEUR;
  const subtotal = Math.round(price * selectedMeters * 10) / 10;

  const formatPrice = (val: number) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(val)} so‘m`;
    if (currency === 'USD') return `$${val.toFixed(2)}`;
    return `€${val.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-[#DDD5C7] overflow-hidden flex flex-col md:flex-row relative max-h-[94vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 shadow text-[#4E4135] hover:text-[#1C1714] flex items-center justify-center transition border border-[#DDD5C7]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Hero Textile Texture Stage */}
        <div className={`md:w-1/2 ${fabric.cssClass} flex flex-col relative border-r border-[#E3DBD0] min-h-[300px] md:min-h-[480px] p-8 justify-between`}>
          <div className="drape-fold-overlay absolute inset-0 opacity-45 pointer-events-none"></div>

          {/* Top Texture Badge */}
          <div className="relative z-10 flex justify-between items-start">
            <span className="bg-black/60 backdrop-blur-md text-white text-xs font-mono px-3 py-1.5 rounded-xl border border-white/20">
              {fabric.gsm} GSM • {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`}
            </span>
            <span
              className="w-6 h-6 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: selectedColor.hex }}
            ></span>
          </div>

          {/* Central Architectural Texture Info */}
          <div className="relative z-10 bg-black/60 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-white shadow-xl text-center max-w-[280px] mx-auto">
            <h3 className="font-serif font-bold text-lg">{selectedColor.name[lang]}</h3>
            <span className="text-xs text-[#D8CFBF] font-mono block mt-1">{fabric.origin}</span>
            <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-[#C4B9AD] flex justify-around font-mono">
              <span>Drape: {fabric.drapeFactor}/10</span>
              <span>•</span>
              <span>Shrink: -{fabric.shrinkageRate}%</span>
            </div>
          </div>

          {/* Bottom Certifications Ribbon */}
          <div className="relative z-10 flex flex-wrap gap-1.5 justify-center">
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
            <span className="text-xs font-bold text-[#B85D3B] uppercase tracking-widest font-mono">
              {fabric.categoryLabel[lang]}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1714] mt-1">
              {fabric.name}
            </h2>
            <p className="text-xs text-[#7A6D5F] font-medium mt-1">
              {fabric.origin} • {fabric.composition[lang]}
            </p>
          </div>

          {/* Color Switcher */}
          <div className="mb-5 pt-3 border-t border-[#F2ECE3]">
            <label className="block text-xs font-bold text-[#3B322A] mb-2">
              {lang === 'uz' ? 'Rang tanlovi (Colorways):' : lang === 'ru' ? 'Выберите цвет:' : 'Color Selection:'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {fabric.colors.map((c) => {
                const isActive = selectedColor.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedColor(c)}
                    className={`p-2 rounded-xl border text-left transition flex flex-col items-center gap-1 ${
                      isActive ? 'border-[#B85D3B] bg-[#FAF5F0] ring-1 ring-[#B85D3B]' : 'border-[#DDD5C7] hover:border-[#998C7F]'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border border-black/10 flex items-center justify-center" style={{ backgroundColor: c.hex }}>
                      {isActive && <Check className="w-3 h-3 text-white drop-shadow" />}
                    </span>
                    <span className="text-[10px] text-[#4E4135] truncate max-w-full text-center">
                      {c.name[lang].split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fabric Specifications */}
          <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-[#F2ECE3] mb-4">
            <div className="bg-[#FAF7F2] p-2.5 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-[#887A6D] block">Vazn / Zichlik</span>
              <span className="font-bold text-[#1C1714]">{fabric.gsm} g/m² ({fabric.ozPerSqYd} oz/yd²)</span>
            </div>
            <div className="bg-[#FAF7F2] p-2.5 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-[#887A6D] block">Mato Eni</span>
              <span className="font-bold text-[#1C1714]">
                {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches} inches`}
              </span>
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
              <span className="font-serif font-bold text-sm text-[#B85D3B]">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedMeters((m) => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                className="w-10 h-10 rounded-xl bg-white border border-[#DDD5C7] font-bold text-base hover:bg-[#F2ECE3] transition flex items-center justify-center"
              >
                -
              </button>
              <div className="flex-grow bg-white border border-[#DDD5C7] rounded-xl py-2 text-center">
                <span className="font-mono font-bold text-base text-[#1C1714]">{selectedMeters.toFixed(1)}</span>
                <span className="text-xs text-[#887A6D] ml-1">{unit === 'metric' ? 'metr' : 'yard'}</span>
              </div>
              <button
                onClick={() => setSelectedMeters((m) => Math.round((m + 0.5) * 10) / 10)}
                className="w-10 h-10 rounded-xl bg-white border border-[#DDD5C7] font-bold text-base hover:bg-[#F2ECE3] transition flex items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <button onClick={() => setSelectedMeters(1.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B]">
                1.5 {unit === 'metric' ? 'm' : 'yd'} (Top/Ko‘ylak)
              </button>
              <button onClick={() => setSelectedMeters(2.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B]">
                2.5 {unit === 'metric' ? 'm' : 'yd'} (Shim/Libos)
              </button>
              <button onClick={() => setSelectedMeters(3.5)} className="py-1.5 px-2 bg-white rounded-lg border border-[#DDD5C7] text-[11px] font-medium text-[#5D5043] hover:border-[#B85D3B]">
                3.5 {unit === 'metric' ? 'm' : 'yd'} (Trench/Palto)
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
              className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{lang === 'uz' ? 'Savatga qo‘shish' : lang === 'ru' ? 'Добавить в корзину' : 'Add to Shopping Bag'}</span>
            </button>

            <button
              onClick={() => {
                onOpen3DStudio(fabric, selectedColor);
                onClose();
              }}
              className="w-full bg-[#FAF5F0] hover:bg-[#F2E8DC] border border-[#DDD5C7] text-[#B85D3B] font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>{lang === 'uz' ? '3D Manekenda sinash' : lang === 'ru' ? 'Примерить на 3D манекене' : 'Preview in 3D Atelier'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
