import { parseStanzas, words, esc } from './text.js';
import * as S from './store.js';
import { EXERCISES, run, loadAudioIndex, voiceNames, canSpeak, pickVoice, stanzaAudio, makeAudio } from './ex.js';
import { searchPoems, fetchPoem, ocrImage } from './sources.js';
import * as G from './game.js';

const app = document.getElementById('app');
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path stroke-width="1.5" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};

// ---------- navigáció (a telefon vissza gombja is működik) ----------
let cleanups = [];
function go(view, params = {}, push = true) {
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  if (push) history.pushState({ view, params }, '');
  else history.replaceState({ view, params }, '');
  window.scrollTo(0, 0);
  (VIEWS[view] || VIEWS.home)(params);
}
window.addEventListener('popstate', e => {
  const st = e.state || { view: 'home', params: {} };
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  (VIEWS[st.view] || VIEWS.home)(st.params);
});
const back = () => history.length > 1 ? history.back() : go('home', {}, false);

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2800);
}

// ---------- segédek ----------
const stanzaLabel = (idx, n) =>
  idx.length === n && n > 1 ? 'Az egész vers'
    : idx.length === 1 ? (n > 1 ? `${idx[0] + 1}. versszak` : 'A vers')
      : `${idx[0] + 1}–${idx[idx.length - 1] + 1}. versszak együtt`;

function taskText(poem, task) {
  const n = poem.stanzas.length, ex = EXERCISES[task.type];
  if (task.kind === 'review') return { eyebrow: 'Ismétlés', title: `${stanzaLabel(task.stanzas, n)} fejből`, sub: 'Megy még? Mondd el soronként.' };
  if (task.kind === 'chain') return { eyebrow: 'Összefűzés', title: stanzaLabel(task.stanzas, n), sub: 'Mondd el egyben az eddig megtanult versszakokat.' };
  if (task.kind === 'whole') return { eyebrow: 'Nagy próba', title: 'Az egész vers fejből', sub: 'Minden versszak megvan. Most egyben!' };
  return { eyebrow: 'Következő lépés', title: `${stanzaLabel(task.stanzas, n)} · ${ex.name}`, sub: ex.help };
}

function segsHTML(poem) {
  return `<div class="segs">${poem.stanzas.map(p => {
    const st = S.stanzaStatus(p);
    if (st === 'done') return '<span class="seg done"></span>';
    if (st === 'due') return '<span class="seg due"></span>';
    return `<span class="seg"><i style="width:${Math.round(p.step / S.PATH.length * 100)}%"></i></span>`;
  }).join('')}</div>`;
}

function poemSummary(poem) {
  const st = poem.stanzas.map(p => S.stanzaStatus(p));
  const done = st.filter(s => s === 'done' || s === 'due').length;
  const due = st.filter(s => s === 'due').length;
  return { done, due, total: st.length };
}

function ctxFor(poem) {
  const lines = parseStanzas(poem.text).flat();
  return {
    allLines: lines,
    allWords: lines.flatMap(words),
    allEnds: lines.map(l => words(l).slice(-1)[0]).filter(Boolean),
    voice: S.state.settings.voice
  };
}

// ================= Nézetek =================
const VIEWS = {};

function levelHTML() {
  const L = G.levelInfo();
  return `<div class="lvl">
    <span class="lvbadge px">${L.lvl}</span>
    <div class="grow"><div class="row" style="justify-content:space-between;gap:6px"><b class="px">${L.name}</b><span class="small muted px">${L.cur} / ${L.need} XP</span></div>
    <div class="xpbar"><i style="width:${Math.round(L.frac * 100)}%"></i></div></div>
  </div>`;
}

