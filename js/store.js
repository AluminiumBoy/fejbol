// Tárolás (a böngészőben) és a tanulási út ütemezése
import { parseStanzas } from './text.js?v=43';

const KEY = 'fejbol.v3';
const DAY = 864e5;

// Minden versszak ezen a lépcsőn megy végig. Az utolsó a fejből felmondás.
// A tanulás a nagy rókával folyik: Mondd utánam → Folytasd (felváltva) → Egyedül
export const PATH = ['echo', 'alt', 'solo'];
const V2_PATH = ['listen', 'cloze', 'initials', 'recall'];
// korábbi, hosszabb út: a haladást átszámoljuk az újra
const OLD_PATH = ['listen', 'rhyme', 'cloze', 'order', 'words', 'hide', 'initials', 'recall'];
// Ismétlések közti napok egy megtanult versszaknál
const INTERVALS = [1, 2, 4, 7, 14, 30];
export const PASS = 0.8;

const SEED = {
  title: 'Itt van az ősz, itt van újra…', author: 'Petőfi Sándor',
  text: `Itt van az ősz, itt van ujra,
S szép, mint mindig, énnekem.
Tudja isten, hogy mi okból
Szeretem? de szeretem.

Kiülök a dombtetőre,
Innen nézek szerteszét,
S hallgatom a fák lehulló
Levelének lágy neszét.

Mosolyogva néz a földre
A szelíd nap sugara,
Mint elalvó gyermekére
Néz a szerető anya.

És valóban ősszel a föld
Csak elalszik, nem hal meg;
Szeméből is látszik, hogy csak
Álmos ő, de nem beteg.

Levetette szép ruháit,
Csendesen levetkezett;
Majd felöltözik, ha virrad
Reggele, a kikelet.

Aludjál hát, szép természet,
Csak aludjál reggelig,
S álmodj olyakat, amikben
Legnagyobb kedved telik.

Én ujjam hegyével halkan
Lantomat megpenditem,
Altató dalod gyanánt zeng
Méla csendes énekem. –

Kedvesem, te űlj le mellém,
Ülj itt addig szótlanúl,
Míg dalom, mint tó fölött a
Suttogó szél, elvonúl.

Ha megcsókolsz, ajkaimra
Ajkadat szép lassan tedd,
Föl ne keltsük álmából a
Szendergő természetet.`
};

export const state = load();

function blankProgress(n) {
  return { stanzas: Array.from({ length: n }, () => ({ step: 0, due: 0, reviews: 0 })), chain: 0, whole: { due: 0, reviews: 0 } };
}

export function makePoem({ title, author, text }) {
  const n = parseStanzas(text).length;
  return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, author, text, created: Date.now(), ...blankProgress(n) };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (s && Array.isArray(s.poems)) return withGame(s);
  s = { poems: [], days: {}, settings: { size: 0 }, pathV: 3 };
  // korábbi (egyszerű) változat verseinek átvétele
  try {
    const old = JSON.parse(localStorage.getItem('fejbol.v2'));
    (old?.texts || []).forEach(t => s.poems.push(makePoem(t)));
  } catch (e) {}
  if (!s.poems.length) s.poems.push(makePoem(SEED));
  return withGame(s);
}

function migratePath(s) {
  if (s.pathV === 3) return;
  if (s.pathV === 2) {
    // 4 lépéses út → 3 lépéses (a meghallgatás és a hiányzó szó a Mondd utánamba olvad)
    const map = [0, 0, 1, 2, 3];
    for (const p of s.poems) for (const st of p.stanzas || []) st.step = map[Math.min(st.step, 4)];
    s.pathV = 3; return;
  }
  for (const p of s.poems) for (const st of p.stanzas || []) {
    if (st.step >= OLD_PATH.length) { st.step = V2_PATH.length; continue; }
    // az első olyan 4 lépéses lépés, ami a régi úton még hátravolt
    const k = V2_PATH.findIndex(t => OLD_PATH.indexOf(t) >= st.step);
    st.step = k < 0 ? V2_PATH.length : k;
  }
  s.pathV = 2;
  migratePath(s);
}

