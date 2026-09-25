import { parseStanzas, words, esc, rhymeGroups, rhymeLine } from './text.js?v=25';
import * as S from './store.js?v=25';
import { EXERCISES, run, loadAudioIndex, voiceNames, canSpeak, pickVoice, stanzaAudio, makeAudio } from './ex.js?v=25';
import { searchPoems, fetchPoem, ocrImage } from './sources.js?v=25';
import * as G from './game.js?v=25';
import * as SH from './shop.js?v=25';
import * as MM from './memes.js?v=25';
import * as CD from './cards.js?v=25';
import * as P from './pet.js?v=25';
import { lineImages, lineScene, loadScenes } from './imagery.js?v=25';

const app = document.getElementById('app');
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"/></svg>',
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

VIEWS.home = () => {
  const poems = S.state.poems;
  const last = S.getPoem(S.state.lastPoem) || poems[0];
  const lastTask = last && S.nextTask(last);
  const m = G.missionToday();
  const bp = G.buildProgress(), W = G.world(), L = G.levelInfo();
  const world = S.state.settings.world;
  const badgeCount = S.state.game.badges.length;
  app.innerHTML = `
    <div class="top">
      <h1 class="brand grow">Fejből</h1>
      <button class="rank" id="rank" aria-label="Rang és jelvények">
        <span class="lvbadge px">${L.lvl}</span>
        <span class="rk"><b class="px">${L.name}</b><i class="xpbar"><i style="width:${Math.round(L.frac * 100)}%"></i></i></span>
      </button>
      <button class="icon-btn" id="settings" aria-label="Beállítások">${I.gear}</button>
    </div>
    ${world ? `<section class="hero ${m.claimed ? 'claimed' : ''}">
      ${world === 'pet' ? petHeroHTML(bp) : `<div class="hero-vis"><canvas id="build" aria-label="${esc(W.label(bp.stage))}: ${bp.placed} / ${bp.size} ${W.unit}"></canvas>
        <span class="hero-tag px">${esc(bp.stage.name)} · ${bp.placed}/${bp.size} ${W.unit}</span></div>`}
      <div class="hero-body">
        <div class="mrow">
          <div class="mdots">${Array.from({ length: G.MISSION_SIZE }, (_, i) => `<span class="${i < m.done ? 'on' : ''}"></span>`).join('')}</div>
          <span class="small muted">${m.claimed ? 'Napi küldetés kész' : `Napi küldetés ${m.done}/${G.MISSION_SIZE}`}</span>
          ${S.streak() > 1 ? `<span class="streak px">${S.streak()} nap</span>` : ''}
        </div>
        ${last ? `<button class="btn go px" id="cont">${m.claimed ? 'Még egy kör' : m.done ? 'Folytatás' : 'Indulás'}</button>` : ''}
        ${last && lastTask ? `<p class="small muted nexttask">${esc(taskText(last, lastTask).title)}</p>` : ''}
        ${last ? `<button class="btn rapbtn px" id="rapgo">Rap mód</button>` : ''}
      </div>
    </section>
    ${CD.col().packs ? `<button class="packbanner" id="packs"><span class="minipack" aria-hidden="true"></span><span class="grow"><b class="px">${CD.col().packs} csomag vár</b><br><span class="small">Bontsd ki, mi van benne</span></span><span class="px">Bontás</span></button>` : ''}
    <nav class="quick">
      ${world === 'pet' ? `<button class="qbtn" id="petbtn"><b class="px">${esc(P.petName())}</b><span>beszélgetés</span></button>` : ''}
      <button class="qbtn" id="cards"><b class="px">Kártyák</b><span>${CD.ownedCount()}/${CD.CARDS.length}</span></button>
      ${world === 'car' ? `<button class="qbtn" id="garage"><b class="px">Garázs</b><span>${G.carsUnlocked()}/${G.CARS.length} autó</span></button>` : ''}
      <button class="qbtn" id="speed"><b class="px">Speedrun</b><span>${last?.best ? `rekord: ${last.best}` : '60 mp'}</span></button>
      <button class="qbtn" id="shop"><b class="px">Bolt</b><span>${SH.shop().coins} érme</span></button>
    </nav>` : worldPickerHTML()}
    <div class="row" style="justify-content:space-between"><p class="label">Verseim</p><button class="btn ghost small" id="add">+ Új vers</button></div>
    <div class="cards">${poems.map(p => {
      const s = poemSummary(p);
      return `<button class="pcard" data-id="${p.id}">
        <div class="row" style="justify-content:space-between;align-items:baseline"><h3>${esc(p.title)}</h3><span class="px small muted">${s.done}/${s.total}</span></div>
        ${segsHTML(p)}
        ${s.due ? `<span class="meta"><span class="due">${s.due} versszak ismétlésre vár</span></span>` : ''}
      </button>`;
    }).join('')}</div>`;
  requestAnimationFrame(() => {
    const c = app.querySelector('#build'); if (c) G.drawProgress(c, bp);
    app.querySelectorAll('canvas[data-world]').forEach(cv => { const w = G.WORLDS[cv.dataset.world]; G.drawProgress(cv, G.buildProgress(Math.max(S.state.game.blocks, 14), w), 0, w); });
  });
  app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { setWorld(b.dataset.pick); G.sfx('win'); if (b.dataset.pick === 'pet' && !P.pet().g) go('petpick'); else VIEWS.home(); });
  app.querySelector('#settings').onclick = () => go('settings');
  app.querySelector('#rank').onclick = () => go('badges');
  app.querySelector('#badges')?.addEventListener('click', () => go('badges'));
  app.querySelector('#shop')?.addEventListener('click', () => go('shop'));
  app.querySelector('#cards')?.addEventListener('click', () => go('cards'));
  app.querySelector('#packs')?.addEventListener('click', () => go('pack'));
  app.querySelector('#garage')?.addEventListener('click', () => go('garage'));
  app.querySelector('#petbtn')?.addEventListener('click', () => go('pet'));
  if (world === 'pet') mountHeroPet();
  app.querySelector('#speed')?.addEventListener('click', () => last && startTask(last, blitzTask(last, -1)));
  app.querySelector('#rapgo')?.addEventListener('click', () => {
    const cur = lastTask?.stanzas || [0];
    startTask(last, { type: 'rap', stanzas: cur, kind: 'free' });
  });
  app.querySelector('#add').onclick = () => go('add');
  app.querySelector('#cont')?.addEventListener('click', () => {
    G.sfx('block');
    if (lastTask) startTask(last, lastTask);
    else startTask(last, blitzTask(last, -1));
  });
  app.querySelectorAll('.pcard').forEach(b => b.onclick = () => go('poem', { id: b.dataset.id }));
};

