import React, { useState, useId } from 'react';
import { GarmentSilhouette, Fabric, UnitSystem, Language } from '../types';
import { Scissors, CheckCircle, Sparkles, ArrowRight } from 'lucide-react';

interface ZeroWasteCalculatorProps {
  garments: GarmentSilhouette[];
  fabrics: Fabric[];
  selectedFabric: Fabric;
  onOpenStudioWithGarment: (garment: GarmentSilhouette) => void;
  unit: UnitSystem;
  lang: Language;
}

export const ZeroWasteCalculator: React.FC<ZeroWasteCalculatorProps> = ({
  garments,
  fabrics,
  selectedFabric,
  onOpenStudioWithGarment,
  unit,
  lang,
}) => {
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>(garments[0].id);
  const [userHeight, setUserHeight] = useState<number>(unit === 'metric' ? 172 : 68);
  const [sizeSystem, setSizeSystem] = useState<'INT' | 'EU' | 'US' | 'UK'>('EU');
  const [selectedSize, setSelectedSize] = useState<string>('EU 38');
  const [fabricRollWidth, setFabricRollWidth] = useState<number>(145);
  const [shrinkageFactor, setShrinkageFactor] = useState<number>(2.5);

  const garmentSelectId = useId();
  const sizeSystemSelectId = useId();
  const sizeSelectId = useId();
  const heightInputId = useId();
  const rollWidthSelectId = useId();

  const currentGarment = garments.find((g) => g.id === selectedGarmentId) || garments[0];

  // Computation algorithm adhering to international tailoring formulas
  const calculateMeterage = (): { optimal: number; saved: number; unitStr: string } => {
    let base = currentGarment.estimatedMeters;

    // Height offset: standard height baseline is 168 cm (66 in)
    const heightCm = unit === 'metric' ? userHeight : userHeight * 2.54;
    const heightDelta = (heightCm - 168) * 0.007;

    // Size allowance offset
    let sizeBonus = 0;
    if (selectedSize.includes('42') || selectedSize.includes('L') || selectedSize.includes('10')) sizeBonus = 0.2;
    if (selectedSize.includes('44') || selectedSize.includes('XL') || selectedSize.includes('12')) sizeBonus = 0.45;
    if (selectedSize.includes('XXL') || selectedSize.includes('14')) sizeBonus = 0.7;

    // Width penalty: narrow fabrics (like 65cm silk) require more length
    let widthMultiplier = 1.0;
    if (fabricRollWidth <= 75) {
      widthMultiplier = 2.1;
    } else if (fabricRollWidth <= 120) {
      widthMultiplier = 1.25;
    }

    // Shrinkage addition
    const shrinkageBuffer = (shrinkageFactor / 100) * base;

    const rawMeters = (base + heightDelta + sizeBonus + shrinkageBuffer) * widthMultiplier;
    const optimalMeters = Math.max(1.0, Math.round(rawMeters * 10) / 10);
    const standardRoughEstimate = Math.round((optimalMeters * 1.25) * 10) / 10;
    const savedMeters = Math.round((standardRoughEstimate - optimalMeters) * 10) / 10;

    if (unit === 'imperial') {
      const optimalYards = Math.round(optimalMeters * 1.09361 * 10) / 10;
      const savedYards = Math.round(savedMeters * 1.09361 * 10) / 10;
      return { optimal: optimalYards, saved: savedYards, unitStr: 'yd' };
    }

    return { optimal: optimalMeters, saved: savedMeters, unitStr: 'metr' };
  };

  const { optimal, saved, unitStr } = calculateMeterage();

  return (
    <section id="calculator" className="bg-[#FAF7F2] border-b border-[#E3DBD0] py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Narrative Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#B85D3B]">
              <Scissors className="w-3.5 h-3.5" />
              <span>{lang === 'uz' ? 'Isrofsiz Bichim Texnologiyasi' : lang === 'ru' ? 'Безотходный Крой' : 'Zero-Waste Pattern Science'}</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1C1714] tracking-tight">
              {lang === 'uz' ? 'Aqlli Sarf Kalkulyatori' : lang === 'ru' ? 'Умный Калькулятор Метража' : 'Bespoke Yardage Calculator'}
            </h2>

            <p className="text-xs sm:text-sm text-[#6A5E52] leading-relaxed">
              {lang === 'uz'
                ? 'An’anaviy xaridlarda noto‘g‘ri hisob tufayli matoning 20-25% qismi ortiqcha qirqim bo‘lib chiqindiga aylanadi. Bizning algoritm matoning yuvilgandagi qisqarishi, eni va bo‘yingizni inobatga olib, jahon kutyurlari standartida hisoblaydi.'
                : lang === 'ru'
                ? 'Из-за погрешностей до 25% купленной ткани уходит в обрезки. Наш алгоритм точно учитывает усадку при декатировке, ширину рулона и европейские стандарты лекал.'
                : 'Up to 25% of purchased fabric becomes unnecessary scrap. Our precision cutting engine factors in wash shrinkage rates, roll bolt widths, and international pattern standards.'}
            </p>

            <div className="p-4 bg-white rounded-2xl border border-[#DFD7CB] space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 font-bold text-[#1C1714]">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'uz'
                    ? 'Yuvilgandagi qisqarish (-2.5%) avtomatik hisobga olingan'
                    : lang === 'ru'
                    ? 'Учтена усадка после влажно-тепловой обработки (-2.5%)'
                    : 'Pre-wash shrinkage rate (-2.5%) calculated'}
                </span>
              </div>
              <div className="flex items-center gap-2.5 font-bold text-[#1C1714]">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'uz'
                    ? 'Grainline (ip yo‘nalishi) va bichim haqlari to‘liq qoplangan'
                    : lang === 'ru'
                    ? 'Синхронизировано с направлением долевой нити и припусками'
                    : 'Grainline alignment & seam allowance included'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onOpenStudioWithGarment(currentGarment)}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-[#B85D3B] hover:text-[#1C1714] transition"
            >
              <span>{lang === 'uz' ? '3D Studiyada sinab ko‘rish' : lang === 'ru' ? 'Примерить в 3D Студии' : 'Test on 3D Mannequin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Calculator Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#DDD5C7] shadow-lg">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* Garment Silhouette Select */}
              <div>
                <label htmlFor={garmentSelectId} className="block text-xs font-bold text-[#3B322A] mb-1.5">
                  {lang === 'uz' ? 'Kiyim turi (Model):' : lang === 'ru' ? 'Тип изделия:' : 'Garment Silhouette:'}
                </label>
                <select
                  id={garmentSelectId}
                  value={selectedGarmentId}
                  onChange={(e) => setSelectedGarmentId(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                >
                  {garments.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name[lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sizing Standard Switcher */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={sizeSystemSelectId} className="text-xs font-bold text-[#3B322A]">
                    {lang === 'uz' ? 'O‘lcham tizimi:' : lang === 'ru' ? 'Стандарт размера:' : 'Size System:'}
                  </label>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    {(['INT', 'EU', 'US', 'UK'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSizeSystem(s)}
                        className={`px-1 rounded ${sizeSystem === s ? 'bg-[#1C1714] text-white font-bold' : 'text-[#8C7F72]'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <select
                  id={sizeSelectId}
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                >
                  {sizeSystem === 'EU' && (
                    <>
                      <option value="EU 34">EU 34 (XS / 80-60-86)</option>
                      <option value="EU 36">EU 36 (S / 84-64-90)</option>
                      <option value="EU 38">EU 38 (M / 88-68-94)</option>
                      <option value="EU 40">EU 40 (M-L / 92-72-98)</option>
                      <option value="EU 42">EU 42 (L / 96-76-102)</option>
                      <option value="EU 44">EU 44 (XL / 100-80-106)</option>
                    </>
                  )}
                  {sizeSystem === 'US' && (
                    <>
                      <option value="US 2">US 2 (Petite S)</option>
                      <option value="US 4">US 4 (Small)</option>
                      <option value="US 6">US 6 (Medium)</option>
                      <option value="US 8">US 8 (Regular)</option>
                      <option value="US 10">US 10 (Large)</option>
                      <option value="US 12">US 12 (X-Large)</option>
                    </>
                  )}
                  {sizeSystem === 'UK' && (
                    <>
                      <option value="UK 6">UK 6</option>
                      <option value="UK 8">UK 8</option>
                      <option value="UK 10">UK 10</option>
                      <option value="UK 12">UK 12</option>
                      <option value="UK 14">UK 14</option>
                    </>
                  )}
                  {sizeSystem === 'INT' && (
                    <>
                      <option value="XS">XS (Extra Small)</option>
                      <option value="S">S (Small)</option>
                      <option value="M">M (Medium)</option>
                      <option value="L">L (Large)</option>
                      <option value="XL">XL (Extra Large)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Height Input */}
              <div>
                <label htmlFor={heightInputId} className="block text-xs font-bold text-[#3B322A] mb-1.5">
                  {lang === 'uz' ? `Bo‘yingiz (${unit === 'metric' ? 'sm' : 'in'}):` : lang === 'ru' ? `Рост (${unit === 'metric' ? 'см' : 'дюйм'}):` : `Height (${unit === 'metric' ? 'cm' : 'in'}):`}
                </label>
                <input
                  id={heightInputId}
                  type="number"
                  value={userHeight}
                  onChange={(e) => setUserHeight(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>

              {/* Roll Bolt Width Input */}
              <div>
                <label htmlFor={rollWidthSelectId} className="block text-xs font-bold text-[#3B322A] mb-1.5">
                  {lang === 'uz' ? 'Mato eni (Bolt Width):' : lang === 'ru' ? 'Ширина ткани в рулоне:' : 'Fabric Bolt Width:'}
                </label>
                <select
                  id={rollWidthSelectId}
                  value={fabricRollWidth}
                  onChange={(e) => setFabricRollWidth(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                >
                  <option value={145}>145 sm (57&quot;) — Standart Yevropa Zig‘iri</option>
                  <option value={150}>150 sm (60&quot;) — Keng Kostyumbop Jun</option>
                  <option value={65}>65 sm (26&quot;) — Marg‘ilon Milliy Ipag‘i</option>
                  <option value={110}>110 sm (44&quot;) — Yaponiya Paxtasi</option>
                </select>
              </div>
            </div>

            {/* Output Metric Banner */}
            <div className="bg-[#FAF7F2] p-6 rounded-2xl border border-[#E0D7C9] flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div>
                <span className="text-xs text-[#7F7264] block font-medium">
                  {lang === 'uz'
                    ? 'Tavsiya etiladigan optimal metraj:'
                    : lang === 'ru'
                    ? 'Рекомендуемый точный метраж:'
                    : 'Recommended Optimal Yardage:'}
                </span>
                <span className="font-serif font-black text-3xl sm:text-4xl text-[#B85D3B] block mt-0.5">
                  {optimal} {unitStr}
                </span>
                <span className="text-[11px] text-[#938575] block mt-1">
                  {fabricRollWidth} sm en va {shrinkageFactor}% qisqarish hisoblangan
                </span>
              </div>

              <div className="text-right sm:border-l sm:border-[#DDD3C4] sm:pl-6">
                <span className="text-xs text-[#7F7264] block font-medium">
                  {lang === 'uz' ? 'Isrofsiz tejalgan mato:' : lang === 'ru' ? 'Экономия ткани:' : 'Estimated Fabric Saved:'}
                </span>
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full mt-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>~{saved} {unitStr} (25% tejamkorlik)</span>
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