function withGame(s) {
  migratePath(s);
  s.game = Object.assign({ xp: 0, blocks: 0, tasks: 0, perfect: 0, missionsDone: 0, badges: [], mission: { day: '', done: 0, claimed: false } }, s.game || {});
  return s;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export const getPoem = id => state.poems.find(p => p.id === id);

export function updateText(poem, { title, author, text }) {
  const changed = poem.text !== text;
  Object.assign(poem, { title, author, text });
  if (changed) Object.assign(poem, blankProgress(parseStanzas(text).length));
  save();
}

export function removePoem(poem) {
  state.poems = state.poems.filter(p => p !== poem);
  save();
}

// ---- hibatérkép: soronként hányszor ment és hányszor nem ----
export function recordLine(poem, si, li, ok) {
  const w = poem.weak || (poem.weak = {}), k = si + '.' + li;
  const e = w[k] || (w[k] = { miss: 0, ok: 0 });
  if (ok) e.ok++; else e.miss++;
  e.t = Date.now(); save();
}
// a nehéz sorok: többször nem ment, mint amennyiszer igen (a friss hibák többet számítanak)
export function weakLines(poem, max = 6) {
  const out = [];
  for (const [k, e] of Object.entries(poem.weak || {})) {
    const score = e.miss * 1.5 - e.ok;
    if (e.miss > 0 && score > 0) { const [si, li] = k.split('.').map(Number); out.push({ si, li, score }); }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
export const weakness = (poem, si, li) => { const e = poem.weak?.[si + '.' + li]; return e ? Math.max(0, Math.min(1, (e.miss * 1.5 - e.ok) / 4)) : 0; };

// ---- esti ismétlés: a nap folyamán gyakorolt sorok (legfeljebb 8), vagy az éppen tanult versszak ----
export function eveningTask(poem) {
  const today = dayKey();
  let refs = Object.entries(poem.weak || {}).filter(([, e]) => e.t && dayKey(e.t) === today).map(([k]) => k.split('.').map(Number));
  refs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!refs.length) {
    const i = poem.stanzas.findIndex(p => p.step > 0 && p.step < PATH.length);
    if (i < 0) return null;
    refs = parseStanzas(poem.text)[i].map((_, li) => [i, li]);
  }
  refs = refs.slice(0, 8);
  return { type: 'solo', stanzas: [...new Set(refs.map(r => r[0]))], lines: refs, kind: 'evening' };
}
export const eveningDone = () => state.eveningDay === dayKey();

// ---- napi statisztika ----
export const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export const todayCount = () => state.days[dayKey()] || 0;
export function streak() {
  let n = 0, t = Date.now();
  if (!state.days[dayKey(t)]) t -= DAY; // ma még nem gyakorolt: tegnaptól számolunk
  while (state.days[dayKey(t)]) { n++; t -= DAY; }
  return n;
}

// ---- állapotok ----
export function stanzaStatus(p, now = Date.now()) {
  if (p.step < PATH.length) return p.step === 0 ? 'new' : 'learn';
  return p.due <= now ? 'due' : 'done';
}

// Mi a következő lépés ennél a versnél? null = mára kész.
export function nextTask(poem, now = Date.now()) {
  const st = poem.stanzas;
  const due = st.findIndex(p => p.step >= PATH.length && p.due <= now);
  if (due >= 0) return { type: 'solo', stanzas: [due], kind: 'review' };
  // gyenge pontok célzott gyakorlása (naponta egyszer, ha legalább 2 nehéz sor van)
  const weak = weakLines(poem);
  if (weak.length >= 2 && poem.weakDay !== dayKey()) return { type: 'fix', stanzas: [...new Set(weak.map(w => w.si))], lines: weak.map(w => [w.si, w.li]), kind: 'weak' };

  let prefix = 0;
  while (prefix < st.length && st[prefix].step >= PATH.length) prefix++;
  if (prefix >= 2 && poem.chain < prefix && prefix < st.length)
    return { type: 'solo', stanzas: range(prefix), kind: 'chain', chain: prefix };

  const i = st.findIndex(p => p.step < PATH.length);
  if (i >= 0) return { type: PATH[st[i].step], stanzas: [i], kind: 'learn' };

  if (st.length > 1 && poem.whole.due <= now) return { type: 'solo', stanzas: range(st.length), kind: 'whole' };
  return null;
}

// Visszaad: { pass, mastered: most lett kész egy versszak, wholeDone: az egész vers sikerült }
export function applyResult(poem, task, score) {
  const now = Date.now(), pass = score >= PASS;
  let mastered = false, wholeDone = false;
  state.days[dayKey()] = (state.days[dayKey()] || 0) + 1;
  if (task.kind === 'learn') {
    const p = poem.stanzas[task.stanzas[0]];
    if (pass && PATH[p.step] === task.type) {
      p.step++;
      if (p.step >= PATH.length) { p.due = now + DAY; p.reviews = 0; mastered = true; }
    }
  } else if (task.kind === 'review') {
    const p = poem.stanzas[task.stanzas[0]];
    if (pass) { p.due = now + INTERVALS[Math.min(p.reviews, INTERVALS.length - 1)] * DAY; p.reviews++; }
    else { p.step = PATH.indexOf('alt'); p.due = 0; }
  } else if (task.kind === 'evening') {
    state.eveningDay = dayKey();
  } else if (task.kind === 'weak') {
    poem.weakDay = dayKey();
  } else if (task.kind === 'chain') {
    if (pass) poem.chain = task.chain;
  } else if (task.kind === 'whole') {
    const w = poem.whole;
    if (pass) { w.due = now + INTERVALS[Math.min(w.reviews, INTERVALS.length - 1)] * DAY; w.reviews++; wholeDone = true; }
  }
  save();
  return { pass, mastered, wholeDone };
}

export function setSize(n) {
  state.settings.size = n; save();
  document.documentElement.dataset.size = n;
}

const range = n => Array.from({ length: n }, (_, i) => i);