// ---------- Gyűjtőkártyák ----------
VIEWS.cards = () => {
  const C = CD.col();
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow px">Gyűjtemény</h1><span class="px muted">${CD.ownedCount()} / ${CD.CARDS.length}</span>
    </div>
    ${C.packs ? `<button class="packbanner" id="packs"><span class="minipack" aria-hidden="true"></span><span class="grow"><b class="px">${C.packs} csomag vár</b></span><span class="px">Bontás</span></button>` : `<p class="muted small" style="margin:0">Csomagot kapsz a napi küldetésért, minden megtanult versszakért, és hármat az egész versért.</p>`}
    ${Object.keys(CD.RARITY).reverse().map(r => {
      const list = CD.CARDS.filter(c => c.r === r);
      return `<p class="label">${CD.RARITY[r].name} · ${list.filter(c => C.owned[c.id]).length}/${list.length}</p>
        <div class="cgrid">${list.map(c => C.owned[c.id] ? `<button class="cslot" data-id="${c.id}">${CD.cardHTML(c, { small: true })}${C.owned[c.id] > 1 ? `<span class="dupn">×${C.owned[c.id]}</span>` : ''}</button>` : `<div class="cslot">${CD.cardHTML(c, { locked: true, small: true })}</div>`).join('')}</div>`;
    }).join('')}`;
  requestAnimationFrame(() => CD.paintCards(app));
  app.querySelector('#back').onclick = back;
  app.querySelector('#packs')?.addEventListener('click', () => go('pack'));
  app.querySelectorAll('.cslot[data-id]').forEach(b => b.onclick = () => go('card', { id: b.dataset.id }));
};

VIEWS.card = ({ id }) => {
  const c = CD.CARDS.find(x => x.id === id); if (!c) return back();
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button><span class="grow"></span></div>
    <div class="showcase">${CD.cardHTML(c)}</div>
    <p class="muted small" style="text-align:center;margin:0">Húzd rajta az ujjad, vagy döntsd meg a telefont.</p>
    <p class="credit">Fotó: ${esc(c.by)} · <a href="${c.src}" target="_blank" rel="noopener">${c.lic}</a>, Wikimedia Commons (kivágva)</p>`;
  requestAnimationFrame(() => { CD.paintCards(app); cleanups.push(CD.tilt(app.querySelector('.tcard'))); });
  app.querySelector('#back').onclick = back;
};

VIEWS.pack = () => {
  const C = CD.col();
  if (!C.packs) return go('cards', {}, false);
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back" aria-label="Vissza">${I.close}</button><span class="grow"></span><span class="px muted">${C.packs} csomag</span></div>
    <div class="stage" id="stage">
      <button class="pack" id="pk" aria-label="Csomag kibontása">
        <span class="pk-logo px">Fejből</span><span class="pk-sub px">Autókártyák · 3 lap</span>
      </button>
      <p class="muted" id="hint">Koppints a csomagra</p>
    </div>`;
  app.querySelector('#back').onclick = () => go('home', {}, false);
  const stage = app.querySelector('#stage'), pk = app.querySelector('#pk');
  let taps = 0;
  pk.onclick = () => {
    taps++;
    pk.classList.remove('shake'); void pk.offsetWidth; pk.classList.add('shake');
    pk.style.setProperty('--glow', taps / 3);
    G.sfx('tick');
    if (taps < 3) { app.querySelector('#hint').textContent = taps === 1 ? 'Még…' : 'Még egyszer!'; return; }
    const res = CD.openPack();
    const cnt = app.querySelector('.top .px.muted'); if (cnt) cnt.textContent = CD.col().packs ? `még ${CD.col().packs} csomag` : '';
    G.sfx('block');
    const flash = document.createElement('div'); flash.className = 'flash'; document.body.appendChild(flash); setTimeout(() => flash.remove(), 700);
    reveal(stage, res);
  };
};

function reveal(stage, res) {
  let k = 0;
  const show = () => {
    const { card, dup } = res.cards[k];
    stage.innerHTML = `
      <div class="rays r-${card.r}" aria-hidden="true"></div>
      <div class="flipper" id="fl">
        <div class="face back"><span class="px">Fejből</span></div>
        <div class="face front">${CD.cardHTML(card)}</div>
      </div>
      <p class="muted" id="hint">Koppints a kártyára</p>
      <div class="dots">${res.cards.map((_, i) => `<span class="${i < k ? 'on' : i === k ? 'cur' : ''}"></span>`).join('')}</div>`;
    CD.paintCards(stage);
    const fl = stage.querySelector('#fl');
    let flipped = false;
    fl.onclick = () => {
      if (!flipped) {
        flipped = true; fl.classList.add('flipped');
        stage.querySelector('.rays').classList.add('on');
        const h = stage.querySelector('#hint');
        h.innerHTML = `<b class="px rar-${card.r}">${CD.RARITY[card.r].name}</b>${dup ? ` · megvolt már, +${CD.RARITY[card.r].xpDup} XP` : ' · ÚJ!'}`;
        if (card.r === 'legend') { G.sfx('level'); G.confetti(3000); }
        else if (card.r === 'epic') { G.sfx('win'); G.confetti(1400); }
        else G.sfx(card.r === 'rare' ? 'good' : 'block');
        if (card.r === 'epic' || card.r === 'legend') cleanups.push(CD.tilt(fl.querySelector('.tcard')));
        return;
      }
      k++;
      if (k < res.cards.length) show(); else summary();
    };
  };
  const summary = () => {
    const left = CD.col().packs;
    stage.innerHTML = `
      <h2 class="px" style="margin:0">Ezeket kaptad</h2>
      <div class="cgrid three">${res.cards.map(({ card, dup }) => `<div class="cslot">${CD.cardHTML(card, { small: true })}${dup ? '' : '<span class="newtag px">Új</span>'}</div>`).join('')}</div>
      ${res.xp ? `<p class="muted small" style="margin:0">Duplikátumokért: +${res.xp} XP</p>` : ''}
      <div class="stack" style="width:100%">
        ${left ? `<button class="btn primary big px" id="more">Következő csomag (${left})</button>` : ''}
        <button class="btn big px ${left ? '' : 'primary'}" id="coll">Gyűjtemény</button>
      </div>`;
    CD.paintCards(stage);
    stage.querySelector('#more')?.addEventListener('click', () => VIEWS.pack());
    stage.querySelector('#coll').onclick = () => go('cards', {}, false);
  };
  show();
}

// ---------- Jutalombolt ----------
const fmtDate = t => new Date(t).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });

VIEWS.shop = () => {
  const sh = SH.shop();
  const pending = sh.orders.filter(o => o.status === 'pending');
  const history = sh.orders.filter(o => o.status !== 'pending').slice(0, 5);
  const min = Math.max(1, sh.minCash || 1);
  const amounts = sh.rate ? [...new Set([min, min * 2, min * 5, sh.coins].filter(a => a >= min && a <= sh.coins))].sort((a, b) => a - b) : [];
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow px">Jutalombolt</h1>
    </div>
    <section class="wallet"><span class="coinbig px">${sh.coins}</span><span class="muted">érme</span>
      <span class="small muted" style="margin-left:auto;text-align:right">Minden sikeres feladat 2–4 érme.<br>Megtanult versszak +10.</span></section>
    ${pending.map(o => `<section class="voucher">
      <p class="label">Beváltásra vár</p>
      <b class="px">${esc(o.name)}</b>
      <span class="vcode px">${o.code}</span>
      <span class="small muted">Mutasd meg egy felnőttnek, ő váltja be.</span>
    </section>`).join('')}
    ${sh.rate ? `<section class="shopsec">
      <div class="row" style="justify-content:space-between"><h2 class="px">Pénzre váltás</h2><span class="small muted">1 érme = ${sh.rate} Ft</span></div>
      ${sh.coins >= min ? `<div class="chips" id="amt">${amounts.map((a, i) => `<button class="chip" data-a="${a}" aria-pressed="${i === 0}">${a} érme · ${Math.round(a * sh.rate)} Ft</button>`).join('')}</div>
        <button class="btn primary big px" id="cash">Beváltást kérek</button>`
        : `<p class="muted small" style="margin:0">Legalább ${min} érme kell a beváltáshoz. Még ${min - sh.coins}.</p>`}
    </section>` : ''}
    ${sh.items.length ? `<section class="shopsec"><h2 class="px">Jutalmak</h2>
      ${sh.items.map(it => `<div class="item">
        <div class="grow"><b>${esc(it.name)}</b><br><span class="small muted">${it.price} érme</span></div>
        ${sh.coins >= it.price ? `<button class="btn primary" data-buy="${it.id}">Megveszem</button>` : `<span class="small muted">még ${it.price - sh.coins}</span>`}
      </div>`).join('')}
    </section>` : ''}
    ${!sh.rate && !sh.items.length ? `<section class="shopsec"><p class="muted" style="margin:0">A bolt még üres. Kérd meg a tesódat vagy a szüleidet, hogy tegyenek fel jutalmakat. Addig is gyűlnek az érméid.</p></section>` : ''}
    ${history.length ? `<p class="label">Korábbiak</p><div class="slist">${history.map(o => `<div class="srow"><span class="first" style="font-family:var(--ui)">${esc(o.name)}</span><span class="small muted">${fmtDate(o.closed || o.at)}</span><span class="pill ${o.status === 'done' ? 'done' : ''}">${o.status === 'done' ? 'Beváltva' : 'Elutasítva'}</span></div>`).join('')}</div>` : ''}
    <button class="btn ghost" id="admin">Felnőtteknek: bolt beállítása</button>`;
  app.querySelector('#back').onclick = back;
  app.querySelector('#admin').onclick = () => go('shopAdmin');
  let amount = amounts[0];
  app.querySelectorAll('#amt .chip').forEach(b => b.onclick = () => {
    amount = +b.dataset.a;
    app.querySelectorAll('#amt .chip').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  const confirmBtn = (btn, label, act) => {
    if (btn.dataset.sure) { act(); return; }
    btn.dataset.sure = '1'; btn.textContent = label; btn.classList.add('bad');
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.classList.remove('bad'); btn.textContent = btn.id === 'cash' ? 'Beváltást kérek' : 'Megveszem'; } }, 3000);
  };
  app.querySelector('#cash')?.addEventListener('click', e => confirmBtn(e.currentTarget, `Biztos? ${amount} érme`, () => {
    if (SH.cashOut(amount)) { G.sfx('win'); G.confetti(1500); VIEWS.shop(); }
  }));
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => confirmBtn(b, 'Biztos?', () => {
    if (SH.buyItem(b.dataset.buy)) { G.sfx('win'); G.confetti(1500); VIEWS.shop(); }
  }));
};

