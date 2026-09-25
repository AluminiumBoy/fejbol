// Szövegkezelés: versszakok, szavak, összehasonlítás

export const WORD = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

export function parseStanzas(text) {
  return text.replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map(s => s.split('\n').map(l => l.trim()).filter(Boolean))
    .filter(s => s.length);
}

// sor → [{t:'írásjel/szóköz'} | {w:'szó'}]
export function tokens(line) {
  const out = []; let last = 0;
  for (const m of line.matchAll(WORD)) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    out.push({ w: m[0] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

export const words = line => line.match(WORD) || [];

// kis-nagybetű és ékezet nélküli alak (ujra = újra)
export const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// keverés, ami biztosan nem az eredeti sorrend (ha lehet)
export function shuffleApart(arr, same = (a, b) => a === b) {
  if (arr.length < 2) return arr.slice();
  for (let k = 0; k < 12; k++) {
    const s = shuffle(arr);
    if (s.some((x, i) => !same(x, arr[i]))) return s;
  }
  return arr.slice().reverse();
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const close = (a, b) => a === b || (a.length > 4 && lev(a, b) <= 1) || (a.length > 7 && lev(a, b) <= 2);

// Beszédfelismeréshez: a várt sor mely szavai hangzottak el (sorrendben).
// Visszaad: {ratio, hit:[bool per várt szó]}
export function matchSpoken(expected, heard) {
  const A = words(expected).map(norm), B = words(heard).map(norm);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = close(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (close(A[i], B[j])) { hit[i] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return { ratio: n ? L[0][0] / n : 1, hit };
}

// Rímpárok egy versszakon belül. A magyar rím a magánhangzókon múlik (kend – bent, ád – dolgát),
// ezért a kulcs: az utolsó magánhangzó, és hogy mássalhangzó zárja-e a szót.
// Visszaad: soronként csoportszám (0, 1, …) vagy -1, ha a sor vége nem rímel másikkal.
const VOW = /[aáeéiíoóöőuúüű]/;
export function rhymeGroups(lines) {
  const key = l => {
    const w = (words(l).slice(-1)[0] || '').toLowerCase();
    for (let i = w.length - 1; i >= 0; i--) if (VOW.test(w[i])) return w[i] + (w.length - 1 > i ? 'm' : '');
    return '';
  };
  const keys = lines.map(key), out = new Array(lines.length).fill(-1), seen = new Map();
  keys.forEach((k, i) => {
    if (!k || keys.filter(x => x === k).length < 2) return;
    if (!seen.has(k)) seen.set(k, seen.size);
    out[i] = seen.get(k);
  });
  // ha kettőnél több sor esett egy csoportba, csak a két leghasonlóbb végű marad
  const ends = lines.map(l => norm(words(l).slice(-1)[0] || ''));
  const suf = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
  for (const gi of new Set(out.filter(x => x >= 0))) {
    const m = out.map((x, i) => x === gi ? i : -1).filter(i => i >= 0);
    if (m.length <= 2) continue;
    let best = [m[0], m[1]], bs = -1;
    for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++) { const v = suf(ends[m[a]], ends[m[b]]); if (v > bs) { bs = v; best = [m[a], m[b]]; } }
    m.forEach(i => { if (!best.includes(i)) out[i] = -1; });
  }
  return out;
}
// a sor HTML-je, a rímelő utolsó szó kiemelve
// gl: (szó) → van-e magyarázata; ha igen, koppintható, pontozottan aláhúzott szó lesz
export function rhymeLine(line, grp, gl) {
  const tk = tokens(line); let last = -1;
  tk.forEach((t, i) => { if (t.w) last = i; });
  const word = (w, cls) => {
    const inner = cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w);
    return gl && gl(w) ? `<span class="gl" data-g="${esc(w.toLowerCase())}" role="button" tabindex="0">${inner}</span>` : inner;
  };
  return tk.map((t, i) => t.t !== undefined ? esc(t.t) : word(t.w, grp >= 0 && i === last ? `rh rh${grp % 2}` : '')).join('');
}
