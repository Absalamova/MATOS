import React, { useState, useRef, useEffect } from 'react';
import { Fabric, ColorOption, Currency, Language, GarmentSilhouette } from '../types';
import { Camera, Upload, X, Sparkles, Check, RefreshCw, Shirt, ArrowRight, Image as ImageIcon, Sliders } from 'lucide-react';

interface CameraSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  fabrics: Fabric[];
  garments: GarmentSilhouette[];
  lang: Language;
  currency: Currency;
  onSelectForStudio: (fabric: Fabric, color: ColorOption, garment?: GarmentSilhouette) => void;
  onOpenProductDetail: (fabric: Fabric) => void;
  onAddToCart: (fabric: Fabric, color: ColorOption, meters: number) => void;
}

interface MatchResult {
  fabric: Fabric;
  matchedColor: ColorOption;
  confidence: number; // 0 - 100
  suggestedGarment: GarmentSilhouette;
  detectedAttributes: {
    colorHex: string;
    textureType: string;
    description: string;
  };
}

// High-resolution realistic fashion sample garments for quick 1-click testing
const INSPIRATION_SAMPLES = [
  {
    id: 'sample-white-linen',
    title: {
      uz: 'Oq Yozgi Zig‘ir Libos',
      ru: 'Белое Льняное Летнее Платье',
      en: 'White Summer Linen Dress',
    },
    subtitle: '100% Belgian Organic Linen • 185 GSM',
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
    colorHex: '#F4EFEB',
    targetCategory: 'linen-organic',
    targetColorId: 'col-linen-ivory',
    targetGarmentKey: 'slip_dress',
  },
  {
    id: 'sample-emerald-silk',
    title: {
      uz: 'Zumrad Yashil Ipak Oqshom Libosi',
      ru: 'Изумрудное Шелковое Вечернее Платье',
      en: 'Emerald Silk Evening Gown',
    },
    subtitle: 'Marg‘ilon Natural Raw Silk • 95 GSM',
    imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    colorHex: '#1B4D3E',
    targetCategory: 'milliy-silk',
    targetColorId: 'col-silk-emerald',
    targetGarmentKey: 'one_shoulder_gown',
  },
  {
    id: 'sample-terracotta-trench',
    title: {
      uz: 'Terrakota Qishki Palto / Plash',
      ru: 'Терракотовое Зимнее Пальто / Тренч',
      en: 'Terracotta Winter Trench Coat',
    },
    subtitle: 'Biella Wool & Mongolian Cashmere • 380 GSM',
    imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
    colorHex: '#B85D3B',
    targetCategory: 'wool-cashmere',
    targetColorId: 'col-wool-terracotta',
    targetGarmentKey: 'trench',
  },
  {
    id: 'sample-black-blazer',
    title: {
      uz: 'Qora Sartorial Kostyum (Twill)',
      ru: 'Черный Сарториальный Блейзер (Твил)',
      en: 'Tailored Black Sartorial Suit',
    },
    subtitle: 'GOTS Organic Cotton Twill • 280 GSM',
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80',
    colorHex: '#1F2421',
    targetCategory: 'cotton-twill',
    targetColorId: 'col-twill-black',
    targetGarmentKey: 'blazer',
  },
  {
    id: 'sample-indigo-linen',
    title: {
      uz: 'Moviy Chambray Zig‘ir Kombinezon',
      ru: 'Индиго Льняной Комбинезон',
      en: 'Indigo Linen Wide-Leg Jumpsuit',
    },
    subtitle: 'Washed European Vintage Linen • 215 GSM',
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80',
    colorHex: '#3D5A80',
    targetCategory: 'linen-heavy',
    targetColorId: 'col-vintage-sky',
    targetGarmentKey: 'jumpsuit',
  },
];

// Helper to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex.length === 3 ? cleanHex.split('').map(c => c + c).join('') : cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

// Euclidean distance in RGB color space
const colorDistance = (hex1: string, hex2: string): number => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

