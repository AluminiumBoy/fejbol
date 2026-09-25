// Játékréteg: XP, szintek, blokkok és építkezés, jelvények, napi küldetés, hangeffektek
import { state, save, streak, dayKey } from './store.js';

export const MISSION_SIZE = 3;

// ---------- szintek ----------
const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];
const LEVEL_NAMES = ['Újonc', 'Felfedező', 'Kalandor', 'Bányász', 'Építő', 'Lovag', 'Mesterépítő', 'Bajnok', 'Hős', 'Legenda', 'Versmester', 'Nagymester'];
export function levelInfo(xp = state.game.xp) {
  let l = 0; while (l + 1 < LEVELS.length && xp >= LEVELS[l + 1]) l++;
  const base = LEVELS[l], next = LEVELS[l + 1] ?? base + 1500;
  return { lvl: l + 1, name: LEVEL_NAMES[l] || 'Nagymester', cur: xp - base, need: next - base, frac: (xp - base) / (next - base) };
}

// ---------- építkezés ----------
// . üres, S kő, W ablak, G kapu, F zászló, P rúd, R tető
export const BUILDS = [
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
export const buildSize = b => b.rows.join('').replace(/\./g, '').length;

// hányadik építménynél tart, és abban hány blokk van kész
export function buildProgress(blocks = state.game.blocks) {
  let i = 0, left = blocks;
  while (left >= buildSize(BUILDS[i % BUILDS.length])) { left -= buildSize(BUILDS[i % BUILDS.length]); i++; }
  const b = BUILDS[i % BUILDS.length];
  return { index: i, build: b, placed: left, size: buildSize(b), finished: i };
}

const COLORS = { S: '#8E949E', W: '#35507F', G: '#7A4B26', F: '#D6453D', P: '#5B3A1E', R: '#B5452F' };
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(',')})`;
}
// build order: alulról felfelé, balról jobbra
export function drawBuild(canvas, prog, highlightNew = 0) {
  const { build, placed } = prog;
  const rows = build.rows, W = 16, H = rows.length + 1;
  const css = canvas.clientWidth || 320, px = Math.floor(css / W);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * px * dpr; canvas.height = H * px * dpr;
  canvas.style.height = (H * px) + 'px';
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  const cells = [];
  for (let r = rows.length - 1; r >= 0; r--) for (let c = 0; c < W; c++) if (rows[r][c] !== '.') cells.push([r, c, rows[r][c]]);
  const ghost = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#ccc';
  cells.forEach(([r, c, t], k) => {
    const x = c * px, y = r * px;
    if (k < placed) {
      g.fillStyle = COLORS[t]; g.fillRect(x, y, px, px);
      g.fillStyle = shade(COLORS[t], 1.25); g.fillRect(x, y, px, Math.max(2, px / 7)); g.fillRect(x, y, Math.max(2, px / 7), px);
      g.fillStyle = shade(COLORS[t], 0.7); g.fillRect(x, y + px - Math.max(2, px / 7), px, Math.max(2, px / 7)); g.fillRect(x + px - Math.max(2, px / 7), y, Math.max(2, px / 7), px);
      if (t === 'W') { g.fillStyle = '#F2C14E'; g.fillRect(x + px * .3, y + px * .3, px * .4, px * .4); }
      if (k >= placed - highlightNew) { g.strokeStyle = '#F2C14E'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, px - 2, px - 2); }
    } else {
      g.strokeStyle = ghost; g.lineWidth = 1; g.setLineDash([2, 2]); g.strokeRect(x + .5, y + .5, px - 1, px - 1); g.setLineDash([]);
    }
  });
  // fű és föld
  const y = rows.length * px;
  for (let c = 0; c < W; c++) {
    g.fillStyle = '#6B4A2B'; g.fillRect(c * px, y, px, px);
    g.fillStyle = '#5BAA3C'; g.fillRect(c * px, y, px, px * .35);
    g.fillStyle = '#4A8F30'; g.fillRect(c * px + (c % 3) * px / 4, y + px * .35, px / 4, px / 6);
  }
}

// ---------- jelvények ----------
export const BADGES = [
  { id: 'elso', name: 'Első lépés', desc: 'Az első feladat kész', glyph: '1', color: '#5BAA3C' },
  { id: 'versszak', name: 'Első versszak', desc: 'Egy versszak megy fejből', glyph: '§', color: '#2340A0' },
  { id: 'hibatlan', name: 'Hibátlan', desc: '5-ször 3 csillag', glyph: '★', color: '#E8A317' },
  { id: 'sorozat3', name: '3 napos sorozat', desc: '3 nap egymás után', glyph: '3', color: '#D6453D' },
  { id: 'sorozat7', name: 'Egy hét', desc: '7 nap egymás után', glyph: '7', color: '#B5452F' },
  { id: 'villam', name: 'Villám', desc: '10 pont a villámkörben', glyph: 'V', color: '#8A4FD8' },
  { id: 'kuldetes5', name: 'Küldetésvadász', desc: '5 napi küldetés teljesítve', glyph: 'K', color: '#0F8B8D' },
  { id: 'epito', name: 'Építőmester', desc: 'Az első építmény kész', glyph: '▦', color: '#7A4B26' },
  { id: 'vers', name: 'Megtanultad!', desc: 'Egy egész vers megy fejből', glyph: '♛', color: '#C4850B' }
];

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

  const buildAfter = buildProgress(G.blocks);
  const earned = [];
  const give = id => { if (!G.badges.includes(id)) { G.badges.push(id); earned.push(BADGES.find(b => b.id === id)); } };
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
    xp, blocks, stars, earned, missionDone,
    mission: Math.min(G.mission.done, MISSION_SIZE),
    levelUp: after.lvl > before.lvl ? after : null,
    buildDone: buildAfter.finished > buildBefore.finished ? buildBefore.build : null
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
    else if (kind === 'bad') { tone(180, 0, .18, 'sawtooth', .05); }
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
