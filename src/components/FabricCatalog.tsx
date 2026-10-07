import React, { useState, useMemo } from 'react';
import { Fabric, ColorOption, Currency, UnitSystem, Language } from '../types';
import { Search, Sparkles, Eye, ArrowUpDown, Filter, RotateCcw, Check, Sparkle, Camera, ShoppingBag } from 'lucide-react';

interface FabricCatalogProps {
  fabrics: Fabric[];
  onSelectFabricForStudio: (fabric: Fabric, color: ColorOption) => void;
  onOpenProductDetail: (fabric: Fabric, initialColor?: ColorOption) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
  onOpenVisualSearch?: () => void;
  isStandalonePage?: boolean;
}

type MaterialFilter = 'all' | 'linen' | 'silk' | 'organic' | 'wool' | 'twill';
type WeightFilter = 'all' | 'light' | 'mid' | 'heavy';
type SortOption = 'featured' | 'gsm-asc' | 'gsm-desc' | 'price-asc' | 'price-desc' | 'drape-desc' | 'name-asc';

export const FabricCatalog: React.FC<FabricCatalogProps> = ({
  fabrics,
  onSelectFabricForStudio,
  onOpenProductDetail,
  currency,
  unit,
  lang,
  onOpenVisualSearch,
  isStandalonePage = false,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFilter>('all');
  const [selectedWeight, setSelectedWeight] = useState<WeightFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Track active selected color option for each fabric card (Uzum Market style)
  const [activeColorMap, setActiveColorMap] = useState<Record<string, ColorOption>>({});

  // Filter and sort logic
  const filteredFabrics = useMemo(() => {
    return fabrics
      .filter((item) => {
        // Material category filter
        let matchesMaterial = true;
        if (selectedMaterial === 'linen') {
          matchesMaterial = item.category.startsWith('linen');
        } else if (selectedMaterial === 'silk') {
          matchesMaterial = item.category === 'milliy-silk';
        } else if (selectedMaterial === 'organic') {
          matchesMaterial =
            item.category === 'linen-organic' ||
            item.certifications.some((c) => c.toLowerCase().includes('gots') || c.toLowerCase().includes('organic'));
        } else if (selectedMaterial === 'wool') {
          matchesMaterial = item.category === 'wool-cashmere';
        } else if (selectedMaterial === 'twill') {
          matchesMaterial = item.category === 'cotton-twill';
        }

        // Weight category filter (GSM)
        let matchesWeight = true;
        if (selectedWeight === 'light') {
          matchesWeight = item.gsm < 180;
        } else if (selectedWeight === 'mid') {
          matchesWeight = item.gsm >= 180 && item.gsm <= 250;
        } else if (selectedWeight === 'heavy') {
          matchesWeight = item.gsm > 250;
        }

        // Search query
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.origin.toLowerCase().includes(query) ||
          item.composition[lang].toLowerCase().includes(query) ||
          item.categoryLabel[lang].toLowerCase().includes(query) ||
          item.colors.some((c) => c.name[lang].toLowerCase().includes(query));

        return matchesMaterial && matchesWeight && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'gsm-asc') return a.gsm - b.gsm;
        if (sortBy === 'gsm-desc') return b.gsm - a.gsm;
        if (sortBy === 'price-asc') {
          const priceA = currency === 'UZS' ? a.priceUZS : currency === 'USD' ? a.priceUSD : a.priceEUR;
          const priceB = currency === 'UZS' ? b.priceUZS : currency === 'USD' ? b.priceUSD : b.priceEUR;
          return priceA - priceB;
        }
        if (sortBy === 'price-desc') {
          const priceA = currency === 'UZS' ? a.priceUZS : currency === 'USD' ? a.priceUSD : a.priceEUR;
          const priceB = currency === 'UZS' ? b.priceUZS : currency === 'USD' ? b.priceUSD : b.priceEUR;
          return priceB - priceA;
        }
        if (sortBy === 'drape-desc') return b.drapeFactor - a.drapeFactor;
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        return 0; // featured/default
      });
  }, [fabrics, selectedMaterial, selectedWeight, sortBy, searchQuery, lang, currency]);

  const hasActiveFilters = selectedMaterial !== 'all' || selectedWeight !== 'all' || searchQuery !== '' || sortBy !== 'featured';

  const resetFilters = () => {
    setSelectedMaterial('all');
    setSelectedWeight('all');
    setSortBy('featured');
    setSearchQuery('');
  };

  const formatPrice = (fabric: Fabric) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(fabric.priceUZS)} so‘m`;
    if (currency === 'USD') return `$${fabric.priceUSD.toFixed(2)}`;
    return `€${fabric.priceEUR.toFixed(2)}`;
  };

  return (
    <section id="catalog" className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isStandalonePage ? 'py-8' : 'py-16 lg:py-24'}`}>
      
      {/* Catalog Title & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E3DBD0]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#B85D3B] mb-1">
            <Sparkle className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Eksklyuziv Tabiiy To‘qimalar' : lang === 'ru' ? 'Эксклюзивная Коллекция Тканей' : 'Bespoke Natural Textiles'}</span>
            <span>•</span>
            <span className="text-[#1C1714]">
              {filteredFabrics.length} {lang === 'uz' ? 'ta to‘qima' : lang === 'ru' ? 'тканей' : 'fabrics'}
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#1C1714]">
            {lang === 'uz' ? 'Matolar Katalogi' : lang === 'ru' ? 'Каталог Натуральных Тканей' : 'International Natural Textiles'}
          </h2>
          <p className="text-xs sm:text-sm text-[#7F7264] mt-1 max-w-2xl">
            {lang === 'uz'
              ? 'Mato yuzini aniq ko‘rish uchun rasmini bosing. Ranglarini tanlaganda surat va ma’lumotlar bir zumda o‘zgaradi.'
              : lang === 'ru'
              ? 'Нажмите на цвет, чтобы моментально переключить фотографию полотна.'
              : 'Click color swatches to instantly preview photographic colorways and details.'}
          </p>
        </div>

        {/* Search Input & Camera Search Button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-grow md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8071]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'uz'
                  ? 'Qidiruv: oq, qora, zig‘ir, 215 gsm...'
                  : lang === 'ru'
                  ? 'Поиск: белый, черный, лён...'
                  : 'Search: white, black, linen...'
              }
              className="w-full bg-white border border-[#DDD5C7] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1C1714] placeholder-[#A49789] focus:outline-none focus:border-[#B85D3B] shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8071] hover:text-[#1C1714] text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Camera / Visual Search Action Button */}
          {onOpenVisualSearch && (
            <button
              onClick={onOpenVisualSearch}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#B85D3B] hover:bg-[#9E4D2F] text-white text-xs font-bold transition shadow-sm hover:shadow-md cursor-pointer shrink-0 group"
              title={lang === 'uz' ? 'Kiyim rasmi yoki kamera orqali matoni topish' : 'Visual Search by Camera'}
            >
              <Camera className="w-4 h-4 group-hover:scale-110 transition" />
              <span className="hidden sm:inline">
                {lang === 'uz' ? 'Rasm Orqali Qidiruv' : lang === 'ru' ? 'Поиск по Фото' : 'Camera Search'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Categories, Weight Filter & Sorting */}
      <div className="bg-white border border-[#E3DBD0] rounded-3xl p-4 sm:p-5 mt-6 shadow-sm space-y-4">
        
        {/* Row 1: Material Categories Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A7C6E] font-bold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#B85D3B]" />
              <span>{lang === 'uz' ? 'Mato Turi:' : lang === 'ru' ? 'Тип Ткани:' : 'Material:'}</span>
            </span>

            {[
              { id: 'all', label: { uz: 'Barchasi', ru: 'Все', en: 'All' } },
              { id: 'linen', label: { uz: 'Zig‘ir (Linen)', ru: 'Лён (Linen)', en: 'Linen' } },
              { id: 'organic', label: { uz: 'Organik (GOTS)', ru: 'Органик (GOTS)', en: 'Organic GOTS' } },
              { id: 'silk', label: { uz: 'Ipak (Silk)', ru: 'Шёлк', en: 'Silk & Ikat' } },
              { id: 'wool', label: { uz: 'Jun & Merinos', ru: 'Шерсть', en: 'Wool & Merino' } },
              { id: 'twill', label: { uz: 'Tvil & Kanvas', ru: 'Твил & Холст', en: 'Twill & Canvas' } },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedMaterial(cat.id as MaterialFilter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedMaterial === cat.id
                    ? 'bg-[#1C1714] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-[#5A4F44] hover:bg-[#F2ECE3] border border-[#DDD5C7]'
                }`}
              >
                {cat.label[lang]}
              </button>
            ))}
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-[#B85D3B] hover:text-[#1C1714] font-bold font-mono transition self-start sm:self-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'uz' ? 'Tozalash' : lang === 'ru' ? 'Сбросить' : 'Reset'}</span>
            </button>
          )}
        </div>

        {/* Row 2: Weight (GSM) and Sorting Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-[#F2ECE3]">
          
          {/* Weight (GSM) Filter Options */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A7C6E] font-bold mr-1">
              {lang === 'uz' ? 'Vazn (GSM):' : lang === 'ru' ? 'Плотность (GSM):' : 'Weight (GSM):'}
            </span>

            {[
              { id: 'all', label: { uz: 'Barchasi', ru: 'Все', en: 'All' } },
              { id: 'light', label: { uz: 'Yengil (<180g)', ru: 'Легкие (<180г)', en: 'Light (<180g)' } },
              { id: 'mid', label: { uz: 'O‘rtacha (180-250g)', ru: 'Средние (180-250г)', en: 'Mid (180-250g)' } },
              { id: 'heavy', label: { uz: 'Qalin (>250g)', ru: 'Плотные (>250г)', en: 'Heavy (>250g)' } },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWeight(w.id as WeightFilter)}
                className={`px-3 py-1 rounded-lg text-[11px] font-mono transition cursor-pointer ${
                  selectedWeight === w.id
                    ? 'bg-[#B85D3B] text-white font-bold'
                    : 'bg-[#FAF7F2] text-[#6A5E52] hover:bg-[#F2ECE3] border border-[#DDD5C7]'
                }`}
              >
                {w.label[lang]}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#B85D3B] shrink-0" />
            <label className="text-[11px] font-mono text-[#8A7C6E] font-bold uppercase shrink-0">
              {lang === 'uz' ? 'Saralash:' : lang === 'ru' ? 'Сортировка:' : 'Sort By:'}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#FAF7F2] border border-[#DDD5C7] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1C1714] focus:outline-none focus:border-[#B85D3B] cursor-pointer"
            >
              <option value="featured">
                {lang === 'uz' ? 'Tavsiya etilgan' : lang === 'ru' ? 'Рекомендуемые' : 'Featured'}
              </option>
              <option value="price-asc">
                {lang === 'uz' ? 'Narx: Arzondan qimmatga' : lang === 'ru' ? 'Цена: по возрастанию' : 'Price: Low to High'}
              </option>
              <option value="price-desc">
                {lang === 'uz' ? 'Narx: Qimmatdan arzonga' : lang === 'ru' ? 'Цена: по убыванию' : 'Price: High to Low'}
              </option>
              <option value="gsm-asc">
                {lang === 'uz' ? 'Vazn: Yengildan og‘irga (GSM ↑)' : 'Weight: Low to High (GSM ↑)'}
              </option>
              <option value="gsm-desc">
                {lang === 'uz' ? 'Vazn: Og‘irdan yengilga (GSM ↓)' : 'Weight: High to Low (GSM ↓)'}
              </option>
              <option value="drape-desc">
                {lang === 'uz' ? 'Drape: Oliy to‘kiluvchan' : 'Drape Index (High)'}
              </option>
              <option value="name-asc">
                {lang === 'uz' ? 'Nomi bo‘yicha (A - Z)' : 'Name (A - Z)'}
              </option>
            </select>
          </div>

        </div>

      </div>

      {/* Fabrics Grid - Clean, Modern, Uzum Market Style Cards */}
      {filteredFabrics.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#DDD5C7] p-12 text-center mt-8">
          <Filter className="w-10 h-10 text-[#C8BEB0] mx-auto mb-3" />
          <h3 className="font-serif font-bold text-lg text-[#1C1714]">
            {lang === 'uz' ? 'Mos keluvchi matolar topilmadi' : lang === 'ru' ? 'Тканей не найдено' : 'No matching textiles found'}
          </h3>
          <p className="text-xs text-[#7F7264] mt-1 max-w-sm mx-auto">
            {lang === 'uz'
              ? 'Filtrlarni yoki qidiruv so‘zini o‘zgartirib ko‘ring.'
              : lang === 'ru'
              ? 'Попробуйте сбросить фильтры или изменить поисковый запрос.'
              : 'Try clearing your active filters or changing your search terms.'}
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1C1714] text-white text-xs font-bold transition hover:bg-[#B85D3B] cursor-pointer"
          >
            {lang === 'uz' ? 'Filtrlarni Tozalash' : lang === 'ru' ? 'Сбросить фильтры' : 'Reset Filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
          {filteredFabrics.map((fabric) => {
            const activeColor = activeColorMap[fabric.id] || fabric.colors[0];
            // High-resolution photo based on currently selected color variant (Uzum Market behavior!)
            const displayPhoto =
              activeColor.image ||
              activeColor.hangImage ||
              fabric.featuredImage ||
              fabric.images?.swatch ||
              fabric.images?.hang;

            return (
              <div
                key={fabric.id}
                className="bg-white rounded-3xl border border-[#E3DBD0] shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group"
              >
                {/* 1 Clean Primary Image Stage (Uzum Market Style) */}
                <div
                  onClick={() => onOpenProductDetail(fabric, activeColor)}
                  className="relative aspect-square overflow-hidden bg-[#FAF7F2] cursor-pointer"
                >
                  {displayPhoto ? (
                    <img
                      src={displayPhoto}
                      alt={`${fabric.name} - ${activeColor.name[lang]}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full h-full ${fabric.cssClass} relative`}>
                      <div className="drape-fold-overlay absolute inset-0 opacity-45 pointer-events-none"></div>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 z-10 flex justify-between items-start pointer-events-none">
                    <span className="bg-white/90 backdrop-blur-md text-[#1C1714] text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl shadow-xs border border-[#E0D7CC]">
                      {fabric.gsm} GSM
                    </span>
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow-md transition-transform"
                      style={{ backgroundColor: activeColor.hex }}
                      title={activeColor.name[lang]}
                    ></span>
                  </div>

                  {/* Subtle Quick Hover Overlay */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-white/95 text-[#1C1714] text-xs font-bold px-4 py-2 rounded-2xl shadow-lg flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#B85D3B]" />
                      <span>{lang === 'uz' ? 'Batafsil ko‘rish' : 'Inspect'}</span>
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex flex-col flex-grow">
                  
                  {/* Category & Origin */}
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#B85D3B] text-[10px] uppercase tracking-wider">
                      {fabric.categoryLabel[lang]}
                    </span>
                    <span className="text-[#887A6D] text-[10px] font-mono">
                      {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => onOpenProductDetail(fabric, activeColor)}
                    className="font-serif font-bold text-sm sm:text-base text-[#1C1714] hover:text-[#B85D3B] cursor-pointer transition line-clamp-1 mb-1"
                  >
                    {fabric.name}
                  </h3>

                  {/* Color Name Label */}
                  <div className="flex items-center justify-between text-[11px] text-[#6A5E52] mb-3">
                    <span className="font-medium truncate max-w-[150px]">{activeColor.name[lang]}</span>
                    <span className="text-[10px] text-[#A09385] font-mono">{fabric.origin.split(' ')[0]}</span>
                  </div>

                  {/* Color Swatch Dots - Clicking changes image and color immediately! */}
                  <div className="mb-4 pt-2.5 border-t border-[#F2ECE3]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {fabric.colors.map((c) => {
                        const isSelected = activeColor.id === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveColorMap({ ...activeColorMap, [fabric.id]: c });
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'scale-115 border-[#B85D3B] ring-2 ring-[#B85D3B]/40 shadow-sm'
                                : 'border-white hover:scale-110 shadow-xs'
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name[lang]}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price & 3D Drape Button */}
                  <div className="mt-auto pt-3 border-t border-[#F2ECE3] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#938575] block tracking-wider">
                        {lang === 'uz' ? '1 metr:' : 'Per meter:'}
                      </span>
                      <span className="text-sm sm:text-base font-serif font-bold text-[#1C1714]">
                        {formatPrice(fabric)}
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectFabricForStudio(fabric, activeColor)}
                      className="bg-[#1C1714] hover:bg-[#B85D3B] text-white px-3 py-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer shrink-0"
                      title="3D Manekenda kiyintirish"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>3D Kiyish</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </section>
  );
};