let adminOk = false;
VIEWS.shopAdmin = () => {
  const head = t => `<div class="top"><button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button><h1 class="t grow px">${t}</h1></div>`;
  if (!adminOk) {
    const first = !SH.hasPin();
    app.innerHTML = head('Bolt beállítása') + `
      <section class="shopsec">
        <p style="margin:0">${first ? 'Adj meg egy 4 jegyű PIN-kódot. Ezzel lehet később jutalmakat felvenni és beváltásokat jóváhagyni. A gyerek ne lássa.' : 'Add meg a PIN-kódot.'}</p>
        <form id="pinf" class="stack">
          <input id="pin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="PIN">
          ${first ? '<input id="pin2" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="PIN még egyszer">' : ''}
          <button class="btn primary big">${first ? 'PIN beállítása' : 'Belépés'}</button>
          <p class="small" id="perr" style="margin:0;color:var(--bad)"></p>
        </form>
      </section>`;
    app.querySelector('#back').onclick = back;
    app.querySelector('#pin').focus();
    app.querySelector('#pinf').onsubmit = async e => {
      e.preventDefault();
      const p = app.querySelector('#pin').value.trim(), err = app.querySelector('#perr');
      if (!/^\d{4,8}$/.test(p)) { err.textContent = 'A PIN 4–8 számjegy legyen.'; return; }
      if (first) {
        if (p !== app.querySelector('#pin2').value.trim()) { err.textContent = 'A két PIN nem egyezik.'; return; }
        await SH.setPin(p); adminOk = true; VIEWS.shopAdmin();
      } else if (await SH.checkPin(p)) { adminOk = true; VIEWS.shopAdmin(); }
      else { err.textContent = 'Hibás PIN.'; app.querySelector('#pin').value = ''; }
    };
    return;
  }
  const sh = SH.shop(), pending = sh.orders.filter(o => o.status === 'pending');
  app.innerHTML = head('Bolt beállítása') + `
    <section class="shopsec">
      <h2 class="px">Beváltásra vár</h2>
      ${pending.length ? pending.map(o => `<div class="item">
        <div class="grow"><b>${esc(o.name)}</b><br><span class="small muted">${o.price} érme · kód: ${o.code} · ${fmtDate(o.at)}</span></div>
        <button class="btn good" data-ok="${o.id}">Kiadva</button><button class="btn" data-no="${o.id}">Elutasít</button>
      </div>`).join('') : '<p class="muted small" style="margin:0">Nincs függő kérés.</p>'}
      <p class="small muted" style="margin:0">Elutasításnál a gyerek visszakapja az érméket.</p>
    </section>
    <section class="shopsec">
      <h2 class="px">Jutalmak</h2>
      ${sh.items.map(it => `<div class="item"><div class="grow"><b>${esc(it.name)}</b><br><span class="small muted">${it.price} érme</span></div><button class="btn ghost" data-del="${it.id}">Törlés</button></div>`).join('') || '<p class="muted small" style="margin:0">Még nincs jutalom.</p>'}
      <form id="addf" class="two">
        <label class="field">Jutalom<input id="iname" placeholder="Mit kap?" maxlength="60"></label>
        <label class="field">Ár (érme)<input id="iprice" type="number" inputmode="numeric" min="1" placeholder="pl. 150"></label>
        <button class="btn primary">Hozzáadás</button>
      </form>
    </section>
    <section class="shopsec">
      <h2 class="px">Pénzre váltás</h2>
      <p class="small muted" style="margin:0">Hány forintot ér 1 érme, és legalább mennyit lehet egyszerre beváltani. 0 Ft = kikapcsolva.</p>
      <form id="ratef" class="two">
        <label class="field">1 érme = ? Ft<input id="rate" type="number" inputmode="decimal" min="0" step="0.5" value="${sh.rate || 0}"></label>
        <label class="field">Minimum (érme)<input id="minc" type="number" inputmode="numeric" min="1" value="${sh.minCash || 50}"></label>
        <button class="btn primary">Mentés</button>
      </form>
    </section>
    <section class="shopsec">
      <h2 class="px">Érmék: ${sh.coins}</h2>
      <p class="small muted" style="margin:0">Kézi javítás, például bónusz jó jegyért.</p>
      <form id="adjf" class="row"><input id="adj" class="grow pin" type="number" inputmode="numeric" placeholder="pl. 20"><button class="btn" data-sign="1">Hozzáad</button><button class="btn" data-sign="-1">Levon</button></form>
    </section>
    <div class="row"><button class="btn ghost" id="newpin">PIN módosítása</button><button class="btn" id="lock">Kilépés</button></div>`;
  app.querySelector('#back').onclick = () => { adminOk = false; back(); };
  app.querySelector('#lock').onclick = () => { adminOk = false; go('shop', {}, false); };
  app.querySelector('#newpin').onclick = () => { SH.shop().pin = ''; S.save(); adminOk = false; VIEWS.shopAdmin(); };
  app.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { SH.settle(b.dataset.ok, true); toast('Beváltva'); VIEWS.shopAdmin(); });
  app.querySelectorAll('[data-no]').forEach(b => b.onclick = () => { SH.settle(b.dataset.no, false); toast('Elutasítva, érmék visszaadva'); VIEWS.shopAdmin(); });
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { SH.removeItem(b.dataset.del); VIEWS.shopAdmin(); });
  app.querySelector('#addf').onsubmit = e => {
    e.preventDefault();
    const n = app.querySelector('#iname').value.trim(), p = parseInt(app.querySelector('#iprice').value, 10);
    if (!n || !(p > 0)) return toast('Adj meg nevet és árat');
    SH.addItem(n, p); toast('Hozzáadva'); VIEWS.shopAdmin();
  };
  app.querySelector('#ratef').onsubmit = e => {
    e.preventDefault();
    const r = Math.max(0, parseFloat(app.querySelector('#rate').value) || 0), m = Math.max(1, parseInt(app.querySelector('#minc').value, 10) || 1);
    SH.setRate(r, m); toast(r ? 'Mentve' : 'Pénzre váltás kikapcsolva');
  };
  let sign = 1;
  app.querySelectorAll('#adjf [data-sign]').forEach(b => b.onclick = () => { sign = +b.dataset.sign; });
  app.querySelector('#adjf').onsubmit = e => {
    e.preventDefault();
    const n = parseInt(app.querySelector('#adj').value, 10);
    if (!(n > 0)) return;
    SH.adjust(sign * n); VIEWS.shopAdmin();
  };
};

