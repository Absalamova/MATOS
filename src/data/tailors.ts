import { GarmentTypeKey, Localized } from '../types';

export type SpecialtyKey = 'couture' | 'suit' | 'linen' | 'silk_chopon' | 'pants_jumpsuit';

export interface Tailor {
  id: string;
  name: string;
  atelierName: string;
  city: string;
  district: string;
  specialtyKey: SpecialtyKey;
  specialtyLabel: Localized;
  experienceYears: number;
  /** null until the atelier has real reviews */
  rating: number | null;
  reviewsCount: number;
  completedOrders: number;
  priceStartingUZS: number;
  /** Typical lead time in days */
  leadDays: number;
  phone: string;
  telegram: string;
  address: string;
  description: Localized;
}

export const SPECIALTIES: { id: SpecialtyKey; label: Localized; garments: GarmentTypeKey[] }[] = [
  {
    id: 'couture',
    label: { uz: 'Kechki liboslar', ru: 'Вечерние платья', en: 'Eveningwear' },
    garments: ['evening_gown', 'one_shoulder_gown', 'strapless_cocktail', 'slip_dress'],
  },
  {
    id: 'suit',
    label: { uz: 'Kostyum va palto', ru: 'Костюмы и пальто', en: 'Suits & coats' },
    garments: ['blazer', 'trench'],
  },
  {
    id: 'linen',
    label: { uz: 'Zig‘ir va yozgi kiyim', ru: 'Лён и летняя одежда', en: 'Linen & summer' },
    garments: ['slip_dress', 'pleated_dress', 'shirt', 'mondrian_dress'],
  },
  {
    id: 'silk_chopon',
    label: { uz: 'Chopon va kimono', ru: 'Чапаны и кимоно', en: 'Chapans & kimonos' },
    garments: ['kimono'],
  },
  {
    id: 'pants_jumpsuit',
    label: { uz: 'Shim va kombinezon', ru: 'Брюки и комбинезоны', en: 'Trousers & jumpsuits' },
    garments: ['jumpsuit', 'shirt'],
  },
];

export const specialtyFor = (key: SpecialtyKey) => SPECIALTIES.find((s) => s.id === key) || SPECIALTIES[0];

export const CITIES = ['Toshkent', 'Samarqand', 'Buxoro', 'Farg‘ona', 'Andijon', 'Namangan'];

