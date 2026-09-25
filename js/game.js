// Játékréteg: XP, szintek, blokkok és építkezés, jelvények, napi küldetés, hangeffektek
import { state, save, streak, dayKey } from './store.js';

export const MISSION_SIZE = 3;

// ---------- szintek ----------
const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];
export function levelInfo(xp = state.game.xp) {
  const LEVEL_NAMES = world().levels;
  let l = 0; while (l + 1 < LEVELS.length && xp >= LEVELS[l + 1]) l++;
  const base = LEVELS[l], next = LEVELS[l + 1] ?? base + 1500;
  return { lvl: l + 1, name: LEVEL_NAMES[l] || 'Nagymester', cur: xp - base, need: next - base, frac: (xp - base) / (next - base) };
}

// ---------- világok ----------
// A csillagokból gyűlő pontok (state.game.blocks) mindhárom világban ugyanazok, csak a megjelenés más.
// . üres, S kő, W ablak, G kapu, F zászló, P rúd, R tető
const BUILDS = [
  { name: 'Vár', rows: [
    '...F........F...',
    '...P........P...',
    '.S.S.S....S.S.S.',
    '.SSSSS....SSSSS.',
    '.SSWSS.SS.SSWSS.',
    '.SSSSSSSSSSSSSS.',
    '.SWSSSSSSSSSSWS.',
    '.SSSSSSSSSSSSSS.',
    '.SSSSSGGGGSSSSS.',
    '.SSSSSGGGGSSSSS.',
    '.SSSSSGGGGSSSSS.'] },
  { name: 'Torony', rows: [
    '.......F........',
    '.......P........',
    '......RRR.......',
    '.....RRRRR......',
    '....RRRRRRR.....',
    '.....SSSSS......',
    '.....SWSWS......',
    '.....SSSSS......',
    '.....SWSWS......',
    '.....SSSSS......',
    '.....SSGSS......'] }
];
const RANKS = ['Újonc', 'Bronz I', 'Bronz II', 'Ezüst I', 'Ezüst II', 'Arany I', 'Arany II', 'Platina', 'Gyémánt', 'Mester', 'Nagymester', 'Legenda'];
const cellsOf = b => b.rows.join('').replace(/\./g, '').length;

export const WORLDS = {
  build: {
    name: 'Építő', desc: 'Blokkokból vár és torony épül', unit: 'blokk',
    levels: RANKS,
    stage: i => { const b = BUILDS[i % BUILDS.length]; return { ...b, size: cellsOf(b), name: i >= BUILDS.length ? `${b.name} (${Math.floor(i / BUILDS.length) + 1}.)` : b.name }; },
    label: st => `Építkezés: ${st.name}`,
    hint: 'Minden csillag egy blokk. Tanulj, és felépül!',
    done: st => `Felépült: ${st.name}!`, next: 'Kezdődik a következő építkezés.',
    badge: { name: 'Építőmester', desc: 'Az első építmény kész' },
    draw: drawBuild
  },
  car: {
    name: 'Autós', desc: 'Versenyzés, minden csillag 1 km', unit: 'km',
    levels: RANKS,
    stage: i => ({ name: `${i + 1}. futam`, size: Math.min(40 + i * 10, 100), n: i }),
    label: st => `Verseny: ${st.name}`,
    hint: 'Minden csillag 1 km. Érj célba!',
    done: st => `Célba értél: ${st.name}!`, next: 'Indul a következő futam, kicsit hosszabb pályán.',
    badge: { name: 'Első futam', desc: 'Először értél célba' },
    draw: drawRace
  },
  foot: {
    name: 'Focis', desc: 'Meccsek és kupák, minden csillag egy gól', unit: 'gól',
    levels: RANKS,
    stage: i => ({ name: `${i + 1}. meccs`, size: Math.min(12 + i * 3, 30), n: i }),
    label: st => `Bajnokság: ${st.name}`,
    hint: 'Minden csillag egy gól. Nyerd meg a meccset!',
    done: st => `Megnyerted: ${st.name}!`, next: 'Jön a következő meccs, erősebb ellenféllel.',
    badge: { name: 'Első győzelem', desc: 'Az első meccs megnyerve' },
    draw: drawMatch
  }
};
export const world = () => WORLDS[state.settings.world] || WORLDS.build;