VIEWS.badges = () => {
  const L = G.levelInfo();
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow px">Rang és jelvények</h1>
    </div>
    <section class="rankcard">
      <span class="lvbadge px">${L.lvl}</span>
      <div class="grow"><b class="px" style="font-size:1.6rem">${L.name}</b>
        <div class="xpbar"><i style="width:${Math.round(L.frac * 100)}%"></i></div>
        <span class="small muted">${L.cur} / ${L.need} XP a következő rangig</span></div>
    </section>
    <div class="badges">${G.BADGES.map(b => {
      const on = S.state.game.badges.includes(b.id); b = G.badgeInfo(b);
      return `<div class="badge ${on ? 'on' : ''}"><span class="bico px" style="--bc:${b.color}">${b.glyph}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`;
    }).join('')}</div>`;
  app.querySelector('#back').onclick = back;
};

// ---------- Kisállat ----------
const petStage = () => Math.min(3, G.buildProgress(S.state.game.blocks, G.WORLDS.pet).finished);
function petHeroHTML(bp) {
  const p = P.pet();
  return `<div class="hero-vis petvis">
    <canvas id="petcv" class="petcv" aria-label="${esc(P.petName())}, a kisállatod"></canvas>
    <span class="hero-tag px">${esc(P.petName())} · ${['Kölyök', 'Kamasz', 'Felnőtt', 'Legenda'][petStage()]}</span>
    <span class="petmeter" title="Jóllakottság"><i style="width:${Math.round(p.food * 100)}%;background:${p.food < .3 ? 'var(--bad)' : '#FFB547'}"></i></span>
    <div class="pbubble off" id="pbubble"></div>
    ${p.snacks ? `<button class="feedbtn px" id="feed"><img src="img/drumstick.png" alt="">Etetés · ${p.snacks}</button>` : ''}
    ${petStage() < 3 ? `<span class="growtag small">${bp.placed}/${bp.size} csillag a növésig</span>` : ''}
  </div>`;
}
let petApi = null, petVoices = new Map(), bubbleTimer;
async function loadPet(canvas, frame) {
  const mod = await import('./pet3d.js?v=25');
  const p = P.pet();
  const seen = Math.min(p.seen ?? petStage(), petStage());
  const api = await mod.mountPet(canvas, { frame, gender: p.g || 'm', stage: seen, hungry: P.hungry(), onTap: () => petTap() });
  petVoices = new Map();
  cleanups.push(() => { api.dispose(); if (petApi === api) petApi = null; });
  petApi = api;
  return api;
}
function petSay(txt, key, ms = 2600) {
  const b = document.getElementById('pbubble');
  if (b && txt) {
    b.textContent = txt; b.classList.remove('off');
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.add('off'), ms);
  }
  if (!key || !petApi) return;
  const g = P.pet().g || 'm', k = g + '/' + key;
  if (!petVoices.has(k)) petVoices.set(k, fetch(`voice/${g}/${key}.mp3`).then(r => r.arrayBuffer()).then(a => petApi.audio().decodeAudioData(a)));
  petVoices.get(k).then(buf => petApi?.speak(buf)).catch(() => {});
}
function petSayUrl(url) {
  if (!petApi) return;
  if (!petVoices.has(url)) petVoices.set(url, fetch(url).then(r => r.arrayBuffer()).then(a => petApi.audio().decodeAudioData(a)));
  petVoices.get(url).then(buf => petApi?.speak(buf)).catch(() => {});
}
const POKES = [['Hihi, ez csiklandoz!', 'poke1'], ['Tanuljunk még egy versszakot?', 'poke2'], ['Te vagy a legjobb!', 'poke4'], ['Mondd el nekem a verset!', 'poke5'], ['Hajrá, menni fog!', 'go']];
function petTap() {
  if (!petApi) return;
  if (petApi.isAsleep()) return petSay('Zzz… hagyj aludni…', 'sleepy');
  petApi.poke(); G.sfx('good');
  if (P.hungry()) return petSay('Éhes vagyok… tanuljunk egy kicsit?', 'hungry');
  const [t, k] = POKES[Math.floor(Math.random() * POKES.length)]; petSay(t, k);
}
function petFeed(after) {
  if (!petApi) return;
  if (!P.pet().snacks) return petSay('Nincs több falat. Egy feladat, és kapok?', 'nosnack', 3000);
  if (P.pet().food >= 1) return petSay('Tele vagyok, köszi!', 'full');
  if (!P.feedOne()) return;
  petSay('Nyami!', 'yum');
  petApi.eat(() => { petApi?.setMood(P.hungry()); petSay('Mmm, finom! Köszi!', 'thanks'); after?.(); });
}
let greeted = false;
async function mountHeroPet() {
  const cv = app.querySelector('#petcv'); if (!cv) return;
  try { await loadPet(cv, 'card'); } catch (e) { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'muted small', textContent: 'A kisállat betöltéséhez internet kell.' })); return; }
  const p = P.pet();
  app.querySelector('#feed')?.addEventListener('click', () => petFeed(() => VIEWS.home()));
  // ha tanulás közben megnőtt, most látványosan megmutatja
  if ((p.seen ?? 0) < petStage()) {
    p.seen = petStage(); S.save();
    setTimeout(() => { petApi?.setStage(p.seen, true); G.sfx('level'); petSay('Ügyes voltál! Nézd, megnőttem!', 'proud', 3200); }, 600);
    greeted = true; return;
  }
  p.seen = petStage(); S.save();
  setTimeout(() => {
    if (p.snacks) petSay(`${p.snacks} falatot kaptál! Adsz nekem?`, 'snack', 3200);
    else if (P.hungry()) petSay('Éhes vagyok… tanuljunk egy kicsit?', 'hungry', 3200);
    else if (!greeted) petSay('De jó, hogy itt vagy!', 'welcome');
    greeted = true;
  }, 700);
}

VIEWS.petpick = () => {
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button><h1 class="t grow px">Kit nevelsz?</h1></div>
    <p class="muted" style="margin:0">A tanulás eteti és növeszti. Ha pár napig nem tanulsz, éhes és szomorú lesz.</p>
    <div class="gpick">
      <button class="gcard" data-g="m"><img src="img/pet-m.webp" alt=""><b class="px">Rókus</b><span>fiú róka</span></button>
      <button class="gcard" data-g="f"><img src="img/pet-f.webp" alt=""><b class="px">Roxi</b><span>lány róka</span></button>
    </div>`;
  app.querySelector('#back').onclick = () => go('home', {}, false);
  app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { P.setGender(b.dataset.g); P.giveSnacks(P.pet().snacks ? 0 : 1); G.sfx('win'); go('home', {}, false); });
};

