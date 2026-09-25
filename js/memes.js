// Mém reakciók: a felhasználó saját képei (csak ezen a telefonon, IndexedDB-ben), ha nincs, beépített rajzok.
import { state, save } from './store.js?v=41';

const DB = 'fejbol-memes', STORE = 'imgs';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
    const out = fn(st);
    t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
}

export const memesOn = () => state.settings.memes !== false;
export function setMemes(on) { state.settings.memes = on; save(); }

// kép kicsinyítése, hogy ne foglaljon sok helyet
async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 560 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .85));
}
export async function addMeme(kind, file) {
  const blob = await shrink(file);
  await tx('readwrite', st => st.put({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind, blob }));
  cache = null;
}
export async function removeMeme(id) { await tx('readwrite', st => st.delete(id)); cache = null; }
export async function listMemes() {
  try { return await tx('readonly', st => st.getAll()) || []; } catch (e) { return []; }
}

let cache = null;
async function urls() {
  if (cache) return cache;
  const all = await listMemes();
  cache = { good: [], bad: [] };
  all.forEach(m => cache[m.kind]?.push(URL.createObjectURL(m.blob)));
  return cache;
}

// beépített, saját rajzok
const SAD = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="#1B2130"/><path d="M40 70 L55 20 L85 55Z M160 70 L145 20 L115 55Z" fill="#9AA1AE"/><path d="M50 60 L57 35 L75 55Z M150 60 L143 35 L125 55Z" fill="#E7A9B4"/><ellipse cx="100" cy="112" rx="68" ry="60" fill="#B4BAC6"/><ellipse cx="72" cy="102" rx="20" ry="24" fill="#1A1C22"/><ellipse cx="128" cy="102" rx="20" ry="24" fill="#1A1C22"/><circle cx="78" cy="94" r="8" fill="#fff"/><circle cx="134" cy="94" r="8" fill="#fff"/><circle cx="68" cy="110" r="4" fill="#fff" opacity=".8"/><circle cx="124" cy="110" r="4" fill="#fff" opacity=".8"/><path d="M58 124 q-6 22 2 34 q8-10 2-34z" fill="#6FC3FF"/><path d="M142 124 q6 22 -2 34 q-8-10 -2-34z" fill="#6FC3FF"/><path d="M92 132 L100 138 L108 132" fill="#E7A9B4"/><path d="M84 152 q16 -12 32 0" stroke="#3A3E48" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M60 64 q12 8 26 6 M140 64 q-12 8 -26 6" stroke="#3A3E48" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`)}`;
const COOL = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="#1B2130"/><path d="M40 70 L55 20 L85 55Z M160 70 L145 20 L115 55Z" fill="#E08A2E"/><path d="M50 60 L57 35 L75 55Z M150 60 L143 35 L125 55Z" fill="#F6C28B"/><ellipse cx="100" cy="112" rx="68" ry="60" fill="#F0A040"/><path d="M60 80 l14 8 M140 80 l-14 8 M80 60 l6 12 M120 60 l-6 12" stroke="#C4701E" stroke-width="5" stroke-linecap="round"/><path d="M36 96 H164 L158 104 Q150 126 124 124 Q104 122 100 106 Q96 122 76 124 Q50 126 42 104Z" fill="#0E0F13"/><path d="M52 102 L70 102 L60 116Z M112 102 L130 102 L120 116Z" fill="#fff" opacity=".35"/><path d="M92 136 L100 142 L108 136" fill="#8A3B12"/><path d="M86 154 q18 10 34 -6" stroke="#5A2A10" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M30 130 h28 M32 142 h26 M170 130 h-28 M168 142 h-26" stroke="#FFF3E0" stroke-width="2.5" stroke-linecap="round" opacity=".8"/></svg>`)}`;

export async function pick(kind) {
  const u = await urls();
  const list = u[kind];
  if (list.length) return list[Math.floor(Math.random() * list.length)];
  return kind === 'good' ? COOL : SAD;
}

// kis felugró mém (válaszoknál); ritkítva, hogy ne legyen sok
let last = 0;
export async function popMeme(kind) {
  if (!memesOn() || Date.now() - last < 3500) return;
  last = Date.now();
  const src = await pick(kind);
  document.querySelector('.memepop')?.remove();
  const el = document.createElement('img');
  el.className = 'memepop ' + kind; el.src = src; el.alt = '';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
