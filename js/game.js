// Játékréteg: XP, szintek, blokkok és építkezés, jelvények, napi küldetés, hangeffektek
import { state, save, streak, dayKey } from './store.js?v=35';
import { cardById } from './cards.js?v=35';
import { petName } from './pet.js?v=35';

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
const RANKS = ['Újonc', 'Bronz I', 'Bronz II', 'Ezüst I', 'Ezüst II', 'Arany I', 'Arany II', 'Platina', 'Gyémánt', 'Mester', 'Nagymester', 'Legenda'];

export const WORLDS = {
  pet: {
    name: 'Kisállat', desc: 'Neveld fel a saját rókádat: a tanulás eteti és növeszti', unit: 'csillag',
    levels: RANKS,
    stage: i => ({ name: ['Kamasz', 'Felnőtt', 'Legenda', 'Legenda'][Math.min(i, 3)], size: [25, 45, 80, Infinity][Math.min(i, 3)], n: i }),
    label: st => `Következő: ${st.name}`,
    hint: 'Minden csillag közelebb visz a növéshez.',
    done: st => `${petName()} megnőtt: ${st.name}!`, next: 'Nézd meg a kezdőlapon!',
    badge: { name: 'Első növés', desc: 'A kisállatod először nőtt' },
    draw: drawPetPreview
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
export const world = () => WORLDS[state.settings.world] || WORLDS.car;

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

// Kisállat előnézet a világválasztóhoz (egy előre lerenderelt kép)
const petPrev = new Image(); petPrev.src = 'img/pet-preview.webp';
function drawPetPreview(canvas) {
  const w = canvas.clientWidth || 300, h = Math.round(w * .5), dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const paint = () => { const k = Math.max(w / petPrev.naturalWidth, h / petPrev.naturalHeight); const iw = petPrev.naturalWidth * k, ih = petPrev.naturalHeight * k; g.drawImage(petPrev, (w - iw) / 2, (h - ih) / 2 - h * .05, iw, ih); };
  if (petPrev.complete && petPrev.naturalWidth) paint(); else petPrev.addEventListener('load', paint, { once: true });
}

// Autós: garázs. Minden megnyert futam felold egy új, valódi autót (a gyűjtőkártyák fotóival).
const GARAGE = ['c7', 'c1', 'c3', 'c15', 'c14', 'c16', 'c22', 'c23', 'c28'];
export const CARS = GARAGE.map(cardById);
const carsUnlockedAt = b => Math.min(CARS.length, 1 + buildProgress(b, WORLDS.car).finished);
export const carsUnlocked = () => carsUnlockedAt(state.game.blocks);
export function activeCar() {
  const n = carsUnlocked();
  const i = CARS.findIndex(c => c.id === state.game.car);
  return CARS[i >= 0 && i < n ? i : n - 1];
}

// képek betöltése egyszer, a vászonra rajzoláshoz
const imgCache = new Map();
function carImage(c, onload) {
  let im = imgCache.get(c.id);
  if (!im) { im = new Image(); im.src = c.img; imgCache.set(c.id, im); }
  if (!im.complete) im.addEventListener('load', onload, { once: true });
  return im;
}

function hiCanvas(canvas, ratio) {
  const w = canvas.clientWidth || 320, h = Math.round(w * ratio), dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
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
  const L = w * .24, f = Math.min(1, prog.placed / prog.size), cx = start + (span - L) * f;
  const carY = road + rh * .8;
  if (f > 0) {
    g.strokeStyle = 'rgba(0,229,255,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const yy = carY - L * .05 - i * L * .045; g.beginPath(); g.moveTo(Math.max(0, cx - L * (.3 + i * .08)), yy); g.lineTo(cx - 4, yy); g.stroke(); }
  }
  const car = activeCar(), im = carImage(car, () => drawRace(canvas, prog));
  if (im.complete && im.naturalWidth) {
    const h2 = L * im.naturalHeight / im.naturalWidth;
    g.save(); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx + L / 2, carY, L * .48, h2 * .08, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save();
    if (car.face === 'L') { g.translate(cx + L, 0); g.scale(-1, 1); g.drawImage(im, 0, carY - h2 * .97, L, h2); }
    else g.drawImage(im, cx, carY - h2 * .97, L, h2);
    g.restore();
  }
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
  { id: 'epito', name: 'Első futam', desc: 'Először értél célba', glyph: '✓', color: '#C08A4B' },
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
