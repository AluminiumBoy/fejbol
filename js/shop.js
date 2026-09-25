// Jutalombolt: érmék, a felnőttek által feltöltött jutalmak, pénzre váltás, PIN-nel védett beállítások.
import { state, save } from './store.js?v=29';

export function shop() {
  state.shop = Object.assign({ coins: 0, items: [], orders: [], rate: 0, minCash: 0, pin: '' }, state.shop || {});
  return state.shop;
}

async function hash(pin) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fejbol:' + pin));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const hasPin = () => !!shop().pin;
export async function setPin(pin) { shop().pin = await hash(pin); save(); }
export async function checkPin(pin) { return shop().pin === await hash(pin); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export function addItem(name, price) { shop().items.push({ id: uid(), name, price }); save(); }
export function removeItem(id) { const s = shop(); s.items = s.items.filter(i => i.id !== id); save(); }
export function setRate(rate, minCash) { const s = shop(); s.rate = rate; s.minCash = minCash; save(); }

// vásárlás: az érme azonnal lejön, az utalvány függőben marad, amíg egy felnőtt be nem váltja
export function buyItem(id) {
  const s = shop(), it = s.items.find(i => i.id === id);
  if (!it || s.coins < it.price) return null;
  s.coins -= it.price;
  const o = { id: uid(), code: code(), kind: 'item', name: it.name, price: it.price, at: Date.now(), status: 'pending' };
  s.orders.unshift(o); save(); return o;
}
export function cashOut(coins) {
  const s = shop();
  if (!s.rate || coins < (s.minCash || 1) || coins > s.coins) return null;
  s.coins -= coins;
  const o = { id: uid(), code: code(), kind: 'cash', name: `${Math.round(coins * s.rate)} Ft`, price: coins, ft: Math.round(coins * s.rate), at: Date.now(), status: 'pending' };
  s.orders.unshift(o); save(); return o;
}
export function settle(id, ok) {
  const s = shop(), o = s.orders.find(x => x.id === id);
  if (!o || o.status !== 'pending') return;
  o.status = ok ? 'done' : 'cancel';
  if (!ok) s.coins += o.price;
  o.closed = Date.now(); save();
}
export function adjust(n) { const s = shop(); s.coins = Math.max(0, s.coins + n); save(); }