VIEWS.home = () => {
  const poems = S.state.poems;
  const last = S.getPoem(S.state.lastPoem) || poems[0];
  const lastTask = last && S.nextTask(last);
  const m = G.missionToday();
  const bp = G.buildProgress();
  app.innerHTML = `
    <div class="top"><h1 class="brand grow">Fejből</h1>
      <span class="streak px" title="nap egymás után">${S.streak()} nap</span>
      <button class="icon-btn" id="settings" aria-label="Beállítások">${I.gear}</button></div>
    ${levelHTML()}
    <section class="mission ${m.claimed ? 'claimed' : ''}">
      <div class="row" style="justify-content:space-between"><p class="label">Mai küldetés</p><span class="px">${m.done}/${G.MISSION_SIZE}</span></div>
      <div class="mslots">${Array.from({ length: G.MISSION_SIZE }, (_, i) => `<span class="${i < m.done ? 'on' : ''}"></span>`).join('')}<span class="chest ${m.claimed ? 'open' : ''}" aria-hidden="true"></span></div>
      <h2 class="px">${m.claimed ? 'Mára kész! A láda a tiéd.' : m.done ? `Még ${G.MISSION_SIZE - m.done} feladat, és jár a láda!` : '3 rövid feladat, kb. 5 perc'}</h2>
      ${last ? `<button class="btn big wide px ${m.claimed ? '' : 'primary'}" id="cont">${m.claimed ? 'Még egy kör?' : m.done ? 'Folytatom' : 'Indulás!'}</button>` : ''}
      ${last && lastTask ? `<p class="small muted" style="margin:0">Következik: ${esc(last.title)} · ${esc(taskText(last, lastTask).title)}</p>` : ''}
    </section>
    <section class="buildcard">
      <div class="row" style="justify-content:space-between"><p class="label">Építkezés: ${bp.build.name}${bp.finished ? ` (${bp.finished + 1}.)` : ''}</p><span class="px small">${bp.placed} / ${bp.size} blokk</span></div>
      <canvas id="build" aria-label="Épülő ${bp.build.name}, ${bp.placed} blokk a ${bp.size}-ból"></canvas>
      <p class="small muted" style="margin:0">Minden csillag egy blokk. Tanulj, és felépül!</p>
    </section>
    <p class="label">Verseim</p>
    <div class="cards">${poems.map(p => {
      const s = poemSummary(p);
      return `<button class="pcard" data-id="${p.id}">
        <h3>${esc(p.title)}</h3>${p.author ? `<span class="by">${esc(p.author)}</span>` : ''}
        ${segsHTML(p)}
        <span class="meta"><span>${s.done} / ${s.total} versszak megy</span>${s.due ? `<span class="due">${s.due} ismétlésre vár</span>` : ''}${p.best ? `<span>Villámkör rekord: ${p.best}</span>` : ''}</span>
      </button>`;
    }).join('')}</div>
    <button class="btn big wide" id="add">+ Új vers</button>
    <p class="label">Jelvények</p>
    <div class="badges">${G.BADGES.map(b => {
      const on = S.state.game.badges.includes(b.id);
      return `<div class="badge ${on ? 'on' : ''}" title="${esc(b.desc)}"><span class="bico px" style="--bc:${b.color}">${b.glyph}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`;
    }).join('')}</div>
    <p class="foot">A haladásod ezen a telefonon tárolódik.</p>`;
  requestAnimationFrame(() => { const c = app.querySelector('#build'); if (c) G.drawBuild(c, bp); });
  app.querySelector('#settings').onclick = () => go('settings');
  app.querySelector('#add').onclick = () => go('add');
  app.querySelector('#cont')?.addEventListener('click', () => {
    G.sfx('block');
    if (lastTask) startTask(last, lastTask);
    else startTask(last, blitzTask(last, -1));
  });
  app.querySelectorAll('.pcard').forEach(b => b.onclick = () => go('poem', { id: b.dataset.id }));
};

function blitzTask(poem, scope) {
  let idx = scope >= 0 ? [scope] : poem.stanzas.map((p, i) => p.step > 0 ? i : -1).filter(i => i >= 0);
  if (!idx.length) idx = [0];
  return { type: 'blitz', stanzas: idx, kind: 'free' };
}