// hányadik szakasznál tart, és abban mennyi van kész
export function buildProgress(blocks = state.game.blocks, w = world()) {
  let i = 0, left = blocks;
  while (left >= w.stage(i).size) { left -= w.stage(i).size; i++; }
  const st = w.stage(i);
  return { index: i, stage: st, build: st, placed: left, size: st.size, finished: i };
}
export const drawProgress = (canvas, prog, fresh = 0, w = world()) => w.draw(canvas, prog, fresh);

function setup(canvas, W, H) {
  const css = canvas.clientWidth || 320, px = Math.floor(css / W);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * px * dpr; canvas.height = H * px * dpr;
  canvas.style.height = (H * px) + 'px';
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.imageSmoothingEnabled = false;
  return { g, px };
}

const COLORS = { S: '#8E949E', W: '#35507F', G: '#7A4B26', F: '#D6453D', P: '#5B3A1E', R: '#B5452F' };
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(',')})`;
}
function block(g, x, y, px, col) {
  const e = Math.max(2, px / 7);
  g.fillStyle = col; g.fillRect(x, y, px, px);
  g.fillStyle = shade(col, 1.25); g.fillRect(x, y, px, e); g.fillRect(x, y, e, px);
  g.fillStyle = shade(col, 0.7); g.fillRect(x, y + px - e, px, e); g.fillRect(x + px - e, y, e, px);
}

// Építő: alulról felfelé, balról jobbra
function drawBuild(canvas, prog, fresh = 0) {
  const { stage: build, placed } = prog;
  const rows = build.rows, W = 16, H = rows.length + 1;
  const { g, px } = setup(canvas, W, H);
  const cells = [];
  for (let r = rows.length - 1; r >= 0; r--) for (let c = 0; c < W; c++) if (rows[r][c] !== '.') cells.push([r, c, rows[r][c]]);
  const ghost = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#ccc';
  cells.forEach(([r, c, t], k) => {
    const x = c * px, y = r * px;
    if (k < placed) {
      block(g, x, y, px, COLORS[t]);
      if (t === 'W') { g.fillStyle = '#F2C14E'; g.fillRect(x + px * .3, y + px * .3, px * .4, px * .4); }
      if (k >= placed - fresh) { g.strokeStyle = '#F2C14E'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, px - 2, px - 2); }
    } else {
      g.strokeStyle = ghost; g.lineWidth = 1; g.setLineDash([2, 2]); g.strokeRect(x + .5, y + .5, px - 1, px - 1); g.setLineDash([]);
    }
  });
  const y = rows.length * px;
  for (let c = 0; c < W; c++) {
    g.fillStyle = '#6B4A2B'; g.fillRect(c * px, y, px, px);
    g.fillStyle = '#5BAA3C'; g.fillRect(c * px, y, px, px * .35);
    g.fillStyle = '#4A8F30'; g.fillRect(c * px + (c % 3) * px / 4, y + px * .35, px / 4, px / 6);
  }
}

// Autós: garázs. Minden megnyert futam felold egy új autót.
// Oldalnézeti autók paraméterekből (hossz arányában): r1/r2 tető eleje-vége, rh tetőmagasság,
// bh karosszéria magasság, hood motorháztető lejtése, wr kerék sugár, ride hasmagasság, spoiler, neon
export const CARS = [
  { id: 'kiscsavo', name: 'Kiscsávó', color: '#E8672C', r1: .14, r2: .62, rh: .14, bh: .17, hood: .03, wr: .095, ride: 1 },
  { id: 'street', name: 'Street Racer', color: '#2F6FE0', r1: .27, r2: .66, rh: .115, bh: .15, hood: .04, wr: .09, ride: .8, spoiler: 1 },
  { id: 'drift', name: 'Drift King', color: '#8A4FE0', neon: '#00F0FF', r1: .3, r2: .64, rh: .1, bh: .14, hood: .05, wr: .09, ride: .7, spoiler: 2 },
  { id: 'muscle', name: 'Muscle Beast', color: '#D93A3A', r1: .3, r2: .57, rh: .11, bh: .18, hood: .015, wr: .1, ride: .9, stripe: '#F4F4F4' },
  { id: 'terep', name: 'Terepszörny', color: '#6E8B3D', r1: .1, r2: .6, rh: .16, bh: .2, hood: .02, wr: .125, ride: 1.9 },
  { id: 'formula', name: 'Formula', color: '#E32B2B', r1: .44, r2: .56, rh: .06, bh: .085, hood: .045, wr: .115, ride: .5, spoiler: 3, stripe: '#F4F4F4' },
  { id: 'hyper', name: 'Hypercar', color: '#00B89C', r1: .32, r2: .62, rh: .085, bh: .12, hood: .07, wr: .09, ride: .55, spoiler: 2 },
  { id: 'ghost', name: 'Neon Ghost', color: '#1C1F28', neon: '#FF2BD6', r1: .32, r2: .62, rh: .085, bh: .12, hood: .07, wr: .09, ride: .55, spoiler: 2, stripe: '#FF2BD6' },
  { id: 'goat', name: 'GOAT GT', color: '#E3A50B', r1: .33, r2: .61, rh: .08, bh: .115, hood: .075, wr: .095, ride: .5, spoiler: 3, stripe: '#1C1F28' }
];
// hány autó van feloldva: 1 + a megnyert futamok száma
const carsUnlockedAt = b => Math.min(CARS.length, 1 + buildProgress(b, WORLDS.car).finished);
export const carsUnlocked = () => carsUnlockedAt(state.game.blocks);
export function activeCar() {
  const n = carsUnlocked();
  const i = CARS.findIndex(c => c.id === state.game.car);
  return CARS[i >= 0 && i < n ? i : n - 1];
}

// Autó rajzolása oldalnézetből. x: hátsó vége, y: talaj, L: hossz pixelben. Előre (jobbra) néz.
export function drawCarV(g, x, y, L, c, { alpha = 1, silhouette = false, glow = true } = {}) {
  g.save(); g.globalAlpha = alpha;
  const r = L * c.wr, yb = y - r * c.ride - r * .35, yt = yb - L * c.bh, yr = yt - L * c.rh;
  const X = f => x + L * f;
  const dark = silhouette ? '#20242E' : shade(c.color, .45);
  // árnyék és neon aláfény
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath(); g.ellipse(X(.5), y + r * .08, L * .5, r * .22, 0, 0, Math.PI * 2); g.fill();
  if (c.neon && !silhouette && glow) {
    const ng = g.createRadialGradient(X(.5), y, 1, X(.5), y, L * .55);
    ng.addColorStop(0, c.neon + 'AA'); ng.addColorStop(1, c.neon + '00');
    g.fillStyle = ng; g.beginPath(); g.ellipse(X(.5), y, L * .6, r * .7, 0, 0, Math.PI * 2); g.fill();
  }
  // karosszéria
  const body = new Path2D();
  body.moveTo(X(.03), yb);
  body.lineTo(X(.008), yt + L * .035);
  body.quadraticCurveTo(X(0), yt, X(.05), yt);
  body.lineTo(X(c.r1 - .05), yt);
  body.quadraticCurveTo(X(c.r1 + .01), yr, X(c.r1 + .09), yr);
  body.lineTo(X(c.r2 - .07), yr);
  body.quadraticCurveTo(X(c.r2 + .02), yr + L * .005, X(c.r2 + .13), yt);
  body.lineTo(X(.955), yt + L * c.hood);
  body.quadraticCurveTo(X(1), yt + L * c.hood, X(.995), yb - L * .025);
  body.quadraticCurveTo(X(.99), yb, X(.95), yb);
  body.closePath();
  if (silhouette) g.fillStyle = '#20242E';
  else {
    const bg = g.createLinearGradient(0, yr, 0, yb);
    bg.addColorStop(0, shade(c.color, 1.35)); bg.addColorStop(.45, c.color); bg.addColorStop(1, shade(c.color, .5));
    g.fillStyle = bg;
  }
  g.fill(body);
  // kerékjárati ívek
  const wx = [X(.2), X(.8)], wy = y - r;
  g.fillStyle = '#0A0B0F';
  wx.forEach(cx => { g.beginPath(); g.arc(cx, wy, r * 1.16, Math.PI, 0); g.lineTo(cx + r * 1.16, yb + 1); g.lineTo(cx - r * 1.16, yb + 1); g.fill(); });
  if (!silhouette) {
    // üvegek
    const inset = L * .018;
    const glass = new Path2D();
    glass.moveTo(X(c.r1 - .02), yt - inset * .3);
    glass.quadraticCurveTo(X(c.r1 + .025), yr + inset, X(c.r1 + .095), yr + inset);
    glass.lineTo(X(c.r2 - .075), yr + inset);
    glass.quadraticCurveTo(X(c.r2 + .005), yr + inset, X(c.r2 + .1), yt - inset * .3);
    glass.closePath();
    const gg = g.createLinearGradient(0, yr, 0, yt);
    gg.addColorStop(0, '#A9D8FF'); gg.addColorStop(1, '#1D2A44');
    g.fillStyle = gg; g.fill(glass);
    // ajtóoszlop
    g.fillStyle = shade(c.color, .6);
    g.fillRect(X((c.r1 + c.r2) / 2 + .01), yr + inset, L * .018, yt - yr - inset);
    // csík
    if (c.stripe) { g.fillStyle = c.stripe; g.globalAlpha = alpha * .9; g.fillRect(X(.04), yt + (yb - yt) * .42, L * .9, Math.max(2, (yb - yt) * .12)); g.globalAlpha = alpha; }
    // fényes perem
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, L * .006);
    g.beginPath(); g.moveTo(X(.05), yt + L * .012); g.lineTo(X(c.r1 - .04), yt + L * .012); g.moveTo(X(c.r2 + .14), yt + L * .012); g.lineTo(X(.94), yt + L * c.hood + L * .012); g.stroke();
    // ajtóvonal
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(1, L * .004);
    g.beginPath(); g.moveTo(X(c.r1 + .02), yt + 2); g.lineTo(X(c.r1 + .02), yb - r * .6); g.moveTo(X(c.r2 + .06), yt + 2); g.lineTo(X(c.r2 + .06), yb - r * .6); g.stroke();
    // lámpák
    g.fillStyle = '#FFF3B0'; g.shadowColor = '#FFE27A'; g.shadowBlur = glow ? L * .05 : 0;
    g.beginPath(); g.ellipse(X(.975), yt + L * c.hood + (yb - yt) * .2, L * .016, (yb - yt) * .12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FF2B3D'; g.shadowColor = '#FF2B3D';
    g.fillRect(X(.006), yt + (yb - yt) * .18, L * .02, (yb - yt) * .22);
    g.shadowBlur = 0;
    // szárny
    if (c.spoiler) {
      const h = L * (.02 + c.spoiler * .012), sw = L * (.1 + c.spoiler * .02);
      g.fillStyle = dark;
      g.fillRect(X(.06), yt - h, L * .012, h); g.fillRect(X(.06) + sw * .6, yt - h, L * .012, h);
      g.fillStyle = c.spoiler > 2 ? shade(c.color, .8) : dark;
      g.beginPath(); g.moveTo(X(.02), yt - h); g.lineTo(X(.02) + sw, yt - h - L * .005); g.lineTo(X(.02) + sw, yt - h + L * .012); g.lineTo(X(.02), yt - h + L * .016); g.fill();
    }
  }
  // kerekek
  wx.forEach(cx => {
    g.fillStyle = '#121419'; g.beginPath(); g.arc(cx, wy, r, 0, Math.PI * 2); g.fill();
    if (silhouette) return;
    const rg = g.createRadialGradient(cx - r * .2, wy - r * .2, 1, cx, wy, r * .68);
    rg.addColorStop(0, '#F2F4F8'); rg.addColorStop(1, '#7E8594');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, wy, r * .64, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3A3F4B'; g.lineWidth = Math.max(1, r * .12);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.beginPath(); g.moveTo(cx, wy); g.lineTo(cx + Math.cos(a) * r * .6, wy + Math.sin(a) * r * .6); g.stroke(); }
    g.fillStyle = c.neon || '#2A2E38'; g.beginPath(); g.arc(cx, wy, r * .17, 0, Math.PI * 2); g.fill();
  });
  g.restore();
}

function hiCanvas(canvas, ratio) {
  const w = canvas.clientWidth || 320, h = Math.round(w * ratio), dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

export function drawCarCard(canvas, c, locked) {
  const { g, w, h } = hiCanvas(canvas, .5);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, locked ? '#0F1117' : '#1A1F2C'); bg.addColorStop(1, '#0B0D12');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (!locked) {
    const sp = g.createRadialGradient(w / 2, h * .1, 2, w / 2, h * .5, w * .55);
    sp.addColorStop(0, 'rgba(255,255,255,.16)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp; g.fillRect(0, 0, w, h);
  }
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, h * .8, w, h * .2);
  drawCarV(g, w * .09, h * .8, w * .82, c, { silhouette: locked });
}

// Éjszakai versenypálya: az autó a rajttól a célig halad
function seeded(n) { let x = n * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }
function drawRace(canvas, prog) {
  const { g, w, h } = hiCanvas(canvas, .5);
  const sky = g.createLinearGradient(0, 0, 0, h * .62);
  sky.addColorStop(0, '#070312'); sky.addColorStop(.7, '#2A0B4A'); sky.addColorStop(1, '#7A1E6E');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const rnd = seeded(7);
  g.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd() * w, rnd() * h * .4, 1.2, 1.2);
  // város sziluett ablakokkal
  const base = h * .62;
  for (let x = 0; x < w;) {
    const bw = w * (.04 + rnd() * .06), bh = h * (.1 + rnd() * .28);
    g.fillStyle = '#12061F'; g.fillRect(x, base - bh, bw, bh);
    g.fillStyle = rnd() > .5 ? 'rgba(255,200,90,.55)' : 'rgba(120,220,255,.45)';
    for (let yy = base - bh + 5; yy < base - 4; yy += 7) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if (rnd() > .55) g.fillRect(xx, yy, 2.5, 3);
    x += bw + 2;
  }
  // horizont fény
  const hz = g.createLinearGradient(0, base - 6, 0, base + 6);
  hz.addColorStop(0, 'rgba(255,43,214,0)'); hz.addColorStop(.5, 'rgba(255,43,214,.9)'); hz.addColorStop(1, 'rgba(255,43,214,0)');
  g.fillStyle = hz; g.fillRect(0, base - 6, w, 12);
  // út
  const road = base + 4, rh = h - road - h * .06;
  const rg = g.createLinearGradient(0, road, 0, road + rh);
  rg.addColorStop(0, '#1B1D26'); rg.addColorStop(1, '#0E0F14');
  g.fillStyle = rg; g.fillRect(0, road, w, rh);
  g.fillStyle = '#00E5FF'; g.shadowColor = '#00E5FF'; g.shadowBlur = 8;
  g.fillRect(0, road, w, 2); g.fillRect(0, road + rh - 2, w, 2); g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let x = 0; x < w; x += 34) g.fillRect(x, road + rh * .55, 18, 2);
  g.fillStyle = '#0B0D12'; g.fillRect(0, road + rh, w, h);
  // cél
  const fx = w * .9, sq = Math.max(4, rh / 8);
  for (let r = 0; r * sq < rh; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#EEE'; g.fillRect(fx + c * sq, road + r * sq, sq, Math.min(sq, rh - r * sq)); }
  // táv
  const start = w * .04, span = fx - start - w * .02;
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `700 ${Math.max(10, w * .026)}px system-ui,sans-serif`; g.textAlign = 'center';
  for (let k = 0; k <= 4; k++) g.fillText(`${Math.round(prog.size * k / 4)} km`, start + span * k / 4 + w * .06, h - h * .015);
  // autó és sebességcsíkok
  const L = w * .2, f = Math.min(1, prog.placed / prog.size), cx = start + (span - L) * f;
  const carY = road + rh * .8;
  if (f > 0) {
    g.strokeStyle = 'rgba(0,229,255,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const yy = carY - L * .05 - i * L * .045; g.beginPath(); g.moveTo(Math.max(0, cx - L * (.3 + i * .08)), yy); g.lineTo(cx - 4, yy); g.stroke(); }
  }
  drawCarV(g, cx, carY, L, activeCar());
}

// Focis: a labda a kapu felé halad, a gólok golyóként gyűlnek
function drawMatch(canvas, prog, fresh = 0) {
  const W = 40, H = 20;
  const { g, px } = setup(canvas, W, H);
  for (let c = 0; c < W; c += 4) { g.fillStyle = (c / 4) % 2 ? '#3E9A45' : '#47A94E'; g.fillRect(c * px, 0, 4 * px, H * px); }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(2, px * .3);
  g.strokeRect(px, px, (W - 2) * px, (H - 2) * px);
  g.beginPath(); g.moveTo(W / 2 * px, px); g.lineTo(W / 2 * px, (H - 1) * px); g.stroke();
  g.beginPath(); g.arc(W / 2 * px, H / 2 * px, 3.5 * px, 0, Math.PI * 2); g.stroke();
  g.strokeRect((W - 7) * px, (H / 2 - 5) * px, 6 * px, 10 * px);
  // kapu és háló
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect((W - 1) * px, (H / 2 - 3) * px, px, 6 * px);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
  for (let y = H / 2 - 3; y <= H / 2 + 3; y += .75) { g.beginPath(); g.moveTo((W - 1) * px, y * px); g.lineTo(W * px, y * px); g.stroke(); }
  // eredményjelző
  g.fillStyle = 'rgba(15,20,30,.78)'; g.fillRect(1.6 * px, 1.6 * px, 11 * px, 3.4 * px);
  g.fillStyle = '#fff'; g.font = `800 ${Math.max(11, px * 2)}px system-ui,sans-serif`; g.textAlign = 'left';
  g.fillText(`${prog.placed} / ${prog.size}`, 2.4 * px, 4.2 * px);
  // labda útja
  const f = prog.placed / prog.size;
  const bx = (3 + (W - 7) * f) * px, by = (H / 2 + Math.sin(f * Math.PI * 3) * 3) * px;
  if (fresh) { const f0 = (prog.placed - fresh) / prog.size; g.globalAlpha = .3; ball(g, (3 + (W - 7) * f0) * px, (H / 2 + Math.sin(f0 * Math.PI * 3) * 3) * px, px); g.globalAlpha = 1; }
  ball(g, bx, by, px);
}
function ball(g, x, y, px) {
  const r = px * 1.3;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1B1F27'; g.beginPath(); g.arc(x, y, r * .38, 0, Math.PI * 2); g.fill();
  [0, 1.26, 2.51, 3.77, 5.03].forEach(a => { g.beginPath(); g.arc(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .2, 0, Math.PI * 2); g.fill(); });
}

// ---------- jelvények ----------
export const BADGES = [
  { id: 'elso', name: 'Első lépés', desc: 'Az első feladat kész', glyph: '1', color: '#3DDC84' },
  { id: 'versszak', name: 'Első versszak', desc: 'Egy versszak megy fejből', glyph: '§', color: '#3D8BFF' },
  { id: 'hibatlan', name: 'Hibátlan', desc: '5-ször 3 csillag', glyph: '★', color: '#FFC83D' },
  { id: 'sorozat3', name: '3 napos sorozat', desc: '3 nap egymás után', glyph: '3', color: '#FF6B3D' },
  { id: 'sorozat7', name: 'Egy hét', desc: '7 nap egymás után', glyph: '7', color: '#FF3D5A' },
  { id: 'villam', name: 'Speedrunner', desc: '10 pont a speedrunban', glyph: '⚡', color: '#B04DFF' },
  { id: 'kuldetes5', name: 'Kitartó', desc: '5 napi küldetés teljesítve', glyph: 'G', color: '#00D1C1' },
  { id: 'epito', name: 'Építőmester', desc: 'Az első építmény kész', glyph: '▦', color: '#C08A4B' },
  { id: 'vers', name: 'Az egész vers', desc: 'Egy egész vers megy fejből', glyph: '♛', color: '#FFD700' }
];

export const badgeInfo = b => b.id === 'epito' ? { ...b, ...world().badge } : b;

// ---------- jutalmazás egy feladat után ----------
export function starsFor(score, raw) {
  if (raw != null) return raw >= 15 ? 3 : raw >= 10 ? 2 : raw >= 5 ? 1 : 0;
  return score >= 0.95 ? 3 : score >= 0.8 ? 2 : score >= 0.5 ? 1 : 0;
}

// Érme a Jutalomboltba: csak a sikeres munka ér érmét (a meghallgatás nem).
function earnCoins({ task, pass, raw, stars, mastered, wholeDone, missionDone }) {
  let c = 0;
  if (task.type === 'blitz') c = Math.floor((raw || 0) / 4);
  else if (pass && task.type !== 'listen') c = 1 + stars;
  if (missionDone) c += 5;
  if (mastered) c += 10;
  if (wholeDone) c += 30;
  state.shop = state.shop || { coins: 0, items: [], orders: [] };
  state.shop.coins += c;
  return c;
}

export function reward({ task, score, pass, raw, mastered, wholeDone, poem }) {
  const G = state.game;
  const before = levelInfo(G.xp), buildBefore = buildProgress(G.blocks);
  const stars = starsFor(score, raw);
  let xp = 10 + stars * 5;
  if (task.type === 'blitz') xp = 5 + (raw || 0) * 2;
  if (task.kind === 'learn' && pass) xp += 10;
  if (mastered) xp += 40;
  if (task.kind === 'chain' && pass) xp += 30;
  if (wholeDone) xp += 150;
  const blocks = task.type === 'blitz' ? Math.floor((raw || 0) / 4) : stars;

  // napi küldetés
  const today = dayKey();
  if (G.mission.day !== today) G.mission = { day: today, done: 0, claimed: false };
  G.mission.done++;
  let missionDone = false;
  if (G.mission.done >= MISSION_SIZE && !G.mission.claimed) {
    G.mission.claimed = true; G.missionsDone++; missionDone = true; xp += 30;
  }

  G.xp += xp; G.blocks += blocks; G.tasks++;
  if (stars === 3) G.perfect++;
  if (task.type === 'blitz' && raw > (poem.best || 0)) poem.best = raw;

  const carsBefore = carsUnlockedAt(G.blocks - blocks);
  const buildAfter = buildProgress(G.blocks);
  const newCars = CARS.slice(carsBefore, carsUnlockedAt(G.blocks));
  const earned = [];
  const give = id => { if (!G.badges.includes(id)) { G.badges.push(id); earned.push(badgeInfo(BADGES.find(b => b.id === id))); } };
  give('elso');
  if (mastered) give('versszak');
  if (G.perfect >= 5) give('hibatlan');
  if (streak() >= 3) give('sorozat3');
  if (streak() >= 7) give('sorozat7');
  if (task.type === 'blitz' && raw >= 10) give('villam');
  if (G.missionsDone >= 5) give('kuldetes5');
  if (buildAfter.finished > 0) give('epito');
  if (wholeDone) give('vers');
  const coins = earnCoins({ task, pass, raw, stars, mastered, wholeDone, missionDone });
  save();

  const after = levelInfo(G.xp);
  return {
    xp, blocks, stars, earned, missionDone, coins, newCars: state.settings.world === 'car' ? newCars : [],
    mission: Math.min(G.mission.done, MISSION_SIZE),
    levelUp: after.lvl > before.lvl ? after : null,
    buildDone: buildAfter.finished > buildBefore.finished ? buildBefore.stage : null
  };
}

export function missionToday() {
  const m = state.game.mission;
  return m.day === dayKey() ? { done: Math.min(m.done, MISSION_SIZE), claimed: m.claimed } : { done: 0, claimed: false };
}

// ---------- hangeffektek (WebAudio, fájl nélkül) ----------
let ac = null;
function tone(freq, t0, dur, type = 'square', vol = 0.06) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.02);
}
export function sfx(kind) {
  if (state.settings.sound === false) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (kind === 'good') { tone(660, 0, .08); tone(990, .07, .12); }
    else if (kind === 'bad') { tone(160, 0, .16, 'triangle', .12); }
    else if (kind === 'block') { tone(300, 0, .05, 'triangle', .1); tone(220, .04, .08, 'triangle', .08); }
    else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .16)); }
    else if (kind === 'level') { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .08, .2, 'square', .05)); }
    else if (kind === 'tick') { tone(1200, 0, .03, 'square', .03); }
  } catch (e) {}
}

// ---------- konfetti ----------
export function confetti(ms = 2500) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30';
  document.body.appendChild(c);
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#5BAA3C', '#F2C14E', '#D6453D', '#2340A0', '#8E949E', '#8A4FD8'];
  const ps = Array.from({ length: 90 }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .5, s: 6 + Math.random() * 6, v: 2 + Math.random() * 3, d: (Math.random() - .5) * 1.5, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    g.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => { p.y += p.v; p.x += p.d; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); });
    if (t - t0 < ms) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
