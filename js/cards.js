// Gyűjtőkártyák: 30 kitalált autó, ritkaságokkal. Csomag jár a napi küldetésért, versszakért, egész versért.
import { state, save } from './store.js?v=14';
import { drawCarV } from './game.js?v=14';

export const RARITY = {
  common: { name: 'Sima', weight: 55, xpDup: 10 },
  rare: { name: 'Ritka', weight: 28, xpDup: 20 },
  epic: { name: 'Epikus', weight: 13, xpDup: 40 },
  legend: { name: 'Legendás', weight: 4, xpDup: 80 }
};
const RORDER = ['common', 'rare', 'epic', 'legend'];

// alak-sablonok a rajzolóhoz
const S = {
  hatch: { r1: .14, r2: .62, rh: .14, bh: .17, hood: .03, wr: .095, ride: 1 },
  sedan: { r1: .25, r2: .66, rh: .12, bh: .16, hood: .04, wr: .09, ride: .9 },
  wagon: { r1: .1, r2: .66, rh: .13, bh: .16, hood: .04, wr: .09, ride: .9 },
  van: { r1: .06, r2: .72, rh: .2, bh: .2, hood: .06, wr: .095, ride: 1.1 },
  suv: { r1: .1, r2: .62, rh: .16, bh: .2, hood: .02, wr: .115, ride: 1.6 },
  pickup: { r1: .42, r2: .7, rh: .15, bh: .18, hood: .02, wr: .115, ride: 1.6 },
  coupe: { r1: .3, r2: .64, rh: .1, bh: .14, hood: .05, wr: .09, ride: .7 },
  muscle: { r1: .3, r2: .57, rh: .11, bh: .18, hood: .015, wr: .1, ride: .9 },
  buggy: { r1: .35, r2: .6, rh: .1, bh: .1, hood: .04, wr: .13, ride: 2 },
  formula: { r1: .44, r2: .56, rh: .06, bh: .085, hood: .045, wr: .115, ride: .5 },
  hyper: { r1: .32, r2: .62, rh: .085, bh: .12, hood: .07, wr: .09, ride: .55 }
};

export const CARDS = [
  // sima
  { n: 'Városi Kompakt', r: 'common', s: 'hatch', color: '#4A90D9' },
  { n: 'Családi Szedán', r: 'common', s: 'sedan', color: '#8C939F' },
  { n: 'Kombi', r: 'common', s: 'wagon', color: '#3F7F5A' },
  { n: 'Kisbusz', r: 'common', s: 'van', color: '#F2F2F2' },
  { n: 'Pickup', r: 'common', s: 'pickup', color: '#B5462F' },
  { n: 'Taxi', r: 'common', s: 'sedan', color: '#F5C518', sign: 1 },
  { n: 'Városi Terepjáró', r: 'common', s: 'suv', color: '#5C6B7A' },
  { n: 'Retro Kupé', r: 'common', s: 'coupe', color: '#D98C3A' },
  { n: 'Postás Furgon', r: 'common', s: 'van', color: '#E8B90F', stripe: '#2B5FB0' },
  { n: 'Tanulóautó', r: 'common', s: 'hatch', color: '#E24A4A' },
  { n: 'Erdei Terepjáró', r: 'common', s: 'suv', color: '#4D6B35' },
  { n: 'Mini Kupé', r: 'common', s: 'coupe', color: '#9B59D0' },
  // ritka
  { n: 'Rendőrautó', r: 'rare', s: 'sedan', color: '#F4F6FA', stripe: '#1F4FB8', bar: ['#FF2B3D', '#2B6BFF'] },
  { n: 'Mentő', r: 'rare', s: 'van', color: '#F4F6FA', stripe: '#E03A3A', bar: ['#2B6BFF', '#2B6BFF'] },
  { n: 'Tűzoltó Parancsnok', r: 'rare', s: 'suv', color: '#D42A2A', stripe: '#F4F6FA', bar: ['#FF2B3D', '#FFB02B'] },
  { n: 'Sportkupé', r: 'rare', s: 'coupe', color: '#1F8FFF', spoiler: 1 },
  { n: 'Rali Bajnok', r: 'rare', s: 'hatch', color: '#1C3F9E', stripe: '#F5C518', spoiler: 2 },
  { n: 'Drift Kupé', r: 'rare', s: 'coupe', color: '#E0457B', spoiler: 2 },
  { n: 'Muscle Classic', r: 'rare', s: 'muscle', color: '#2E2F36', stripe: '#F4F4F4' },
  { n: 'Sivatagi Buggy', r: 'rare', s: 'buggy', color: '#E07B2A' },
  { n: 'Street Tuner', r: 'rare', s: 'sedan', color: '#23C483', spoiler: 1 },
  // epikus
  { n: 'Éjféli Tuner', r: 'epic', s: 'coupe', color: '#1C1F28', neon: '#00F0FF', spoiler: 2, stripe: '#00F0FF' },
  { n: 'Szuperkupé', r: 'epic', s: 'hyper', color: '#E32B2B', spoiler: 2 },
  { n: 'GT3 Pályaautó', r: 'epic', s: 'hyper', color: '#F4F6FA', stripe: '#1F8FFF', spoiler: 3 },
  { n: 'Formula Junior', r: 'epic', s: 'formula', color: '#1F6FE0', spoiler: 3, stripe: '#F4F4F4' },
  { n: 'Neon Runner', r: 'epic', s: 'coupe', color: '#6A2BD9', neon: '#FF2BD6', spoiler: 2 },
  { n: 'Hegyi Rali', r: 'epic', s: 'suv', color: '#F4F6FA', stripe: '#E32B2B', spoiler: 1 },
  // legendás
  { n: 'Aranyvillám', r: 'legend', s: 'hyper', color: '#E3A50B', spoiler: 3, stripe: '#1C1F28' },
  { n: 'Hiperkar X', r: 'legend', s: 'hyper', color: '#00B89C', neon: '#00F0FF', spoiler: 3 },
  { n: 'Fantom', r: 'legend', s: 'hyper', color: '#15161C', neon: '#B04DFF', spoiler: 3, stripe: '#B04DFF' }
].map((c, i) => ({ ...S[c.s], ...c, id: 'c' + (i + 1), no: i + 1, name: c.n }));

