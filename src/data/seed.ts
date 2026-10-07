import type { StoredOrder, StoredSwatchRequest } from '../lib/orders';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

/** Demo history shown in the admin panel before real orders arrive. */
export const SEED_ORDERS: StoredOrder[] = [
  { id: 'MT-1042', customer: 'Jamshid Davlatov', phone: '+998 90 123 45 67', kind: 'mato', item: 'GOTS Organic Linen — Navy, 4.5 m', amountUZS: 690000, status: 'new', date: daysAgo(0) },
  { id: 'MT-1041', customer: 'Madina Karimova', phone: '+998 93 555 12 10', kind: 'tikuv', item: 'Oqshom ko‘ylagi — Ipak Yo‘li atelyesi', amountUZS: 1450000, status: 'processing', date: daysAgo(1), note: 'Bel 68 sm, 3 haftada tayyor bo‘lsin.' },
  { id: 'MT-1040', customer: 'Sardor Aliyev', phone: '+998 97 700 44 22', kind: 'mato', item: 'Heavyweight Linen — Fog, 6 m', amountUZS: 840000, status: 'shipped', date: daysAgo(2) },
  { id: 'MT-1039', customer: 'Nigora Yusupova', phone: '+998 91 330 77 88', kind: 'tikuv', item: 'Blazer — Savile Tashkent', amountUZS: 980000, status: 'done', date: daysAgo(4) },
  { id: 'MT-1038', customer: 'Bekzod Rahimov', phone: '+998 99 810 20 30', kind: 'mato', item: 'Plain Weave Linen — Apple, 3 m', amountUZS: 420000, status: 'done', date: daysAgo(5) },
  { id: 'MT-1037', customer: 'Zarina Ortiqova', phone: '+998 88 112 90 90', kind: 'mato', item: 'Organic Linen — Slate, 8 m', amountUZS: 1180000, status: 'cancelled', date: daysAgo(6) },
  { id: 'MT-1036', customer: 'Aziza Mirzayeva', phone: '+998 90 777 31 31', kind: 'mato', item: 'Linen Cotton Canvas — White, 5 m', amountUZS: 610000, status: 'done', date: daysAgo(9) },
  { id: 'MT-1035', customer: 'Timur Qodirov', phone: '+998 93 410 22 05', kind: 'tikuv', item: 'Kostyum — Savile Tashkent', amountUZS: 2100000, status: 'done', date: daysAgo(12) },
  { id: 'MT-1034', customer: 'Feruza Ismoilova', phone: '+998 94 880 12 12', kind: 'mato', item: 'GOTS Organic Linen — Blush, 7 m', amountUZS: 1020000, status: 'done', date: daysAgo(15) },
  { id: 'MT-1033', customer: 'Rustam Hamidov', phone: '+998 97 245 66 01', kind: 'mato', item: 'Plain Weave Linen — Iron, 4 m', amountUZS: 560000, status: 'done', date: daysAgo(19) },
];
export const SEED_SWATCHES: StoredSwatchRequest[] = [
  { id: 'SW-310', customer: 'Dilfuza Normatova', city: 'Toshkent', fabrics: ['GOTS Linen White', 'GOTS Linen Fog', 'Heavyweight Linen Navy', 'Plain Weave Apple', 'Organic Slate'], status: 'pending', date: daysAgo(0) },
  { id: 'SW-309', customer: 'Otabek Sodiqov', city: 'Samarqand', fabrics: ['Plain Weave Navy', 'GOTS Linen Black', 'Linen Cotton Canvas'], status: 'packed', date: daysAgo(2) },
  { id: 'SW-308', customer: 'Gulnora Hasanova', city: 'Buxoro', fabrics: ['GOTS Linen Glacier', 'Organic Hollyhock', 'Bold Gingham Navy', 'Plain Weave Iron', 'Plain Weave Lemonade'], status: 'delivered', date: daysAgo(5) },
];