VIEWS.poem = ({ id, scope = -1 }) => {
  const poem = S.getPoem(id); if (!poem) return go('home', {}, false);
  S.state.lastPoem = id; S.save();
  const stz = parseStanzas(poem.text), n = stz.length;
  const task = S.nextTask(poem);
  const tt = task && taskText(poem, task);
  const step = task?.kind === 'learn' ? poem.stanzas[task.stanzas[0]].step : -1;
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <div class="grow"><h1 class="t">${esc(poem.title)}</h1>${poem.author ? `<p class="sub">${esc(poem.author)}</p>` : ''}</div>
      <button class="icon-btn" id="edit" aria-label="Szerkesztés">${I.edit}</button>
    </div>
    ${task ? `<section class="next">
      <p class="label">${tt.eyebrow}</p>
      <h2>${esc(tt.title)}</h2>
      <p>${esc(tt.sub)}</p>
      ${step >= 0 ? `<div class="pathdots">${S.PATH.map((t, i) => `<span class="${i < step ? 'ok' : i === step ? 'on' : ''}">${EXERCISES[t].name}</span>`).join('')}</div>` : ''}
      <button class="btn big wide" id="go">Kezdjük</button>
    </section>` : `<section class="next rest">
      <p class="label">Mára kész</p>
      <h2>Ügyes vagy, minden megy!</h2>
      <p>Holnap jön a következő ismétlés. Addig lent szabadon gyakorolhatsz.</p>
    </section>`}
    <p class="label">Versszakok</p>
    <div class="slist">${stz.map((lines, i) => {
      const p = poem.stanzas[i], st = S.stanzaStatus(p);
      const pill = st === 'new' ? '<span class="pill">Új</span>'
        : st === 'learn' ? `<span class="pill learn">Tanulás ${p.step}/${S.PATH.length}</span>`
          : st === 'due' ? '<span class="pill due">Ismételni</span>' : '<span class="pill done">Megy</span>';
      return `<div class="srow"><span class="n">${i + 1}.</span><span class="first">${esc(lines[0])}</span>${pill}</div>`;
    }).join('')}</div>
    <p class="label">Szabad gyakorlás</p>
    ${n > 1 ? `<div class="chips" id="scope">
      <button class="chip" data-s="-1" aria-pressed="${scope === -1}">Egész</button>
      ${stz.map((_, i) => `<button class="chip" data-s="${i}" aria-pressed="${scope === i}">${i + 1}.</button>`).join('')}
    </div>` : ''}
    <div class="tiles">${Object.entries(EXERCISES).map(([k, e]) => `
      <button class="tile ${e.special ? 'special' : ''}" data-t="${k}"><svg class="ic" viewBox="0 0 24 24"><path d="${e.icon}"/></svg><b>${e.name}</b><span>${e.short}</span></button>`).join('')}
    </div>
    <details class="stack"><summary class="label" style="cursor:pointer;padding:6px 0">A teljes vers</summary>
      <div class="sheet"><div class="poem">${stz.map((lines, i) => `<p class="stanza">${lines.map((l, li) => `<span class="ln">${li === 0 && n > 1 ? `<span class="snum">${i + 1}.</span>` : ''}${esc(l)}</span>`).join('')}</p>`).join('')}</div></div>
    </details>`;
  app.querySelector('#back').onclick = () => go('home');
  app.querySelector('#edit').onclick = () => go('edit', { id });
  app.querySelector('#go')?.addEventListener('click', () => startTask(poem, task));
  app.querySelectorAll('#scope .chip').forEach(b => b.onclick = () => go('poem', { id, scope: +b.dataset.s }, false));
  app.querySelectorAll('.tile').forEach(b => b.onclick = () => {
    if (b.dataset.t === 'blitz') return startTask(poem, blitzTask(poem, scope));
    const idx = scope < 0 ? stz.map((_, i) => i) : [scope];
    startTask(poem, { type: b.dataset.t, stanzas: idx, kind: 'free' });
  });
};

function startTask(poem, task) { go('exercise', { id: poem.id, task }); }

VIEWS.exercise = ({ id, task }) => {
  const poem = S.getPoem(id); if (!poem) return go('home', {}, false);
  const stz = parseStanzas(poem.text);
  const set = task.stanzas.filter(i => stz[i]).map(i => ({ i, lines: stz[i] }));
  const ex = EXERCISES[task.type];
  app.innerHTML = `
    <div class="exbar">
      <button class="icon-btn" id="close" aria-label="Kilépés">${I.close}</button>
      <div class="progress" role="progressbar" aria-label="Haladás"><i style="width:0"></i></div>
    </div>
    <div class="extitle"><h2>${ex.name}</h2><p>${esc(stanzaLabel(task.stanzas, stz.length))} · ${esc(poem.title)}</p></div>
    <div id="exbody"></div>
    <div class="dock" id="exdock"></div>`;
  app.querySelector('#close').onclick = back;
  const bar = app.querySelector('.progress i');
  let finished = false;
  const ui = {
    body: app.querySelector('#exbody'), dock: app.querySelector('#exdock'),
    progress: f => { bar.style.width = Math.round(f * 100) + '%'; },
    cleanup: f => cleanups.push(f),
    toast,
    sfx: G.sfx,
    finish: (score, raw) => {
      if (finished) return; finished = true;
      const r = S.applyResult(poem, task, score);
      const rw = G.reward({ task, score, raw, poem, ...r });
      go('result', { id, task, score, raw, pass: r.pass, rw, wholeDone: r.wholeDone, mastered: r.mastered }, false);
    }
  };
  run(task.type, ui, set, ctxFor(poem));
};

VIEWS.result = ({ id, task, score, raw, pass, rw, wholeDone, mastered }) => {
  const poem = S.getPoem(id); if (!poem) return go('home', {}, false);
  const stars = rw ? rw.stars : G.starsFor(score, raw);
  const blitz = task.type === 'blitz';
  const head = blitz ? `${raw} pont!` : wholeDone ? 'Megtanultad!' : ['Gyakoroljuk még', 'Majdnem!', 'Szép munka!', 'Hibátlan!'][stars];
  let msg;
  if (blitz) msg = raw >= (poem.best || 0) && raw > 0 ? 'Új rekord!' : `A rekordod: ${poem.best || 0} pont.`;
  else if (wholeDone) msg = 'Az egész vers megy fejből. Ez igazi teljesítmény!';
  else if (task.kind === 'free') msg = pass ? 'Ez jól ment.' : 'Még egy kör, és menni fog.';
  else if (task.kind === 'learn') msg = pass ? (mastered ? 'Ez a versszak megvan! Holnap ismétlünk.' : 'Jöhet a következő lépés.') : 'Ehhez a lépéshez 80% kell. Próbáld újra, menni fog.';
  else if (task.kind === 'review') msg = pass ? 'Megmaradt! A következő ismétlés később jön.' : 'Egy kicsit elfelejtődött. Átvesszük újra a kezdőbetűkkel.';
  else msg = pass ? 'Egyben is megy!' : 'Gyakorold még a piros pöttyös sorokat, aztán próbáld újra.';
  const next = S.nextTask(poem);
  const m = G.missionToday();
  const bp = G.buildProgress();
  app.innerHTML = `
    <div class="result ${wholeDone ? 'grand' : ''}">
      <div class="stars">${[0, 1, 2].map(i => I.star.replace('<svg', `<svg class="${i < stars ? 'on' : 'off'}" style="animation-delay:${i * .15}s"`)).join('')}</div>
      <h2>${head}</h2>
      <p>${blitz ? '' : `<b>${Math.round(score * 100)}%</b> · `}${msg}</p>
      ${rw ? `<div class="loot">
        <span class="px">+${rw.xp} XP</span>
        ${rw.blocks ? `<span class="px">+${rw.blocks} blokk</span>` : ''}
      </div>` : ''}
    </div>
    ${rw?.levelUp ? `<div class="levelup"><span class="lvbadge px">${rw.levelUp.lvl}</span><div><b class="px">Szintlépés!</b><br><span>Új rang: ${rw.levelUp.name}</span></div></div>` : ''}
    ${rw?.missionDone ? `<div class="levelup chestwin"><span class="chest open" aria-hidden="true"></span><div><b class="px">Mai küldetés teljesítve!</b><br><span>A láda bónusza: +30 XP</span></div></div>`
      : rw ? `<div class="note small">Mai küldetés: ${m.done}/${G.MISSION_SIZE}${m.claimed ? ' (kész)' : ''}</div>` : ''}
    ${rw?.buildDone ? `<div class="levelup"><span class="lvbadge px">▦</span><div><b class="px">Felépült: ${rw.buildDone.name}!</b><br><span>Kezdődik a következő építkezés.</span></div></div>` : ''}
    ${(rw?.earned || []).map(b => `<div class="levelup"><span class="bico px" style="--bc:${b.color}">${b.glyph}</span><div><b class="px">Új jelvény: ${esc(b.name)}</b><br><span>${esc(b.desc)}</span></div></div>`).join('')}
    ${rw?.blocks ? `<section class="buildcard"><p class="label">${bp.build.name} · ${bp.placed} / ${bp.size}</p><canvas id="build"></canvas></section>` : ''}
    <div class="stack">
      ${!blitz && task.kind !== 'free' && next ? `<button class="btn big primary wide px" id="next">Tovább: ${esc(EXERCISES[next.type].name)}</button>` : ''}
      <button class="btn big wide px ${blitz || task.kind === 'free' || !next ? 'primary' : ''}" id="again">Még egyszer</button>
      <button class="btn big wide ghost" id="done">Vissza a vershez</button>
    </div>`;
  requestAnimationFrame(() => {
    const c = app.querySelector('#build');
    if (c) G.drawBuild(c, bp, Math.min(rw.blocks, bp.placed));
  });
  if (wholeDone || rw?.levelUp || rw?.missionDone) { G.sfx(rw?.levelUp ? 'level' : 'win'); G.confetti(); }
  else if (stars >= 2) G.sfx('win');
  app.querySelector('#next')?.addEventListener('click', () => go('exercise', { id, task: next }, false));
  app.querySelector('#again').onclick = () => go('exercise', { id, task }, false);
  app.querySelector('#done').onclick = () => go('poem', { id }, false);
};

// ---------- új vers ----------
const SUGGEST = ['Anyám tyúkja', 'Szeptember végén', 'Nemzeti dal', 'Családi kör', 'A walesi bárdok', 'Az Alföld', 'Szózat', 'Himnusz Kölcsey'];

VIEWS.add = ({ tab = 'search', draft = null } = {}) => {
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow">Új vers</h1>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="search" aria-selected="${tab === 'search'}">Keresés</button>
      <button role="tab" data-tab="photo" aria-selected="${tab === 'photo'}">Fotóról</button>
      <button role="tab" data-tab="paste" aria-selected="${tab === 'paste'}">Beírás</button>
    </div>
    <div id="pane" class="stack"></div>`;
  app.querySelector('#back').onclick = back;
  app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => go('add', { tab: b.dataset.tab, draft }, false));
  const pane = app.querySelector('#pane');
  ({ search: paneSearch, photo: panePhoto, paste: panePaste })[tab](pane, draft);
};

