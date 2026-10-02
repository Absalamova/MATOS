import { GarmentSilhouette } from '../types';

export const GARMENTS: GarmentSilhouette[] = [
  {
    id: 'garment-one-shoulder',
    typeKey: 'one_shoulder_gown',
    name: {
      uz: 'Asimmetrik Bir Yelkali Maksi Libos (Runway)',
      ru: 'Асимметричное Платье с Разрезом (Runway)',
      en: 'Asymmetric One-Shoulder Slit Gown',
    },
    estimatedMeters: 3.2,
    estimatedYards: 3.5,
    difficulty: {
      uz: 'Yuqori (Asimmetriya va kesim)',
      ru: 'Высокая (Асимметрия и разрез)',
      en: 'Advanced (Asymmetric drape)',
    },
    description: {
      uz: 'Bir yelkadan o‘tuvchi nafis diagonal tasma, tana bo‘ylab qad ko‘rsatuvchi siluet va chuqur oyoq kesimi.',
      ru: 'Эффектное платье на одно плечо с глубоким разрезом от бедра и контрастным скульптурным лифом.',
      en: 'Dramatic single-strap evening column gown with high leg slit and graphic diagonal colorblock.',
    },
  },
  {
    id: 'garment-mondrian-dress',
    typeKey: 'mondrian_dress',
    name: {
      uz: 'Mondrian Geometrik Kokteyl Libosi',
      ru: 'Геометрическое Платье Мондриан',
      en: 'Mondrian Geometric Shift Dress',
    },
    estimatedMeters: 2.0,
    estimatedYards: 2.2,
    difficulty: {
      uz: 'O‘rtacha (To‘g‘ri bloklar)',
      ru: 'Средняя (Геометрические блоки)',
      en: 'Intermediate (Linear colorblocks)',
    },
    description: {
      uz: 'Parij kutyurining klassik geometrik qiyofasi: yengsiz siluet, aniq qora chiziqlar va rang bloklari.',
      ru: 'Культовое силуэтное мини-платье без рукавов с контрастными графичными блоками в стиле поп-арт.',
      en: 'Architectural sleeveless shift mini dress featuring clean grid lines and bold color-block inserts.',
    },
  },
  {
    id: 'garment-strapless-cocktail',
    typeKey: 'strapless_cocktail',
    name: {
      uz: 'Bando Kokteyl Libosi (Shleyfli)',
      ru: 'Платье-Бандо с Хвостом-Шлейфом',
      en: 'Strapless Colorblock Mini & Train',
    },
    estimatedMeters: 2.4,
    estimatedYards: 2.6,
    difficulty: {
      uz: 'O‘rtacha-yuqori (Korsetli bando)',
      ru: 'Выше среднего (Корсетное бандо)',
      en: 'Intermediate-Advanced (Corsetry)',
    },
    description: {
      uz: 'Yelkasiz qat’iy bando korseti, kontrastli vertikal bloklar va orqadan tushuvchi nafis shleyf.',
      ru: 'Облегающий силуэт без бретелей с акцентным вертикальным колор-блоком и драпированным шлейфом.',
      en: 'Strapless body-contour mini dress accented with clean geometric panelling and waterfall back drape.',
    },
  },
  {
    id: 'garment-slip-dress',
    typeKey: 'slip_dress',
    name: {
      uz: 'Nafis Yozgi Slip Libos',
      ru: 'Минималистичное Платье-Слип',
      en: 'Minimalist Bias-Cut Slip Dress',
    },
    estimatedMeters: 2.2,
    estimatedYards: 2.4,
    difficulty: {
      uz: 'O‘rtacha (Qiya bichim)',
      ru: 'Средняя (Крой по косой)',
      en: 'Intermediate (Bias grainline)',
    },
    description: {
      uz: 'Nozik yelkama-yelka tasmali, tana chiziqlari bo‘ylab tabiiy erkin to‘kiluvchi zamonaviy libos.',
      ru: 'Лаконичный струящийся силуэт на тонких бретелях с естественным пластичным облеганием.',
      en: 'Effortless 90s-inspired slip dress with fluid bias drape that gracefully skims body contours.',
    },
  },
  {
    id: 'garment-evening-gown',
    typeKey: 'evening_gown',
    name: {
      uz: 'Hashamatli Oqshom Maksi Libosi',
      ru: 'Вечернее Платье Макси в Пол',
      en: 'Architectural Evening Maxi Gown',
    },
    estimatedMeters: 3.6,
    estimatedYards: 3.9,
    difficulty: {
      uz: 'Yuqori (Haute Couture)',
      ru: 'Высокая (Haute Couture)',
      en: 'Advanced (Haute Couture)',
    },
    description: {
      uz: 'Baland qad-qomatni namoyon etuvchi, etaklari erkin to‘lqinlanib yerga qadar tushuvchi oliy toifa fason.',
      ru: 'Величественное платье в пол со скульптурным лифом и роскошными ниспадающими фалдами подола.',
      en: 'Dramatic floor-sweeping gown with fitted corset-like waist and cascading voluminous drapery.',
    },
  },
  {
    id: 'garment-blazer',
    typeKey: 'blazer',
    name: {
      uz: 'Klassik Sartorial Jaket',
      ru: 'Двубортный Сарториальный Блейзер',
      en: 'Tailored Double-Breasted Blazer',
    },
    estimatedMeters: 2.8,
    estimatedYards: 3.1,
    difficulty: {
      uz: 'Yuqori (Klassik bichim)',
      ru: 'Высокая (Классический тейлоринг)',
      en: 'Advanced (Bespoke Tailoring)',
    },
    description: {
      uz: 'Yelka chizig‘i qat’iy, lapellari keng va bel qismi nozik ta’kidlangan zamonaviy shahar kostyumi.',
      ru: 'Архитектурный пиджак с четкой плечевой линией, широкими лацканами и безупречной посадкой.',
      en: 'Impeccable sharp-shouldered blazer with peaked lapels and structural interlinings.',
    },
  },
  {
    id: 'garment-trench',
    typeKey: 'trench',
    name: {
      uz: 'Belbog‘li Klassik Trench Palto',
      ru: 'Классический Поясной Тренчкот',
      en: 'Structured Belted Trench Coat',
    },
    estimatedMeters: 3.4,
    estimatedYards: 3.7,
    difficulty: {
      uz: 'Professional (Ko‘p detallar)',
      ru: 'Профессиональная (Множество деталей)',
      en: 'Expert (Double yoke & storm flaps)',
    },
    description: {
      uz: 'Keng yoqali, shamoldan himoyalovchi qo‘sh ko‘krakli va qalin kamarli abadiy garderob asosi.',
      ru: 'Культовый длинный тренч с погонами, отлетной кокеткой и плотным поясом на талии.',
      en: 'Iconic double-breasted longline trench with storm flaps, epaulettes, and deep belted cinch.',
    },
  },
  {
    id: 'garment-kimono',
    typeKey: 'kimono',
    name: {
      uz: 'Milliy Ipak Chopon / Kimono Robe',
      ru: 'Шелковый Восточный Чапан / Кимоно',
      en: 'Heritage Silk Robe / Atelier Kimono',
    },
    estimatedMeters: 3.0,
    estimatedYards: 3.3,
    difficulty: {
      uz: 'Oson-o‘rtacha (To‘g‘ri bichim)',
      ru: 'Легкая / Средняя (Прямой крой)',
      en: 'Beginner-Friendly (Geometric lines)',
    },
    description: {
      uz: 'Sharqona keng yenglar, qulay erkin bichim va ipak matoning to‘liq jilosini ko‘rsatuvchi hashamatli chopon.',
      ru: 'Свободный распашной крой, широкие рукава и великолепная демонстрация роскошной фактуры ткани.',
      en: 'Relaxed kimono silhouette with dramatic wide sleeves, showcasing the full brilliance of the fabric.',
    },
  },
  {
    id: 'garment-jumpsuit',
    typeKey: 'jumpsuit',
    name: {
      uz: 'Keng Bichimli Kombinezon (Jumpsuit)',
      ru: 'Широкий Элегантный Комбинезон',
      en: 'Wide-Leg Tailored Jumpsuit',
    },
    estimatedMeters: 3.2,
    estimatedYards: 3.5,
    difficulty: {
      uz: 'O‘rtacha-yuqori',
      ru: 'Выше среднего',
      en: 'Upper-Intermediate',
    },
    description: {
      uz: 'Baland belli, erkin va keng paxta/zig‘ir shimlari bilan birlashtirilgan zamonaviy monoxrom qiyofa.',
      ru: 'Высокая посадка, струящиеся широкие палаццо-брюки и приталенный минималистичный верх.',
      en: 'High-waisted tailored jumpsuit featuring sweeping palazzo trousers and a clean halter or V-neckline.',
    },
  },
  {
    id: 'garment-shirt',
    typeKey: 'shirt',
    name: {
      uz: 'Keng Fason Atelier Ko‘ylak / Bluzka',
      ru: 'Оверсайз Рубашка Atelier',
      en: 'Oversized Atelier Relaxed Shirt',
    },
    estimatedMeters: 1.8,
    estimatedYards: 2.0,
    difficulty: {
      uz: 'O‘rtacha (Yoqa va manjetlar)',
      ru: 'Средняя (Воротник и манжеты)',
      en: 'Intermediate (Collar stand & cuffs)',
    },
    description: {
      uz: 'Tushirilgan yelka chizig‘i, klassik yoqa va tabiiy matoning erkin nafas olishini ta’minlovchi qulay bichim.',
      ru: 'Свободная посадка, спущенное плечо, французские швы и комфортный непринужденный силуэт.',
      en: 'Generously proportioned button-down shirt with dropped shoulders and elongated clean cuffs.',
    },
  },
  {
    id: 'garment-pleated-dress',
    typeKey: 'pleated_dress',
    name: {
      uz: 'A-Bichimli Qatlamli Libos',
      ru: 'А-Силуэтное Платье с Мягкими Складками',
      en: 'Fluted A-Line Pleated Atelier Dress',
    },
    estimatedMeters: 2.7,
    estimatedYards: 3.0,
    difficulty: {
      uz: 'O‘rtacha (Qatlamlar hisobi)',
      ru: 'Средняя (Равномерные складки)',
      en: 'Intermediate (Pleat distribution)',
    },
    description: {
      uz: 'Yengil kengayib boruvchi trapeziya shakli, qomatga urg‘u beruvchi vertikal burmalar va to‘qimaning jozibasi.',
      ru: 'Расклешенный силуэт А-линии с мягкими вертикальными складками, подчеркивающими пластику ткани.',
      en: 'Graceful A-line fluted dress featuring sculpted box pleats that expand organically during motion.',
    },
  },
];
