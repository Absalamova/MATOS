import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Phone, Send, Award, Scissors, Check, Plus, X, ExternalLink } from 'lucide-react';
import { Language, Currency } from '../types';

export interface Tailor {
  id: string;
  name: string;
  atelierName: string;
  city: string;
  district: string;
  specialtyKey: 'couture' | 'suit' | 'linen' | 'silk_chopon' | 'pants_jumpsuit';
  specialtyLabel: {
    uz: string;
    ru: string;
    en: string;
  };
  experienceYears: number;
  rating: number;
  reviewsCount: number;
  completedOrders: number;
  priceStartingUZS: number;
  phone: string;
  telegram: string;
  address: string;
  description: {
    uz: string;
    ru: string;
    en: string;
  };
}

const DEFAULT_TAILORS: Tailor[] = [
  {
    id: 'tailor-1',
    name: 'Dilnoza Umarova',
    atelierName: 'Atelier "Ipak Yo‘li Haute Couture"',
    city: 'Toshkent',
    district: 'Mirzo Ulug‘bek tumani',
    specialtyKey: 'couture',
    specialtyLabel: {
      uz: 'Oqshom va Kutyur Liboslari',
      ru: 'Вечерние и Haute Couture платья',
      en: 'Evening & Haute Couture Gowns',
    },
    experienceYears: 16,
    rating: 5.0,
    reviewsCount: 194,
    completedOrders: 520,
    priceStartingUZS: 250000,
    phone: '+998 (90) 845-12-34',
    telegram: '@dilnoza_couture',
    address: 'Buyuk Ipak Yo‘li ko‘chasi, 42-uy',
    description: {
      uz: 'Parij kutyur texnologiyalari bo‘yicha asimmetrik oqshom ko‘ylaklari, korsetli bando liboslari va ipak matolardan eksklyuziv bichim ustasi.',
      ru: 'Мастер высшей категории по вечерним платьям со сложной драпировкой, корсетам и асимметричным силуэтам.',
      en: 'Master artisan specializing in floor-sweeping evening gowns, structured corsetry, and fluid silk drape.',
    },
  },
  {
    id: 'tailor-2',
    name: 'Akmal Rustamov',
    atelierName: 'Bespoke Sartorial "Savile Tashkent"',
    city: 'Toshkent',
    district: 'Yakkasaroy tumani',
    specialtyKey: 'suit',
    specialtyLabel: {
      uz: 'Erkaklar & Ayollar Kostyumi, Trench',
      ru: 'Классические костюмы & Тренчи',
      en: 'Tailored Suits & Trench Coats',
    },
    experienceYears: 20,
    rating: 4.9,
    reviewsCount: 260,
    completedOrders: 890,
    priceStartingUZS: 350000,
    phone: '+998 (97) 710-55-99',
    telegram: '@savile_tashkent',
    address: 'Shota Rustaveli ko‘chasi, 18-uy',
    description: {
      uz: 'Italiya va Britaniya an’anaviy sartorial uslubida ikki bortli jaketlar, klassik shimlar va qalin zig‘ir/jun trench palto tikuvchisi.',
      ru: 'Индивидуальный пошив премиальных пиджаков, брюк и пальто по классической британской технологии.',
      en: 'Hand-tailored bespoke blazers, double-breasted jackets, and structured outerwear.',
    },
  },
  {
    id: 'tailor-3',
    name: 'Zilola Karimova',
    atelierName: 'Eco-Atelier "Pure Linen Studio"',
    city: 'Samarqand',
    district: 'Universitet xiyoboni',
    specialtyKey: 'linen',
    specialtyLabel: {
      uz: 'Yuvilgan Zig‘ir & Isrofsiz Yozgi Liboslar',
      ru: 'Варёный лён & Эко-сарафаны',
      en: 'Washed Linen & Zero-Waste Dresses',
    },
    experienceYears: 11,
    rating: 4.9,
    reviewsCount: 142,
    completedOrders: 380,
    priceStartingUZS: 180000,
    phone: '+998 (93) 330-88-22',
    telegram: '@purelinen_samarkand',
    address: 'Registon ko‘chasi, 5-uy',
    description: {
      uz: 'The Fabric Store vintage zig‘ir matolari, yaponcha erkin bichim va qisqarishni inobatga oluvchi isrofsiz sarafanlar mutaxassisi.',
      ru: 'Специалист по пошиву свободных льняных платьев, комбинезонов и летних комплектов с идеальной усадкой.',
      en: 'Specialist in relaxed pure linen tailoring, zero-waste cutting methods, and warm-weather staples.',
    },
  },
  {
    id: 'tailor-4',
    name: 'Muxlisa Qosimova',
    atelierName: 'National Heritage "Marg‘ilon Jilosi"',
    city: 'Farg‘ona',
    district: 'Marg‘ilon sh., Hunarmandlar markazi',
    specialtyKey: 'silk_chopon',
    specialtyLabel: {
      uz: 'Milliy Ipak Chopon & Kimono',
      ru: 'Шелковые Чапаны & Кимоно',
      en: 'Silk Robes & Modern Kimonos',
    },
    experienceYears: 24,
    rating: 5.0,
    reviewsCount: 318,
    completedOrders: 1150,
    priceStartingUZS: 280000,
    phone: '+998 (91) 680-44-11',
    telegram: '@margilon_jilosi',
    address: 'Ipakchilar ko‘chasi, 12-uy',
    description: {
      uz: 'Marg‘ilon shohisi, adras va tabiiy ipakdan an’anaviy hamda zamonaviy podium uslubidagi hashamatli choponlar tikish bo‘yicha xalq ustasi.',
      ru: 'Народный мастер по созданию аутентичных и подиумных шелковых чапанов и накидок из маргиланского иката.',
      en: 'Master artisan creating heritage silk robes, modern kimonos, and traditional abrbandi silk outerwear.',
    },
  },
  {
    id: 'tailor-5',
    name: 'Elena Semyonova',
    atelierName: 'Modern Tailoring "Atelier Line"',
    city: 'Toshkent',
    district: 'Chilonzor tumani',
    specialtyKey: 'pants_jumpsuit',
    specialtyLabel: {
      uz: 'Keng Shimlar, Kombinezon & Bluzka',
      ru: 'Брюки Палаццо & Комбинезоны',
      en: 'Wide-Leg Trousers & Jumpsuits',
    },
    experienceYears: 13,
    rating: 4.8,
    reviewsCount: 104,
    completedOrders: 410,
    priceStartingUZS: 190000,
    phone: '+998 (90) 155-77-33',
    telegram: '@atelier_line_uz',
    address: 'Bunyodkor shoh ko‘chasi, 23-uy',
    description: {
      uz: 'Palazzo shimlari, baland belli kombinezonlar va nozik paxta/tvil matolardan kundalik nafis garderob kiyimlari tikish ustasi.',
      ru: 'Безупречный крой широких брюк, комбинезонов и оверсайз рубашек из натуральных тканей.',
      en: 'Flawless cutting and finishing for palazzo trousers, bespoke jumpsuits, and casual chic shirts.',
    },
  },
];

