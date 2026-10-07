import React, { useState, useEffect } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem, Currency, UnitSystem, Language, User } from '../types';
import confetti from 'canvas-confetti';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  currentUser: User | null;
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
  currentUser,
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

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout'>('cart');
  const [checkoutForm, setCheckoutForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.identifier || '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (currentUser) {
      setCheckoutForm(prev => ({
        ...prev,
        name: currentUser.name,
        phone: currentUser.identifier,
      }));
    }
  }, [currentUser]);

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutStep('checkout');
  };

  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address) {
      onShowToast(
        lang === 'uz'
          ? 'Iltimos, ism, telefon va manzilni kiriting'
          : lang === 'ru'
          ? 'Пожалуйста, заполните имя, телефон и адрес'
          : 'Please provide your name, phone, and address'
      );
      return;
    }

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#D4AF37', '#B85D3B', '#1C1714', '#ffffff']
    });

    onShowToast(
      lang === 'uz'
        ? `Buyurtmangiz qabul qilindi, ${checkoutForm.name}! Tez orada bog'lanamiz.`
        : lang === 'ru'
        ? `Заказ принят, ${checkoutForm.name}! Мы свяжемся с вами.`
        : `Order placed successfully, ${checkoutForm.name}!`
    );

    onClearCart();
    setCheckoutStep('cart');
    setCheckoutForm({ name: '', phone: '', address: '', notes: '' });
    onClose();
  };

  // When drawer is closed, reset step
  const handleClose = () => {
    setCheckoutStep('cart');
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
                {checkoutStep === 'checkout'
                  ? (lang === 'uz' ? 'Buyurtmani rasmiylashtirish' : lang === 'ru' ? 'Оформление заказа' : 'Checkout')
                  : (lang === 'uz' ? 'Xaridingiz Savati' : lang === 'ru' ? 'Корзина Покупок' : 'Bespoke Shopping Bag')}
              </h3>
              <span className="text-[11px] text-[#7F7264] font-mono">matos haute textiles</span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-[#F2ECE3] hover:bg-[#E5DDD2] text-[#55493D] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Item List / Checkout Form */}
        <div className="flex-grow p-4 overflow-y-auto space-y-3">
          {checkoutStep === 'cart' ? (
            cart.length === 0 ? (
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
                <div key={item.id} className="flex gap-3 bg-white p-3.5 rounded-2xl border border-[#DDD5C7] items-center shadow-xs">
                  
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
                    <div className="text-[11px] text-[#7F7264] font-mono flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="truncate max-w-[80px]">{item.color.name[lang]}</span>
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
            )
          ) : (
            <form id="checkout-form" onSubmit={handleConfirmOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                  {lang === 'uz' ? 'Ism va Familiya *' : lang === 'ru' ? 'Имя и Фамилия *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  placeholder={lang === 'uz' ? 'To‘liq ismingiz' : 'John Doe'}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-4 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                  {lang === 'uz' ? 'Telefon raqam *' : lang === 'ru' ? 'Номер телефона *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={checkoutForm.phone}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-4 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                  {lang === 'uz' ? 'Yetkazib berish manzili *' : lang === 'ru' ? 'Адрес доставки *' : 'Delivery Address *'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={checkoutForm.address}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                  placeholder={lang === 'uz' ? 'Viloyat, shahar, ko‘cha, uy...' : 'City, street, house...'}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-4 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                  {lang === 'uz' ? 'Qo‘shimcha izoh' : lang === 'ru' ? 'Комментарий к заказу' : 'Order Notes'}
                </label>
                <textarea
                  rows={2}
                  value={checkoutForm.notes}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                  placeholder={lang === 'uz' ? 'Buyurtma uchun qo‘shimcha talablar...' : 'Any special requests...'}
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl px-4 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B] resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className="text-xs text-[#B85D3B] font-bold hover:underline"
              >
                {lang === 'uz' ? '← Savatga qaytish' : lang === 'ru' ? '← Назад в корзину' : '← Back to Cart'}
              </button>
            </form>
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

            {checkoutStep === 'cart' ? (
              <button
                onClick={handleProceedToCheckout}
                className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                <span>{lang === 'uz' ? 'Buyurtmani rasmiylashtirish' : lang === 'ru' ? 'Оформить заказ' : 'Proceed to Checkout'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                className="w-full bg-[#B85D3B] hover:bg-[#9E4D2F] text-white font-bold py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{lang === 'uz' ? 'Buyurtmani tasdiqlash' : lang === 'ru' ? 'Подтвердить заказ' : 'Confirm Order'}</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
