import type { Localized, OrderKind, OrderStatus, TailorRequestStatus, TailorStatus } from './types.ts';

/** Status steps per order kind, in order. `cancelled` is always available as a side exit. */
export const ORDER_FLOW: Record<OrderKind, OrderStatus[]> = {
  fabric: ['new', 'confirmed', 'shipped', 'delivered'],
  sample: ['new', 'packed', 'shipped', 'delivered'],
};

export const orderStatusesFor = (kind: OrderKind): OrderStatus[] => [...ORDER_FLOW[kind], 'cancelled'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, Localized> = {
  new: { uz: 'Yangi', ru: 'Новый', en: 'New' },
  confirmed: { uz: 'Tasdiqlandi', ru: 'Подтверждён', en: 'Confirmed' },
  packed: { uz: 'Qadoqlandi', ru: 'Упакован', en: 'Packed' },
  shipped: { uz: 'Yo‘lda', ru: 'В пути', en: 'On the way' },
  delivered: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Cancelled' },
};

/** What the shopper sees: "new" reads as "received". */
export const ORDER_STATUS_CUSTOMER: Record<OrderStatus, Localized> = {
  ...ORDER_STATUS_LABEL,
  new: { uz: 'Qabul qilindi', ru: 'Принят', en: 'Received' },
};

export const TAILOR_REQUEST_FLOW: TailorRequestStatus[] = ['new', 'contacted', 'in_progress', 'done'];
export const TAILOR_REQUEST_STATUSES: TailorRequestStatus[] = [...TAILOR_REQUEST_FLOW, 'cancelled'];

export const TAILOR_REQUEST_LABEL: Record<TailorRequestStatus, Localized> = {
  new: { uz: 'Yangi', ru: 'Новая', en: 'New' },
  contacted: { uz: 'Bog‘lanildi', ru: 'Связались', en: 'Contacted' },
  in_progress: { uz: 'Tikilmoqda', ru: 'В работе', en: 'In progress' },
  done: { uz: 'Tayyor', ru: 'Готово', en: 'Done' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменена', en: 'Cancelled' },
};

export const TAILOR_STATUS_LABEL: Record<TailorStatus, Localized> = {
  pending: { uz: 'Tekshiruvda', ru: 'На проверке', en: 'Pending' },
  approved: { uz: 'Faol', ru: 'Активно', en: 'Approved' },
  rejected: { uz: 'Rad etilgan', ru: 'Отклонено', en: 'Rejected' },
  hidden: { uz: 'Yashirilgan', ru: 'Скрыто', en: 'Hidden' },
};

export const ORDER_NUMBER_PREFIX: Record<OrderKind, string> = { fabric: 'MT', sample: 'SW' };
