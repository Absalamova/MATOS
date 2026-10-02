import React from 'react';
import { Globe, Award, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { Language, UnitSystem } from '../types';

interface Props {
  lang: Language;
  unit: UnitSystem;
}

export const InternationalStandardsBanner: React.FC<Props> = ({ lang, unit }) => {
  const standardsData = [
    {
      code: 'OEKO-TEX® 100',
      label: {
        uz: 'Xavfsiz Toksikologik Standart',
        ru: 'Стандарт Эко-Безопасности',
        en: 'Eco-Tox Safety Standard',
      },
      desc: {
        uz: '300 dan ortiq zararli kimyoviy moddalardan xoli, nozik teri va bolalar uchun 100% xavfsiz.',
        ru: 'Без вредных красителей и формальдегидов. Полная гипоаллергенность.',
        en: 'Zero harmful chemicals, phthalates, or heavy metals. 100% skin safe.',
      },
    },
    {
      code: 'GOTS Certified',
      label: {
        uz: 'Global Organik To‘qimachilik',
        ru: 'Глобальный Органический Стандарт',
        en: 'Global Organic Textile Standard',
      },
      desc: {
        uz: 'Organik urug‘dan to mato yuvilishigacha bo‘lgan barcha bosqichlar ekologik sertifikatlangan.',
        ru: 'Полный экологический цикл производства от органического семени до ткачества.',
        en: 'Strict organic cultivation criteria and ethical labor verification.',
      },
    },
    {
      code: 'Masters of Linen®',
      label: {
        uz: 'Yevropa Oliy Zig‘ir Gildiyasi',
        ru: 'Гильдия Европейского Льна',
        en: 'European Flax Guild',
      },
      desc: {
        uz: '100% Yevropada yetishtirilgan va to‘qilgan, sun’iy sug‘orishsiz yetishtirilgan tabiiy tola.',
        ru: '100% европейский лён без искусственного орошения, высшая степень долговечности.',
        en: '100% European grown and woven flax, zero irrigation footprint.',
      },
    },
    {
      code: 'UNESCO Heritage',
      label: {
        uz: 'Marg‘ilon Abrbandi Merosi',
        ru: 'Наследие ЮНЕСКО Маргилана',
        en: 'UNESCO Silk Guild',
      },
      desc: {
        uz: 'Buyuk Ipak yo‘li an’anasidagi qo‘lda to‘qilgan ipak va tabiiy bo‘yoqlar sertifikati.',
        ru: 'Ручное ткачество шелка и натуральное крашение с вековой историей.',
        en: 'Historic Silk Road hand-loomed mulberry silk and natural mineral dyes.',
      },
    },
  ];

  const sizeMatrix = [
    { int: 'XS', eu: '34', us: '2', uk: '6', bustCm: '80-84', bustIn: '31-33', waistCm: '60-64', waistIn: '23-25' },
    { int: 'S', eu: '36', us: '4', uk: '8', bustCm: '84-88', bustIn: '33-35', waistCm: '64-68', waistIn: '25-27' },
    { int: 'M', eu: '38', us: '6', uk: '10', bustCm: '88-92', bustIn: '35-37', waistCm: '68-72', waistIn: '27-29' },
    { int: 'L', eu: '40', us: '8', uk: '12', bustCm: '92-96', bustIn: '37-39', waistCm: '72-76', waistIn: '29-31' },
    { int: 'XL', eu: '42', us: '10', uk: '14', bustCm: '96-102', bustIn: '39-41', waistCm: '76-82', waistIn: '31-33' },
    { int: 'XXL', eu: '44', us: '12', uk: '16', bustCm: '102-108', bustIn: '41-43', waistCm: '82-88', waistIn: '33-35' },
  ];

  return (
    <section id="standards" className="bg-[#191513] text-[#EDE7DE] py-16 lg:py-24 border-b border-[#2A231D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#26201B] border border-[#3A322A] text-[#CF6E4C] text-xs font-mono uppercase tracking-widest mb-3">
            <Globe className="w-3.5 h-3.5" />
            <span>ISO / ASTM / GOTS Global Quality</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            {lang === 'uz' ? 'Butun Dunyo Standartlari' : lang === 'ru' ? 'Глобальные Стандарты Качества' : 'Global Atelier Standards'}
          </h2>
          <p className="text-xs sm:text-sm text-[#A89D8E] mt-3">
            {lang === 'uz'
              ? 'Parij, Milan va London kutyurlari talablariga to‘liq javob beruvchi xalqaro o‘lchamlar va to‘qimachilik sertifikatlari.'
              : lang === 'ru'
              ? 'Единая система размеров и экологические сертификаты, признанные модными домами Парижа, Милана и Лондона.'
              : 'Standardized international sizing charts, ISO textile shrink testing, and tier-1 ethical certifications.'}
          </p>
        </div>

        {/* 4 Trust Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {standardsData.map((std) => (
            <div key={std.code} className="bg-[#221C18] p-6 rounded-3xl border border-[#342C25] hover:border-[#CF6E4C] transition duration-300">
              <div className="w-10 h-10 rounded-xl bg-[#2D241E] text-[#CF6E4C] flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-mono text-xs font-bold text-[#D4AF37] block uppercase tracking-wider mb-1">
                {std.code}
              </span>
              <h3 className="font-serif font-bold text-base text-white mb-2">
                {std.label[lang]}
              </h3>
              <p className="text-xs text-[#9E9081] leading-relaxed">
                {std.desc[lang]}
              </p>
            </div>
          ))}
        </div>

        {/* Universal Size Conversion Matrix Table */}
        <div className="bg-[#221C18] rounded-3xl border border-[#342C25] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#312922] gap-2 mb-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-white">
                {lang === 'uz' ? 'Xalqaro O‘lchamlar Jadvali' : lang === 'ru' ? 'Таблица Международных Размеров' : 'International Size Conversion Matrix'}
              </h3>
              <span className="text-xs text-[#9E9081]">
                {lang === 'uz' ? 'EU, US, UK va Xalqaro standartlar o‘rtasidagi moslik' : lang === 'ru' ? 'Синхронизация стандартов EU, US, UK и INT' : 'Harmonized sizing standard for atelier patterns'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#CF6E4C] bg-[#171311] px-3 py-1.5 rounded-xl border border-[#342C25]">
              {unit === 'metric' ? 'Santimetrda (CM)' : 'In Inches (IN)'}
            </span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#312922] text-[#887A6C] font-mono uppercase text-[10px]">
                  <th className="py-3 px-3">INT</th>
                  <th className="py-3 px-3">EU</th>
                  <th className="py-3 px-3">US</th>
                  <th className="py-3 px-3">UK</th>
                  <th className="py-3 px-3">
                    {lang === 'uz' ? 'Ko‘krak aylanasi' : lang === 'ru' ? 'Обхват груди' : 'Bust'}
                  </th>
                  <th className="py-3 px-3">
                    {lang === 'uz' ? 'Bel aylanasi' : lang === 'ru' ? 'Обхват талии' : 'Waist'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2B231D] font-mono">
                {sizeMatrix.map((row) => (
                  <tr key={row.int} className="hover:bg-[#28211C] transition">
                    <td className="py-3.5 px-3 font-bold text-white">{row.int}</td>
                    <td className="py-3.5 px-3 text-[#CF6E4C]">{row.eu}</td>
                    <td className="py-3.5 px-3 text-[#A89D8E]">{row.us}</td>
                    <td className="py-3.5 px-3 text-[#A89D8E]">{row.uk}</td>
                    <td className="py-3.5 px-3 text-white">
                      {unit === 'metric' ? `${row.bustCm} sm` : `${row.bustIn}"`}
                    </td>
                    <td className="py-3.5 px-3 text-white">
                      {unit === 'metric' ? `${row.waistCm} sm` : `${row.waistIn}"`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
};