function paneSearch(pane) {
  pane.innerHTML = `
    <form class="search" id="sf"><input id="q" type="search" placeholder="A vers címe vagy egy sora" autocomplete="off" enterkeyhint="search"><button class="btn primary">Keres</button></form>
    <p class="label">Gyakori iskolai versek</p>
    <div class="chips">${SUGGEST.map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div id="res" class="stack"></div>
    <p class="foot">A versek a Wikiforrásból (hu.wikisource.org) jönnek. Ha a tankönyvben más a szöveg, töltsd fel fotóról.</p>`;
  const res = pane.querySelector('#res');
  const doSearch = async q => {
    if (!q.trim()) return;
    res.innerHTML = '<p class="muted">Keresés…</p>';
    try {
      const list = await searchPoems(q);
      if (!list.length) { res.innerHTML = '<p class="muted">Nincs találat. Próbáld a vers első sorával, vagy töltsd fel fotóról.</p>'; return; }
      res.innerHTML = `<div class="results">${list.map(r => `<button data-t="${esc(r.title)}"><b>${esc(r.title)}</b><span>${esc(r.snippet)}</span></button>`).join('')}</div>`;
      res.querySelectorAll('.results button').forEach(b => b.onclick = () => pick(b.dataset.t));
    } catch (e) { res.innerHTML = `<p class="note bad">${esc(e.message || 'Nincs internetkapcsolat.')}</p>`; }
  };
  const pick = async title => {
    res.innerHTML = '<p class="muted">Betöltés…</p>';
    try {
      const p = await fetchPoem(title);
      const n = parseStanzas(p.text).length;
      res.innerHTML = `
        <div class="stack"><div><b style="font-family:var(--poem);font-size:1.15rem">${esc(p.title)}</b><br><span class="muted">${esc(p.author || 'Ismeretlen szerző')} · ${n} versszak</span></div>
        <div class="preview">${esc(p.text)}</div>
        <div class="row"><button class="btn big primary grow" id="take">Ezt tanulom</button><button class="btn big grow" id="fix">Javítok rajta</button></div></div>`;
      res.querySelector('#take').onclick = () => addPoem(p);
      res.querySelector('#fix').onclick = () => go('add', { tab: 'paste', draft: p }, false);
    } catch (e) { res.innerHTML = `<p class="note bad">${esc(e.message)}</p>`; }
  };
  pane.querySelector('#sf').onsubmit = e => { e.preventDefault(); doSearch(pane.querySelector('#q').value); };
  pane.querySelectorAll('.chip').forEach(b => b.onclick = () => { pane.querySelector('#q').value = b.dataset.q; doSearch(b.dataset.q); });
}