export const DEFAULT_TAILORS: Tailor[] = [
  {
    id: 'tailor-1',
    name: 'Dilnoza Umarova',
    atelierName: 'Ipak Yo‘li atelyesi',
    city: 'Toshkent',
    district: 'Mirzo Ulug‘bek tumani',
    specialtyKey: 'couture',
    specialtyLabel: specialtyFor('couture').label,
    experienceYears: 16,
    rating: 5.0,
    reviewsCount: 194,
    completedOrders: 520,
    priceStartingUZS: 450000,
    leadDays: 14,
    phone: '+998 90 845 12 34',
    telegram: '@dilnoza_couture',
    address: 'Buyuk Ipak Yo‘li ko‘chasi, 42',
    description: {
      uz: 'Korsetli va asimmetrik kechki ko‘ylaklar, ipakdan murakkab drapirovka.',
      ru: 'Корсетные и асимметричные вечерние платья, сложная драпировка из шёлка.',
      en: 'Corseted and asymmetric evening gowns, complex silk draping.',
    },
  },
  {
    id: 'tailor-2',
    name: 'Akmal Rustamov',
    atelierName: 'Savile Tashkent',
    city: 'Toshkent',
    district: 'Yakkasaroy tumani',
    specialtyKey: 'suit',
    specialtyLabel: specialtyFor('suit').label,
    experienceYears: 20,
    rating: 4.9,
    reviewsCount: 260,
    completedOrders: 890,
    priceStartingUZS: 650000,
    leadDays: 21,
    phone: '+998 97 710 55 99',
    telegram: '@savile_tashkent',
    address: 'Shota Rustaveli ko‘chasi, 18',
    description: {
      uz: 'Ikki bortli jaketlar, klassik shimlar va qalin zig‘ir yoki jundan palto.',
      ru: 'Двубортные жакеты, классические брюки и пальто из плотного льна или шерсти.',
      en: 'Double-breasted jackets, classic trousers and heavy linen or wool coats.',
    },
  },
  {
    id: 'tailor-3',
    name: 'Zilola Karimova',
    atelierName: 'Pure Linen Studio',
    city: 'Samarqand',
    district: 'Universitet xiyoboni',
    specialtyKey: 'linen',
    specialtyLabel: specialtyFor('linen').label,
    experienceYears: 11,
    rating: 4.9,
    reviewsCount: 142,
    completedOrders: 380,
    priceStartingUZS: 280000,
    leadDays: 10,
    phone: '+998 93 330 88 22',
    telegram: '@purelinen_samarkand',
    address: 'Registon ko‘chasi, 5',
    description: {
      uz: 'Zig‘irdan erkin ko‘ylak va sarafanlar, qisqarishni hisobga olgan isrofsiz bichim.',
      ru: 'Свободные льняные платья и сарафаны, безотходный крой с учётом усадки.',
      en: 'Relaxed linen dresses and sundresses, zero-waste cutting that accounts for shrinkage.',
    },
  },
  {
    id: 'tailor-4',
    name: 'Muxlisa Qosimova',
    atelierName: 'Marg‘ilon jilosi',
    city: 'Farg‘ona',
    district: 'Marg‘ilon, Hunarmandlar markazi',
    specialtyKey: 'silk_chopon',
    specialtyLabel: specialtyFor('silk_chopon').label,
    experienceYears: 24,
    rating: 5.0,
    reviewsCount: 318,
    completedOrders: 1150,
    priceStartingUZS: 380000,
    leadDays: 12,
    phone: '+998 91 680 44 11',
    telegram: '@margilon_jilosi',
    address: 'Ipakchilar ko‘chasi, 12',
    description: {
      uz: 'Adras va atlasdan an’anaviy hamda zamonaviy choponlar.',
      ru: 'Традиционные и современные чапаны из адраса и атласа.',
      en: 'Traditional and modern chapans in adras and atlas silk.',
    },
  },
  {
    id: 'tailor-5',
    name: 'Elena Semyonova',
    atelierName: 'Atelier Line',
    city: 'Toshkent',
    district: 'Chilonzor tumani',
    specialtyKey: 'pants_jumpsuit',
    specialtyLabel: specialtyFor('pants_jumpsuit').label,
    experienceYears: 13,
    rating: 4.8,
    reviewsCount: 104,
    completedOrders: 410,
    priceStartingUZS: 320000,
    leadDays: 10,
    phone: '+998 90 155 77 33',
    telegram: '@atelier_line_uz',
    address: 'Bunyodkor shoh ko‘chasi, 23',
    description: {
      uz: 'Palazzo shimlar, kombinezonlar va oversayz rubashkalar.',
      ru: 'Брюки палаццо, комбинезоны и рубашки оверсайз.',
      en: 'Palazzo trousers, jumpsuits and oversized shirts.',
    },
  },
  {
    id: 'tailor-6',
    name: 'Gulnora Hasanova',
    atelierName: 'Buxoro zardo‘zi',
    city: 'Buxoro',
    district: 'Eski shahar',
    specialtyKey: 'couture',
    specialtyLabel: specialtyFor('couture').label,
    experienceYears: 18,
    rating: 4.9,
    reviewsCount: 87,
    completedOrders: 260,
    priceStartingUZS: 400000,
    leadDays: 18,
    phone: '+998 65 221 40 40',
    telegram: '@bukhara_zardozi',
    address: 'Xo‘ja Nurobod ko‘chasi, 7',
    description: {
      uz: 'Kechki ko‘ylaklarga zardo‘zi kashta va qo‘l ishlari.',
      ru: 'Вечерние платья с золотым шитьём зардози и ручной отделкой.',
      en: 'Evening dresses with zardozi gold embroidery and hand finishing.',
    },
  },
];
