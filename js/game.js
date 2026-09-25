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
const RANKS = ['NPC', 'Kezdő tesó', 'Rizzler', 'Sigma', 'Chad', 'Aura farmer', 'GigaChad', 'Main Character', 'Sigma legenda', 'GOATED', 'Brainrot Boss', 'Final Boss'];
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
    badge: { name: 'Első futam', desc: 'Először értél célba, új verda' },
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
// B karosszéria, D sötét, G üveg, W kerék, L lámpa, S szárny, N neon
export const CARS = [
  { id: 'kiscsavo', name: 'Kiscsávó', color: '#E0662B', rows: ['....BBBBBB......', '...BGGGBGGB.....', '.BBBBBBBBBBBBBL.', '.BBBBBBBBBBBBBB.', '.DDWWDDDDDDWWDD.', '...WW......WW...'] },
  { id: 'street', name: 'Street Racer', color: '#2F6FD6', rows: ['S...BBBBB.......', 'SS.BGGGGGB......', 'SBBBBBBBBBBBBBL.', '.BBBBBBBBBBBBBB.', '.DDWWDDDDDDWWDD.', '...WW......WW...'] },
  { id: 'drift', name: 'Drift King', color: '#8A4FD8', neon: '#00F0FF', rows: ['....BBBBB.......', 'S..BGGGGGBB.....', 'SBBBBBBBBBBBBBBL', 'BBBBBBBBBBBBBBBB', 'DDWWDDDDDDDDWWDD', 'NNWWNNNNNNNNWWNN'] },
  { id: 'muscle', name: 'Muscle Beast', color: '#D6453D', rows: ['..BBBBB.........', '.BGGGGBBBBBDD...', 'BBBBBBBBBBBBBBBL', 'BBBBBBBBBBBBBBBB', 'DWWWDDDDDDDWWWDD', '.WWW.......WWW..'] },
  { id: 'terep', name: 'Terepszörny', color: '#5E7D3A', rows: ['.BBBBBBB........', '.BGGGBGGB.......', '.BBBBBBBBBBBBBBL', '.BBBBBBBBBBBBBBB', '.DWWWDDDDDDWWWD.', '..WWW......WWW..'] },
  { id: 'formula', name: 'Formula', color: '#E23B3B', rows: ['......GG........', 'SS...BBBB.......', 'SSBBBBBBBBBBBBBL', '.WW.DDDDDDD.WW..', 'WWWW.......WWWW.', '.WW.........WW..'] },
  { id: 'hyper', name: 'Hypercar', color: '#00C2A8', rows: ['................', '.....BBGGGG.....', 'SBBBBBBGGGGBBB..', 'SBBBBBBBBBBBBBBL', 'DDWWDDDDDDDDWWDD', '..WW........WW..'] },
  { id: 'ghost', name: 'Neon Ghost', color: '#23262F', neon: '#FF2BD6', rows: ['................', '.....BBGGGG.....', 'SBBBBBBGGGGBBB..', 'SNNNNNNNNNNNNNNL', 'DDWWDDDDDDDDWWDD', 'NNWWNNNNNNNNWWNN'] },
  { id: 'goat', name: 'GOAT GT', color: '#E8B00F', rows: ['SSS.............', '.S...BBGGGG.....', '.SBBBBBGGGGBBB..', 'BBBBBBBBBBBBBBBL', 'DDWWDDDDDDDDWWDD', '..WW........WW..'] }
];
// hány autó van feloldva: 1 + a megnyert futamok száma
const carsUnlockedAt = b => Math.min(CARS.length, 1 + buildProgress(b, WORLDS.car).finished);
export const carsUnlocked = () => Math.min(CARS.length, 1 + buildProgress(state.game.blocks, WORLDS.car).finished);
export function activeCar() {
  const n = carsUnlocked();
  const i = CARS.findIndex(c => c.id === state.game.car);
  return CARS[i >= 0 && i < n ? i : n - 1];
}
export function drawCar(g, x, y, u, c, alpha = 1, silhouette = false) {
  g.globalAlpha = alpha;
  const pal = { B: c.color, D: shade(c.color, .6), G: '#9FD8FF', W: '#111318', L: '#FFE08A', S: shade(c.color, .75), N: c.neon || c.color };
  c.rows.forEach((row, r) => [...row].forEach((ch, k) => {
    if (ch === '.') return;
    g.fillStyle = silhouette ? '#2A2F3B' : pal[ch];
    g.fillRect(Math.round(x + k * u), Math.round(y + r * u), Math.ceil(u), Math.ceil(u));
  }));
  g.globalAlpha = 1;
}
export function drawCarCard(canvas, c, locked) {
  const { g, px } = setup(canvas, 20, 9);
  g.fillStyle = locked ? '#12151C' : '#1B2130'; g.fillRect(0, 0, 20 * px, 9 * px);
  g.fillStyle = locked ? '#1B1F28' : '#2A3142'; g.fillRect(0, 7 * px, 20 * px, 2 * px);
  if (!locked && c.neon) { g.fillStyle = c.neon; g.globalAlpha = .25; g.fillRect(2 * px, 6.6 * px, 16 * px, px * .8); g.globalAlpha = 1; }
  drawCar(g, 2 * px, 1.2 * px, px, c, 1, locked);
}