function panePhoto(pane, draft) {
  pane.innerHTML = `
    <label class="drop" for="file">${I.camera}
      <b>Fényképezd le a verset a könyvből</b>
      <span class="muted small">Egyenesen, jó fényben, csak a vers legyen a képen. Ha két oldalas, egymás után fotózd le.</span>
      <span class="btn primary">Fotó készítése</span>
    </label>
    <input type="file" id="file" accept="image/*" capture="environment" hidden>
    <div id="st"></div>
    ${draft?.text ? `<p class="note">Már van ${parseStanzas(draft.text).length} versszak beolvasva. A következő fotó ehhez adódik hozzá.</p><button class="btn big wide" id="toEdit">Tovább az ellenőrzéshez</button>` : ''}`;
  const st = pane.querySelector('#st');
  pane.querySelector('#toEdit')?.addEventListener('click', () => go('add', { tab: 'paste', draft }, false));
  pane.querySelector('#file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    st.innerHTML = `<div class="stack"><p class="muted" id="stt">Szövegfelismerő betöltése… (első alkalommal kb. 10 MB)</p><div class="bar"><i style="width:0"></i></div></div>`;
    try {
      const text = await ocrImage(f, p => {
        st.querySelector('#stt').textContent = 'Olvasom a szöveget… ' + Math.round(p * 100) + '%';
        st.querySelector('.bar i').style.width = Math.round(p * 100) + '%';
      });
      const merged = { title: draft?.title || '', author: draft?.author || '', text: [draft?.text, text].filter(Boolean).join('\n\n') };
      go('add', { tab: 'paste', draft: merged, fromPhoto: true }, false);
      toast('Kész! Nézd át, és javítsd, ha valami elcsúszott.');
    } catch (err) { st.innerHTML = `<p class="note bad">${esc(err.message || 'Nem sikerült beolvasni a képet.')}</p>`; }
  };
}

