import React, { useState } from 'react';
import { Mannequin3DStudio } from './Mannequin3DStudio';
import { ZeroWasteCalculator } from './ZeroWasteCalculator';
import { InternationalStandardsBanner } from './InternationalStandardsBanner';
import { Fabric, GarmentSilhouette, ColorOption, Currency, UnitSystem, Language } from '../types';
import { Sparkles, Scissors, Layers, ArrowLeft, Eye, Shirt, Sparkle } from 'lucide-react';

interface Studio3DPageProps {
  fabrics: Fabric[];
  garments: GarmentSilhouette[];
  selectedFabric: Fabric;
  selectedGarment: GarmentSilhouette;
  selectedColor: ColorOption;
  onSelectFabric: (fabric: Fabric) => void;
  onSelectGarment: (garment: GarmentSilhouette) => void;
  onSelectColor: (color: ColorOption) => void;
  onAddToCart: (fabric: Fabric, color: ColorOption, meters: number) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
  onBackToHome: () => void;
  onNavigateToCatalog: () => void;
}

export const Studio3DPage: React.FC<Studio3DPageProps> = ({
  fabrics,
  garments,
  selectedFabric,
  selectedGarment,
  selectedColor,
  onSelectFabric,
  onSelectGarment,
  onSelectColor,
  onAddToCart,
  currency,
  unit,
  lang,
  onBackToHome,
  onNavigateToCatalog,
}) => {
  const [studioTab, setStudioTab] = useState<'3d' | 'calculator' | 'standards'>('3d');

  return (
    <div className="min-h-screen bg-[#141210] text-[#EDE7DE] pb-20">
      
      {/* Studio Page Header Bar */}
      <div className="bg-[#1C1815] border-b border-[#2C241F] py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left Nav & Title */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={onBackToHome}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#A89D91] hover:text-white transition cursor-pointer bg-[#25201B] hover:bg-[#322A24] px-3 py-1.5 rounded-xl border border-[#3A322A]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'uz' ? 'Bosh sahifa' : lang === 'ru' ? 'Главная' : 'Home'}</span>
                </button>
                <button
                  onClick={onNavigateToCatalog}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#A89D91] hover:text-white transition cursor-pointer bg-[#25201B] hover:bg-[#322A24] px-3 py-1.5 rounded-xl border border-[#3A322A]"
                >
                  <Shirt className="w-3.5 h-3.5" />
                  <span>{lang === 'uz' ? 'Matolar Katalogi' : lang === 'ru' ? 'Каталог Тканей' : 'Catalog'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#CF6E4C] uppercase tracking-widest font-bold">
                <Sparkle className="w-3.5 h-3.5" />
                <span>3D Virtual Fitting Atelier</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                {lang === 'uz' ? '3D Kiyinish Xonasi & Drape Studiyasi' : lang === 'ru' ? '3D Примерочная & Студия Драпировки' : '3D Drape & Mannequin Studio'}
              </h1>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#12100E] border border-[#2D251F] flex-wrap self-start md:self-auto">
              <button
                onClick={() => setStudioTab('3d')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  studioTab === '3d'
                    ? 'bg-[#CF6E4C] text-white shadow-md'
                    : 'text-[#A89D91] hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'uz' ? '3D Virtual Maneken' : lang === 'ru' ? '3D Манекен' : '3D Mannequin'}</span>
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
                <span>{lang === 'uz' ? 'Isrofsiz Bichim' : lang === 'ru' ? 'Калькулятор' : 'Yardage Calc'}</span>
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
                <span>{lang === 'uz' ? 'Standartlar' : lang === 'ru' ? 'Стандарты' : 'Standards'}</span>
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Main Studio Viewport */}
      {studioTab === '3d' && (
        <Mannequin3DStudio
          fabrics={fabrics}
          garments={garments}
          selectedFabric={selectedFabric}
          selectedGarment={selectedGarment}
          selectedColor={selectedColor}
          onSelectFabric={onSelectFabric}
          onSelectGarment={onSelectGarment}
          onSelectColor={onSelectColor}
          onAddToCart={onAddToCart}
          currency={currency}
          unit={unit}
          lang={lang}
        />
      )}

      {/* Sub-Tab 2: Yardage Calculator */}
      {studioTab === 'calculator' && (
        <div className="bg-[#FAF7F2] text-[#1C1714] py-12">
          <ZeroWasteCalculator
            garments={garments}
            fabrics={fabrics}
            selectedFabric={selectedFabric}
            onOpenStudioWithGarment={(garment) => {
              onSelectGarment(garment);
              setStudioTab('3d');
            }}
            unit={unit}
            lang={lang}
          />
        </div>
      )}

      {/* Sub-Tab 3: International Standards */}
      {studioTab === 'standards' && (
        <div className="bg-[#FAF7F2] text-[#1C1714] py-12">
          <InternationalStandardsBanner lang={lang} unit={unit} />
        </div>
      )}

    </div>
  );
};
