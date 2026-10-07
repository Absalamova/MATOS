/**
 * Orders, sample requests and tailor bookings are written in the same shape the
 * admin panel reads (matos_orders / matos_swatch_requests), so everything a buyer
 * submits on the site shows up there immediately.
 */
import { SEED_ORDERS, SEED_SWATCHES } from '../data/seed';
import { KEYS, load, save } from './storage';

export type OrderStatus = 'new' | 'processing' | 'shipped' | 'done' | 'cancelled';
export type SwatchStatus = 'pending' | 'packed' | 'delivered';

export interface OrderLine {
  fabricId: string;
  colorId: string;
  title: string;
  meters: number;
  amountUZS: number;
}

export interface StoredOrder {
  id: string;
  customer: string;
  phone: string;
  kind: 'mato' | 'tikuv';
  item: string;
  amountUZS: number;
  status: OrderStatus;
  date: string;
  note?: string;
  userId?: string;
  city?: string;
  address?: string;
  delivery?: 'courier' | 'pickup';
  payment?: 'cash' | 'card';
  lines?: OrderLine[];
  tailorId?: string;
}

export interface StoredSwatchRequest {
  id: string;
  customer: string;
  city: string;
  fabrics: string[];
  status: SwatchStatus;
  date: string;
  phone?: string;
  userId?: string;
  address?: string;
}

const readOrders = () => load<StoredOrder[] | null>(KEYS.orders, null) ?? [...SEED_ORDERS];
const readSwatches = () => load<StoredSwatchRequest[] | null>(KEYS.swatchRequests, null) ?? [...SEED_SWATCHES];

function nextId(prefix: string, list: { id: string }[], start: number) {
  const max = list.reduce((m, o) => {
    const n = Number(o.id.replace(/\D/g, ''));
    return Number.isFinite(n) && o.id.startsWith(prefix) ? Math.max(m, n) : m;
  }, start);
  return `${prefix}${max + 1}`;
}

export interface Customer {
  name: string;
  phone: string;
  city: string;
  address: string;
  userId?: string;
}

export function placeOrder(input: {
  customer: Customer;
  lines: OrderLine[];
  samples: string[];
  note?: string;
  delivery: 'courier' | 'pickup';
  payment: 'cash' | 'card';
}): { orderId?: string; swatchId?: string } {
  const now = new Date().toISOString();
  const result: { orderId?: string; swatchId?: string } = {};
  if (input.lines.length) {
    const orders = readOrders();
    const id = nextId('MT-', orders, 1042);
    const amount = input.lines.reduce((s, l) => s + l.amountUZS, 0);
    const item = input.lines.map((l) => `${l.title}, ${l.meters.toFixed(1)} m`).join('; ');
    orders.unshift({
      id,
      customer: input.customer.name,
      phone: input.customer.phone,
      kind: 'mato',
      item,
      amountUZS: Math.round(amount),
      status: 'new',
      date: now,
      note: input.note || undefined,
      userId: input.customer.userId,
      city: input.customer.city,
      address: input.customer.address,
      delivery: input.delivery,
      payment: input.payment,
      lines: input.lines,
    });
    save(KEYS.orders, orders);
    result.orderId = id;
  }
  if (input.samples.length) {
    const list = readSwatches();
    const id = nextId('SW-', list, 310);
    list.unshift({
      id,
      customer: input.customer.name,
      city: input.customer.city,
      fabrics: input.samples,
      status: 'pending',
      date: now,
      phone: input.customer.phone,
      userId: input.customer.userId,
      address: input.customer.address,
    });
    save(KEYS.swatchRequests, list);
    result.swatchId = id;
  }
  return result;
}

export function bookTailor(input: {
  customer: { name: string; phone: string; userId?: string; city: string };
  tailorId: string;
  atelierName: string;
  garmentTitle: string;
  priceFromUZS: number;
  note: string;
}) {
  const orders = readOrders();
  const id = nextId('MT-', orders, 1042);
  orders.unshift({
    id,
    customer: input.customer.name,
    phone: input.customer.phone,
    kind: 'tikuv',
    item: `${input.garmentTitle} — ${input.atelierName}`,
    amountUZS: input.priceFromUZS,
    status: 'new',
    date: new Date().toISOString(),
    note: input.note || undefined,
    userId: input.customer.userId,
    city: input.customer.city,
    tailorId: input.tailorId,
  });
  save(KEYS.orders, orders);
  return id;
}

const digits = (s: string) => s.replace(/\D/g, '');

export function historyFor(user: { id: string; identifier: string }) {
  const match = (o: { userId?: string; phone?: string }) =>
    o.userId === user.id || (!!o.phone && digits(o.phone) !== '' && digits(o.phone) === digits(user.identifier));
  return {
    orders: readOrders().filter(match),
    samples: readSwatches().filter(match),
  };
}