function panePaste(pane, draft) {
  pane.innerHTML = poemForm(draft) + `
    <div class="row">
      <button class="btn big primary grow" id="save">Mentés</button>
      ${draft?.text ? '<button class="btn big grow" id="more">+ Még egy fotó</button>' : ''}
    </div>`;
  pane.querySelector('#more')?.addEventListener('click', () => go('add', { tab: 'photo', draft: readForm(pane) }, false));
  pane.querySelector('#save').onclick = () => {
    const d = readForm(pane);
    if (!d.text) { pane.querySelector('#fText').focus(); toast('Előbb kell a vers szövege.'); return; }
    addPoem(d);
  };
}

const poemForm = d => `
  <div class="two">
    <label class="field">Cím<input id="fTitle" value="${esc(d?.title || '')}" placeholder="pl. Anyám tyúkja"></label>
    <label class="field">Szerző<input id="fAuthor" value="${esc(d?.author || '')}" placeholder="pl. Petőfi Sándor"></label>
  </div>
  <label class="field">A vers szövege <span class="small" style="font-weight:600">(a versszakok között legyen egy üres sor)</span>
    <textarea id="fText" placeholder="Másold vagy írd ide a verset…">${esc(d?.text || '')}</textarea>
  </label>`;
const readForm = root => ({
  title: root.querySelector('#fTitle').value.trim() || 'Névtelen vers',
  author: root.querySelector('#fAuthor').value.trim(),
  text: root.querySelector('#fText').value.trim()
});

function addPoem(d) {
  const p = S.makePoem(d);
  S.state.poems.unshift(p); S.state.lastPoem = p.id; S.save();
  toast('Hozzáadva!');
  go('poem', { id: p.id }, false);
}