interface TailorsDirectoryProps {
  lang: Language;
  currency: Currency;
  onShowToast: (msg: string) => void;
  onBackToAtelier?: () => void;
}

export const TailorsDirectory: React.FC<TailorsDirectoryProps> = ({
  lang,
  currency,
  onShowToast,
  onBackToAtelier,
}) => {
  const [tailors, setTailors] = useState<Tailor[]>(DEFAULT_TAILORS);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [bookingTailor, setBookingTailor] = useState<Tailor | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);

  // New tailor registration form
  const [newMasterName, setNewMasterName] = useState('');
  const [newAtelierName, setNewAtelierName] = useState('');
  const [newCity, setNewCity] = useState('Toshkent');
  const [newDistrict, setNewDistrict] = useState('');
  const [newSpecialty, setNewSpecialty] = useState<'couture' | 'suit' | 'linen' | 'silk_chopon' | 'pants_jumpsuit'>('couture');
  const [newExperience, setNewExperience] = useState(5);
  const [newPhone, setNewPhone] = useState('');
  const [newTelegram, setNewTelegram] = useState('');
  const [newPrice, setNewPrice] = useState(200000);

  // Booking contact form
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientFabricNote, setClientFabricNote] = useState('');

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('matos_tailors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTailors(parsed);
        }
      } else {
        localStorage.setItem('matos_tailors', JSON.stringify(DEFAULT_TAILORS));
      }
    } catch {
      // Default
    }
  }, []);

  const saveTailors = (updated: Tailor[]) => {
    setTailors(updated);
    try {
      localStorage.setItem('matos_tailors', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleRegisterTailor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName || !newPhone || !newAtelierName) {
      onShowToast(lang === 'uz' ? 'Iltimos, barcha maydonlarni to‘ldiring' : 'Please fill all fields');
      return;
    }

    const specialtyLabels = {
      couture: { uz: 'Oqshom va Kutyur Liboslari', ru: 'Вечерние и Haute Couture', en: 'Haute Couture Gowns' },
      suit: { uz: 'Erkaklar & Ayollar Kostyumi', ru: 'Костюмы & Пиджаки', en: 'Tailored Suits' },
      linen: { uz: 'Yuvilgan Zig‘ir & Isrofsiz Bichim', ru: 'Варёный лён & Сарафаны', en: 'Washed Linen' },
      silk_chopon: { uz: 'Milliy Ipak Chopon & Kimono', ru: 'Шелковые Чапаны', en: 'Silk Robes' },
      pants_jumpsuit: { uz: 'Keng Shimlar & Kombinezon', ru: 'Брюки & Комбинезоны', en: 'Trousers & Jumpsuits' },
    };

    const newTailor: Tailor = {
      id: `tailor-${Date.now()}`,
      name: newMasterName.trim(),
      atelierName: newAtelierName.trim(),
      city: newCity,
      district: newDistrict.trim() || `${newCity} markazi`,
      specialtyKey: newSpecialty,
      specialtyLabel: specialtyLabels[newSpecialty],
      experienceYears: Number(newExperience) || 5,
      rating: 5.0,
      reviewsCount: 1,
      completedOrders: 10,
      priceStartingUZS: Number(newPrice) || 200000,
      phone: newPhone.trim(),
      telegram: newTelegram.trim().startsWith('@') ? newTelegram.trim() : `@${newTelegram.trim()}`,
      address: `${newCity}, ${newDistrict}`,
      description: {
        uz: `${newAtelierName} atelyesi yetakchi ustasi. Tabiiy matolardan individual bichim va tikuv xizmati.`,
        ru: `Мастер ателье ${newAtelierName}. Индивидуальный пошив из натуральных тканей.`,
        en: `Master artisan at ${newAtelierName}, offering bespoke tailoring from premium natural textiles.`,
      },
    };

    const updated = [newTailor, ...tailors];
    saveTailors(updated);
    setIsRegisterOpen(false);
    onShowToast(
      lang === 'uz'
        ? `Atelier bazaga muvaffaqiyatli qo‘shildi: ${newMasterName}!`
        : `Atelier successfully registered: ${newMasterName}!`
    );

    // Reset form
    setNewMasterName('');
    setNewAtelierName('');
    setNewPhone('');
    setNewTelegram('');
  };

  const handleSendBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone) {
      onShowToast(lang === 'uz' ? 'Ism va telefoningizni kiriting' : 'Please provide name and phone');
      return;
    }

    onShowToast(
      lang === 'uz'
        ? `Buyurtma yuborildi! Usta ${bookingTailor?.name} tez orada (${clientPhone}) raqamiga aloqaga chiqadi.`
        : `Booking sent! Master ${bookingTailor?.name} will contact you shortly.`
    );
    setBookingTailor(null);
    setClientName('');
    setClientPhone('');
    setClientFabricNote('');
  };

  const filteredTailors = tailors.filter((t) => {
    const matchesCity = selectedCity === 'all' || t.city === selectedCity;
    const matchesSpecialty = selectedSpecialty === 'all' || t.specialtyKey === selectedSpecialty;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      t.name.toLowerCase().includes(query) ||
      t.atelierName.toLowerCase().includes(query) ||
      t.city.toLowerCase().includes(query) ||
      t.specialtyLabel[lang].toLowerCase().includes(query);

    return matchesCity && matchesSpecialty && matchesSearch;
  });

  const formatPrice = (uzs: number) => {
    if (currency === 'USD') return `$${Math.round(uzs / 12800)}`;
    if (currency === 'EUR') return `€${Math.round(uzs / 13800)}`;
    return `${new Intl.NumberFormat('uz-UZ').format(uzs)} so‘m`;
  };

  return (
    <section id="tailors" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      {onBackToAtelier && (
        <div className="mb-6">
          <button
            onClick={onBackToAtelier}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#8A7C6E] hover:text-[#B85D3B] transition px-4 py-2 rounded-xl border border-[#DDD5C7] bg-white shadow-2xs cursor-pointer"
          >
            <span>←</span>
            <span>{lang === 'uz' ? 'Matolar Katalogi & 3D Studiyaga qaytish' : lang === 'ru' ? 'Назад в Каталог и 3D Студию' : 'Back to Fabric Catalog & 3D Studio'}</span>
          </button>
        </div>
      )}
      
      {/* Title & Registration Action */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E3DBD0]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#B85D3B] mb-1">
            <Scissors className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Mahalliy & Xalqaro Kutyurlar' : lang === 'ru' ? 'База Мастеров & Ателье' : 'Bespoke Master Tailors'}</span>
            <span>•</span>
            <span className="text-[#1C1714]">{filteredTailors.length} {lang === 'uz' ? 'ta usta' : 'tailors'}</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#1C1714]">
            {lang === 'uz' ? 'Tikuvchilar va Atelyelar Bazasi' : lang === 'ru' ? 'Реестр Мастеров-Портных' : 'Bespoke Tailors & Ateliers'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6A5E52] mt-1 max-w-2xl">
            {lang === 'uz'
              ? 'Xarid qilgan matongizni isrofsiz va oliy mahorat bilan tikib beruvchi tajribali ustalar bilan to‘g‘ridan-to‘g‘ri bog‘laning.'
              : lang === 'ru'
              ? 'Прямая связь с проверенными мастерами индивидуального пошива из премиальных тканей.'
              : 'Direct access to verified master tailors specializing in bespoke cutting and fine natural fabrics.'}
          </p>
        </div>

        {/* Register new tailor button */}
        <button
          onClick={() => setIsRegisterOpen(true)}
          className="bg-[#1C1714] hover:bg-[#B85D3B] text-white px-5 py-3 rounded-2xl transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 text-[#D4AF37]" />
          <span>{lang === 'uz' ? 'Atelieringizni qo‘shish' : lang === 'ru' ? 'Добавить ателье' : 'Register as a Tailor'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E3DBD0] rounded-3xl p-4 sm:p-5 mt-6 shadow-sm space-y-4">
        
        {/* Row 1: Search & City */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-grow max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8071]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'uz' ? 'Usta yoki atelier nomi bo‘yicha qidiruv...' : 'Search master or atelier...'}
              className="w-full bg-[#FAF7F2] border border-[#DDD5C7] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
            />
          </div>

          {/* City selector pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-[#8A7C6E] font-bold mr-1">Shahar:</span>
            {['all', 'Toshkent', 'Samarqand', 'Buxoro', 'Farg‘ona'].map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  selectedCity === city
                    ? 'bg-[#1C1714] text-white'
                    : 'bg-[#FAF7F2] text-[#5A4F44] hover:bg-[#F2ECE3] border border-[#DDD5C7]'
                }`}
              >
                {city === 'all' ? (lang === 'uz' ? 'Barcha shaharlar' : 'All Cities') : city}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Specialty Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-[#F2ECE3]">
          <span className="text-[11px] font-mono text-[#8A7C6E] font-bold mr-1">Ixtisoslik:</span>
          {[
            { id: 'all', label: { uz: 'Barcha ixtisosliklar', ru: 'Все', en: 'All Specialties' } },
            { id: 'couture', label: { uz: 'Oqshom & Kutyur', ru: 'Кутюр & Платья', en: 'Couture Gowns' } },
            { id: 'suit', label: { uz: 'Kostyum & Trench', ru: 'Костюмы', en: 'Suits & Blazers' } },
            { id: 'linen', label: { uz: 'Zig‘ir & Yozgi Bichim', ru: 'Лён & Эко', en: 'Linen & Dresses' } },
            { id: 'silk_chopon', label: { uz: 'Ipak Chopon & Kimono', ru: 'Чапаны', en: 'Silk Robes' } },
            { id: 'pants_jumpsuit', label: { uz: 'Shim & Kombinezon', ru: 'Брюки', en: 'Trousers' } },
          ].map((sp) => (
            <button
              key={sp.id}
              onClick={() => setSelectedSpecialty(sp.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition ${
                selectedSpecialty === sp.id
                  ? 'bg-[#B85D3B] text-white font-bold'
                  : 'bg-[#FAF7F2] text-[#6A5E52] hover:bg-[#F2ECE3] border border-[#DDD5C7]'
              }`}
            >
              {sp.label[lang]}
            </button>
          ))}
        </div>

      </div>

      {/* Tailors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredTailors.map((tailor) => (
          <div
            key={tailor.id}
            className="bg-white rounded-3xl border border-[#DDD5C7] p-6 shadow-2xs hover:shadow-lg transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header: Avatar, Name & Rating */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#1C1714] text-white font-serif font-bold text-lg flex items-center justify-center shrink-0">
                    {tailor.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1C1714] leading-snug">
                      {tailor.name}
                    </h3>
                    <span className="text-[11px] text-[#B85D3B] font-mono font-medium block">
                      {tailor.atelierName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[#FAF5F0] border border-[#E3DBD0] px-2.5 py-1 rounded-xl shrink-0">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-xs text-[#1C1714]">{tailor.rating}</span>
                  <span className="text-[10px] text-[#8A7C6E]">({tailor.reviewsCount})</span>
                </div>
              </div>

              {/* Location & Specialty */}
              <div className="flex items-center gap-2 text-xs text-[#7F7264] mb-3">
                <MapPin className="w-3.5 h-3.5 text-[#B85D3B] shrink-0" />
                <span>{tailor.city}, {tailor.district}</span>
              </div>

              {/* Specialty Tag */}
              <div className="mb-3">
                <span className="inline-block bg-[#F4EFEB] text-[#1C1714] text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border border-[#DDD5C7]">
                  {tailor.specialtyLabel[lang]}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-[#5D5043] leading-relaxed mb-4 line-clamp-3">
                {tailor.description[lang]}
              </p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAF7F2] p-3 rounded-2xl border border-[#E8DFD3] mb-4 font-mono">
                <div>
                  <span className="text-[#8A7C6E] block text-[10px] uppercase">Tajriba:</span>
                  <span className="font-bold text-[#1C1714]">{tailor.experienceYears} yil</span>
                </div>
                <div>
                  <span className="text-[#8A7C6E] block text-[10px] uppercase">Tikuv narxi:</span>
                  <span className="font-bold text-[#B85D3B]">
                    {formatPrice(tailor.priceStartingUZS)} dan
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Actions */}
            <div className="pt-2 flex items-center gap-2 border-t border-[#F2ECE3]">
              <button
                onClick={() => setBookingTailor(tailor)}
                className="flex-1 bg-[#1C1714] hover:bg-[#B85D3B] text-white py-2.5 px-3 rounded-xl transition text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Scissors className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{lang === 'uz' ? 'Bog‘lanish & Buyurtma' : 'Book Tailor'}</span>
              </button>

              <a
                href={`https://t.me/${tailor.telegram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#DDD5C7] text-[#2A6E9E] hover:bg-[#EBF5FB] transition flex items-center justify-center shrink-0"
                title="Telegram orqali bog‘lanish"
              >
                <Send className="w-4 h-4" />
              </a>
            </div>

          </div>
        ))}
      </div>

      {/* Booking / Contact Modal */}
      {bookingTailor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#DFD7CB] relative">
            <button
              onClick={() => setBookingTailor(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#DDD5C7] text-[#6A5E52] hover:text-[#1C1714] flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-[#E3DBD0] mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1714] text-white font-serif font-bold text-xl flex items-center justify-center">
                {bookingTailor.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1C1714]">{bookingTailor.name}</h3>
                <span className="text-xs text-[#B85D3B] font-mono">{bookingTailor.atelierName}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-xs text-[#5D5043]">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#DFD7CB]">
                <span>Telefon:</span>
                <a href={`tel:${bookingTailor.phone}`} className="font-mono font-bold text-[#1C1714] text-sm">
                  {bookingTailor.phone}
                </a>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#DFD7CB]">
                <span>Telegram:</span>
                <span className="font-mono font-bold text-[#2A6E9E]">{bookingTailor.telegram}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#DFD7CB]">
                <span className="block text-[10px] text-[#887A6D] uppercase font-mono">Manzil:</span>
                <span className="font-medium text-[#1C1714]">{bookingTailor.address}</span>
              </div>
            </div>

            {/* Quick Consultation Request Form */}
            <form onSubmit={handleSendBooking} className="space-y-3 pt-2 border-t border-[#E3DBD0]">
              <h4 className="text-xs font-bold text-[#1C1714]">
                {lang === 'uz' ? 'Ustaga onlayn buyurtma so‘rovi yuborish:' : 'Request Consultation:'}
              </h4>
              <input
                type="text"
                placeholder={lang === 'uz' ? 'Ismingiz' : 'Your Name'}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#B85D3B]"
                required
              />
              <input
                type="tel"
                placeholder={lang === 'uz' ? 'Telefon raqamingiz' : 'Phone Number'}
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#B85D3B]"
                required
              />
              <textarea
                placeholder={lang === 'uz' ? 'Mato va fason haqida qisqacha (masalan: 2.5m zig‘ir, asimmetrik libos)' : 'Fabric & garment notes'}
                value={clientFabricNote}
                onChange={(e) => setClientFabricNote(e.target.value)}
                rows={2}
                className="w-full bg-white border border-[#DDD5C7] rounded-xl p-3 text-xs focus:outline-none focus:border-[#B85D3B]"
              />

              <button
                type="submit"
                className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white py-3 rounded-xl transition text-xs font-bold uppercase tracking-wider shadow-md"
              >
                {lang === 'uz' ? 'So‘rovni Yuborish' : 'Send Booking Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Atelier Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#DFD7CB] relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsRegisterOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#DDD5C7] text-[#6A5E52] hover:text-[#1C1714] flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-serif font-bold text-xl text-[#1C1714] mb-1">
              {lang === 'uz' ? 'Atelieringizni Ro‘yxatdan O‘tkazish' : 'Register Your Atelier'}
            </h3>
            <p className="text-xs text-[#6A5E52] mb-5">
              {lang === 'uz'
                ? 'Mijozlarimiz xarid qilgan matolarini sizga olib kelishlari uchun atelye profilini yarating.'
                : 'Join our bespoke network to connect with fabric clients looking for skilled tailors.'}
            </p>

            <form onSubmit={handleRegisterTailor} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#4B4036] font-bold mb-1">Usta Ism-Familiyasi:</label>
                <input
                  type="text"
                  placeholder="masalan: Malika Karimova"
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#4B4036] font-bold mb-1">Atelier / Studiya Nomi:</label>
                <input
                  type="text"
                  placeholder="masalan: Silk & Linen Haute Studio"
                  value={newAtelierName}
                  onChange={(e) => setNewAtelierName(e.target.value)}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Shahar:</label>
                  <select
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3 py-2"
                  >
                    <option value="Toshkent">Toshkent</option>
                    <option value="Samarqand">Samarqand</option>
                    <option value="Buxoro">Buxoro</option>
                    <option value="Farg‘ona">Farg‘ona / Marg‘ilon</option>
                    <option value="Andijon">Andijon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Tuman / Ko‘cha:</label>
                  <input
                    type="text"
                    placeholder="Chilonzor tumani"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4B4036] font-bold mb-1">Asosiy Ixtisoslik:</label>
                <select
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value as any)}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3 py-2"
                >
                  <option value="couture">Oqshom va Kutyur Liboslari</option>
                  <option value="suit">Erkaklar & Ayollar Kostyumi, Trench</option>
                  <option value="linen">Yuvilgan Zig‘ir & Isrofsiz Yozgi Liboslar</option>
                  <option value="silk_chopon">Milliy Ipak Chopon & Kimono</option>
                  <option value="pants_jumpsuit">Keng Shimlar, Kombinezon & Bluzka</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Tajriba (yil):</label>
                  <input
                    type="number"
                    value={newExperience}
                    onChange={(e) => setNewExperience(Number(e.target.value))}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  />
                </div>
                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Boshlang‘ich narx (so‘m):</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Telefon raqam:</label>
                  <input
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#4B4036] font-bold mb-1">Telegram (@username):</label>
                  <input
                    type="text"
                    placeholder="@atelier_username"
                    value={newTelegram}
                    onChange={(e) => setNewTelegram(e.target.value)}
                    className="w-full bg-white border border-[#DDD5C7] rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#B85D3B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white py-3 rounded-xl transition text-xs font-bold uppercase tracking-wider shadow-md mt-3"
              >
                {lang === 'uz' ? 'Profilni Saqlash' : 'Register Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

    </section>
  );
};