function drawRace(canvas, prog, fresh = 0) {
  const W = 40, H = 18;
  const { g, px } = setup(canvas, W, H);
  const w = W * px, road = 9 * px, rh = 6 * px;
  g.fillStyle = '#8FD0F5'; g.fillRect(0, 0, w, road);
  g.fillStyle = '#FFFFFF'; [[4, 2], [22, 3], [33, 1.5]].forEach(([cx, cy]) => { g.fillRect(cx * px, cy * px, px * 4, px); g.fillRect((cx + 1) * px, (cy - 1) * px, px * 2, px); });
  g.fillStyle = '#5BAA3C'; g.fillRect(0, road - px * 2, w, px * 2);
  for (let t = 0; t < W; t += 6) { g.fillStyle = '#3F7F2A'; g.fillRect((t + 2) * px, road - px * 5, px * 2, px * 3); g.fillStyle = '#6B4A2B'; g.fillRect((t + 2.6) * px, road - px * 2, px * .8, px * 2); }
  g.fillStyle = '#3A3F4A'; g.fillRect(0, road, w, rh);
  g.fillStyle = '#F2F2F2'; for (let x = 0; x < W; x += 3) g.fillRect(x * px, road + rh / 2 - px * .25, px * 1.6, px * .5);
  g.fillStyle = '#D6453D'; for (let x = 0; x < W; x += 2) g.fillRect(x * px, road, px, px * .5);
  g.fillStyle = '#5BAA3C'; g.fillRect(0, road + rh, w, H * px - road - rh);
  // cél: kockás csík
  const fx = (W - 3) * px;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#fff'; g.fillRect(fx + c * px, road + r * px, px, px); }
  g.fillStyle = '#5B3A1E'; g.fillRect(fx + px * .5, road - px * 5, px * .5, px * 5);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#fff'; g.fillRect(fx + px + c * px * .8, road - px * 5 + r * px * .8, px * .8, px * .8); }
  // km jelzők
  g.fillStyle = '#FFFFFF'; g.font = `700 ${Math.max(9, px * 1.1)}px system-ui,sans-serif`; g.textAlign = 'center';
  const start = 1, span = W - 3 - start - 10;
  for (let k = 0; k <= 4; k++) { const x = (start + span * k / 4 + 5) * px; g.fillText(`${Math.round(prog.size * k / 4)}`, x, (H - .6) * px); }
  const c = activeCar(), u = px * .62;
  const at = f => (start + span * Math.min(1, f)) * px;
  if (fresh) drawCar(g, at((prog.placed - fresh) / prog.size), road + px * .9, u, c, .3);
  drawCar(g, at(prog.placed / prog.size), road + px * .9, u, c);
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
  { id: 'elso', name: 'Elindult a grind', desc: 'Az első feladat kész', glyph: '1', color: '#3DDC84' },
  { id: 'versszak', name: 'Első W', desc: 'Egy versszak megy fejből', glyph: 'W', color: '#3D8BFF' },
  { id: 'hibatlan', name: 'Tökéletes aura', desc: '5-ször 3 csillag', glyph: '★', color: '#FFC83D' },
  { id: 'sorozat3', name: '3 napos streak', desc: '3 nap egymás után', glyph: '3', color: '#FF6B3D' },
  { id: 'sorozat7', name: 'Egy hét, no cap', desc: '7 nap egymás után', glyph: '7', color: '#FF3D5A' },
  { id: 'villam', name: 'Speedrunner', desc: '10 pont a speedrunban', glyph: '⚡', color: '#B04DFF' },
  { id: 'kuldetes5', name: 'Grind gép', desc: '5 napi grind teljesítve', glyph: 'G', color: '#00D1C1' },
  { id: 'epito', name: 'Építőmester', desc: 'Az első építmény kész', glyph: '▦', color: '#C08A4B' },
  { id: 'vers', name: 'Main Character', desc: 'Egy egész vers megy fejből', glyph: '♛', color: '#FFD700' }
];

export const badgeInfo = b => b.id === 'epito' ? { ...b, ...world().badge } : b;

// ---------- jutalmazás egy feladat után ----------
export function starsFor(score, raw) {
  if (raw != null) return raw >= 15 ? 3 : raw >= 10 ? 2 : raw >= 5 ? 1 : 0;
  return score >= 0.95 ? 3 : score >= 0.8 ? 2 : score >= 0.5 ? 1 : 0;
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
  save();

  const after = levelInfo(G.xp);
  return {
    xp, blocks, stars, earned, missionDone, newCars: state.settings.world === 'car' ? newCars : [],
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
function boom() {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(140, ac.currentTime); o.frequency.exponentialRampToValueAtTime(38, ac.currentTime + .5);
  g.gain.setValueAtTime(.5, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .7);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .75);
}
export function sfx(kind) {
  if (state.settings.sound === false) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (kind === 'good') { tone(660, 0, .08); tone(990, .07, .12); }
    else if (kind === 'bad') { boom(); }
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