VIEWS.pet = () => {
  const p = P.pet();
  app.innerHTML = `
    <div class="petfull">
      <canvas id="petcv" class="petcv full"></canvas>
      <div class="pethud">
        <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
        <b class="px grow" style="font-size:1.6rem">${esc(P.petName())}</b>
        <span class="petmeter big" title="Jóllakottság"><i style="width:${Math.round(p.food * 100)}%;background:${p.food < .3 ? 'var(--bad)' : '#FFB547'}"></i></span>
      </div>
      <div class="pbubble off" id="pbubble"></div>
      <div class="petdock">
        <button class="btn go px" id="talk">Beszélj hozzá</button>
        <div class="row">
          <button class="btn grow" id="feed"><img src="img/drumstick.png" alt="" width="24">Etetés · <span id="sn">${p.snacks}</span></button>
          <button class="btn grow" id="sleep"><img src="img/zzz.png" alt="" width="24">Alvás</button>
          <button class="btn grow" id="poem"><img src="img/sparkles.png" alt="" width="24">Vers</button>
        </div>
        <button class="btn ghost small" id="swap">Fiú / lány csere</button>
      </div>
    </div>`;
  let listening = false, stream, micAn, recorder, chunks = [], speaking = false, quietSince = 0, replaying = false, vadTimer;
  const talkBtn = app.querySelector('#talk');
  const stopMic = () => { listening = false; clearInterval(vadTimer); stream?.getTracks().forEach(t => t.stop()); stream = null; talkBtn.classList.remove('on'); talkBtn.textContent = 'Beszélj hozzá'; };
  cleanups.push(stopMic);
  const tb = new Float32Array(1024);
  const lvl = an => { an.getFloatTimeDomainData(tb); let s = 0; for (const v of tb) s += v * v; return Math.sqrt(s / tb.length); };
  talkBtn.onclick = async () => {
    if (!petApi) return;
    if (listening) return stopMic();
    if (petApi.isAsleep()) return petSay('Zzz… hagyj aludni…', 'sleepy');
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { return petSay('Engedélyezd a mikrofont, hogy halljalak!', 'mic', 3000); }
    const a = petApi.audio(); micAn = a.createAnalyser(); micAn.fftSize = 1024; a.createMediaStreamSource(stream).connect(micAn);
    listening = true; talkBtn.classList.add('on'); talkBtn.textContent = 'Hallgatlak…';
    petSay('Mondj valamit, visszamondom!', 'listen', 2500);
    // ha beszélsz, felveszi; ha elhallgatsz, vékony, vicces hangon visszamondja
    vadTimer = setInterval(() => {
      if (!listening || replaying) return;
      const l = lvl(micAn), now = performance.now();
      if (!speaking && l > .035) {
        speaking = true; quietSince = 0; chunks = [];
        recorder = new MediaRecorder(stream); recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
          if (!chunks.length) return; replaying = true;
          try { const b = await petApi.audio().decodeAudioData(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer()); await petApi.speak(b, 1.6); } catch (e) {}
          replaying = false;
        };
        recorder.start();
      } else if (speaking) {
        if (l < .02) { quietSince ||= now; if (now - quietSince > 700) { speaking = false; recorder.stop(); } } else quietSince = 0;
      }
    }, 50);
  };
  app.querySelector('#back').onclick = back;
  app.querySelector('#feed').onclick = () => petFeed(() => { app.querySelector('#sn').textContent = P.pet().snacks; });
  app.querySelector('#sleep').onclick = e => {
    if (!petApi) return;
    const on = !petApi.isAsleep(); petApi.setSleep(on); e.currentTarget.classList.toggle('on', on);
    if (on) { stopMic(); petSay('Jó éjt!', 'night'); } else { petSay('Jó reggelt! Tanulunk?', 'morning'); petApi.jump(); petApi.happy(); }
  };
  app.querySelector('#poem').onclick = async () => {
    if (!petApi || petApi.isAsleep()) return petSay('Zzz… hagyj aludni…', 'sleepy');
    const poem = S.getPoem(S.state.lastPoem) || S.state.poems[0];
    const first = parseStanzas(poem.text)[0], voice = (P.pet().g === 'f') ? 'noemi' : 'tamas';
    const clip = stanzaAudio(first, voice);
    if (!clip) return petSay('Ezt a verset még nem tudom felolvasni.');
    petSay(first[0] + ' …', null, 4200);
    try { const buf = await petApi.audio().decodeAudioData(await (await fetch(clip.url)).arrayBuffer()); await petApi.speak(buf, 1.05); } catch (e) {}
  };
  app.querySelector('#swap').onclick = () => { P.setGender(P.pet().g === 'f' ? 'm' : 'f'); petVoices = new Map(); petApi?.setGender(P.pet().g); VIEWS.pet(); };
  loadPet(app.querySelector('#petcv'), 'full').then(() => {
    setTimeout(() => P.hungry() ? petSay('Éhes vagyok… tanuljunk egy kicsit?', 'hungry') : petSay('Koppints rám, vagy beszélj hozzám!', null, 3000), 500);
  }).catch(() => petSay('A kisállat betöltéséhez internet kell.'));
};

