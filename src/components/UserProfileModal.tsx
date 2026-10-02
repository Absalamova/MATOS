import React, { useState } from 'react';
import { X, Check, Ruler, User as UserIcon, LogOut, Package } from 'lucide-react';
import { User, Language, UnitSystem } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  lang: Language;
  unit: UnitSystem;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onLogout,
  lang,
  unit,
}) => {
  const [height, setHeight] = useState(currentUser.measurements.heightCm);
  const [chest, setChest] = useState(currentUser.measurements.chestCm);
  const [waist, setWaist] = useState(currentUser.measurements.waistCm);
  const [hips, setHips] = useState(currentUser.measurements.hipsCm);
  const [sizeINT, setSizeINT] = useState(currentUser.measurements.sizeINT);
  const [sizeEU, setSizeEU] = useState(currentUser.measurements.sizeEU);
  const [sizeUS, setSizeUS] = useState(currentUser.measurements.sizeUS);
  const [sizeUK, setSizeUK] = useState(currentUser.measurements.sizeUK);

  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedUser: User = {
      ...currentUser,
      measurements: {
        heightCm: height,
        chestCm: chest,
        waistCm: waist,
        hipsCm: hips,
        sizeINT,
        sizeEU,
        sizeUS,
        sizeUK,
      },
    };

    // Update in localStorage
    const storedUsers: User[] = JSON.parse(localStorage.getItem('matos_users') || '[]');
    const index = storedUsers.findIndex((u) => u.id === currentUser.id);
    if (index !== -1) {
      storedUsers[index] = updatedUser;
    } else {
      storedUsers.push(updatedUser);
    }
    localStorage.setItem('matos_users', JSON.stringify(storedUsers));
    localStorage.setItem('matos_current_user', JSON.stringify(updatedUser));

    onUpdateUser(updatedUser);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF8F5] w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#DFD7CB] relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#DDD5C7] text-[#6A5E52] hover:text-[#1C1714] flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-[#E5DDD2]">
          <div className="w-14 h-14 rounded-2xl bg-[#1C1714] text-white flex items-center justify-center text-xl font-bold font-serif">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-serif font-bold text-xl text-[#1C1714]">{currentUser.name}</h3>
            <span className="text-xs text-[#7F7264] font-mono">
              {currentUser.identifier} • {lang === 'uz' ? 'Atelier A’zosi' : lang === 'ru' ? 'Клиент Ателье' : 'Atelier Member'}
            </span>
          </div>
        </div>

        {/* Saved Measurements Form */}
        <form onSubmit={handleSave} className="py-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="w-4 h-4 text-[#B85D3B]" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C1714]">
                {lang === 'uz'
                  ? 'Shaxsiy O‘lchamlar & Xalqaro Standartlar'
                  : lang === 'ru'
                  ? 'Индивидуальные мерки & Стандарты'
                  : 'Custom Measurements & Global Sizing'}
              </h4>
            </div>
            <p className="text-xs text-[#7F7264] mb-4">
              {lang === 'uz'
                ? 'Bu o‘lchamlar 3D Maneken va Isrofsiz Bichim Kalkulyatoriga avtomatik integratsiya qilinadi.'
                : lang === 'ru'
                ? 'Эти параметры автоматически передаются в 3D студию и калькулятор раскроя.'
                : 'These measurements automatically calibrate the 3D drape simulator and zero-waste pattern calculator.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-[#DFD7CB]">
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1 font-bold">
                  {lang === 'uz' ? 'Bo‘y (Height)' : lang === 'ru' ? 'Рост' : 'Height'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full font-bold text-sm text-[#1C1714] bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-[#887A6D]">{unit === 'metric' ? 'sm' : 'in'}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-[#DFD7CB]">
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1 font-bold">
                  {lang === 'uz' ? 'Ko‘krak (Bust)' : lang === 'ru' ? 'Грудь' : 'Bust'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={chest}
                    onChange={(e) => setChest(Number(e.target.value))}
                    className="w-full font-bold text-sm text-[#1C1714] bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-[#887A6D]">{unit === 'metric' ? 'sm' : 'in'}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-[#DFD7CB]">
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1 font-bold">
                  {lang === 'uz' ? 'Bel (Waist)' : lang === 'ru' ? 'Талия' : 'Waist'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={waist}
                    onChange={(e) => setWaist(Number(e.target.value))}
                    className="w-full font-bold text-sm text-[#1C1714] bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-[#887A6D]">{unit === 'metric' ? 'sm' : 'in'}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-[#DFD7CB]">
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1 font-bold">
                  {lang === 'uz' ? 'Bo‘ksa (Hips)' : lang === 'ru' ? 'Бедра' : 'Hips'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={hips}
                    onChange={(e) => setHips(Number(e.target.value))}
                    className="w-full font-bold text-sm text-[#1C1714] bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-[#887A6D]">{unit === 'metric' ? 'sm' : 'in'}</span>
                </div>
              </div>
            </div>

            {/* International Size Standards Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1">INT Size</label>
                <select
                  value={sizeINT}
                  onChange={(e) => setSizeINT(e.target.value)}
                  className="w-full bg-white border border-[#DFD7CB] rounded-xl px-2.5 py-2 text-xs font-bold text-[#1C1714]"
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1">EU Size</label>
                <select
                  value={sizeEU}
                  onChange={(e) => setSizeEU(e.target.value)}
                  className="w-full bg-white border border-[#DFD7CB] rounded-xl px-2.5 py-2 text-xs font-bold text-[#1C1714]"
                >
                  <option value="EU 34">EU 34</option>
                  <option value="EU 36">EU 36</option>
                  <option value="EU 38">EU 38</option>
                  <option value="EU 40">EU 40</option>
                  <option value="EU 42">EU 42</option>
                  <option value="EU 44">EU 44</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1">US Size</label>
                <select
                  value={sizeUS}
                  onChange={(e) => setSizeUS(e.target.value)}
                  className="w-full bg-white border border-[#DFD7CB] rounded-xl px-2.5 py-2 text-xs font-bold text-[#1C1714]"
                >
                  <option value="US 2">US 2</option>
                  <option value="US 4">US 4</option>
                  <option value="US 6">US 6</option>
                  <option value="US 8">US 8</option>
                  <option value="US 10">US 10</option>
                  <option value="US 12">US 12</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#887A6D] mb-1">UK Size</label>
                <select
                  value={sizeUK}
                  onChange={(e) => setSizeUK(e.target.value)}
                  className="w-full bg-white border border-[#DFD7CB] rounded-xl px-2.5 py-2 text-xs font-bold text-[#1C1714]"
                >
                  <option value="UK 6">UK 6</option>
                  <option value="UK 8">UK 8</option>
                  <option value="UK 10">UK 10</option>
                  <option value="UK 12">UK 12</option>
                  <option value="UK 14">UK 14</option>
                  <option value="UK 16">UK 16</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="submit"
                className="bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-2.5 px-6 rounded-xl transition text-xs uppercase tracking-wider flex items-center gap-2"
              >
                {isSaved && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <span>
                  {isSaved
                    ? (lang === 'uz' ? 'Saqlandi!' : lang === 'ru' ? 'Сохранено!' : 'Saved!')
                    : (lang === 'uz' ? 'O‘lchamlarni Saqlash' : lang === 'ru' ? 'Сохранить мерки' : 'Save Measurements')}
                </span>
              </button>
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className="border-t border-[#E5DDD2] pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-[#B85D3B]" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C1714]">
                {lang === 'uz' ? 'Oxirgi Buyurtmalar & Namunalar' : lang === 'ru' ? 'Заказы и образцы' : 'Recent Atelier Orders'}
              </h4>
            </div>

            <div className="space-y-2.5">
              <div className="bg-white p-3.5 rounded-2xl border border-[#DFD7CB] flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-[#1C1714]">Belgian Washed Pure Linen (2.5 m)</div>
                  <div className="text-[11px] text-[#7F7264] font-mono">Buyurtma #MT-9042 • Kuryer yo‘lda</div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  {lang === 'uz' ? 'Yetkazilmoqda' : lang === 'ru' ? 'В доставке' : 'In Transit'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-[#DFD7CB] flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-[#1C1714]">Artisan Swatch Box (5 x namunalar)</div>
                  <div className="text-[11px] text-[#7F7264] font-mono">Buyurtma #SW-1084 • Bepul namuna</div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {lang === 'uz' ? 'Yetkazildi' : lang === 'ru' ? 'Доставлено' : 'Delivered'}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#E5DDD2] flex items-center justify-between">
          <button
            onClick={onLogout}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{lang === 'uz' ? 'Akkauntdan chiqish' : lang === 'ru' ? 'Выйти из аккаунта' : 'Sign Out'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#DDD5C7] text-xs font-bold text-[#1C1714] hover:bg-[#F2ECE3] transition"
          >
            {lang === 'uz' ? 'Yopish' : lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
