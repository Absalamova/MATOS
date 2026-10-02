import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';
import { User, Language } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  lang: Language;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  lang,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regIdentifier, setRegIdentifier] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginIdentifier || !loginPassword) {
      setErrorMessage(
        lang === 'uz'
          ? 'Iltimos, barcha maydonlarni to‘ldiring'
          : lang === 'ru'
          ? 'Заполните все поля'
          : 'Please fill in all fields'
      );
      return;
    }

    try {
      const storedUsers: User[] = JSON.parse(localStorage.getItem('matos_users') || '[]');
      const user = storedUsers.find(
        (u) =>
          u.identifier.toLowerCase().trim() === loginIdentifier.toLowerCase().trim() &&
          u.password === loginPassword
      );

      if (user) {
        localStorage.setItem('matos_current_user', JSON.stringify(user));
        onLoginSuccess(user);
        onClose();
      } else {
        setErrorMessage(
          lang === 'uz'
            ? 'Telefon/Email yoki parol noto‘g‘ri kiritildi'
            : lang === 'ru'
            ? 'Неверный логин или пароль'
            : 'Invalid identifier or password'
        );
      }
    } catch {
      setErrorMessage('Xatolik yuz berdi');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName || !regIdentifier || !regPassword) {
      setErrorMessage(
        lang === 'uz'
          ? 'Iltimos, barcha maydonlarni to‘ldiring'
          : lang === 'ru'
          ? 'Заполните все поля'
          : 'Please fill in all fields'
      );
      return;
    }

    if (regPassword.length < 3) {
      setErrorMessage(
        lang === 'uz'
          ? 'Parol kamida 3 ta belgidan iborat bo‘lishi lozim'
          : lang === 'ru'
          ? 'Пароль должен быть не менее 3 символов'
          : 'Password must be at least 3 characters'
      );
      return;
    }

    try {
      const storedUsers: User[] = JSON.parse(localStorage.getItem('matos_users') || '[]');
      const exists = storedUsers.find(
        (u) => u.identifier.toLowerCase().trim() === regIdentifier.toLowerCase().trim()
      );

      if (exists) {
        setErrorMessage(
          lang === 'uz'
            ? 'Ushbu telefon yoki email orqali akkaunt allaqachon mavjud'
            : lang === 'ru'
            ? 'Пользователь с таким email/телефоном уже существует'
            : 'An account with this phone or email already exists'
        );
        return;
      }

      const newUser: User = {
        id: `user-${Date.now()}`,
        name: regName.trim(),
        identifier: regIdentifier.trim(),
        password: regPassword,
        registeredAt: new Date().toISOString(),
        measurements: {
          heightCm: 172,
          chestCm: 92,
          waistCm: 74,
          hipsCm: 98,
          sizeINT: 'M',
          sizeEU: 'EU 38',
          sizeUS: 'US 6',
          sizeUK: 'UK 10',
        },
      };

      storedUsers.push(newUser);
      localStorage.setItem('matos_users', JSON.stringify(storedUsers));
      localStorage.setItem('matos_current_user', JSON.stringify(newUser));

      onLoginSuccess(newUser);
      onClose();
    } catch {
      setErrorMessage('Xatolik yuz berdi');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF8F5] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#DFD7CB] relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#DDD5C7] text-[#6A5E52] hover:text-[#1C1714] flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Headers: Kirish (Login) vs Ro'yxatdan o'tish (Register) */}
        <div className="flex border-b border-[#E3DBD0] mb-6">
          <button
            onClick={() => {
              setTab('login');
              setErrorMessage('');
            }}
            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition ${
              tab === 'login'
                ? 'border-b-2 border-[#B85D3B] text-[#1C1714]'
                : 'text-[#8C7F72] hover:text-[#1C1714]'
            }`}
          >
            {lang === 'uz' ? 'Kirish' : lang === 'ru' ? 'Вход' : 'Sign In'}
          </button>
          <button
            onClick={() => {
              setTab('register');
              setErrorMessage('');
            }}
            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition ${
              tab === 'register'
                ? 'border-b-2 border-[#B85D3B] text-[#1C1714]'
                : 'text-[#8C7F72] hover:text-[#1C1714]'
            }`}
          >
            {lang === 'uz' ? 'Ro‘yxatdan o‘tish' : lang === 'ru' ? 'Регистрация' : 'Register'}
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                {lang === 'uz' ? 'Telefon yoki Email:' : lang === 'ru' ? 'Телефон или Email:' : 'Phone or Email:'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D80]" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="masalan: +998 90 123 45 67 yoki email"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                {lang === 'uz' ? 'Parol:' : lang === 'ru' ? 'Пароль:' : 'Password:'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D80]" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#1C1714] hover:bg-[#B85D3B] text-white font-bold py-3.5 rounded-xl transition text-xs uppercase tracking-wider shadow-md mt-2"
            >
              {lang === 'uz' ? 'Kirish' : lang === 'ru' ? 'Войти' : 'Sign In'}
            </button>

            {/* Redirection to Register */}
            <div className="pt-4 text-center border-t border-[#E3DBD0] text-xs text-[#6A5E52]">
              <span>
                {lang === 'uz'
                  ? 'Profilingiz yo‘qmi? '
                  : lang === 'ru'
                  ? 'Еще нет профиля? '
                  : 'No account yet? '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMessage('');
                }}
                className="font-bold text-[#B85D3B] hover:underline cursor-pointer"
              >
                {lang === 'uz' ? 'Ro‘yxatdan o‘tish' : lang === 'ru' ? 'Зарегистрироваться' : 'Create an Account'}
              </button>
            </div>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                {lang === 'uz' ? 'Ism va Familiya:' : lang === 'ru' ? 'Имя и Фамилия:' : 'Full Name:'}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D80]" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="masalan: Malika Karimova"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                {lang === 'uz' ? 'Telefon yoki Email:' : lang === 'ru' ? 'Телефон или Email:' : 'Phone or Email:'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D80]" />
                <input
                  type="text"
                  value={regIdentifier}
                  onChange={(e) => setRegIdentifier(e.target.value)}
                  placeholder="+998 90 000 00 00 yoki email@domain.com"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4B4036] mb-1.5">
                {lang === 'uz' ? 'Yangi parol yarating:' : lang === 'ru' ? 'Придумайте пароль:' : 'Create Password:'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D80]" />
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="kamida 3 belgi"
                  className="w-full bg-white border border-[#DDD5C7] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1C1714] focus:outline-none focus:border-[#B85D3B]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#B85D3B] hover:bg-[#A04E2F] text-white font-bold py-3.5 rounded-xl transition text-xs uppercase tracking-wider shadow-md mt-2"
            >
              {lang === 'uz' ? 'Ro‘yxatdan o‘tish' : lang === 'ru' ? 'Зарегистрироваться' : 'Register Account'}
            </button>

            {/* Back to Login link */}
            <div className="pt-4 text-center border-t border-[#E3DBD0] text-xs text-[#6A5E52]">
              <span>
                {lang === 'uz'
                  ? 'Allaqachon ro‘yxatdan o‘tganmisiz? '
                  : lang === 'ru'
                  ? 'Уже зарегистрированы? '
                  : 'Already registered? '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMessage('');
                }}
                className="font-bold text-[#1C1714] hover:underline cursor-pointer"
              >
                {lang === 'uz' ? 'Kirish' : lang === 'ru' ? 'Войти' : 'Sign In'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
