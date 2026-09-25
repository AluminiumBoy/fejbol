// Felelés-próba: a róka tanárként összevissza kérdez a versből, a végén jegyet ad.
// Mikrofon nélkül: a gyerek hangosan felel, a róka elmondja a helyeset, a gyerek értékeli magát.
import { parseStanzas, esc, shuffle } from './text.js?v=41';

let lineIdx = null;
async function lineIndex() {
  if (!lineIdx) { try { lineIdx = await (await fetch('audio/lines/index.json')).json(); } catch (e) { lineIdx = { lines: {} }; } }
  return lineIdx;
}
const GRADES = ['', 'Elégtelen', 'Elégséges', 'Közepes', 'Jó', 'Jeles'];

// deps: { root, poem, gender, pet(), say(txt,key,ms), toast, onLine([si,li],ok), onFinished(grade), onExit(), cleanup }
export function mountExam(deps) {
  const { root, poem } = deps;
  const st = parseStanzas(poem.text), voice = deps.gender === 'f' ? 'noemi' : 'tamas';
  const pet = () => deps.pet();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let runId = 0;

  async function sayKey(key, txt) {
    deps.say(txt, null, 2600);
    try { const b = await pet().audio().decodeAudioData(await (await fetch(`voice/${deps.gender || 'm'}/${key}.mp3`)).arrayBuffer()); await pet().speak(b); } catch (e) { await wait(1200); }
  }
  async function readLine(l) {
    const idx = await lineIndex(), h = idx.lines?.[l];
    if (!h || !pet()) return wait(1500);
    try { const b = await pet().audio().decodeAudioData(await (await fetch(`audio/lines/${voice}/${h}.mp3`)).arrayBuffer()); await pet().speak(b); } catch (e) { await wait(1500); }
  }

  // 5 kérdés: kezdés, egy versszak, folytatás, még egy versszak vagy folytatás, szerző és cím
  function questions() {
    const refs = st.flatMap((lines, si) => lines.map((_, li) => [si, li]));
    const conts = shuffle(refs.slice(0, -1)).slice(0, 2);
    const sts = shuffle(st.map((_, i) => i).filter(i => i > 0 || st.length === 1)).slice(0, 2);
    const mid = shuffle([{ k: 'stanza', si: sts[0] ?? 0 }, { k: 'cont', ref: conts[0] }, Math.random() < .5 && sts[1] != null ? { k: 'stanza', si: sts[1] } : { k: 'cont', ref: conts[1] || conts[0] }]);
    return [{ k: 'first' }, ...mid, { k: 'author' }];
  }
  const nextRef = ([si, li]) => li + 1 < st[si].length ? [si, li + 1] : [si + 1, 0];

  function screen(html) {
    root.innerHTML = `<div class="exam"><button class="btn exclose" id="exx" aria-label="Kilépés">✕</button>${html}</div>`;
    root.querySelector('#exx').onclick = exit;
  }
  const waitClick = sel => new Promise(res => root.querySelectorAll(sel).forEach(b => b.onclick = () => res(b.dataset.v)));

  async function run() {
    const my = ++runId, alive = () => my === runId;
    pet()?.setTeacher?.(true); pet()?.setFocus?.(true);
    const qs = questions();
    let points = 0;
    screen(`<p class="exq px">Felelés</p><p class="muted small" style="margin:0">5 kérdés. Mondd hangosan a választ, aztán nyomd meg a gombot.</p>`);
    await sayKey('examstart', 'Felelés következik! Figyelj a kérdésekre.');
    for (let n = 0; n < qs.length && alive(); n++) {
      const q = qs[n];
      let ask, answerLines = [], refs = [];
      if (q.k === 'first') { ask = 'Hogy kezdődik a vers?'; refs = [[0, 0], [0, 1]].filter(([s, l]) => st[s]?.[l]); }
      else if (q.k === 'stanza') { ask = `Mondd el a ${q.si + 1}. versszakot!`; refs = st[q.si].map((_, li) => [q.si, li]); }
      else if (q.k === 'cont') { const nx = nextRef(q.ref); ask = 'Folytasd innen:'; refs = st[nx[0]] ? [nx] : []; }
      else ask = 'Ki írta ezt a verset, és mi a címe?';
      answerLines = refs.map(([s, l]) => st[s][l]);
      const cue = q.k === 'cont' ? st[q.ref[0]][q.ref[1]] : '';
      screen(`<p class="exnum">${n + 1}. kérdés / ${qs.length}</p><p class="exq">${esc(ask)}</p>${cue ? `<p class="excue">„${esc(cue)} …”</p>` : ''}
        <button class="btn go px wide" data-v="done">Elmondtam</button>`);
      await sayKey(q.k === 'first' ? 'q_first' : q.k === 'stanza' ? `q_st${q.si + 1}` : q.k === 'cont' ? 'q_cont' : 'q_author', ask);
      if (cue && alive()) await readLine(cue);
      if (!alive()) return;
      pet()?.setListening(true);
      await waitClick('[data-v]');
      pet()?.setListening(false);
      if (!alive()) return;
      // a helyes válasz: kiírva és felolvasva
      const correct = q.k === 'author' ? [`${poem.author || 'Ismeretlen szerző'}: ${poem.title}`] : answerLines;
      screen(`<p class="exnum">${n + 1}. kérdés / ${qs.length}</p><p class="exq">Így hangzik:</p><div class="exans">${correct.map(l => `<p>${esc(l)}</p>`).join('')}</div>
        <p class="muted small" style="margin:0;text-align:center">Hogy sikerült?</p>
        <div class="row"><button class="btn grow good" data-v="2">Hibátlan</button><button class="btn grow" data-v="1">Kis hiba</button><button class="btn grow bad" data-v="0">Nem ment</button></div>`);
      await sayKey('itwas', 'Így hangzik:');
      for (const l of answerLines) { if (!alive()) return; await readLine(l); }
      const v = +(await waitClick('[data-v]'));
      points += v;
      refs.forEach(r => deps.onLine?.(r, v === 2));
      pet()?.react(v === 2 ? 'good' : v === 0 ? 'bad' : 'good');
    }
    if (!alive()) return;
    const pct = points / (qs.length * 2);
    const grade = pct >= .9 ? 5 : pct >= .7 ? 4 : pct >= .5 ? 3 : pct >= .3 ? 2 : 1;
    screen(`<div class="exgrade"><span class="px g${grade}">${grade}</span><b>${GRADES[grade]}</b><span class="muted small">${points} / ${qs.length * 2} pont</span></div>
      <div class="row"><button class="btn go px grow" data-v="again">Még egy felelés</button><button class="btn" data-v="exit">Vissza</button></div>`);
    pet()?.setTeacher?.(false); pet()?.setFocus?.(false);
    pet()?.react(grade >= 4 ? 'great' : grade <= 2 ? 'bad' : 'good');
    deps.onFinished?.(grade, pct);
    sayKey(`grade${grade}`, ['', 'Ez most nem ment, de semmi baj, holnap újra próbáljuk!', 'Kettes. Gyakoroljunk még együtt!', 'Hármas. Még egy kis gyakorlás, és menni fog!', 'Négyes! Nagyon jó!', 'Ötös! Ez kitűnő felelet volt!'][grade]);
    const v = await waitClick('[data-v]');
    if (v === 'again') run(); else exit();
  }
  function exit() { runId++; pet()?.setTeacher?.(false); pet()?.setFocus?.(false); pet()?.setListening(false); deps.onExit?.(); }
  deps.cleanup?.(() => { runId++; });
  run();
  return { stop: exit };
}
