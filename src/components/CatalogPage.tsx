import React from 'react';
import { FabricCatalog } from './FabricCatalog';
import { Fabric, ColorOption, Currency, UnitSystem, Language } from '../types';
import { Sparkles, ArrowLeft, Camera, ShieldCheck, Sparkle } from 'lucide-react';

interface CatalogPageProps {
  fabrics: Fabric[];
  onSelectFabricForStudio: (fabric: Fabric, color: ColorOption) => void;
  onOpenProductDetail: (fabric: Fabric) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
  onOpenVisualSearch: () => void;
  onBackToHome: () => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  fabrics,
  onSelectFabricForStudio,
  onOpenProductDetail,
  currency,
  unit,
  lang,
  onOpenVisualSearch,
  onBackToHome,
}) => {
  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-20">
      
      {/* Page Hero Banner */}
      <div className="bg-gradient-to-b from-[#1C1714] to-[#2A231E] text-white py-12 md:py-16 border-b border-[#3D332B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb & Back */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#D8CFBF] hover:text-white transition cursor-pointer bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'uz' ? 'Bosh sahifaga qaytish' : lang === 'ru' ? 'На главную' : 'Back to Home'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-mono text-[#E8DFD3]">
                {lang === 'uz' ? '19 xil eksklyuziv to‘qimalar' : lang === 'ru' ? '19 эксклюзивных тканей' : '19 Curated Weaves'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85D3B]/20 border border-[#B85D3B]/40 text-[#E89274] text-xs font-mono font-bold">
                <Sparkle className="w-3 h-3" />
                <span>Haute Textile Repository</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                {lang === 'uz' ? 'Matolar Katalogi' : lang === 'ru' ? 'Полный Каталог Тканей' : 'Complete Textile Catalog'}
              </h1>
              <p className="text-xs sm:text-sm text-[#D8CFBF] max-w-2xl leading-relaxed">
                {lang === 'uz'
                  ? 'wearethefabricstore.com kolleksiyasi va Marg‘ilon tabiiy ipaklari. Har bir matoning aniq zichligi (GSM), eni, to‘kiluvchanlik indeksi va fotosuratlari bilan to‘liq tanishing.'
                  : lang === 'ru'
                  ? 'Коллекция эксклюзивного льна The Fabric Store и маргиланского шелка. Фотографии полотен в высоком разрешении и параметры пластичности.'
                  : 'Curated natural weaves from The Fabric Store and heritage silk guilds. High-resolution multi-angle photography and precise tailoring metrics.'}
              </p>
            </div>

            <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col gap-2.5 justify-end">
              <button
                onClick={onOpenVisualSearch}
                className="w-full bg-[#B85D3B] hover:bg-[#9E4D2F] text-white font-bold py-3 px-4 rounded-2xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{lang === 'uz' ? 'Kamera Orqali Qidirish' : lang === 'ru' ? 'Поиск по фото' : 'Camera Search'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Catalog Listing */}
      <FabricCatalog
        fabrics={fabrics}
        onSelectFabricForStudio={onSelectFabricForStudio}
        onOpenProductDetail={onOpenProductDetail}
        currency={currency}
        unit={unit}
        lang={lang}
        onOpenVisualSearch={onOpenVisualSearch}
        isStandalonePage={true}
      />

    </div>
  );
};
