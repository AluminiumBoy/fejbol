// A kisállat állapota (grafika nélkül): nem, jóllakottság, falatok.
import { state, save } from './store.js?v=32';

export const NAMES = { m: 'Rókus', f: 'Roxi' };
const EMPTY_HOURS = 96; // ennyi idő alatt ürül ki teljesen (4 nap)

export function pet() {
  const p = state.pet = Object.assign({ g: '', food: .6, t: Date.now(), snacks: 0 }, state.pet || {});
  const h = (Date.now() - p.t) / 36e5;
  if (h > 0) { p.food = Math.max(0, p.food - h / EMPTY_HOURS); p.t = Date.now(); }
  return p;
}
export const petName = () => NAMES[pet().g] || 'Róka';
export const hungry = () => pet().food < .3;
export function setGender(g) { pet().g = g; save(); }
export function giveSnacks(n) { if (n > 0) { pet().snacks += n; save(); } }
export function feedOne() {
  const p = pet();
  if (p.snacks < 1) return false;
  p.snacks--; p.food = Math.min(1, p.food + .2); save();
  return true;
}