function worldPickerHTML() {
  return `<section class="picker">
    <p class="label">Válassz világot!</p>
    <p class="small muted" style="margin:0">A csillagaidért ebben a világban kapsz jutalmat. Később is átválthatsz.</p>
    <div class="worlds">${Object.entries(G.WORLDS).map(([k, w]) => `
      <button class="world" data-pick="${k}"><canvas data-world="${k}"></canvas><b class="px">${w.name}</b><span>${w.desc}</span></button>`).join('')}
    </div></section>`;
}
function setWorld(k) {
  S.state.settings.world = k; S.save();
  document.documentElement.dataset.world = k;
}

// kombó: egymás utáni jó válaszok; 3-tól felvillan
let streakRun = 0;
function combo(kind) {
  if (kind === 'bad') { streakRun = 0; MM.popMeme('bad'); return; }
  if (kind !== 'good' && kind !== 'block') return;
  streakRun++;
  if (streakRun < 3) return;
  if (streakRun === 3 || streakRun % 5 === 0) MM.popMeme('good');
  document.querySelector('.hype')?.remove();
  const t = document.createElement('div');
  t.className = 'hype good'; t.textContent = `Kombó ×${streakRun}`;
  t.style.setProperty('--r', '-4deg');
  document.body.appendChild(t); setTimeout(() => t.remove(), 900);
}

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
      <h2>Mára minden megvan.</h2>
      <p>Holnap jön a következő ismétlés. Addig gyakorolhatsz szabadon, vagy dönts rekordot a speedrunban.</p>
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
      <div class="sheet"><div class="poem">${stz.map((lines, i) => { const rg = rhymeGroups(lines); return `<p class="stanza">${lines.map((l, li) => `<span class="ln">${li === 0 && n > 1 ? `<span class="snum">${i + 1}.</span>` : ''}${rhymeLine(l, rg[li])}</span>`).join('')}</p>`; }).join('')}</div></div>
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
  // a róka tanulótárs minden világban ott van (a beállításokban kikapcsolható)
  const withPet = S.state.settings.buddy !== false;
  if (withPet && !P.pet().g) P.setGender('m');
  app.innerHTML = `
    <div class="exbar">
      <button class="icon-btn" id="close" aria-label="Kilépés">${I.close}</button>
      <div class="progress" role="progressbar" aria-label="Haladás"><i style="width:0"></i></div>
    </div>
    <div class="extitle ${withPet ? 'withpet' : ''}"><h2>${ex.name}</h2><p>${esc(stanzaLabel(task.stanzas, stz.length))} · ${esc(poem.title)}</p>
      ${withPet ? '<canvas id="petcv" class="minipet" aria-label="A kisállatod figyel"></canvas><div class="pbubble mini off" id="pbubble"></div><div class="thought off" id="thought" aria-live="polite"></div>' : ''}</div>
    <div id="exbody"></div>
    <div class="dock" id="exdock"></div>`;
  app.querySelector('#close').onclick = back;
  // a róka tanulótárs: felolvas, figyel, reagál
  const pal = withPet ? {
    name: P.petName(),
    attach: el => petApi?.attach(el),
    react: k => petApi?.react(k),
    listen: on => petApi?.setListening(on),
    say: (key, txt = '') => petSay(txt, key, 1800),
    audio: () => petApi?.audio(),
    pulse: () => petApi?.pulse(),
    mouth: an => petApi?.mouth(an),
    // gondolatbuborék: a sor képei (kettős kódolás)
    think: line => {
      const t = app.querySelector('#thought'); if (!t) return;
      const sc = line && lineScene(line), pics = line ? lineImages(line) : [];
      if (!sc && !pics.length) { t.classList.add('off'); return; }
      t.classList.toggle('scene', !!sc);
      t.innerHTML = sc ? esc(sc.t) : pics.map(p => `<span>${p}</span>`).join('');
      t.classList.remove('off'); t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
      if (sc) petSayUrl(`voice/scenes/${P.pet().g || 'm'}/${sc.h}.mp3`);
      clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('off'), sc ? 7000 : 4000);
    }
  } : null;
  if (withPet) loadPet(app.querySelector('#petcv'), 'mini').catch(() => app.querySelector('#petcv')?.remove());
  let badSaid = 0;
  const bar = app.querySelector('.progress i');
  let finished = false;
  streakRun = 0;
  const ui = {
    body: app.querySelector('#exbody'), dock: app.querySelector('#exdock'),
    progress: f => { bar.style.width = Math.round(f * 100) + '%'; },
    cleanup: f => cleanups.push(f),
    toast,
    sfx: kind => {
      G.sfx(kind); combo(kind);
      if (!pal) return;
      pal.react(kind);
      if (kind === 'bad' && Date.now() - badSaid > 8000) { badSaid = Date.now(); pal.say('oops', 'Hoppá, semmi baj!'); }
      if (kind === 'good' && streakRun === 3) pal.say('combo', 'Hű, egymás után mind jó!');
    },
    pet: pal,
    // egyszeri tipp
    tip: (id, msg) => { const seen = S.state.settings.tips || (S.state.settings.tips = {}); if (seen[id]) return; seen[id] = 1; S.save(); toast(msg); },
    finish: (score, raw) => {
      if (finished) return; finished = true;
      const r = S.applyResult(poem, task, score);
      const rw = G.reward({ task, score, raw, poem, ...r });
      rw.packs = (rw.missionDone ? 1 : 0) + (r.mastered ? 1 : 0) + (r.wholeDone ? 3 : 0);
      rw.snacks = (r.pass && task.type !== 'listen' ? 1 : 0) + (rw.missionDone ? 1 : 0) + (r.mastered ? 1 : 0);
      if (S.state.settings.world === 'pet') P.giveSnacks(rw.snacks); else rw.snacks = 0;
      CD.givePacks(rw.packs);
      go('result', { id, task, score, raw, pass: r.pass, rw, wholeDone: r.wholeDone, mastered: r.mastered }, false);
    }
  };
  const ctx = ctxFor(poem);
  if (withPet) ctx.voice = P.pet().g === 'f' ? 'noemi' : 'tamas';
  run(task.type, ui, set, ctx);
};

