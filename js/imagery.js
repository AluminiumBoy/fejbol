// Képes emlékeztető (kettős kódolás): minden sorhoz néhány kép, amit a róka "elképzel".
// A beépített vershez kézzel válogatott képek, más versekhez kulcsszó-szótár.
import { words, norm } from './text.js?v=38';

const CURATED = {
  'Itt van az ősz, itt van ujra,': '🍂🔁',
  'S szép, mint mindig, énnekem.': '😍🙋',
  'Tudja isten, hogy mi okból': '🙏❓',
  'Szeretem? de szeretem.': '❤️❤️',
  'Kiülök a dombtetőre,': '🧍⛰️',
  'Innen nézek szerteszét,': '👀↔️',
  'S hallgatom a fák lehulló': '👂🌳🍁',
  'Levelének lágy neszét.': '🍂🤫',
  'Mosolyogva néz a földre': '😊⬇️🌍',
  'A szelíd nap sugara,': '☀️✨',
  'Mint elalvó gyermekére': '😴👶',
  'Néz a szerető anya.': '👩‍👦❤️',
  'És valóban ősszel a föld': '🍂🌍',
  'Csak elalszik, nem hal meg;': '😴🌱',
  'Szeméből is látszik, hogy csak': '👀💡',
  'Álmos ő, de nem beteg.': '🥱👍',
  'Levetette szép ruháit,': '🌳👗⬇️',
  'Csendesen levetkezett;': '🤫🍂',
  'Majd felöltözik, ha virrad': '👕🌅',
  'Reggele, a kikelet.': '🌸🌱',
  'Aludjál hát, szép természet,': '😴🏞️',
  'Csak aludjál reggelig,': '😴⏰',
  'S álmodj olyakat, amikben': '💭✨',
  'Legnagyobb kedved telik.': '😄🎉',
  'Én ujjam hegyével halkan': '☝️🤫',
  'Lantomat megpenditem,': '🪕🎵',
  'Altató dalod gyanánt zeng': '🎶😴',
  'Méla csendes énekem. –': '🎤🤫',
  'Kedvesem, te űlj le mellém,': '💑🪑',
  'Ülj itt addig szótlanúl,': '🪑🤐',
  'Míg dalom, mint tó fölött a': '🎵🏞️',
  'Suttogó szél, elvonúl.': '🌬️💨',
  'Ha megcsókolsz, ajkaimra': '💋',
  'Ajkadat szép lassan tedd,': '💋🐢',
  'Föl ne keltsük álmából a': '🤫⏰',
  'Szendergő természetet.': '😴🌳'
};

// szótő → kép (ékezet nélkül, a szó elejére illesztve)
const DICT = [
  ['osz', '🍂'], ['tavasz', '🌸'], ['kikelet', '🌸'], ['nyar', '☀️'], ['tel', '❄️'], ['ho', '❄️'], ['nap', '☀️'], ['hold', '🌙'],
  ['csillag', '⭐'], ['eg', '🌌'], ['felho', '☁️'], ['eso', '🌧️'], ['szel', '🌬️'], ['vihar', '⛈️'], ['villam', '⚡'],
  ['fa', '🌳'], ['erdo', '🌲'], ['virag', '🌸'], ['rozsa', '🌹'], ['fu', '🌿'], ['level', '🍃'], ['mezo', '🌾'], ['buza', '🌾'],
  ['madar', '🐦'], ['fecske', '🐦'], ['tyuk', '🐔'], ['kakas', '🐓'], ['kutya', '🐕'], ['macska', '🐈'], ['cica', '🐈'], ['lo', '🐴'],
  ['hal', '🐟'], ['meh', '🐝'], ['lepke', '🦋'], ['viz', '💧'], ['to', '🏞️'], ['folyo', '🏞️'], ['patak', '🏞️'], ['tenger', '🌊'],
  ['hegy', '⛰️'], ['domb', '⛰️'], ['fold', '🌍'], ['alfold', '🌾'], ['haz', '🏠'], ['szoba', '🚪'], ['ablak', '🪟'], ['ajto', '🚪'],
  ['asztal', '🪑'], ['kenyer', '🍞'], ['anya', '👩'], ['apa', '👨'], ['gyermek', '👶'], ['gyerek', '👶'], ['fiu', '👦'], ['lany', '👧'],
  ['csalad', '👨‍👩‍👧'], ['sziv', '❤️'], ['szeret', '❤️'], ['kedves', '💕'], ['sir', '😢'], ['konny', '😢'], ['nevet', '😄'], ['mosoly', '😊'],
  ['alsz', '😴'], ['alud', '😴'], ['alom', '💭'], ['alm', '💭'], ['szem', '👀'], ['nez', '👀'], ['lat', '👀'], ['ful', '👂'], ['hall', '👂'],
  ['kez', '✋'], ['ujj', '☝️'], ['lab', '🦶'], ['szaj', '👄'], ['ajk', '💋'], ['csok', '💋'], ['dal', '🎵'], ['enek', '🎶'], ['zene', '🎵'],
  ['tuz', '🔥'], ['lang', '🔥'], ['arany', '🥇'], ['kiraly', '👑'], ['katona', '💂'], ['harc', '⚔️'], ['kard', '⚔️'], ['zaszlo', '🚩'],
  ['haza', '🏡'], ['nep', '👥'], ['szabad', '🕊️'], ['isten', '🙏'], ['ido', '⏳'], ['reggel', '🌅'], ['virrad', '🌅'], ['este', '🌆'],
  ['ejjel', '🌙'], ['ej', '🌙'], ['ut', '🛤️'], ['kert', '🏡'], ['ko', '🪨'], ['konyv', '📖'], ['ir', '✍️'], ['csend', '🤫'],
  ['halk', '🤫'], ['sotet', '🌑'], ['feny', '💡'], ['meleg', '🔥'], ['hideg', '🥶'], ['uj', '✨'], ['oreg', '👴'], ['beteg', '🤒'],
  ['meg', '🔁'], ['ujra', '🔁'], ['szep', '✨'], ['nagy', '🐘'], ['kicsi', '🐜'], ['sok', '➕'], ['fut', '🏃'], ['megy', '🚶'], ['jon', '🚶']
];

export function lineImages(line) {
  if (CURATED[line.trim()]) return [...new Intl.Segmenter('hu', { granularity: 'grapheme' }).segment(CURATED[line.trim()])].map(s => s.segment);
  const out = [];
  for (const w of words(line)) {
    const n = norm(w);
    if (n.length < 2) continue;
    const hit = DICT.find(([stem]) => n.startsWith(stem) && (stem.length >= 3 || n.length <= stem.length + 3));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
    if (out.length >= 3) break;
  }
  return out;
}

// ---------- vicces mini-jelenetek (bizarr kép + történetmódszer), a róka fel is olvassa ----------
let scenes = null;
export async function loadScenes() {
  if (!scenes) { try { scenes = await (await fetch('voice/scenes/index.json')).json(); } catch (e) { scenes = {}; } }
  return scenes;
}
export const lineScene = line => scenes?.[line?.trim()] || null; // { h, t }
export const hasHint = line => !!(lineScene(line) || lineImages(line).length);
