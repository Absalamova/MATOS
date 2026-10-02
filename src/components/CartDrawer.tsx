import React from 'react';
import { X, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem, Currency, UnitSystem, Language } from '../types';
import confetti from 'canvas-confetti';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
  onShowToast: (msg: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  currency,
  unit,
  lang,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const formatPrice = (val: number) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(val)} so‘m`;
    if (currency === 'USD') return `$${val.toFixed(2)}`;
    return `€${val.toFixed(2)}`;
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    onShowToast(
      lang === 'uz'
        ? 'Buyurtmangiz muvaffaqiyatli rasmiylashtirildi! Atelier ustasi tez orada bog‘lanadi.'
        : lang === 'ru'
        ? 'Ваш заказ успешно оформлен! Мастер ателье свяжется с вами.'
        : 'Your atelier order has been placed! Our bespoke team will contact you shortly.'
    );

    onClearCart();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="bg-[#FAF8F5] w-full max-w-md h-full shadow-2xl flex flex-col border-l border-[#DDD5C7]">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#E3DBD0] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1C1714] text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[#D8CFBF]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1C1714]">
                {lang === 'uz' ? 'Xaridingiz Savati' : lang === 'ru' ? 'Корзина Покупок' : 'Bespoke Shopping Bag'}
              </h3>
              <span className="text-[11px] text-[#7F7264] font-mono">matos haute textiles</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2ECE3] hover:bg-[#E5DDD2] text-[#55493D] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-grow p-4 overflow-y-auto space-y-3">
          {cart.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[#938575]">
              <ShoppingBag className="w-12 h-12 mb-3 text-[#C8BFB2]" />
              <p className="font-serif font-bold text-base text-[#1C1714]">
                {lang === 'uz' ? 'Savatchangiz bo‘sh' : lang === 'ru' ? 'Корзина пуста' : 'Your bag is empty'}
              </p>
              <p className="text-xs text-[#7F7264] mt-1 max-w-xs">
                {lang === 'uz'
                  ? '3D Studiyadan yoki Katalog to‘plamidan eksklyuziv matolarni tanlang.'
                  : lang === 'ru'
                  ? 'Выберите роскошные ткани в 3D студии или каталоге.'
                  : 'Select exclusive textiles from our 3D atelier or curated catalog.'}
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-3 bg-white p-3.5 rounded-2xl border border-[#DDD5C7] items-center">
                
                {/* Mini Fabric Preview */}
                <div
                  className={`w-14 h-14 rounded-xl ${item.cssClass} border border-[#DDD5C7] flex-shrink-0 relative overflow-hidden flex items-center justify-center`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white shadow-xs"
                    style={{ backgroundColor: item.color.hex }}
                  />
                </div>

                {/* Details */}
                <div className="flex-grow min-w-0">
                  <h4 className="font-serif font-bold text-xs text-[#1C1714] truncate">
                    {item.fabricName}
                  </h4>
                  <div className="text-[11px] text-[#7F7264] font-mono flex items-center gap-1.5 mt-0.5">
                    <span>{item.color.name[lang]}</span>
                    <span>•</span>
                    <span>{item.gsm} GSM</span>
                  </div>

                  {/* Meterage Adjustment */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -0.5)}
                      className="w-6 h-6 rounded bg-[#F2ECE3] hover:bg-[#E3DBD0] text-xs font-bold text-[#1C1714] flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs font-bold text-[#1C1714]">
                      {item.quantity.toFixed(1)} {item.unit}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 0.5)}
                      className="w-6 h-6 rounded bg-[#F2ECE3] hover:bg-[#E3DBD0] text-xs font-bold text-[#1C1714] flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price and Delete */}
                <div className="text-right flex flex-col justify-between items-end self-stretch">
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-[#9E9081] hover:text-rose-600 text-xs transition p-1"
                    title="O‘chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-serif font-bold text-xs text-[#1C1714]">
                    {formatPrice(item.totalPrice)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer & Checkout */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[#E3DBD0] bg-white space-y-3">
            <div className="flex justify-between items-center text-xs text-[#7F7264]">
              <span>{lang === 'uz' ? 'Jami metraj:' : lang === 'ru' ? 'Всего ткани:' : 'Total fabric:'}</span>
              <span className="font-mono font-bold text-[#1C1714]">
                {totalQuantity.toFixed(1)} {unit === 'metric' ? 'm' : 'yd'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm border-t border-[#F2ECE3] pt-2">
              <span className="font-bold text-[#1C1714]">
                {lang === 'uz' ? 'To‘lov summasi:' : lang === 'ru' ? 'Итого к оплате:' : 'Total Amount:'}
              </span>
              <span className="font-serif font-black text-xl text-[#B85D3B]">
                {formatPrice(totalPrice)}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
            >
              <span>{lang === 'uz' ? 'Buyurtmani rasmiylashtirish' : lang === 'ru' ? 'Оформить заказ' : 'Proceed to Checkout'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