// értékek a kártyán: az alakból és a ritkaságból, mindig ugyanazok
function seeded(n) { let x = n * 7919 + 13; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }
export function stats(c) {
  const rnd = seeded(c.no), base = { common: 45, rare: 62, epic: 76, legend: 88 }[c.r];
  const sport = ['coupe', 'hyper', 'formula', 'muscle'].includes(c.s) ? 8 : c.s === 'van' ? -10 : 0;
  const v = k => Math.max(20, Math.min(99, Math.round(base + sport + k + rnd() * 10 - 5)));
  return [['Gyorsulás', v(c.s === 'muscle' ? 6 : 0)], ['Végsebesség', v(c.s === 'formula' ? 6 : 0)], ['Kezelhetőség', v(c.s === 'buggy' || c.s === 'hatch' ? 5 : 0)]];
}

export function col() {
  state.cards = Object.assign({ owned: {}, packs: 1, opened: 0 }, state.cards || {});
  return state.cards;
}
export const ownedCount = () => Object.keys(col().owned).length;

// csomag: 3 kártya, a harmadik legalább ritka; ha lehet, új lapot ad
function rollRarity(minIdx = 0) {
  const opts = RORDER.slice(minIdx), tot = opts.reduce((a, r) => a + RARITY[r].weight, 0);
  let x = Math.random() * tot;
  for (const r of opts) { x -= RARITY[r].weight; if (x <= 0) return r; }
  return opts[opts.length - 1];
}
export function openPack() {
  const C = col();
  if (C.packs < 1) return null;
  C.packs--; C.opened++;
  const out = [];
  for (let k = 0; k < 3; k++) {
    const r = rollRarity(k === 2 ? 1 : 0);
    const pool = CARDS.filter(c => c.r === r && !out.some(o => o.card.id === c.id));
    const fresh = pool.filter(c => !C.owned[c.id]);
    const from = fresh.length && Math.random() < .75 ? fresh : pool;
    const card = from[Math.floor(Math.random() * from.length)];
    const dup = !!C.owned[card.id];
    C.owned[card.id] = (C.owned[card.id] || 0) + 1;
    out.push({ card, dup });
  }
  const xp = out.filter(o => o.dup).reduce((a, o) => a + RARITY[o.card.r].xpDup, 0);
  state.game.xp += xp;
  save();
  return { cards: out.sort((a, b) => RORDER.indexOf(a.card.r) - RORDER.indexOf(b.card.r)), xp };
}
export function givePacks(n) { if (n > 0) { col().packs += n; save(); } }

// ---------- megjelenítés ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function cardHTML(c, { locked = false, small = false } = {}) {
  if (locked) return `<div class="tcard locked ${small ? 'sm' : ''}"><div class="tc-in"><span class="tc-q px">?</span><span class="tc-no px">#${c.no}</span></div></div>`;
  return `<div class="tcard r-${c.r} ${small ? 'sm' : ''}" data-card="${c.id}">
    <div class="tc-in">
      <div class="tc-top"><span class="tc-rar px">${RARITY[c.r].name}</span><span class="tc-no px">#${c.no}</span></div>
      <canvas class="tc-img" data-car="${c.id}"></canvas>
      <b class="tc-name px">${esc(c.name)}</b>
      ${small ? '' : `<div class="tc-stats">${stats(c).map(([l, v]) => `<div><span>${l}</span><i><i style="width:${v}%"></i></i><b>${v}</b></div>`).join('')}</div>`}
    </div>
    ${c.r === 'epic' || c.r === 'legend' ? '<div class="tc-holo"></div>' : ''}<div class="tc-glare"></div>
  </div>`;
}
export function paintCards(root) {
  root.querySelectorAll('canvas.tc-img').forEach(cv => {
    const c = CARDS.find(x => x.id === cv.dataset.car); if (!c) return;
    const w = cv.clientWidth || 200, h = Math.round(w * .5), dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCarV(g, w * .06, h * .86, w * .88, c);
  });
}

// hologram: dőlés az ujj / egér helyzete szerint, telefonon a döntés szerint is
export function tilt(el) {
  const set = (x, y) => {
    el.style.setProperty('--rx', ((.5 - y) * 22).toFixed(1) + 'deg');
    el.style.setProperty('--ry', ((x - .5) * 26).toFixed(1) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  };
  const move = e => {
    const r = el.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
    set(Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (p.clientY - r.top) / r.height)));
  };
  const reset = () => set(.5, .5);
  el.addEventListener('pointermove', move); el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('pointerleave', reset);
  const ori = e => { if (e.gamma == null) return; set(.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, .5 + Math.max(-30, Math.min(30, (e.beta || 45) - 45)) / 60); };
  window.addEventListener('deviceorientation', ori);
  reset();
  return () => window.removeEventListener('deviceorientation', ori);
}
