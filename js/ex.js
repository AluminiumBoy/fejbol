// A gyakorlófeladatok. Mindegyik ugyanazt kapja:
//   ui  = { body, dock, progress(0..1), finish(score), cleanup(fn), toast(msg) }
//   set = [{ i: versszak sorszáma, lines: [...] }]
//   ctx = { allWords: a vers összes szava (tippekhez) }
import { tokens, words, norm, esc, shuffle, shuffleApart, matchSpoken, rhymeGroups, rhymeLine } from './text.js?v=41';
import { lineImages, lineScene, hasHint } from './imagery.js?v=41';
import { hasGloss } from './gloss.js?v=41';

export const EXERCISES = {
  listen:   { name: 'Meghallgatás', short: 'Hallgasd meg és olvasd fel', help: 'Hallgasd meg, aztán olvasd fel hangosan te is.', icon: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4' },
  rhyme:    { name: 'Rímelő sorvég', short: 'Hogy végződik a sor?', help: 'Hogy végződik a sor? Figyelj a rímre!', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  cloze:    { name: 'Hiányzó szó',  short: 'Válaszd ki a kimaradt szót', help: 'Melyik szó hiányzik? Koppints a jóra.', icon: 'M4 12h4M16 12h4M10 9h4v6h-4z' },
  order:    { name: 'Sorrend',      short: 'Tedd sorba a sorokat', help: 'Koppints a sorokra abban a sorrendben, ahogy a versben jönnek.', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  words:    { name: 'Szókirakó',    short: 'Rakd össze a sort szavakból', help: 'Koppints a szavakra a helyes sorrendben.', icon: 'M3 7h6v4H3zM11 7h10v4H11zM3 14h10v4H3zM15 14h6v4h-6z' },
  hide:     { name: 'Eltűnő szavak', short: 'Egyre több szó tűnik el', help: 'Mondd el hangosan, a hiányzó szavakkal együtt. Ha elakadsz, koppints a szóra.', icon: 'M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zM4 4l16 16' },
  initials: { name: 'Kezdőbetűk',   short: 'Csak az első betűk látszanak', help: 'Mondd el hangosan. Csak a kezdőbetűk segítenek, ha kell, koppints a szóra.', icon: 'M5 19l5-14 5 14M7 14h6M17 19V9' },
  blitz:    { name: 'Speedrun', short: '60 mp, dönts rekordot', help: 'Válaszolj minél többre 60 másodperc alatt. A rossz válasz 3 másodpercbe kerül.', icon: 'M13 2L4 14h7l-1 8 9-12h-7z', special: true },
  echo:     { name: 'Mondd utánam', short: 'A róka mondja, te utána', help: 'A róka elmond egy sort, te utána mondod.', icon: 'M4 12h10M10 6l6 6-6 6M20 5v14' },
  alt:      { name: 'Folytasd', short: 'Felváltva a rókával', help: 'Felváltva mondjátok: egy sor a rókáé, a következő a tiéd.', icon: 'M7 7h10M7 12h6M7 17h10' },
  fix:      { name: 'Gyenge pontok', short: 'Ami még nem megy', help: 'Csak azokat a sorokat gyakoroljuk, amik még elakadnak.', icon: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', hidden: true },
  solo:     { name: 'Egyedül', short: 'Fejből, a róka figyel', help: 'Mondd el fejből, a róka figyel és ellenőriz.', icon: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3' },
  exam:     { name: 'Felelés-próba', short: 'A róka kifeleltet, jegyet ad', help: 'A róka tanárként kérdez a versből.', icon: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5', special: true },
  rap:      { name: 'Rap mód', short: 'Rappeld el ütemre', help: 'Szól az ütem: rappeld a verset a rókával!', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', special: true },
  recall:   { name: 'Felmondás',    short: 'Fejből, soronként', help: 'Mondd el fejből a következő sort, aztán nézd meg, jó volt-e.', icon: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3' }
};

export function run(type, ui, set, ctx) {
  return ({ rap, blitz, listen, rhyme, cloze, order, words: wordsEx, hide, initials, recall })[type](ui, set, ctx);
}

// ---------- közös ----------
const flat = set => set.flatMap(s => s.lines.map((l, li) => ({ l, si: s.i, li })));

function sheet(set, renderLine) {
  let html = '<div class="sheet"><div class="poem">', g = 0;
  for (const s of set) {
    let inner = '';
    s.lines.forEach((l, li) => { const h = renderLine(l, s.i, li, g++); if (h != null) inner += h; });
    if (inner) html += `<p class="stanza">${inner}</p>`;
  }
  return html + '</div></div>';
}
const ln = (si, li, content, cls = '') =>
  `<span class="ln ${cls}">${li === 0 ? `<span class="snum">${si + 1}.</span>` : ''}${content}</span>`;

// ---------- képes súgás (kettős kódolás) ----------
// a sor képei a róka gondolatbuborékában; ha nincs róka, felugró sávban. Nem számít hibának.
function showPics(ui, line) {
  if (!line || !hasHint(line)) return ui.toast('Ehhez a sorhoz nincs súgás.');
  ui.tip?.('imagery', 'Képzeld el a jelenetet! Az agy a vicces, furcsa képeket sokkal könnyebben megjegyzi, mint a szavakat.');
  const sc = lineScene(line);
  if (ui.pet) ui.pet.think(line); else ui.toast(sc ? sc.t : lineImages(line).join(' '));
}
const picBtn = (line, label = 'Képzeld el') => line && hasHint(line) ? `<button class="btn picbtn" id="pics">💭 ${label}</button>` : '';
const wirePics = (ui, getLine) => ui.dock.querySelector('#pics')?.addEventListener('click', () => showPics(ui, getLine()));
// soronkénti képek a sor végén (a teljes versszakot mutató feladatokhoz), a kapcsoló a .showpics osztály
const linePics = l => { const p = lineImages(l); return p.length ? ` <span class="lpics">${p.join('')}</span>` : ''; };
const picToggle = () => `<button class="btn picbtn" id="picsAll">💭 Képzeld el</button>`;
function wirePicToggle(ui, set) {
  const all = set ? flat(set) : [];
  let i = 0;
  ui.dock.querySelector('#picsAll')?.addEventListener('click', e => {
    if (!all.length) return;
    const x = all[i % all.length]; i++;
    showPics(ui, x.l);
    e.currentTarget.textContent = `💭 Képzeld el (${((i - 1) % all.length) + 1}/${all.length})`;
  });
}

function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
const clamp = x => Math.max(0, Math.min(1, x));

// ---------- felolvasás (TTS) ----------
let huVoice = null;
function pickHuVoice() {
  if (!('speechSynthesis' in window)) return;
  huVoice = speechSynthesis.getVoices().find(v => /^hu/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickHuVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickHuVoice); }
export const canSpeak = () => !!huVoice;

// ---------- beszédfelismerés ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => !!SR;

// ================= 1. Meghallgatás =================
// Hangforrás: előre legenerált magyar felolvasás (audio/), ha nincs, a készülék saját hangja.
let audioIndex = null;
export async function loadAudioIndex() {
  try { audioIndex = await (await fetch('audio/index.json')).json(); } catch (e) {}
}
// a hang elemet az oldalhoz csatoljuk, mert egyes böngészők különben leállítják
export function makeAudio(url) {
  document.querySelectorAll('audio[data-fejbol]').forEach(a => { a.pause(); a.remove(); });
  const a = new Audio(url); a.dataset.fejbol = '1'; a.hidden = true;
  document.body.appendChild(a);
  return a;
}
export const voiceNames = () => audioIndex?.voices || {};
export const pickVoice = v => (audioIndex?.voices?.[v] ? v : Object.keys(audioIndex?.voices || {})[0]);
// versszak hangfájlja + sorkezdési időpontok (mp)
export function stanzaAudio(lines, voice) {
  const e = audioIndex?.stanzas?.[lines.join('\n')];
  voice = pickVoice(voice);
  return e && voice && e.starts[voice] ? { url: `audio/${voice}/${e.file}.mp3`, starts: e.starts[voice] } : null;
}

function listen(ui, set, ctx) {
  const lines = flat(set);
  const clips = set.map(s => stanzaAudio(s.lines, ctx.voice));
  const src = clips.every(Boolean) ? 'file' : canSpeak() ? 'tts' : null;
  const need = src ? 2 : 3;
  let count = 0, playing = false, cur = -1, audio = null, token = 0;
  let recorder = null, recUrl = null, recChunks = [], recAudio = null;

  const rg = new Map(set.map(s => [s.i, rhymeGroups(s.lines)]));
  let thought = -1;
  const draw = () => {
    ui.body.innerHTML = sheet(set, (l, si, li, g) => ln(si, li, rhymeLine(l, rg.get(si)[li], hasGloss), g === cur ? 'hl' : ''));
    thought = cur;
  };
  const stop = () => {
    playing = false; cur = -1; token++;
    if (audio) { audio.pause(); audio = null; }
    if (src === 'tts') speechSynthesis.cancel();
    dockDraw(); draw();
  };
  const sayLine = k => new Promise(res => {
    const u = new SpeechSynthesisUtterance(lines[k].l);
    u.voice = huVoice; u.lang = huVoice.lang; u.rate = 0.85;
    u.onend = res; u.onerror = res; speechSynthesis.speak(u);
  });
  // egy versszak lejátszása egyben (természetes hanglejtés), a sor kiemelése követi
  const playClip = (n, offset) => new Promise(res => {
    const { url, starts } = clips[n];
    const el = audio = makeAudio(url);
    ui.pet?.attach(el);
    el.ontimeupdate = () => {
      if (el !== audio) return;
      let li = 0;
      starts.forEach((t, i) => { if (t != null && el.currentTime >= t - 0.05) li = i; });
      if (cur !== offset + li) { cur = offset + li; draw(); }
    };
    el.onended = res; el.onerror = res;
    el.play().catch(res);
  });
  const play = async () => {
    stop(); playing = true; const my = token; dockDraw();
    if (src === 'file') {
      let offset = 0;
      for (let n = 0; n < set.length; n++) {
        if (my !== token) return;
        await playClip(n, offset);
        offset += set[n].lines.length;
        if (my !== token) return;
        await new Promise(r => setTimeout(r, 700));
      }
    } else {
      for (let k = 0; k < lines.length; k++) {
        if (my !== token) return;
        cur = k; draw();
        await sayLine(k);
        if (my !== token) return;
        const stanzaEnd = k + 1 < lines.length && lines[k + 1].si !== lines[k].si;
        await new Promise(r => setTimeout(r, stanzaEnd ? 900 : 350));
      }
    }
    if (my === token) stop();
  };

  async function toggleRecord() {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recChunks = []; recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => recChunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recUrl) URL.revokeObjectURL(recUrl);
        recUrl = URL.createObjectURL(new Blob(recChunks, { type: recorder.mimeType }));
        recorder = null; dockDraw();
      };
      recorder.start(); dockDraw();
    } catch (e) { recorder = null; ui.toast('Nem sikerült elindítani a mikrofont.'); }
  }
  function playRec() {
    if (recAudio) { recAudio.pause(); recAudio = null; dockDraw(); return; }
    recAudio = makeAudio(recUrl); recAudio.onended = () => { recAudio = null; dockDraw(); };
    recAudio.play(); dockDraw();
  }

  const dockDraw = () => {
    const canRec = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    ui.dock.innerHTML = `
      <p class="muted small" style="margin:0">${src ? 'Hallgasd meg, közben kövesd a szöveget. Aztán olvasd fel hangosan te is kétszer.' : 'Olvasd fel hangosan háromszor, figyelj a ritmusra. Minden felolvasás után nyomd meg a gombot.'}</p>
      ${canRec ? `<div class="row">
        <button class="btn grow mic ${recorder ? 'live' : ''}" id="rec">${recorder ? 'Felvétel leállítása' : recUrl ? 'Új felvétel' : 'Felveszem magam'}</button>
        ${recUrl ? `<button class="btn grow" id="recPlay">${recAudio ? 'Megállítás' : 'Visszahallgatom'}</button>` : ''}
      </div>` : ''}
      <div class="row">
        ${src ? `<button class="btn big grow" id="play">${playing ? 'Megállítás' : 'Felolvasás'}</button>` : ''}
        <button class="btn big primary grow" id="did">Felolvastam (${count}/${need})</button>
      </div>`;
    if (src) ui.dock.querySelector('#play').onclick = () => playing ? stop() : play();
    if (canRec) {
      ui.dock.querySelector('#rec').onclick = toggleRecord;
      ui.dock.querySelector('#recPlay')?.addEventListener('click', playRec);
    }
    ui.dock.querySelector('#did').onclick = () => {
      count++; ui.progress(count / need);
      if (count >= need) { stop(); ui.finish(1); } else dockDraw();
    };
  };
  ui.cleanup(() => {
    token++; playing = false;
    if (audio) audio.pause();
    if (src === 'tts') speechSynthesis.cancel();
    try { recorder?.stop(); } catch (e) {}
    recAudio?.pause();
  });
  draw(); dockDraw(); ui.progress(0);
}

// ================= Rímelő sorvég =================
function rhyme(ui, set, ctx) {
  const lines = flat(set).map(x => {
    const tk = tokens(x.l);
    let j = -1; tk.forEach((t, n) => { if (t.w) j = n; });
    return { ...x, tk, j, target: j >= 0 ? tk[j].w : null };
  }).filter(x => x.target);
  const ends = [...new Map(ctx.allEnds.map(w => [norm(w), w])).values()];
  const tail = w => norm(w).slice(-2);
  function options(target) {
    const tn = norm(target);
    // olyan tippek, amik a legkevésbé hasonlítanak a helyes végződésre, hogy a rím döntsön
    let others = shuffle(ends.filter(w => norm(w) !== tn));
    const same = others.filter(w => tail(w) === tail(target));
    others = [...others.filter(w => tail(w) !== tail(target)), ...same].slice(0, 3);
    if (others.length < 3) others.push(...shuffle(ctx.allWords.filter(w => norm(w) !== tn && !others.includes(w))).slice(0, 3 - others.length));
    return shuffle([target, ...others]);
  }
  let k = 0, firstTry = 0, missed = false, filled = false;
  const draw = () => {
    ui.body.innerHTML = sheet(set, (l, si, li, g) => {
      if (g < k) return ln(si, li, esc(l));
      if (g > k) return null;
      const it = lines[k];
      return ln(si, li, it.tk.map((t, n) => t.t !== undefined ? (n > it.j ? esc(t.t) : esc(t.t)) : n === it.j
        ? `<span class="blank ${filled ? 'filled' : ''}">${filled ? esc(t.w) : '&nbsp;'}</span>` : esc(t.w)).join(''), 'hl');
    });
  };
  const dockDraw = () => {
    const it = lines[k];
    ui.dock.innerHTML = `<p class="muted small" style="margin:0">Hogy végződik a sor? Figyelj a rímre!</p>
      <div class="opts">${options(it.target).map(o => `<button class="opt" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div>${picBtn(it.l)}`;
    ui.pet?.think(null); wirePics(ui, () => it.l);
    ui.dock.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (filled) return;
      if (b.dataset.w === it.target) {
        b.classList.add('right'); ui.sfx('good'); filled = true; if (!missed) firstTry++; draw();
        setTimeout(() => {
          k++; missed = false; filled = false; ui.progress(k / lines.length);
          if (k >= lines.length) ui.finish(firstTry / lines.length); else { draw(); dockDraw(); }
        }, 700);
      } else { missed = true; ui.sfx('bad'); b.classList.add('wrong'); b.disabled = true; shake(b); }
    });
  };
  if (!lines.length) return ui.finish(1);
  draw(); dockDraw(); ui.progress(0);
}

// ================= 2. Hiányzó szó =================
function cloze(ui, set, ctx) {
  const lines = flat(set);
  const items = lines.map((x, g) => {
    const tk = tokens(x.l);
    const ws = tk.map((t, j) => ({ ...t, j })).filter(t => t.w);
    let cand = ws.filter(t => t.w.length >= 4);
    if (!cand.length) cand = ws.filter(t => t.w.length >= 2);
    if (!cand.length) cand = ws;
    const pick = cand[Math.floor(Math.random() * cand.length)];
    return { ...x, g, tk, j: pick?.j, target: pick?.w };
  }).filter(it => it.target);

  const pool = [...new Map(ctx.allWords.map(w => [norm(w), w])).values()];
  function options(target) {
    const tn = norm(target);
    const others = shuffle(pool.filter(w => norm(w) !== tn && w.length >= 2));
    others.sort((a, b) => Math.abs(a.length - target.length) - Math.abs(b.length - target.length));
    const picks = shuffle(others.slice(0, 8)).slice(0, 3);
    return shuffle([target, ...picks]);
  }

  let k = 0, firstTry = 0, missed = false, filled = false;
  const draw = () => {
    const it = items[k];
    ui.body.innerHTML = sheet(set, (l, si, li, g) => {
      if (g < it.g) return ln(si, li, esc(l));
      if (g > it.g) return null;
      const html = it.tk.map((t, j) => t.t !== undefined ? esc(t.t) : j === it.j
        ? `<span class="blank ${filled ? 'filled' : ''}">${filled ? esc(t.w) : '&nbsp;'}</span>` : esc(t.w)).join('');
      return ln(si, li, html, 'hl');
    });
  };
  const dockDraw = () => {
    const it = items[k];
    ui.dock.innerHTML = `<div class="opts">${options(it.target).map(o => `<button class="opt" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div>${picBtn(it.l)}`;
    ui.pet?.think(null); wirePics(ui, () => it.l);
    ui.dock.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (filled) return;
      if (b.dataset.w === it.target) {
        b.classList.add('right'); ui.sfx('good'); filled = true; if (!missed) firstTry++;
        ui.mark?.(it.si, it.li, !missed);
        draw();
        setTimeout(() => {
          k++; missed = false; filled = false; ui.progress(k / items.length);
          if (k >= items.length) ui.finish(firstTry / items.length); else { draw(); dockDraw(); }
        }, 700);
      } else { missed = true; ui.sfx('bad'); b.classList.add('wrong'); b.disabled = true; shake(b); }
    });
  };
  if (!items.length) return ui.finish(1);
  draw(); dockDraw(); ui.progress(0);
}

// ================= 3. Sorrend =================
function order(ui, set) {
  const total = set.reduce((n, s) => n + s.lines.length, 0);
  let si = 0, placed = 0, mistakes = 0, done = 0, pool = [];
  const start = () => { placed = 0; pool = shuffleApart(set[si].lines.map((l, k) => ({ l, k })), (a, b) => a.l === b.l); };
  const draw = () => {
    const s = set[si];
    const shown = [{ i: s.i, lines: s.lines.slice(0, placed) }];
    let html = sheet(shown, (l, i, li) => ln(i, li, esc(l)));
    if (!placed) html = `<div class="sheet"><div class="poem"><p class="stanza"><span class="ln"><span class="snum">${s.i + 1}.</span><span class="ask">Melyik sorral kezdődik?</span></span></p></div></div>`;
    else if (placed < s.lines.length) html = html.replace('</p></div></div>', `<span class="ln"><span class="ask">Melyik jön ezután?</span></span></p></div></div>`);
    ui.body.innerHTML = html + `<div class="pool" style="margin-top:14px">${pool.map((c, n) => c ? `<button class="lcard" data-n="${n}">${esc(c.l)}</button>` : '').join('')}</div>`;
    ui.body.querySelectorAll('.lcard').forEach(b => b.onclick = () => {
      const c = pool[+b.dataset.n];
      if (c.l === set[si].lines[placed]) {
        pool[+b.dataset.n] = null; ui.sfx('good'); ui.pet?.think(null); placed++; done++; ui.progress(done / total);
        if (placed >= set[si].lines.length) {
          si++;
          if (si >= set.length) return ui.finish(clamp(1 - mistakes / (total * 2)));
          start();
        }
        draw();
      } else { mistakes++; ui.sfx('bad'); b.classList.add('wrong'); shake(b); setTimeout(() => b.classList.remove('wrong'), 600); }
    });
  };
  ui.dock.innerHTML = `<p class="muted small" style="margin:0">${EXERCISES.order.help}</p><button class="btn picbtn" id="pics">💭 Képzeld el: mi jön?</button>`;
  wirePics(ui, () => set[si]?.lines[placed]);
  start(); draw(); ui.progress(0);
}

// ================= 4. Szókirakó =================
function wordsEx(ui, set) {
  const lines = flat(set);
  const totalWords = lines.reduce((n, x) => n + words(x.l).length, 0);
  let k = 0, placed = 0, mistakes = 0, done = 0, chips = [];
  const start = () => { placed = 0; chips = shuffleApart(words(lines[k].l).map((w, n) => ({ w, n, used: false })), (a, b) => norm(a.w) === norm(b.w)); };
  const partial = (line, cnt) => {
    let seen = 0, out = '';
    for (const t of tokens(line)) {
      if (t.w) { if (seen >= cnt) break; out += `<span class="w shown">${esc(t.w)}</span>`; seen++; }
      else if (seen > 0 || cnt > 0) { if (seen >= cnt && t.t.trim() === '') break; out += esc(t.t); }
    }
    return out;
  };
  const draw = () => {
    const target = words(lines[k].l);
    ui.body.innerHTML = sheet(set, (l, si, li, g) => {
      if (g < k) return ln(si, li, esc(l));
      if (g === k) return ln(si, li, placed >= target.length ? esc(l) : partial(l, placed) + ' <span class="ask">…</span>', 'hl');
      return null;
    });
    ui.dock.innerHTML = `<div class="wpool">${chips.map((c, n) => `<button class="wchip ${c.used ? 'used' : ''}" data-n="${n}">${esc(c.w)}</button>`).join('')}</div>${picBtn(lines[k].l)}`;
    if (placed === 0) ui.pet?.think(null);
    wirePics(ui, () => lines[k].l);
    ui.dock.querySelectorAll('.wchip').forEach(b => b.onclick = () => {
      const c = chips[+b.dataset.n];
      if (c.used) return;
      if (norm(c.w) === norm(target[placed])) {
        c.used = true; ui.sfx('block'); placed++; done++; ui.progress(done / totalWords);
        if (placed >= target.length) {
          draw();
          setTimeout(() => { k++; if (k >= lines.length) ui.finish(clamp(1 - mistakes / totalWords)); else { start(); draw(); } }, 450);
        } else draw();
      } else { mistakes++; ui.sfx('bad'); b.classList.add('wrong'); shake(b); setTimeout(() => b.classList.remove('wrong'), 600); }
    });
  };
  start(); draw(); ui.progress(0);
}

// ================= 5. Eltűnő szavak =================
function hide(ui, set) {
  const ROUNDS = [0.35, 0.65, 1];
  const rank = new Map();
  let round = 0, reveals = 0, hiddenTotal = 0;
  let revealed = new Set();
  const key = (g, j) => g + '.' + j;
  const draw = () => {
    let hiddenNow = 0;
    ui.body.innerHTML = sheet(set, (l, si, li, g) => ln(si, li, tokens(l).map((t, j) => {
      if (t.t !== undefined) return esc(t.t);
      const k = key(g, j);
      if (!rank.has(k)) rank.set(k, Math.random());
      if (rank.get(k) < ROUNDS[round]) {
        hiddenNow++;
        return `<button class="w ${revealed.has(k) ? 'shown' : 'hid'}" data-k="${k}">${esc(t.w)}</button>`;
      }
      return esc(t.w);
    }).join('')));
    return hiddenNow;
  };
  const startRound = () => {
    revealed = new Set();
    hiddenTotal += draw();
    ui.dock.innerHTML = `
      <p class="muted small" style="margin:0">${round + 1}. kör a 3-ból: ${round === 2 ? 'minden szó eltűnt, mondd el fejből.' : 'mondd el hangosan az egészet.'} Ha elakadsz, koppints a szóra.</p>
      <button class="btn big primary wide" id="nextR">${round < 2 ? 'Elmondtam, jöhet a nehezebb' : 'Elmondtam, kész'}</button>${picToggle()}`;
    wirePicToggle(ui, set);
    ui.dock.querySelector('#nextR').onclick = () => {
      round++; ui.progress(round / 3);
      if (round >= 3) ui.finish(clamp(1 - reveals / Math.max(1, hiddenTotal)));
      else startRound();
    };
  };
  ui.body.onclick = e => {
    const b = e.target.closest('.w.hid'); if (!b) return;
    revealed.add(b.dataset.k); reveals++; b.classList.replace('hid', 'shown');
  };
  ui.cleanup(() => { ui.body.onclick = null; });
  startRound(); ui.progress(0);
}

// ================= 6. Kezdőbetűk =================
function initials(ui, set) {
  let total = 0, reveals = 0;
  ui.body.innerHTML = sheet(set, (l, si, li) => ln(si, li, tokens(l).map(t => {
    if (t.t !== undefined) return esc(t.t);
    total++;
    return `<button class="w init"><span class="fl">${esc(t.w[0])}</span><span class="rest">${esc(t.w.slice(1))}</span></button>`;
  }).join('')));
  ui.body.onclick = e => {
    const b = e.target.closest('.w.init'); if (!b || b.classList.contains('shown')) return;
    b.classList.add('shown'); reveals++;
  };
  ui.cleanup(() => { ui.body.onclick = null; });
  ui.dock.innerHTML = `
    <p class="muted small" style="margin:0">${EXERCISES.initials.help}</p>
    <button class="btn big primary wide" id="fin">Elmondtam</button>${picToggle()}`;
  wirePicToggle(ui, set);
  ui.dock.querySelector('#fin').onclick = () => ui.finish(clamp(1 - reveals / Math.max(1, total)));
  ui.progress(0);
}

// ================= 7. Felmondás =================
function recall(ui, set, ctx) {
  const lines = flat(set);
  let k = 0, shown = false, hint = 0, marks = [], heard = null, rec = null, micOff = !canListen();
  const draw = () => {
    ui.body.innerHTML = sheet(set, (l, si, li, g) => {
      if (g < k) return ln(si, li, esc(l), marks[g] ? 'ok' : 'miss');
      if (g > k) return null;
      if (shown) {
        if (heard) {
          const html = tokens(l).map((t, j, arr) => {
            if (t.t !== undefined) return esc(t.t);
            const wi = arr.slice(0, j).filter(x => x.w).length;
            return heard.hit[wi] ? esc(t.w) : `<span class="heard"><span class="miss">${esc(t.w)}</span></span>`;
          }).join('');
          return ln(si, li, html, 'hl');
        }
        return ln(si, li, esc(l), 'hl');
      }
      const sc = lineScene(l), pics = lineImages(l).join(' ');
      const cue = sc ? (ui.pet ? '💭 Képzeld el…' : esc(sc.t)) : pics;
      return ln(si, li, `<span class="ask">${hint >= 2 ? esc(words(l).slice(0, 1)[0] || '') + ' …' : hint === 1 && cue ? `<span class="pics">${cue}</span>` : 'Mondd el a következő sort'}</span>`);
    });
    ui.body.querySelector('.ln.hl, .ask')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const dockDraw = () => {
    if (!shown) {
      ui.dock.innerHTML = `
        ${micOff ? '' : `<button class="btn big primary wide mic" id="mic">${ui.pet ? `Mondd el ${esc(ui.pet.name)}nak` : 'Mondom'}</button>`}
        <div class="row">
          <button class="btn big grow" id="hint" ${hint >= 2 ? 'disabled' : ''}>${hint === 0 && hasHint(lines[k].l) ? 'Képzeld el' : 'Első szó'}</button>
          <button class="btn big ${micOff ? 'primary' : ''} grow" id="show">Megnézem</button>
        </div>`;
      ui.dock.querySelector('#hint').onclick = () => {
        hint = hint === 0 && hasHint(lines[k].l) ? 1 : 2;
        if (hint === 1) { ui.pet?.think(lines[k].l); ui.tip?.('imagery', 'Képzeld el a jelenetet! Az agy a vicces, furcsa képeket sokkal könnyebben megjegyzi, mint a szavakat.'); }
        draw(); dockDraw();
      };
      ui.dock.querySelector('#show').onclick = () => { shown = true; draw(); dockDraw(); readLine(k); };
      if (!micOff) ui.dock.querySelector('#mic').onclick = listenLine;
    } else {
      const good = heard ? heard.ratio >= 0.75 : null;
      ui.dock.innerHTML = `
        ${heard ? `<div class="note ${good ? 'good' : 'bad'}">${good ? 'Ez jó volt!' : 'Ez még nem az igazi. A pirossal jelölt szavak hiányoztak.'}<br><span class="small muted">Ezt hallottam: <span class="heard">„${esc(heard.text)}”</span></span></div>` : ''}
        <div class="row">
          <button class="btn big ${good === false ? 'bad' : 'good'} grow" id="ok">${heard && good ? 'Tovább' : 'Tudtam'}</button>
          <button class="btn big ${good === false ? 'primary' : 'bad'} grow" id="no">${heard && !good ? 'Tovább' : 'Nem ment'}</button>
        </div>`;
      ui.dock.querySelector('#ok').onclick = () => step(true);
      ui.dock.querySelector('#no').onclick = () => step(false);
      if (heard && good) ui.dock.querySelector('#no').textContent = 'Mégsem ment';
      if (heard && !good) ui.dock.querySelector('#ok').textContent = 'Mégis tudtam';
    }
  };
  // a sor felolvasása a versszak hangfájljából (a sorkezdési időpontok alapján), a róka szájával
  function readLine(idx) {
    if (!ui.pet) return;
    const x = lines[idx], st = set.find(s => s.i === x.si), clip = st && stanzaAudio(st.lines, ctx.voice);
    if (!clip) return;
    const from = clip.starts[x.li] ?? 0, to = clip.starts[x.li + 1];
    const el = makeAudio(clip.url);
    ui.pet.attach(el);
    el.addEventListener('loadedmetadata', () => { el.currentTime = Math.max(0, from - .05); el.play().catch(() => {}); }, { once: true });
    if (to) el.addEventListener('timeupdate', () => { if (el.currentTime >= to - .05) el.pause(); });
    ui.cleanup(() => el.pause());
  }
  function step(ok) {
    if (!heard) ui.pet?.react(ok ? 'good' : 'bad');
    marks[k] = ok && hint < 2;
    ui.mark?.(lines[k].si, lines[k].li, marks[k]); k++; shown = false; hint = 0; heard = null; ui.pet?.think(null);
    ui.progress(k / lines.length);
    if (k >= lines.length) return ui.finish(marks.filter(Boolean).length / lines.length);
    draw(); dockDraw();
  }
  function listenLine() {
    const btn = ui.dock.querySelector('#mic');
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'hu-HU'; rec.maxAlternatives = 3; rec.interimResults = false;
    let got = false;
    rec.onresult = e => {
      got = true;
      const expected = lines[k].l;
      let best = null;
      for (const alt of e.results[0]) {
        const m = matchSpoken(expected, alt.transcript);
        if (!best || m.ratio > best.ratio) best = { ...m, text: alt.transcript };
      }
      heard = best; shown = true;
      if (ui.pet) { const ok = best.ratio >= 0.75; ui.pet.react(ok ? 'great' : 'bad'); ui.pet.say(ok ? 'yes' : 'tryagain', ok ? 'Igen, ez az!' : 'Majdnem! Próbáld újra!'); }
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { micOff = true; ui.toast('A mikrofon nincs engedélyezve. Használd a Megnézem gombot.'); }
      else if (e.error === 'no-speech') ui.toast('Nem hallottam semmit. Próbáld újra!');
      else if (e.error !== 'aborted') ui.toast('A hangfelismerés most nem működik.');
    };
    rec.onend = () => { rec = null; ui.pet?.listen(false); if (got) draw(); dockDraw(); };
    try { rec.start(); ui.pet?.listen(true); btn.classList.add('live'); btn.textContent = ui.pet ? `${ui.pet.name} figyel… (koppints, ha kész)` : 'Figyelek… (koppints, ha kész)'; }
    catch (e) { rec = null; micOff = true; dockDraw(); }
  }
  ui.cleanup(() => { try { rec?.abort(); } catch (e) {} });
  draw(); dockDraw(); ui.progress(0);
}

// ================= Villámkör (60 mp) =================
function blitz(ui, set, ctx) {
  const lines = flat(set), all = ctx.allLines;
  const TIME = 60;
  let left = TIME, score = 0, q = null, busy = false, over = false;
  const pool = [...new Map(ctx.allWords.filter(w => w.length >= 3).map(w => [norm(w), w])).values()];

  function makeQ() {
    const nextOk = lines.map((_, k) => k).filter(k => k + 1 < lines.length);
    if (nextOk.length && Math.random() < 0.5) {
      const k = nextOk[Math.floor(Math.random() * nextOk.length)];
      const right = lines[k + 1].l;
      const wrong = shuffle(all.filter(l => l !== right && l !== lines[k].l)).slice(0, 2);
      return { kind: 'next', prompt: lines[k].l, right, opts: shuffle([right, ...wrong]) };
    }
    const x = lines[Math.floor(Math.random() * lines.length)];
    const tk = tokens(x.l), cand = tk.map((t, j) => ({ ...t, j })).filter(t => t.w && t.w.length >= 3);
    if (!cand.length) return makeQ();
    const pick = cand[Math.floor(Math.random() * cand.length)];
    const others = shuffle(pool.filter(w => norm(w) !== norm(pick.w))).slice(0, 3);
    const html = tk.map((t, j) => t.t !== undefined ? esc(t.t) : j === pick.j ? '<span class="blank">&nbsp;</span>' : esc(t.w)).join('');
    return { kind: 'word', html, right: pick.w, opts: shuffle([pick.w, ...others]) };
  }
  function draw() {
    ui.body.innerHTML = `
      <div class="hud"><span class="px big">${Math.ceil(left)}<small> mp</small></span><span class="px big">${score}<small> pont</small></span></div>
      <div class="sheet"><div class="poem">${q.kind === 'next'
        ? `<p class="stanza"><span class="ln">${esc(q.prompt)}</span><span class="ln"><span class="ask">Mi jön utána?</span></span></p>`
        : `<p class="stanza"><span class="ln hl">${q.html}</span></p>`}</div></div>`;
    ui.dock.innerHTML = `<div class="${q.kind === 'next' ? 'pool' : 'opts'}">${q.opts.map((o, n) =>
      `<button class="${q.kind === 'next' ? 'lcard' : 'opt'}" data-n="${n}">${esc(o)}</button>`).join('')}</div>`;
    ui.dock.querySelectorAll('button').forEach(b => b.onclick = () => answer(b, q.opts[+b.dataset.n]));
  }
  function answer(b, o) {
    if (busy || over) return;
    if (o === q.right) {
      score++; ui.sfx('good'); b.classList.add('right'); busy = true;
      setTimeout(() => { busy = false; if (!over) { q = makeQ(); draw(); } }, 250);
    } else {
      left = Math.max(0, left - 3); ui.sfx('bad'); b.classList.add('wrong'); shake(b); busy = true;
      ui.dock.querySelectorAll('button').forEach(x => { if (q.opts[+x.dataset.n] === q.right) x.classList.add('right'); });
      setTimeout(() => { busy = false; if (!over) { q = makeQ(); draw(); } }, 700);
    }
  }
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now(); left -= (now - last) / 1000; last = now;
    ui.progress(1 - Math.max(0, left) / TIME);
    const hud = ui.body.querySelector('.hud .px');
    if (hud) hud.innerHTML = `${Math.max(0, Math.ceil(left))}<small> mp</small>`;
    if (left <= 5.2 && left > 0 && Math.abs(left - Math.round(left)) < 0.13) ui.sfx('tick');
    if (left <= 0 && !over) { over = true; clearInterval(timer); ui.finish(clamp(score / 15), score); }
  }, 250);
  ui.cleanup(() => clearInterval(timer));
  q = makeQ(); draw(); ui.progress(0);
}

// ================= Rap mód =================
// Hip-hop ütem a böngészőben (dob, basszus, akkordok), a róka ütemre rappel, a szöveg karaoke-szerűen megy.
// Hallgasd: a róka rappel. Felelgetős: róka egy sort, te a következő ütemben. Egyedül: te rappelsz, a szöveg körönként halványul.
let lineIdx = null;
async function loadLineIndex() {
  if (!lineIdx) { try { lineIdx = await (await fetch('audio/lines/index.json')).json(); } catch (e) { lineIdx = { lines: {}, dur: {} }; } }
  return lineIdx;
}
const sylls = w => (norm(w).match(/[aeiou]/g) || ['x']).length;

function rap(ui, set, ctx) {
  const lines = flat(set);
  const voice = ctx.voice === 'noemi' ? 'noemi' : 'tamas';
  const MODES = { listen: 'Hallgasd', echo: 'Felelgetős', solo: 'Egyedül' };
  const TEMPO = { 76: 'Lassú', 84: 'Közepes', 92: 'Gyors' };
  let mode = 'listen', bpm = 84, playing = false, hasVoice = false;
  let ac = null, own = false, master = null, vbus = null, timer = null, nextTime = 0, step = 0, plan = [], bufs = new Map(), timeouts = [];
  const stepDur = () => 60 / bpm / 4, barLen = () => 60 / bpm * 4;

  const hashOf = l => lineIdx?.lines?.[l];
  // a sor szavainak helye az ütemben (16-od lépésekben): szótagonként egy nyolcad, hosszú sornál sűrűbben
  function gridOf(l) {
    const ws = words(l), tot = ws.reduce((a, w) => a + sylls(w), 0) || 1;
    const per = tot <= 8 ? 2 : 16 / tot;
    let s = 0;
    return ws.map(w => { const n = sylls(w), g = { step: s * per, len: n * per }; s += n; return g; });
  }
  async function prepare() {
    await loadLineIndex();
    hasVoice = lines.every(x => hashOf(x.l));
    if (!hasVoice) mode = 'solo';
    draw(); dockDraw();
  }
  function buildPlan() {
    const p = [{ kind: 'intro' }];
    if (mode === 'listen') lines.forEach((x, i) => p.push({ kind: 'fox', i }));
    else if (mode === 'echo') lines.forEach((x, i) => { p.push({ kind: 'fox', i }); p.push({ kind: 'you', i }); });
    else for (let r = 0; r < 3; r++) lines.forEach((x, i) => p.push({ kind: 'solo', i, r }));
    p.push({ kind: 'end' });
    return p;
  }

  // ---------- hangszerek ----------
  let noiseBuf = null;
  const noise = () => { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; };
  function env(node, t, peak, len) { const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + len); node.connect(g).connect(master); return g; }
  function kick(t) { const o = ac.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .22); env(o, t, .95, .38); o.start(t); o.stop(t + .4); }
  function snare(t) {
    const n = ac.createBufferSource(); n.buffer = noise(); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; n.connect(f); env(f, t, .5, .2); n.start(t); n.stop(t + .22);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); env(o, t, .25, .1); o.start(t); o.stop(t + .12);
  }
  function hat(t, open) { const n = ac.createBufferSource(); n.buffer = noise(); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000; n.connect(f); env(f, t, open ? .13 : .07, open ? .22 : .04); n.start(t); n.stop(t + .25); }
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  function bass(t, m, len) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(m); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; o.connect(f); env(f, t, .26, len); o.start(t); o.stop(t + len + .05); }
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]; // Am F C G
  const ROOTS = [45, 41, 48, 43];
  function chord(t, b) { CHORDS[b % 4].forEach(m => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(m); env(o, t, .035, barLen() * .9); o.start(t); o.stop(t + barLen()); }); }

  // ---------- ütemezés ----------
  const at = (t, fn) => timeouts.push(setTimeout(fn, Math.max(0, (t - ac.currentTime) * 1000)));
  function scheduleStep(n, t) {
    const s = n % 16, b = Math.floor(n / 16);
    if (b >= plan.length) return;
    if (plan[b].kind === 'end') { if (s === 0) at(t, done); return; }
    if (s === 0 || s === 7 || s === 10) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (s % 2 === 0) hat(t + (s % 4 === 2 ? stepDur() * .12 : 0), s === 14);
    if (s === 0) { bass(t, ROOTS[b % 4], stepDur() * 6); chord(t, b); scheduleBar(b, t); }
    if (s === 8) bass(t, ROOTS[b % 4] + 7, stepDur() * 3);
    if (s === 11) bass(t, ROOTS[b % 4] + 12, stepDur() * 2);
    if (s % 4 === 0) at(t, () => { ui.pet?.pulse(); beatDot(s / 4); });
  }
  function scheduleBar(b, t) {
    const bar = plan[b];
    at(t, () => showBar(b));
    const x = bar.i !== undefined ? lines[bar.i] : null;
    const grid = x ? gridOf(x.l) : null;
    if (bar.kind === 'fox') {
      const buf = bufs.get(x.l);
      if (!buf) return;
      const an = ac.createAnalyser(); an.fftSize = 1024; an.connect(vbus);
      // a sor egyben, természetesen szól az ütem elejétől (ez tetszett); csak ha túl hosszú, kicsit gyorsít
      const rate = Math.max(1, Math.min(1.15, buf.duration / (barLen() * .9)));
      const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(an);
      src.start(t + .03);
      at(t, () => ui.pet?.mouth(an));
      at(t + .03 + buf.duration / rate + .05, () => ui.pet?.mouth(null));
      // a kiemelés a kimondott szavakat követi (a szavak időpontjai alapján)
      const tim = lineIdx?.w?.[voice]?.[hashOf(x.l)];
      if (tim && tim.length === grid.length) tim.forEach(([off], j) => at(t + .03 + off / rate, () => markWord(j)));
      else grid.forEach((g, j) => at(t + g.step * stepDur(), () => markWord(j)));
    } else if (grid && bar.kind !== 'intro') grid.forEach((g, j) => at(t + g.step * stepDur(), () => markWord(j)));
  }
  function tick() { while (nextTime < ac.currentTime + .15) { scheduleStep(step, nextTime); nextTime += stepDur(); step++; } }

  async function start() {
    ac = ui.pet?.audio?.() || null;
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); own = true; }
    if (ac.state === 'suspended') await ac.resume();
    master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
    vbus = ac.createGain(); vbus.gain.value = 1.1; vbus.connect(master);
    if (mode !== 'solo') {
      const need = [...new Set(lines.map(x => x.l))].filter(l => !bufs.has(l));
      ui.dock.querySelector('#go').textContent = 'Betöltés…';
      await Promise.all(need.map(async l => {
        const r = await fetch(`audio/lines/${voice}/${hashOf(l)}.mp3`);
        bufs.set(l, await ac.decodeAudioData(await r.arrayBuffer()));
      }));
    }
    plan = buildPlan(); step = 0; nextTime = ac.currentTime + .1; playing = true;
    timer = setInterval(tick, 25); tick();
    dockDraw();
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null;
    timeouts.forEach(clearTimeout); timeouts = [];
    try { master?.disconnect(); } catch (e) {}
    ui.pet?.mouth(null); ui.pet?.listen(false);
    if (own) { ac?.close(); ac = null; }
  }
  function done() { stop(); ui.finish(1); }
  ui.cleanup(stop);

  // ---------- megjelenítés ----------
  const wordsHTML = (l, r = 0) => tokens(l).map(t => {
    if (t.t !== undefined) return r >= 2 ? '' : esc(t.t);
    const shown = r === 0 ? esc(t.w) : r === 1 ? esc(t.w[0]) + '<span class="dim">' + '·'.repeat(Math.max(1, sylls(t.w) - 1)) + '</span>' : '<span class="dim">' + '·'.repeat(sylls(t.w)) + '</span>';
    return `<span class="rw" data-s="${sylls(t.w)}">${shown}</span>`;
  }).join(r >= 2 ? ' ' : '');
  function draw() {
    ui.body.innerHTML = `
      <div class="rapstage">
        <div class="raplabel px" id="rlab">${playing ? '' : 'Rap mód'}</div>
        <div class="rapline" id="rline">${playing ? '' : esc(lines[0].l)}</div>
        <div class="rapnext" id="rnext">${playing ? '' : esc(lines[1]?.l || '')}</div>
        <div class="beats">${[0, 1, 2, 3].map(i => `<span data-b="${i}"></span>`).join('')}</div>
      </div>
      ${hasVoice ? '' : '<p class="muted small" style="margin:0;text-align:center">Ehhez a vershez nincs felvett rap-hang, ezért csak az Egyedül mód megy.</p>'}`;
  }
  function beatDot(i) {
    ui.body.querySelectorAll('.beats span').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  function showBar(b) {
    const bar = plan[b], lab = ui.body.querySelector('#rlab'), line = ui.body.querySelector('#rline'), nxt = ui.body.querySelector('#rnext');
    if (!lab) return;
    ui.pet?.listen(bar.kind === 'you');
    const total = plan.length - 2;
    ui.progress(Math.min(1, (b) / Math.max(1, total)));
    if (bar.kind === 'intro') { lab.textContent = 'Figyelj az ütemre…'; line.innerHTML = wordsHTML(lines[0].l, 0); nxt.textContent = ''; return; }
    const x = lines[bar.i];
    const r = bar.kind === 'solo' ? bar.r : 0;
    lab.textContent = bar.kind === 'fox' ? (ui.pet ? `${ui.pet.name} rappel` : 'Figyelj!') : bar.kind === 'you' ? 'Te jössz!' : `Te rappelsz · ${bar.r + 1}. kör`;
    lab.className = 'raplabel px ' + (bar.kind === 'you' || bar.kind === 'solo' ? 'you' : '');
    line.innerHTML = wordsHTML(x.l, r);
    const nb = plan[b + 1];
    nxt.innerHTML = nb && nb.i !== undefined && nb.i !== bar.i ? (nb.kind === 'solo' && nb.r >= 1 ? '' : esc(lines[nb.i].l)) : '';
  }
  // a szó kiemelése pontosan akkor, amikor az ütemben sorra kerül
  function markWord(j) {
    const ws = [...ui.body.querySelectorAll('#rline .rw')];
    ws.forEach((x, k) => { x.classList.toggle('cur', k === j); if (k <= j) x.classList.add('on'); });
  }
  function dockDraw() {
    ui.dock.innerHTML = `
      <div class="chips" style="justify-content:center">${Object.entries(MODES).map(([k, l]) => `<button class="chip" data-m="${k}" aria-pressed="${mode === k}" ${playing || (!hasVoice && k !== 'solo') ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      <div class="chips" style="justify-content:center">${Object.entries(TEMPO).map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${bpm === +k}" ${playing ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      <button class="btn big primary wide px" id="go">${playing ? 'Megállítás' : 'Indulhat az ütem'}</button>`;
    ui.dock.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; dockDraw(); });
    ui.dock.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { bpm = +b.dataset.t; dockDraw(); });
    ui.dock.querySelector('#go').onclick = () => { if (playing) { stop(); draw(); dockDraw(); ui.progress(0); } else start().catch(() => { ui.toast('Nem sikerült elindítani a hangot.'); stop(); dockDraw(); }); };
  }
  draw(); dockDraw(); ui.progress(0); prepare();
}
