import React, { useState, useMemo } from 'react';
import { Fabric, ColorOption, Currency, UnitSystem, Language } from '../types';
import { Search, Sparkles, Eye, ArrowUpDown, Filter, RotateCcw, Check, Sparkle, Camera } from 'lucide-react';

interface FabricCatalogProps {
  fabrics: Fabric[];
  onSelectFabricForStudio: (fabric: Fabric, color: ColorOption) => void;
  onOpenProductDetail: (fabric: Fabric) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
  onOpenVisualSearch?: () => void;
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
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFilter>('all');
  const [selectedWeight, setSelectedWeight] = useState<WeightFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeColorMap, setActiveColorMap] = useState<Record<string, string>>({});

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
            item.category === 'cotton-twill' ||
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
    <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      
      {/* Catalog Title & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E3DBD0]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#B85D3B] mb-1">
            <Sparkle className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Eksklyuziv Kolleksiya' : lang === 'ru' ? 'Эксклюзивная Коллекция' : 'Bespoke Textile Archive'}</span>
            <span>•</span>
            <span className="text-[#1C1714]">
              {filteredFabrics.length} {lang === 'uz' ? 'ta to‘qima' : lang === 'ru' ? 'тканей' : 'weaves'}
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#1C1714]">
            {lang === 'uz' ? 'Xalqaro Standartdagi Tabiiy Matolar' : lang === 'ru' ? 'Каталог Натуральных Тканей' : 'International Natural Textiles'}
          </h2>
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
                  ? 'Qidiruv: zig‘ir, ipak, 215 gsm...'
                  : lang === 'ru'
                  ? 'Поиск: лён, шёлк, 215 gsm...'
                  : 'Search: linen, silk, organic...'
              }
              className="w-full bg-white border border-[#DDD5C7] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1C1714] placeholder-[#A49789] focus:outline-none focus:border-[#B85D3B] shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8071] hover:text-[#1C1714] text-xs font-bold"
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
              { id: 'silk', label: { uz: 'Ipak (Silk & Ikat)', ru: 'Шёлк & Икат', en: 'Silk & Ikat' } },
              { id: 'organic', label: { uz: 'Organik (GOTS)', ru: 'Органик (GOTS)', en: 'Organic GOTS' } },
              { id: 'wool', label: { uz: 'Jun & Kachemir', ru: 'Шерсть & Кашемир', en: 'Wool & Cashmere' } },
              { id: 'twill', label: { uz: 'Tvil & Paxta', ru: 'Твил & Хлопок', en: 'Twill & Cotton' } },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedMaterial(cat.id as MaterialFilter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
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
              className="inline-flex items-center gap-1 text-xs text-[#B85D3B] hover:text-[#1C1714] font-bold font-mono transition self-start sm:self-auto"
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
                className={`px-3 py-1 rounded-lg text-[11px] font-mono transition ${
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
                {lang === 'uz' ? 'Tavsiya etilgan (Featured)' : lang === 'ru' ? 'Рекомендуемые' : 'Featured'}
              </option>
              <option value="gsm-asc">
                {lang === 'uz' ? 'Vazn: Yengildan og‘irga (GSM ↑)' : lang === 'ru' ? 'Плотность: от легких (GSM ↑)' : 'Weight: Low to High (GSM ↑)'}
              </option>
              <option value="gsm-desc">
                {lang === 'uz' ? 'Vazn: Og‘irdan yengilga (GSM ↓)' : lang === 'ru' ? 'Плотность: от плотных (GSM ↓)' : 'Weight: High to Low (GSM ↓)'}
              </option>
              <option value="price-asc">
                {lang === 'uz' ? 'Narx: Arzondan qimmatga' : lang === 'ru' ? 'Цена: по возрастанию' : 'Price: Low to High'}
              </option>
              <option value="price-desc">
                {lang === 'uz' ? 'Narx: Qimmatdan arzonga' : lang === 'ru' ? 'Цена: по убыванию' : 'Price: High to Low'}
              </option>
              <option value="drape-desc">
                {lang === 'uz' ? 'Drape: Oliy to‘kiluvchan' : lang === 'ru' ? 'Пластичность: высокая' : 'Drape Index (High)'}
              </option>
              <option value="name-asc">
                {lang === 'uz' ? 'Nomi bo‘yicha (A - Z)' : lang === 'ru' ? 'По названию (А - Я)' : 'Name (A - Z)'}
              </option>
            </select>
          </div>

        </div>

      </div>

      {/* Fabrics Grid */}
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
            className="mt-4 px-4 py-2 rounded-xl bg-[#1C1714] text-white text-xs font-bold transition hover:bg-[#B85D3B]"
          >
            {lang === 'uz' ? 'Filtrlarni Tozalash' : lang === 'ru' ? 'Сбросить фильтры' : 'Reset Filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {filteredFabrics.map((fabric) => {
            const activeColorId = activeColorMap[fabric.id] || fabric.colors[0].id;
            const activeColor = fabric.colors.find((c) => c.id === activeColorId) || fabric.colors[0];

            return (
              <div
                key={fabric.id}
                className="bg-white rounded-3xl border border-[#DDD5C7] shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group"
              >
                {/* Card Weave Texture Header */}
                <div
                  className={`relative aspect-4/3 overflow-hidden ${fabric.cssClass} cursor-pointer p-4 flex flex-col justify-between`}
                  onClick={() => onOpenProductDetail(fabric)}
                >
                  <div className="drape-fold-overlay absolute inset-0 opacity-45 pointer-events-none"></div>

                  {/* Top Badge: Density & Origin */}
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-xl border border-white/20">
                      {fabric.gsm} GSM • {unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}"`}
                    </span>
                    <span
                      className="w-4 h-4 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: activeColor.hex }}
                      title={activeColor.name[lang]}
                    ></span>
                  </div>

                  {/* Bottom Overlay Bar */}
                  <div className="relative z-10 bg-black/65 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-white text-[11px] flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#D8CFBF]">{fabric.origin}</span>
                    <span className="text-[#CF6E4C] font-bold text-[10px] uppercase flex items-center gap-1">
                      <span>{lang === 'uz' ? 'Batafsil' : lang === 'ru' ? 'Детали' : 'Inspect'}</span>
                      <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-bold text-[#B85D3B] text-[10px] uppercase tracking-wider">
                      {fabric.categoryLabel[lang]}
                    </span>
                    <span className="text-[#887A6D] text-[10px] font-mono">
                      Drape: {fabric.drapeFactor}/10
                    </span>
                  </div>

                  <h3
                    onClick={() => onOpenProductDetail(fabric)}
                    className="font-serif font-bold text-base text-[#1C1714] hover:text-[#B85D3B] cursor-pointer transition line-clamp-1 mb-1"
                  >
                    {fabric.name}
                  </h3>

                  <p className="text-xs text-[#6A5E52] line-clamp-2 mb-3 leading-relaxed">
                    {fabric.description[lang]}
                  </p>

                  {/* Color Swatch Selector for this card */}
                  <div className="mb-4 pt-2 border-t border-[#F2ECE3]">
                    <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono text-[#887A6D]">
                      <span>{lang === 'uz' ? 'Ranglar:' : lang === 'ru' ? 'Цвета:' : 'Colorways:'}</span>
                      <span className="text-[#1C1714] font-medium truncate max-w-[120px]">{activeColor.name[lang]}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {fabric.colors.map((c) => {
                        const isSelected = c.id === activeColor.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setActiveColorMap({ ...activeColorMap, [fabric.id]: c.id })}
                            className={`w-5 h-5 rounded-full border transition-transform ${
                              isSelected ? 'ring-2 ring-[#B85D3B] scale-110 border-white' : 'border-black/10 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name[lang]}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing & 3D Action */}
                  <div className="mt-auto pt-3 border-t border-[#F2ECE3] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#938575] block tracking-wider">
                        {lang === 'uz' ? '1 metr narxi:' : lang === 'ru' ? 'Цена за метр:' : 'Price per meter:'}
                      </span>
                      <span className="text-base font-serif font-bold text-[#1C1714]">
                        {formatPrice(fabric)}
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectFabricForStudio(fabric, activeColor)}
                      className="bg-[#1C1714] hover:bg-[#B85D3B] text-white px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shadow-xs"
                      title="3D Manekenda sinash"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>3D Drape</span>
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