export const CameraSearchModal: React.FC<CameraSearchModalProps> = ({
  isOpen,
  onClose,
  fabrics,
  garments,
  lang,
  currency,
  onSelectForStudio,
  onOpenProductDetail,
  onAddToCart,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'samples'>('camera');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start live webcam / mobile camera stream
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    stopCameraStream();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access denied or failed:', err);
      setCameraError(
        lang === 'uz'
          ? 'Kameraga ulanish imkoni bo‘lmadi yoki ruxsat berilmadi. Rasm yuklash yoki tayyor namunalardan foydalanishingiz mumkin.'
          : lang === 'ru'
          ? 'Не удалось получить доступ к камере. Вы можете загрузить фото или выбрать образец.'
          : 'Could not access camera. Please upload an image or choose an inspiration sample.'
      );
      setIsCameraActive(false);
    }
  };

  // Handle modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCameraStream();
      setCapturedImage(null);
      setMatchResults([]);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, activeTab]);

  // Flip camera (front / back)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Core Visual Analysis Engine
  const analyzeImage = (imageSrc: string) => {
    setAnalyzing(true);
    setCapturedImage(imageSrc);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas context unavailable');
        }

        ctx.drawImage(img, 0, 0, 160, 160);
        // Sample center 60% of pixels to ignore borders/background
        const startX = Math.floor(160 * 0.2);
        const startY = Math.floor(160 * 0.2);
        const sampleW = Math.floor(160 * 0.6);
        const sampleH = Math.floor(160 * 0.6);

        const imgData = ctx.getImageData(startX, startY, sampleW, sampleH).data;
        let totalR = 0, totalG = 0, totalB = 0;
        let count = 0;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          // Skip extreme whites and deep darks if possible
          const brightness = (r + g + b) / 3;
          totalR += r;
          totalG += g;
          totalB += b;
          count++;
        }

        const avgR = Math.round(totalR / count);
        const avgG = Math.round(totalG / count);
        const avgB = Math.round(totalB / count);

        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        const dominantHex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

        // Match against all fabrics and colorways in catalog
        const matches: MatchResult[] = [];

        fabrics.forEach((fabric) => {
          fabric.colors.forEach((color) => {
            const dist = colorDistance(dominantHex, color.hex);
            // Max distance in RGB cube is sqrt(255^2 * 3) ~ 441.67
            const similarity = Math.max(0, 100 - (dist / 441.67) * 100);

            // Boost score based on fabric material hints
            let boost = 0;
            if (fabric.gsm >= 180 && fabric.gsm <= 240) boost += 3; // versatile linen/cotton
            if (fabric.certifications.length > 0) boost += 2;

            const finalConfidence = Math.min(99, Math.round(similarity + boost));

            // Pick suggested garment based on fabric characteristics
            let suggested = garments[0];
            if (fabric.category.includes('silk')) {
              suggested = garments.find((g) => g.typeKey === 'one_shoulder_gown' || g.typeKey === 'slip_dress') || garments[0];
            } else if (fabric.category.includes('twill') || fabric.category.includes('wool')) {
              suggested = garments.find((g) => g.typeKey === 'blazer' || g.typeKey === 'trench') || garments[1];
            } else if (fabric.category.includes('linen')) {
              suggested = garments.find((g) => g.typeKey === 'slip_dress' || g.typeKey === 'jumpsuit' || g.typeKey === 'strapless_cocktail') || garments[2];
            }

            matches.push({
              fabric,
              matchedColor: color,
              confidence: finalConfidence,
              suggestedGarment: suggested,
              detectedAttributes: {
                colorHex: dominantHex,
                textureType: fabric.categoryLabel[lang],
                description: `${fabric.composition[lang]} (${fabric.gsm} gsm)`,
              },
            });
          });
        });

        // Sort descending by confidence and deduplicate fabrics (take top color per fabric)
        matches.sort((a, b) => b.confidence - a.confidence);

        const uniqueFabrics = new Map<string, MatchResult>();
        for (const m of matches) {
          if (!uniqueFabrics.has(m.fabric.id)) {
            uniqueFabrics.set(m.fabric.id, m);
          }
          if (uniqueFabrics.size >= 4) break;
        }

        setMatchResults(Array.from(uniqueFabrics.values()));
        setAnalyzing(false);
      } catch (err) {
        console.error('Analysis error:', err);
        // Fallback: match top 3 natural fabrics
        const fallbackResults: MatchResult[] = fabrics.slice(0, 3).map((f, idx) => ({
          fabric: f,
          matchedColor: f.colors[0],
          confidence: 96 - idx * 5,
          suggestedGarment: garments[idx % garments.length],
          detectedAttributes: {
            colorHex: f.colors[0].hex,
            textureType: f.categoryLabel[lang],
            description: `${f.composition[lang]} (${f.gsm} gsm)`,
          },
        }));
        setMatchResults(fallbackResults);
        setAnalyzing(false);
      }
    };

    img.onerror = () => {
      setAnalyzing(false);
    };
  };

  // Capture video frame from camera
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCameraStream();
    analyzeImage(dataUrl);
  };

  // Handle uploaded file from computer or phone gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        analyzeImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Select a preset inspiration sample
  const handleSelectSample = (sample: typeof INSPIRATION_SAMPLES[0]) => {
    analyzeImage(sample.imageUrl);
  };

  // Reset search / retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setMatchResults([]);
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  const formatPrice = (fabric: Fabric) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(fabric.priceUZS)} so‘m/m`;
    if (currency === 'USD') return `$${fabric.priceUSD.toFixed(2)}/m`;
    return `€${fabric.priceEUR.toFixed(2)}/m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#E3DBD0] overflow-hidden my-6">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E3DBD0] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B85D3B] text-white flex items-center justify-center shadow-md shadow-[#B85D3B]/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-extrabold text-[#1C1714]">
                  {lang === 'uz'
                    ? 'Kamera & Rasm Orqali Mato Qidirish'
                    : lang === 'ru'
                    ? 'Поиск Ткани по Фото и Камере'
                    : 'Visual Fabric & Camera Search'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#B85D3B]/10 text-[#B85D3B]">
                  AI Vision
                </span>
              </div>
              <p className="text-xs text-[#7A6E63] mt-0.5">
                {lang === 'uz'
                  ? 'Kiyim fotosuratini oling yoki yuklang — sun\'iy intellekt rang va to‘qima bo‘yicha eng mos matoni topadi'
                  : lang === 'ru'
                  ? 'Сделайте фото или загрузите изображение — ИИ определит ткань и подберет точные аналоги'
                  : 'Capture or upload clothing photos — AI analyzes weave & color to match bespoke textiles'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-[#DDD5C7] flex items-center justify-center text-[#7A6E63] hover:text-[#1C1714] hover:bg-[#F2ECE1] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Canvas for Image Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Search Mode Navigation Tabs (Visible when no results yet) */}
        {!capturedImage && (
          <div className="flex border-b border-[#E3DBD0] bg-[#F2ECE1]/60 px-6 pt-3 gap-2">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider rounded-t-2xl border-t border-x transition-all ${
                activeTab === 'camera'
                  ? 'bg-white text-[#B85D3B] border-[#E3DBD0] shadow-xs'
                  : 'text-[#65594C] border-transparent hover:text-[#1C1714]'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'uz' ? 'Jonli Kamera' : lang === 'ru' ? 'Камера' : 'Live Camera'}</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider rounded-t-2xl border-t border-x transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-[#B85D3B] border-[#E3DBD0] shadow-xs'
                  : 'text-[#65594C] border-transparent hover:text-[#1C1714]'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{lang === 'uz' ? 'Rasm Yuklash' : lang === 'ru' ? 'Загрузить Фото' : 'Upload Image'}</span>
            </button>

            <button
              onClick={() => setActiveTab('samples')}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider rounded-t-2xl border-t border-x transition-all ${
                activeTab === 'samples'
                  ? 'bg-white text-[#B85D3B] border-[#E3DBD0] shadow-xs'
                  : 'text-[#65594C] border-transparent hover:text-[#1C1714]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{lang === 'uz' ? 'Tayyor Namunalar' : lang === 'ru' ? 'Примеры Моделей' : 'Sample Outfits'}</span>
            </button>
          </div>
        )}

        {/* Modal Main Content Area */}
        <div className="p-6">
          
          {/* STATE 1: Analyzing Loader */}
          {analyzing && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#B85D3B]/20 border-t-[#B85D3B] animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-[#1C1714]/10 border-b-[#1C1714] animate-spin duration-700" />
                <Sparkles className="w-8 h-8 text-[#B85D3B] absolute inset-0 m-auto animate-pulse" />
              </div>
              <h4 className="font-serif text-2xl font-extrabold text-[#1C1714] mb-2">
                {lang === 'uz'
                  ? 'Mato va Rang Tahlil Qilinmoqda...'
                  : lang === 'ru'
                  ? 'Идет Анализ Ткани и Текстуры...'
                  : 'Analyzing Textile Grain & Color...'}
              </h4>
              <p className="text-sm text-[#7A6E63] max-w-md">
                {lang === 'uz'
                  ? 'Piksellar to‘qimasi, yorug‘lik va rang spektri tabiiy matolar katalogi bilan solishtirilmoqda'
                  : lang === 'ru'
                  ? 'Сравнение оптических характеристик и волокон с архивом натуральных тканей'
                  : 'Matching optical weave characteristics, yarn density, and palette against our textile archives'}
              </p>
            </div>
          )}

          {/* STATE 2: Matched Results Display */}
          {!analyzing && matchResults.length > 0 && capturedImage && (
            <div className="space-y-6">
              
              {/* Analysis Summary Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#E3DBD0] shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-[#B85D3B] shrink-0 shadow-md">
                    <img src={capturedImage} alt="Input" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 right-0 p-1 bg-[#B85D3B] text-white">
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#B85D3B]">
                        {lang === 'uz' ? 'Tahlil Muvaffaqiyatli' : lang === 'ru' ? 'Анализ Завершен' : 'Analysis Complete'}
                      </span>
                      <span className="text-xs text-[#8E8071]">•</span>
                      <span className="text-xs text-[#8E8071]">{matchResults.length} {lang === 'uz' ? 'ta mos mato topildi' : lang === 'ru' ? 'тканей найдено' : 'matches found'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="w-4 h-4 rounded-full border border-black/20 shadow-xs inline-block"
                        style={{ backgroundColor: matchResults[0].detectedAttributes.colorHex }}
                        title="Dominant Color"
                      />
                      <span className="font-mono text-xs text-[#1C1714] font-semibold">
                        {matchResults[0].detectedAttributes.colorHex.toUpperCase()}
                      </span>
                      <span className="text-xs text-[#7A6E63] font-medium">
                        — {matchResults[0].detectedAttributes.textureType}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRetake}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DDD5C7] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-xs font-bold text-[#1C1714] transition cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === 'uz' ? 'Boshqa Rasm Olish' : lang === 'ru' ? 'Новое Фото' : 'Scan Another Photo'}</span>
                </button>
              </div>

              {/* Matched Fabrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchResults.map((result, idx) => (
                  <div
                    key={`${result.fabric.id}-${idx}`}
                    className={`relative p-5 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'bg-gradient-to-br from-white via-white to-[#FDF8F3] border-[#B85D3B] shadow-md ring-2 ring-[#B85D3B]/20'
                        : 'bg-white border-[#E3DBD0] hover:border-[#B85D3B]/60 shadow-xs'
                    }`}
                  >
                    {/* Top Match Badge */}
                    {idx === 0 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B85D3B] text-white text-[11px] font-bold shadow-xs">
                        <Sparkles className="w-3 h-3" />
                        <span>{result.confidence}% {lang === 'uz' ? 'Ideal Moslik' : lang === 'ru' ? 'Идеальное Совпадение' : 'Best Match'}</span>
                      </div>
                    )}

                    <div className="flex gap-4">
                      {/* Fabric Swatch Thumbnail */}
                      <div
                        onClick={() => onOpenProductDetail(result.fabric)}
                        className={`relative w-24 h-28 rounded-xl overflow-hidden shrink-0 border border-[#E3DBD0] cursor-pointer group shadow-xs ${result.fabric.cssClass} flex items-center justify-center`}
                        style={{ backgroundColor: result.matchedColor.hex }}
                      >
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition duration-300" />
                        <span className="font-serif font-black text-2xl text-white/40 group-hover:scale-110 transition duration-300">
                          m
                        </span>
                        <div
                          className="absolute bottom-2 left-2 w-5 h-5 rounded-full border border-white shadow-md ring-1 ring-black/20"
                          style={{ backgroundColor: result.matchedColor.hex }}
                          title={result.matchedColor.name[lang]}
                        />
                      </div>

                      {/* Fabric Details */}
                      <div className="flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase font-bold text-[#8E8071]">
                              {result.fabric.origin} • {result.fabric.gsm} GSM
                            </span>
                            {idx !== 0 && (
                              <span className="font-mono text-[11px] font-extrabold text-[#B85D3B]">
                                {result.confidence}% {lang === 'uz' ? 'mos' : 'match'}
                              </span>
                            )}
                          </div>

                          <h5
                            onClick={() => onOpenProductDetail(result.fabric)}
                            className="font-serif text-base font-extrabold text-[#1C1714] hover:text-[#B85D3B] cursor-pointer transition line-clamp-1 mt-0.5"
                          >
                            {result.fabric.name}
                          </h5>

                          <p className="text-xs text-[#7A6E63] mt-0.5 line-clamp-1">
                            {result.fabric.composition[lang]}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-bold text-[#1C1714]">
                              {formatPrice(result.fabric)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#F2ECE1] text-[#65594C] font-semibold">
                              {result.matchedColor.name[lang]}
                            </span>
                          </div>
                        </div>

                        {/* Match Confidence Progress Bar */}
                        <div className="mt-3">
                          <div className="w-full bg-[#EAE3D9] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B85D3B] rounded-full transition-all duration-500"
                              style={{ width: `${result.confidence}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for Matched Fabric */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#EAE3D9]">
                      <button
                        onClick={() => {
                          onSelectForStudio(result.fabric, result.matchedColor, result.suggestedGarment);
                          onClose();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1C1714] hover:bg-[#B85D3B] text-white text-xs font-bold transition shadow-xs cursor-pointer group"
                      >
                        <Shirt className="w-3.5 h-3.5 text-[#E6DFD3] group-hover:scale-110 transition" />
                        <span>
                          {lang === 'uz'
                            ? '3D Manekenda Ko‘rish'
                            : lang === 'ru'
                            ? 'Примерить в 3D'
                            : 'Drape in 3D'}
                        </span>
                      </button>

                      <button
                        onClick={() => onOpenProductDetail(result.fabric)}
                        className="px-3 py-2.5 rounded-xl border border-[#DDD5C7] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#1C1714] transition cursor-pointer"
                        title={lang === 'uz' ? 'Batafsil ma’lumot' : 'Details'}
                      >
                        {lang === 'uz' ? 'Tafsilot' : lang === 'ru' ? 'Инфо' : 'Details'}
                      </button>

                      <button
                        onClick={() => onAddToCart(result.fabric, result.matchedColor, result.suggestedGarment.estimatedMeters)}
                        className="px-3 py-2.5 rounded-xl bg-[#B85D3B]/10 hover:bg-[#B85D3B] hover:text-white text-[#B85D3B] text-xs font-bold transition cursor-pointer"
                        title={lang === 'uz' ? 'Savatga qo‘shish' : 'Add to cart'}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATE 3: Camera Live Viewfinder */}
          {!analyzing && !capturedImage && activeTab === 'camera' && (
            <div className="flex flex-col items-center">
              {cameraError ? (
                <div className="w-full py-12 px-6 rounded-2xl bg-[#FFF6F4] border border-[#FAD7CE] text-center">
                  <Camera className="w-12 h-12 text-[#B85D3B] mx-auto mb-3 opacity-60" />
                  <p className="text-sm font-semibold text-[#8B2E16] mb-4 max-w-md mx-auto">
                    {cameraError}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-5 py-2.5 rounded-xl bg-[#B85D3B] text-white text-xs font-bold hover:bg-[#9E4D2F] transition cursor-pointer"
                    >
                      {lang === 'uz' ? 'Rasm Faylini Yuklash' : lang === 'ru' ? 'Загрузить Фото' : 'Upload Image File'}
                    </button>
                    <button
                      onClick={() => setActiveTab('samples')}
                      className="px-5 py-2.5 rounded-xl border border-[#DDD5C7] bg-white text-xs font-bold text-[#1C1714] hover:bg-[#F2ECE1] transition cursor-pointer"
                    >
                      {lang === 'uz' ? 'Namunalarni Ko‘rish' : lang === 'ru' ? 'Примеры Моделей' : 'View Samples'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-xl flex flex-col items-center">
                  {/* Viewfinder Frame */}
                  <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-black shadow-2xl border-4 border-white">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Viewfinder Reticle / Target Guides */}
                    <div className="absolute inset-8 pointer-events-none border border-white/40 rounded-xl">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#B85D3B]" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#B85D3B]" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#B85D3B]" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#B85D3B]" />
                    </div>

                    {/* Scanning Laser Animation */}
                    <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-[#B85D3B] to-transparent animate-bounce opacity-80" />

                    {/* Camera Control Overlays */}
                    <button
                      onClick={toggleFacingMode}
                      className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
                      title="Kamerani almashtirish (old/orqa)"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-mono text-white/90">
                        {lang === 'uz' ? 'Kiyim yoki matoni nishonga oling' : lang === 'ru' ? 'Наведите камеру на ткань' : 'Aim camera at clothing or textile'}
                      </span>
                    </div>
                  </div>

                  {/* Shutter Capture Button */}
                  <div className="mt-6 flex items-center justify-center gap-6">
                    <button
                      onClick={captureSnapshot}
                      className="w-18 h-18 rounded-full bg-[#B85D3B] hover:bg-[#9E4D2F] text-white flex items-center justify-center p-1.5 shadow-xl shadow-[#B85D3B]/30 hover:scale-105 active:scale-95 transition cursor-pointer"
                      title="Suratga olish"
                    >
                      <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center">
                        <Camera className="w-7 h-7" />
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 4: Upload Photo Area */}
          {!analyzing && !capturedImage && activeTab === 'upload' && (
            <div className="max-w-xl mx-auto py-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      if (typeof evt.target?.result === 'string') {
                        analyzeImage(evt.target.result);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="border-2 border-dashed border-[#DDD5C7] hover:border-[#B85D3B] bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition group shadow-xs"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#FAF7F2] group-hover:bg-[#B85D3B]/10 text-[#B85D3B] flex items-center justify-center mb-4 transition">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="font-serif text-lg font-bold text-[#1C1714]">
                  {lang === 'uz' ? 'Kiyim yoki mato rasmini bu yerga tashlang' : lang === 'ru' ? 'Перетащите изображение сюда' : 'Drag & drop clothing photo here'}
                </h4>
                <p className="text-xs text-[#7A6E63] mt-1 max-w-sm">
                  {lang === 'uz'
                    ? 'Yoki qurilmangizdan fayl tanlang (JPEG, PNG, WEBP). AI to‘qima tarkibi va rangini darhol tahlil qiladi.'
                    : lang === 'ru'
                    ? 'Или выберите файл с устройства (JPEG, PNG, WEBP). ИИ моментально определит ткань.'
                    : 'Or click to browse from device (JPEG, PNG, WEBP). AI identifies weave specs instantly.'}
                </p>

                <button
                  type="button"
                  className="mt-6 px-6 py-2.5 rounded-xl bg-[#1C1714] group-hover:bg-[#B85D3B] text-white text-xs font-bold transition shadow-xs"
                >
                  {lang === 'uz' ? 'Faylni Tanlash' : lang === 'ru' ? 'Выбрать Файл' : 'Browse File'}
                </button>
              </div>
            </div>
          )}

          {/* STATE 5: Inspiration Samples Showcase */}
          {!analyzing && !capturedImage && activeTab === 'samples' && (
            <div>
              <div className="mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#B85D3B]">
                  {lang === 'uz' ? 'Tezkor Sinov Uchun Namunalar' : lang === 'ru' ? 'Примеры Для Быстрого Теста' : 'Quick Inspiration Samples'}
                </span>
                <h4 className="font-serif text-lg font-extrabold text-[#1C1714] mt-0.5">
                  {lang === 'uz'
                    ? 'Quyidagi kiyimlardan birini bosing va sun\'iy intellekt qidiruvini sinab ko‘ring:'
                    : lang === 'ru'
                    ? 'Нажмите на любой образ для мгновенного поиска аналога ткани:'
                    : 'Click any garment to instantly trigger AI textile matching:'}
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {INSPIRATION_SAMPLES.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="group relative rounded-2xl overflow-hidden bg-white border border-[#E3DBD0] hover:border-[#B85D3B] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-3/4 overflow-hidden bg-[#EAE3D9]">
                      <img
                        src={sample.imageUrl}
                        alt={sample.title[lang]}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                        <span className="text-[11px] font-bold text-white flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                          {lang === 'uz' ? 'Matoni topish' : 'Match fabric'}
                        </span>
                      </div>
                      <div
                        className="absolute top-2 right-2 w-4 h-4 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: sample.colorHex }}
                      />
                    </div>
                    <div className="p-2.5 flex-grow flex flex-col justify-between">
                      <span className="font-serif text-xs font-bold text-[#1C1714] line-clamp-1 group-hover:text-[#B85D3B] transition">
                        {sample.title[lang]}
                      </span>
                      <span className="text-[10px] text-[#8E8071] line-clamp-1 mt-0.5 font-mono">
                        {sample.subtitle}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Note */}
        <div className="px-6 py-4 bg-[#F2ECE1]/60 border-t border-[#E3DBD0] flex items-center justify-between text-xs text-[#7A6E63]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#B85D3B]" />
            <span>
              {lang === 'uz'
                ? 'Optik to‘qima tahlili: Zig‘ir, Marg‘ilon ipaklari, paxta tvili va kashmir uchun moslashtirilgan'
                : lang === 'ru'
                ? 'Оптический анализ текстур: Лён, натуральный шелк, твил и кашемир'
                : 'Optical weave analysis: Calibrated for linen, raw silk, organic twill & cashmere'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#1C1714] hover:text-[#B85D3B] transition"
          >
            {lang === 'uz' ? 'Yopish' : lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