VIEWS.edit = ({ id }) => {
  const poem = S.getPoem(id); if (!poem) return go('home', {}, false);
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow">Szerkesztés</h1>
    </div>
    <div class="stack" id="form">${poemForm(poem)}
      <p class="muted small" style="margin:0">Ha a szöveget módosítod, a haladás ennél a versnél elölről indul.</p>
      <div class="row"><button class="btn big primary grow" id="save">Mentés</button><button class="btn big ghost" id="del">Vers törlése</button></div>
      <div class="confirm" id="conf" hidden>Biztosan törlöd a verset és a haladást?
        <button class="btn bad" id="yes">Igen, törlés</button><button class="btn" id="no">Mégse</button></div>
    </div>`;
  const f = app.querySelector('#form');
  app.querySelector('#back').onclick = back;
  app.querySelector('#save').onclick = () => {
    const d = readForm(f);
    if (!d.text) return toast('A vers szövege nem lehet üres.');
    S.updateText(poem, d); toast('Mentve'); go('poem', { id }, false);
  };
  app.querySelector('#del').onclick = () => { app.querySelector('#conf').hidden = false; };
  app.querySelector('#no').onclick = () => { app.querySelector('#conf').hidden = true; };
  app.querySelector('#yes').onclick = () => {
    S.removePoem(poem);
    if (!S.state.poems.length) S.state.poems.push(S.makePoem({ title: 'Névtelen vers', author: '', text: 'Írd ide a verset.' }));
    S.save(); go('home', {}, false);
  };
};

VIEWS.settings = () => {
  const set = S.state.settings, voices = voiceNames();
  const cur = pickVoice(set.voice);
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow">Beállítások</h1>
    </div>
    <p class="label">Betűméret</p>
    <div class="chips" id="size">${['Normál', 'Nagy', 'Óriás'].map((l, i) => `<button class="chip" data-v="${i}" aria-pressed="${(set.size || 0) === i}">${l}</button>`).join('')}</div>
    <p class="label">Hangeffektek</p>
    <div class="chips" id="sound"><button class="chip" data-v="1" aria-pressed="${set.sound !== false}">Be</button><button class="chip" data-v="0" aria-pressed="${set.sound === false}">Ki</button></div>
    <p class="label">Felolvasó hang</p>
    <div class="chips" id="voice">${Object.entries(voices).map(([k, l]) => `<button class="chip" data-v="${k}" aria-pressed="${cur === k}">${esc(l)}</button>`).join('')}</div>
    <button class="btn wide" id="try">Meghallgatom</button>
    <p class="muted small" style="margin:0">A beépített versekhez előre elkészített, természetes magyar felolvasás tartozik. Saját versnél a telefon saját felolvasója szól${canSpeak() ? '' : ', de ezen a készüléken nem találtam magyar hangot'}.</p>
    <p class="label">Adatok</p>
    <p class="muted small" style="margin:0">A versek és a haladás csak ezen a telefonon, ebben a böngészőben tárolódnak. Nem kell hozzá fiók.</p>`;
  app.querySelector('#back').onclick = back;
  app.querySelectorAll('#size .chip').forEach(b => b.onclick = () => { S.setSize(+b.dataset.v); VIEWS.settings(); });
  app.querySelectorAll('#sound .chip').forEach(b => b.onclick = () => { set.sound = b.dataset.v === '1'; S.save(); G.sfx('good'); VIEWS.settings(); });
  app.querySelectorAll('#voice .chip').forEach(b => b.onclick = () => { set.voice = b.dataset.v; S.save(); VIEWS.settings(); });
  let a = null;
  app.querySelector('#try').onclick = () => {
    const first = parseStanzas(S.state.poems.find(p => stanzaAudio(parseStanzas(p.text)[0], set.voice))?.text || '')[0];
    const clip = first && stanzaAudio(first, set.voice);
    if (!clip) return toast('Nincs előre felvett vers a hangpróbához.');
    a?.pause(); a = makeAudio(clip.url); a.play().catch(() => toast('Nem sikerült lejátszani.'));
  };
  cleanups.push(() => a?.pause());
};

// ---------- indulás ----------
document.documentElement.dataset.size = S.state.settings.size || 0;
S.save();
loadAudioIndex();
go('home', {}, false);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