VIEWS.result = ({ id, task, score, raw, pass, rw, wholeDone, mastered }) => {
  const poem = S.getPoem(id); if (!poem) return go('home', {}, false);
  const stars = rw ? rw.stars : G.starsFor(score, raw);
  const blitz = task.type === 'blitz';
  const head = blitz ? `${raw} pont` : wholeDone ? 'Megvan az egész vers' : ['Még egyszer', 'Majdnem', 'Szép', 'Tökéletes'][stars];
  let msg;
  if (blitz) msg = raw >= (poem.best || 0) && raw > 0 ? 'Új rekord!' : `A rekordod: ${poem.best || 0} pont.`;
  else if (wholeDone) msg = 'Az egész verset tudod fejből.';
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
      <img class="memebig" id="meme" alt="" hidden>
      <h2>${head}</h2>
      <p>${blitz ? '' : `<b>${Math.round(score * 100)}%</b> · `}${msg}</p>
      ${rw ? `<div class="loot">
        <span class="px">+${rw.xp} XP</span>
        ${rw.blocks ? `<span class="px">+${rw.blocks} ${G.world().unit}</span>` : ''}
        ${rw.coins ? `<span class="px coin">+${rw.coins} érme</span>` : ''}
        ${rw.snacks ? `<span class="px snack">+${rw.snacks} falat</span>` : ''}
      </div>` : ''}
    </div>
    ${rw?.levelUp ? `<div class="levelup"><span class="lvbadge px">${rw.levelUp.lvl}</span><div><b class="px">Új rang: ${rw.levelUp.name}</b><br><span>${rw.levelUp.lvl}. szint</span></div></div>` : ''}
    ${rw?.missionDone ? `<div class="levelup chestwin"><span class="ico-round" aria-hidden="true">${I.gift}</span><div><b class="px">Napi küldetés kész</b><br><span>Láda: +30 XP</span></div></div>`
      : rw ? `<div class="note small">Napi küldetés: ${m.done}/${G.MISSION_SIZE}${m.claimed ? ' (kész)' : ''}</div>` : ''}
    ${(rw?.newCars || []).map(c => `<div class="newcar"><p class="label">Új autó feloldva</p><div class="carstage"><img src="${c.img}" alt="${esc(c.name)}"></div><b class="px">${esc(c.name)}</b><button class="btn primary px" data-drive="${c.id}">Beülök</button></div>`).join('')}
    ${rw?.packs ? `<button class="packbanner" id="openpack"><span class="minipack" aria-hidden="true"></span><span class="grow"><b class="px">+${rw.packs} kártyacsomag</b><br><span class="small">Koppints és bontsd ki</span></span><span class="px">Bontás</span></button>` : ''}
    ${rw?.buildDone ? `<div class="levelup"><span class="lvbadge px">✓</span><div><b class="px">${esc(G.world().done(rw.buildDone))}</b><br><span>${G.world().next}</span></div></div>` : ''}
    ${(rw?.earned || []).map(b => `<div class="levelup"><span class="bico px" style="--bc:${b.color}">${b.glyph}</span><div><b class="px">Új jelvény: ${esc(b.name)}</b><br><span>${esc(b.desc)}</span></div></div>`).join('')}
    ${rw?.blocks && S.state.settings.world ? `<section class="buildcard"><p class="label">${esc(G.world().label(bp.stage))} · ${bp.placed} / ${bp.size} ${G.world().unit}</p><canvas id="build"></canvas></section>` : ''}
    <div class="stack">
      ${!blitz && task.kind !== 'free' && next ? `<button class="btn big primary wide px" id="next">Tovább: ${esc(EXERCISES[next.type].name)}</button>` : ''}
      <button class="btn big wide px ${blitz || task.kind === 'free' || !next ? 'primary' : ''}" id="again">Még egyszer</button>
      <button class="btn big wide ghost" id="done">Vissza a vershez</button>
    </div>`;
  requestAnimationFrame(() => {
    const c = app.querySelector('#build');
    if (c) G.drawProgress(c, bp, Math.min(rw.blocks, bp.placed));
  });
  app.querySelectorAll('[data-drive]').forEach(b => b.onclick = () => { S.state.game.car = b.dataset.drive; S.save(); G.sfx('win'); toast('Kiválasztva'); b.disabled = true; });
  if (wholeDone || rw?.levelUp || rw?.missionDone || rw?.newCars?.length) { G.sfx(rw?.levelUp ? 'level' : 'win'); G.confetti(); }
  else if (stars >= 2) G.sfx('win');
  const memeKind = stars >= 3 || wholeDone || (blitz && raw >= (poem.best || 0) && raw > 0) ? 'good' : stars <= 1 ? 'bad' : null;
  if (memeKind && MM.memesOn()) MM.pick(memeKind).then(src => { const im = app.querySelector('#meme'); if (im) { im.src = src; im.hidden = false; } });
  app.querySelector('#openpack')?.addEventListener('click', () => go('pack'));
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

VIEWS.garage = () => {
  const n = G.carsUnlocked(), cur = G.activeCar();
  app.innerHTML = `
    <div class="top">
      <button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button>
      <h1 class="t grow px">Garázs</h1><span class="px muted">${n} / ${G.CARS.length}</span>
    </div>
    <p class="muted small" style="margin:0">Minden megnyert futam után új autó jár. Koppints arra, amelyikkel versenyezni akarsz.</p>
    <div class="garage">${G.CARS.map((c, i) => {
      const locked = i >= n;
      return `<button class="gcar ${c.id === cur.id ? 'sel' : ''}" data-id="${c.id}" ${locked ? 'disabled' : ''}>
        <div class="carstage ${locked ? 'locked' : ''}"><img src="${c.img}" alt="${locked ? '' : esc(c.name)}" loading="lazy"></div>
        <b class="px">${locked ? '???' : esc(c.name)}</b>
        <span>${locked ? `${i}. futam után` : c.id === cur.id ? 'Ezzel mész' : `${c.hp} LE · ${c.top} km/h`}</span>
      </button>`;
    }).join('')}</div>`;
  app.querySelector('#back').onclick = back;
  app.querySelectorAll('.gcar:not([disabled])').forEach(b => b.onclick = () => { S.state.game.car = b.dataset.id; S.save(); G.sfx('block'); VIEWS.garage(); });
};

VIEWS.credits = () => {
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back" aria-label="Vissza">${I.back}</button><h1 class="t grow px">Fotók forrása</h1></div>
    <p class="muted small" style="margin:0">Az autófotók a Wikimedia Commonsról származnak, szabad licenccel. A háttér ki lett vágva, a módosított képek ugyanazon licenc alatt használhatók. A kártyák adatai kerekített gyári adatok.</p>
    <div class="slist">${CD.CARDS.map(c => `<div class="srow"><span class="first" style="font-family:var(--ui)"><b>${esc(c.name)}</b><br><span class="small muted">${esc(c.by)} · <a href="${c.src}" target="_blank" rel="noopener">${c.lic}</a></span></span></div>`).join('')}</div>`;
  app.querySelector('#back').onclick = back;
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
    <p class="label">Világ</p>
    <div class="chips" id="world">${Object.entries(G.WORLDS).map(([k, w]) => `<button class="chip" data-v="${k}" aria-pressed="${(set.world || 'build') === k}">${w.name}</button>`).join('')}</div>
    <p class="label">Róka a feladatoknál</p>
    <div class="chips" id="buddy"><button class="chip" data-v="1" aria-pressed="${set.buddy !== false}">Be</button><button class="chip" data-v="0" aria-pressed="${set.buddy === false}">Ki</button></div>
    <p class="muted small" style="margin:0">A róka felolvas, figyel, amikor elmondod neki a sort, és reagál a válaszaidra.</p>
    <p class="label">Vers háttere</p>
    <div class="chips" id="paper"><button class="chip" data-v="0" aria-pressed="${!set.paper}">Sötét</button><button class="chip" data-v="1" aria-pressed="${!!set.paper}">Papír (legjobban olvasható)</button></div>
    <p class="muted small" style="margin:0">A rímelő sorvégek színesek és aláhúzottak, az éppen olvasott sor zöld: ez segít megjegyezni.</p>
    <p class="label">Mém reakciók</p>
    <div class="chips" id="memeOn"><button class="chip" data-v="1" aria-pressed="${MM.memesOn()}">Be</button><button class="chip" data-v="0" aria-pressed="${!MM.memesOn()}">Ki</button></div>
    ${MM.memesOn() ? `<p class="muted small" style="margin:0">Saját mémeket is feltölthetsz. Csak ezen a telefonon tárolódnak. Ha nincs feltöltve semmi, a beépített cicák jönnek.</p>
    ${[['good', 'Ha jól megy'], ['bad', 'Ha rosszul megy']].map(([k, l]) => `<div class="memeset"><b>${l}</b>
      <div class="memegrid" id="mg-${k}"></div>
      <label class="btn small" for="mf-${k}">+ Kép hozzáadása</label><input type="file" id="mf-${k}" accept="image/*" multiple hidden></div>`).join('')}` : ''}
    <p class="label">Hangeffektek</p>
    <div class="chips" id="sound"><button class="chip" data-v="1" aria-pressed="${set.sound !== false}">Be</button><button class="chip" data-v="0" aria-pressed="${set.sound === false}">Ki</button></div>
    <p class="label">Felolvasó hang</p>
    <div class="chips" id="voice">${Object.entries(voices).map(([k, l]) => `<button class="chip" data-v="${k}" aria-pressed="${cur === k}">${esc(l)}</button>`).join('')}</div>
    <button class="btn wide" id="try">Meghallgatom</button>
    <p class="muted small" style="margin:0">A beépített versekhez előre elkészített, természetes magyar felolvasás tartozik. Saját versnél a telefon saját felolvasója szól${canSpeak() ? '' : ', de ezen a készüléken nem találtam magyar hangot'}.</p>
    <p class="label">Autófotók</p>
    <button class="btn wide" id="credits">Fotók forrása és licence</button>
    <p class="label">Adatok</p>
    <p class="muted small" style="margin:0">A versek és a haladás csak ezen a telefonon, ebben a böngészőben tárolódnak. Nem kell hozzá fiók.</p>`;
  app.querySelector('#back').onclick = back;
  app.querySelectorAll('#size .chip').forEach(b => b.onclick = () => { S.setSize(+b.dataset.v); VIEWS.settings(); });
  app.querySelectorAll('#world .chip').forEach(b => b.onclick = () => { setWorld(b.dataset.v); VIEWS.settings(); });
  app.querySelector('#credits').onclick = () => go('credits');
  app.querySelectorAll('#buddy .chip').forEach(b => b.onclick = () => { set.buddy = b.dataset.v === '1'; S.save(); VIEWS.settings(); });
  app.querySelectorAll('#paper .chip').forEach(b => b.onclick = () => { set.paper = b.dataset.v === '1'; S.save(); document.documentElement.dataset.paper = set.paper ? '1' : '0'; VIEWS.settings(); });
  app.querySelectorAll('#memeOn .chip').forEach(b => b.onclick = () => { MM.setMemes(b.dataset.v === '1'); VIEWS.settings(); });
  const fillMemes = async () => {
    const all = await MM.listMemes();
    for (const k of ['good', 'bad']) {
      const box = app.querySelector('#mg-' + k); if (!box) continue;
      const mine = all.filter(m => m.kind === k);
      box.innerHTML = mine.length ? '' : '<span class="small muted">Még nincs saját kép.</span>';
      mine.forEach(m => {
        const w = document.createElement('div'); w.className = 'mthumb';
        const im = document.createElement('img'); im.src = URL.createObjectURL(m.blob); im.alt = '';
        const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', 'Törlés');
        x.onclick = async () => { await MM.removeMeme(m.id); fillMemes(); };
        w.append(im, x); box.appendChild(w);
      });
    }
  };
  fillMemes();
  ['good', 'bad'].forEach(k => app.querySelector('#mf-' + k)?.addEventListener('change', async e => {
    for (const f of e.target.files) { try { await MM.addMeme(k, f); } catch (err) { toast('Ezt a képet nem sikerült betölteni.'); } }
    e.target.value = ''; fillMemes(); toast('Hozzáadva');
  }));
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
if (S.state.settings.world === 'build') { S.state.settings.world = 'car'; S.save(); } // az Építő világ megszűnt
if (S.state.settings.world) document.documentElement.dataset.world = S.state.settings.world;
document.documentElement.dataset.paper = S.state.settings.paper ? '1' : '0';
S.save();
loadAudioIndex();
loadScenes();
go('home', {}, false);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
