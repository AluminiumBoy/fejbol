// "Tanuljunk együtt": beszélgetős tanulás a nagy rókával.
// 1. Mondd utánam  2. Folytasd (felváltva)  3. Egyedül. A róka felolvas, figyel, ellenőriz, dicsér.
import { parseStanzas, esc, words, matchSpoken, rhymeLine } from './text.js?v=41';
import { lineScene, lineImages } from './imagery.js?v=41';
import { hasGloss } from './gloss.js?v=41';

const LEVELS = { echo: 'Mondd utánam', alt: 'Folytasd', solo: 'Egyedül', fix: 'Gyenge pontok' };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

let lineIdx = null;
async function lineIndex() {
  if (!lineIdx) { try { lineIdx = await (await fetch('audio/lines/index.json')).json(); } catch (e) { lineIdx = { lines: {} }; } }
  return lineIdx;
}

// deps: { root, pet(): petApi, say(txt,key,ms), sayUrl(url), gender, poem, onReward(), toast(msg), cleanup(fn) }
export function mountLesson(deps) {
  const { root, poem } = deps;
  const stanzas = parseStanzas(poem.text);
  const voice = deps.gender === 'f' ? 'noemi' : 'tamas';
  let si = 0, level = 'echo', running = false, runId = 0;
  // irányított mód: az app adja a feladatot ({ stanzas, level, label }), a végén onFinished-del jelez
  let task = null;
  // a gyakorolt sorok helye a versben: [versszak, sor]
  const curRefs = () => task?.lines ? task.lines : (task ? task.stanzas : [si]).flatMap(s => (stanzas[s] || []).map((_, li) => [s, li]));
  const curLines = () => curRefs().map(([s, li]) => stanzas[s]?.[li]).filter(Boolean);
  let stream = null, micAn = null, micCtx = null;
  const bufs = new Map();
  // soronkénti állapot a kijelzéshez: 'show' | 'hide' | 'ok' | 'miss', és az aktuális sor
  let states = [], cur = -1, who = '';

  const pet = () => deps.pet();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function lineBuf(l) {
    if (bufs.has(l)) return bufs.get(l);
    const idx = await lineIndex(), h = idx.lines?.[l];
    if (!h || !pet()) return null;
    const p = fetch(`audio/lines/${voice}/${h}.mp3`).then(r => r.arrayBuffer()).then(a => pet().audio().decodeAudioData(a));
    bufs.set(l, p); return p;
  }
  // a róka felolvas egy sort (ha nincs felvétel, csak kiírja)
  async function foxSays(l) {
    const b = await lineBuf(l).catch(() => null);
    if (b && pet()) await pet().speak(b, 1);
    else await wait(1800);
  }
  // hangminta lejátszása és megvárása
  async function sayKey(key, txt) {
    deps.say(txt, null, 2200);
    const url = `voice/${deps.gender || 'm'}/${key}.mp3`;
    try { const b = await pet().audio().decodeAudioData(await (await fetch(url)).arrayBuffer()); await pet().speak(b); } catch (e) { await wait(900); }
  }

  // ---------- hallgatás: beszédfelismerés, vagy ha az nincs, hangerő alapján ----------
  // mikrofon csak ha a beállításokban kérték (a folyamatos be-kikapcsolás telefonon pittyeg és lehalkítja a hangot)
  const micOn = () => !!deps.useMic;
  async function micReady() {
    if (!micOn()) return true;
    if (SR || stream) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micCtx = pet()?.audio() || new AudioContext();
      micAn = micCtx.createAnalyser(); micAn.fftSize = 1024; micCtx.createMediaStreamSource(stream).connect(micAn);
      return true;
    } catch (e) { return false; }
  }
  const buf = new Float32Array(1024);
  const lvl = () => { micAn.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); };
  function listen(expected, myRun) {
    return new Promise(resolve => {
      if (!micOn()) {
        // mikrofon nélkül: a gyerek elmondja, aztán "Kész" (vagy magától továbblép, ha letelt a sor ideje)
        const est = 1800 + words(expected).length * 550;
        const tm = setTimeout(() => resolve({ spoke: true }), est * 1.6);
        manualDone = () => { clearTimeout(tm); resolve({ spoke: true }); };
        return;
      }
      if (SR) {
        const r = new SR(); r.lang = 'hu-HU'; r.maxAlternatives = 3; r.interimResults = false;
        let best = null, pressed = false;
        r.onresult = e => { for (const alt of e.results[0]) { const m = matchSpoken(expected, alt.transcript); if (!best || m.ratio > best.ratio) best = { ...m, text: alt.transcript }; } };
        // ha a gyerek jelzi, hogy elmondta, de a felismerő nem hallott semmit, elfogadjuk (a róka utána elmondja a helyeset)
        r.onend = () => resolve(best ? { spoke: true, ratio: best.ratio, text: best.text } : { spoke: pressed });
        r.onerror = () => {};
        manualDone = () => { pressed = true; try { r.stop(); } catch (e) {} };
        try { r.start(); } catch (e) { resolve({ spoke: false }); }
        return;
      }
      if (!micAn) { manualDone = () => resolve({ spoke: true }); return; }
      // hangerő-figyelés: megvárja, hogy beszélj, majd hogy elhallgass
      let started = 0, quiet = 0; const t0 = performance.now();
      manualDone = () => { clearInterval(iv); resolve({ spoke: !!started || true }); };
      const iv = setInterval(() => {
        if (myRun !== runId) { clearInterval(iv); resolve({ spoke: false }); return; }
        const l = lvl(), now = performance.now();
        if (!started && l > .035) started = now;
        if (started) { if (l < .02) { quiet ||= now; if (now - quiet > 800 && now - started > 500) { clearInterval(iv); resolve({ spoke: true }); } } else quiet = 0; }
        if (!started && now - t0 > 9000) { clearInterval(iv); resolve({ spoke: false }); }
      }, 50);
    });
  }
  let manualDone = null, manualSkip = false;

  // ---------- menet ----------
  async function run() {
    const my = ++runId; running = true;
    pet()?.setFocus?.(true);
    const lines = curLines(), refs = curRefs();
    const alive = () => my === runId;
    if (micOn() && !(await micReady())) deps.toast('Nincs mikrofon: a "Kész" gombbal jelezd, ha elmondtad.');
    states = lines.map(() => level === 'echo' ? 'show' : 'hide'); cur = -1; draw();
    // melyik sort ki mondja: 'fox' / 'kid'
    let turns;
    if (level === 'echo') turns = lines.flatMap((_, i) => [['fox', i], ['kid', i]]);
    else if (level === 'alt') turns = [...lines.map((_, i) => [i % 2 ? 'kid' : 'fox', i]), ...lines.map((_, i) => [i % 2 ? 'fox' : 'kid', i])];
    else if (level === 'fix') turns = lines.flatMap((_, i) => [['fox', i], ['kid', i, 'echo'], ['kid', i]]);
    else turns = lines.map((_, i) => ['kid', i]);
    await sayKey({ echo: 'repeat', alt: 'continue', solo: 'solo', fix: 'weak' }[level], LEVELS[level] + '!');
    const missed = new Set();
    let good = 0, kidTurns = 0, round2 = level === 'alt' ? lines.length : Infinity;
    for (let n = 0; n < turns.length && alive(); n++) {
      const [w, i, mode] = turns[n], l = lines[i];
      const echoTurn = level === 'echo' || mode === 'echo';
      if (n === round2) { states = lines.map(() => 'hide'); draw(); }
      cur = i; who = w;
      if (w === 'fox') {
        states[i] = 'show'; draw();
        await foxSays(l);
      } else {
        if (!echoTurn || level === 'echo') kidTurns++;
        states[i] = echoTurn ? 'show' : 'hide';
        who = 'kid'; draw();
        pet()?.setListening(true);
        manualSkip = false;
        const res = await listen(l, my);
        pet()?.setListening(false);
        manualDone = null;
        if (!alive()) break;
        let ok = res.spoke && !manualSkip && (res.ratio == null || res.ratio >= .65);
        if (!echoTurn) { deps.onLine?.(refs[i], ok); if (!ok) missed.add(i); }
        if (!echoTurn || manualSkip) {
          // a róka megmutatja és elmondja a helyes sort
          states[i] = ok ? 'ok' : 'miss'; draw();
          if (!ok || res.ratio == null) await foxSays(l);
        } else states[i] = ok ? 'ok' : 'miss';
        draw();
        if (ok) { good++; pet()?.react(res.ratio != null && res.ratio > .9 ? 'great' : 'good'); if (res.ratio != null && Math.random() < .5) await sayKey('yes', 'Igen, ez az!'); }
        else { pet()?.react('bad'); if (res.spoke) await sayKey('tryagain', 'Majdnem! Próbáld újra!'); }
      }
      await wait(250);
    }
    // azonnali javítás: a hibás sorok még egyszer (a róka mondja, te utána, aztán egyedül); nem számít a pontba
    if (alive() && missed.size && level !== 'fix') {
      await sayKey('redo', 'Ezeket vegyük át még egyszer!');
      for (const i of missed) {
        if (!alive()) break;
        cur = i; who = 'fox'; states[i] = 'show'; draw(); await foxSays(lines[i]);
        manualSkip = false; who = 'kid'; draw(); pet()?.setListening(true); await listen(lines[i], my); pet()?.setListening(false);
        if (!alive()) break;
        manualSkip = false; states[i] = 'hide'; who = 'kid'; draw(); pet()?.setListening(true); const r2 = await listen(lines[i], my); pet()?.setListening(false);
        if (!alive()) break;
        const ok2 = r2.spoke && !manualSkip && (r2.ratio == null || r2.ratio >= .65); manualSkip = false;
        states[i] = ok2 ? 'ok' : 'miss'; draw(); deps.onLine?.(refs[i], ok2);
        if (ok2) pet()?.react('good'); else await foxSays(lines[i]);
      }
    }
    if (!alive()) return;
    running = false; cur = -1; pet()?.setFocus?.(false);
    if (task && deps.onFinished) { draw(); deps.onFinished({ score: kidTurns ? good / kidTurns : 1, good, kidTurns }); return; }
    draw();
    if (good >= Math.ceil(kidTurns * .6)) {
      pet()?.react('great'); await sayKey('stanzadone', 'Ügyes! Ez a versszak már megy!');
      deps.onReward?.(level);
      // automatikus továbblépés: következő fokozat, vagy következő versszak
      if (level === 'echo') level = 'alt'; else if (level === 'alt') level = 'solo';
      else if (si < stanzas.length - 1) { si++; level = 'echo'; }
    } else await sayKey('tryagain', 'Majdnem! Próbáld újra!');
    draw();
  }
  function stop() { runId++; running = false; pet()?.setFocus?.(false); try { manualDone?.(); } catch (e) {} pet()?.setListening(false); cur = -1; draw(); }

  // ---------- megjelenítés ----------
  function lineHTML(l, i) {
    const st = states[i] || 'show', active = i === cur;
    const text = st === 'hide' && !(active && who === 'fox') ? words(l).map(w => '<span class="mask">' + '·'.repeat(Math.min(6, w.length)) + '</span>').join(' ') : rhymeLine(l, -1, hasGloss);
    return `<div class="lline ${active ? 'cur ' + who : ''} ${st}">${active && who === 'kid' ? '<span class="turn">Te</span>' : active ? '<span class="turn fox">Róka</span>' : ''}<span class="lt">${text}</span></div>`;
  }
  function draw() {
    const lines = curLines();
    if (!states.length || states.length !== lines.length) states = lines.map(() => 'show');
    root.innerHTML = `
      <div class="lessonbar" ${running || task ? 'hidden' : ''}>
        <div class="chips lchips">${stanzas.map((_, i) => `<button class="chip" data-si="${i}" aria-pressed="${i === si}" ${running ? 'disabled' : ''}>${i + 1}.</button>`).join('')}</div>
        <div class="chips lchips">${Object.entries(LEVELS).map(([k, t]) => `<button class="chip" data-lv="${k}" aria-pressed="${k === level}" ${running ? 'disabled' : ''}>${t}</button>`).join('')}</div>
      </div>
      <div class="lsheet">${lines.map(lineHTML).join('')}</div>
      <div class="row">
        ${running
          ? `${who === 'kid' ? `<button class="btn go px grow" id="ldone">Kész, mondtam</button><button class="btn grow" id="lskip">Nem tudom</button><button class="btn" id="lhint">💭</button>` : `<span class="grow muted small" style="text-align:center">A róka beszél…</span>`}<button class="btn" id="lstop" aria-label="Megállítás">✕</button>`
          : `<button class="btn go px grow" id="lstart">${task ? esc(task.label || LEVELS[level]) : `${LEVELS[level]} · ${si + 1}. versszak`}</button><button class="btn" id="lwhat">Miről szól?</button><button class="btn" id="lexit">Vissza</button>`}
      </div>`;
    root.querySelectorAll('[data-si]').forEach(b => b.onclick = () => { si = +b.dataset.si; states = []; draw(); });
    root.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { level = b.dataset.lv; states = []; draw(); });
    root.querySelector('#lstart')?.addEventListener('click', () => { pet()?.audio(); run(); });
    root.querySelector('#lexit')?.addEventListener('click', () => { stop(); deps.onExit?.(); });
    root.querySelector('#lwhat')?.addEventListener('click', () => deps.about?.(task ? task.stanzas[0] : si));
    root.querySelector('#lstop')?.addEventListener('click', stop);
    root.querySelector('#ldone')?.addEventListener('click', () => manualDone?.());
    root.querySelector('#lskip')?.addEventListener('click', () => { manualSkip = true; manualDone?.(); });
    root.querySelector('#lhint')?.addEventListener('click', () => {
      const l = stanzas[si][cur]; if (!l) return;
      const sc = lineScene(l);
      if (sc) { deps.say(sc.t, null, 6500); deps.sayUrl(`voice/scenes/${deps.gender || 'm'}/${sc.h}.mp3`); }
      else deps.say(lineImages(l).join(' ') || (words(l)[0] + ' …'), null, 4000);
    });
    root.querySelector('.lline.cur')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  deps.cleanup?.(() => { stop(); stream?.getTracks().forEach(t => t.stop()); });
  draw();
  return {
    stop,
    // irányított feladat indítása (autostart: rögtön indul)
    start(t, autostart = true) { stop(); task = t; level = t.level; states = []; draw(); if (autostart) run(); }
  };
}
