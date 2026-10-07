import { Language, Localized } from '../types';

export const L = (uz: string, ru: string, en: string): Localized => ({ uz, ru, en });

export type T = (s: Localized) => string;
export const makeT = (lang: Language): T => (s) => s[lang] ?? s.uz;

/** Strings used in more than one place. */
export const UI = {
  catalog: L('Katalog', 'Каталог', 'Catalog'),
  studio: L('3D kiyib ko‘rish', '3D-примерка', '3D try-on'),
  tailors: L('Tikuvchilar', 'Портные', 'Tailors'),
  samples: L('Bepul namuna', 'Бесплатный образец', 'Free sample'),
  freeSamples: L('Bepul namunalar', 'Бесплатные образцы', 'Free samples'),
  bag: L('Savat', 'Корзина', 'Bag'),
  signIn: L('Kirish', 'Войти', 'Sign in'),
  signOut: L('Chiqish', 'Выйти', 'Sign out'),
  profile: L('Profil', 'Профиль', 'Profile'),
  close: L('Yopish', 'Закрыть', 'Close'),
  back: L('Orqaga', 'Назад', 'Back'),
  addToBag: L('Savatga qo‘shish', 'В корзину', 'Add to bag'),
  addSample: L('Namunaga qo‘shish', 'Добавить образец', 'Add sample'),
  inSamples: L('Namunada bor', 'Образец добавлен', 'Sample added'),
  tryOn3D: L('3D’da kiyib ko‘rish', 'Примерить в 3D', 'Try on in 3D'),
  photoSearch: L('Rasm orqali topish', 'Поиск по фото', 'Search by photo'),
  perMeter: L('1 metr', 'за метр', 'per metre'),
  perYard: L('1 yard', 'за ярд', 'per yard'),
  width: L('Eni', 'Ширина', 'Width'),
  weight: L('Zichligi', 'Плотность', 'Weight'),
  drape: L('Tushishi', 'Драпируемость', 'Drape'),
  composition: L('Tarkibi', 'Состав', 'Composition'),
  shrinkage: L('Qisqarishi', 'Усадка', 'Shrinkage'),
  care: L('Parvarish', 'Уход', 'Care'),
  seller: L('Sotuvchi', 'Продавец', 'Seller'),
  colour: L('Rang', 'Цвет', 'Colour'),
  colours: L('rang', 'цв.', 'colours'),
  length: L('Uzunligi', 'Длина', 'Length'),
  total: L('Jami', 'Итого', 'Total'),
  findTailor: L('Tikuvchi topish', 'Найти портного', 'Find a tailor'),
  remove: L('O‘chirish', 'Удалить', 'Remove'),
};
