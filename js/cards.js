// Gyűjtőkártyák: 30 valódi autó fotóval (Wikimedia Commons, szabad licenc) és gyári adatokkal.
// Csomag jár a napi küldetésért, versszakért, egész versért.
import { state, save } from './store.js?v=41';

export const RARITY = {
  common: { name: 'Sima', weight: 55, xpDup: 10 },
  rare: { name: 'Ritka', weight: 28, xpDup: 20 },
  epic: { name: 'Epikus', weight: 13, xpDup: 40 },
  legend: { name: 'Legendás', weight: 4, xpDup: 80 }
};
const RORDER = ['common', 'rare', 'epic', 'legend'];

// hp: lóerő (LE), acc: 0-100 km/h másodpercben, top: végsebesség km/h (kerekített gyári adatok)
// face: merre néz az autó eleje a fotón (L balra, R jobbra)
export const CARDS = [
  { id: 'c1', no: 1, name: "Volkswagen Golf GTI", r: 'common', hp: 245, acc: 6.3, top: 250, face: 'L', by: "Damian B Oh", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_GTI_Mk8_Dolphin_Gray_Metallic_(2).jpg" },
  { id: 'c2', no: 2, name: "Honda Civic Type R", r: 'common', hp: 329, acc: 5.4, top: 275, face: 'R', by: "Dinkun Chen", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:HONDA_CIVIC_TYPE_R_FL5_China_(5).jpg" },
  { id: 'c3', no: 3, name: "Toyota GR Yaris", r: 'common', hp: 261, acc: 5.5, top: 230, face: 'R', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Toyota_GR_Yaris_RZ_1X7A0252.jpg" },
  { id: 'c4', no: 4, name: "Ford Fiesta ST", r: 'common', hp: 200, acc: 6.5, top: 232, face: 'R', by: "Vauxford", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2018_Ford_Fiesta_ST-2_Turbo_1.5.jpg" },
  { id: 'c5', no: 5, name: "Mini John Cooper Works", r: 'common', hp: 231, acc: 6.1, top: 246, face: 'R', by: "Nikolai Bulykin", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B,_Mini_John_Cooper_Works_F56_%D0%BD%D0%B0_%D0%90%D1%83%D1%8D%D0%B7%D0%BE%D0%B2%D0%B0-%D0%A2%D0%B8%D0%BC%D0%B8%D1%80%D1%8F%D0%B7%D0%B5%D0%B2%D0%B0.jpg" },
  { id: 'c6', no: 6, name: "Hyundai i30 N", r: 'common', hp: 275, acc: 6.1, top: 250, face: 'L', by: "Vauxford", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2018_Hyundai_i30_N_Performance_T-GDi_2.0.jpg" },
  { id: 'c7', no: 7, name: "Suzuki Swift Sport", r: 'common', hp: 140, acc: 8.1, top: 210, face: 'L', by: "Vauxford", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2018_Suzuki_Swift_Sport_Boosterjet_1.4.jpg" },
  { id: 'c8', no: 8, name: "Škoda Octavia RS", r: 'common', hp: 245, acc: 6.7, top: 250, face: 'L', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Skoda_Octavia_IV_Combi_RS_IMG_3534.jpg" },
  { id: 'c9', no: 9, name: "Mazda MX-5", r: 'common', hp: 160, acc: 7.3, top: 214, face: 'L', by: "EurovisionNim", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2015_Mazda_MX-5_(ND)_Roadster_GT_convertible_(2018-10-30)_01.jpg" },
  { id: 'c10', no: 10, name: "Renault Clio RS 200", r: 'common', hp: 200, acc: 6.9, top: 225, face: 'R', by: "Jeremy from Sydney, Australia", lic: 'CC BY 2.0', src: "https://commons.wikimedia.org/wiki/File:2012_Renault_Sport_Clio_(X85_MY12)_200_Cup_3-door_hatchback_(28682464861).jpg" },
  { id: 'c11', no: 11, name: "Abarth 595", r: 'common', hp: 180, acc: 6.7, top: 225, face: 'R', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Fiat_Abarth_595_esseesse_IMG_3014.jpg" },
  { id: 'c12', no: 12, name: "Toyota GR86", r: 'common', hp: 234, acc: 6.3, top: 226, face: 'L', by: "TTTNIS", lic: 'CC0', src: "https://commons.wikimedia.org/wiki/File:Toyota_GR86_SZ.jpg" },
  { id: 'c13', no: 13, name: "Ford Mustang GT", r: 'rare', hp: 450, acc: 4.3, top: 250, face: 'R', by: "Calreyn88", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2018_Ford_Mustang_GT_2.jpg" },
  { id: 'c14', no: 14, name: "BMW M3 Competition", r: 'rare', hp: 510, acc: 3.9, top: 290, face: 'L', by: "Tomtom7777", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:BMW_M3_Competition_G80_LCI_in_La_Jolla,_California_(May_14,_2026).png" },
  { id: 'c15', no: 15, name: "Toyota GR Supra", r: 'rare', hp: 340, acc: 4.3, top: 250, face: 'R', by: "Charles from Port Chester, New York", lic: 'CC BY 2.0', src: "https://commons.wikimedia.org/wiki/File:Toyota_GR_Supra_(2021)_(53686019489).jpg" },
  { id: 'c16', no: 16, name: "Nissan GT-R", r: 'rare', hp: 530, acc: 3.0, top: 315, face: 'R', by: "Dinkun Chen", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:NISSAN_GT-R_(R35,_2011_FACELIFT)_China.jpg" },
  { id: 'c17', no: 17, name: "Audi RS 3", r: 'rare', hp: 400, acc: 3.8, top: 290, face: 'L', by: "Alexander-93", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Audi_RS3_8Y_IMG_8404.jpg" },
  { id: 'c18', no: 18, name: "Mercedes-AMG A 45 S", r: 'rare', hp: 421, acc: 3.9, top: 270, face: 'L', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Mercedes-AMG_A_45_S_4MATIC%2B_(W177)_1X7A0312.jpg" },
  { id: 'c19', no: 19, name: "Chevrolet Corvette C8", r: 'rare', hp: 502, acc: 3.5, top: 312, face: 'L', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg" },
  { id: 'c20', no: 20, name: "Dodge Challenger SRT8", r: 'rare', hp: 492, acc: 4.5, top: 293, face: 'L', by: "Ermell", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Dodge_Challenger_SRT8_(2015)_Hirschaid-20220709-RM-120221.jpg" },
  { id: 'c21', no: 21, name: "Alpine A110", r: 'rare', hp: 252, acc: 4.5, top: 250, face: 'L', by: "Kakoula10", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Alpine_A110_vue_de_profil.jpg" },
  { id: 'c22', no: 22, name: "Lamborghini Huracán Tecnica", r: 'epic', hp: 640, acc: 3.2, top: 325, face: 'L', by: "Alexander-93", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Lamborghini_Hurac%C3%A1n_Tecnica_1X7A7430.jpg" },
  { id: 'c23', no: 23, name: "Ferrari SF90 Stradale", r: 'epic', hp: 1000, acc: 2.5, top: 340, face: 'L', by: "Calreyn88", lic: 'CC BY 4.0', src: "https://commons.wikimedia.org/wiki/File:Ferrari_SF90_Stradale_Mayfair.jpg" },
  { id: 'c24', no: 24, name: "McLaren 720S", r: 'epic', hp: 720, acc: 2.9, top: 341, face: 'L', by: "Matti Blume", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:McLaren_720S,_IAA_2017,_(1Y7A3405).jpg" },
  { id: 'c25', no: 25, name: "Audi R8 V10 performance", r: 'epic', hp: 620, acc: 3.1, top: 331, face: 'L', by: "Damian B Oh", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Audi_R8_V10_Performance_4S_FL_Java_Green_Metallic_(1).jpg" },
  { id: 'c26', no: 26, name: "Porsche Taycan Turbo S", r: 'epic', hp: 761, acc: 2.8, top: 260, face: 'L', by: "Calreyn88", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:2020_Porsche_Taycan_Turbo_S_(21742).jpg" },
  { id: 'c27', no: 27, name: "Mercedes-AMG GT Black Series", r: 'epic', hp: 730, acc: 3.2, top: 325, face: 'R', by: "Alexander-93", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Mercedes-AMG_GT_Black_Series_IMG_0324.jpg" },
  { id: 'c28', no: 28, name: "Bugatti Chiron", r: 'legend', hp: 1500, acc: 2.4, top: 420, face: 'L', by: "Matti Blume", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Bugatti_Chiron_110_Ans,_GIMS_2019,_Le_Grand-Saconnex_(GIMS9979).jpg" },
  { id: 'c29', no: 29, name: "Porsche 911 GT3 RS", r: 'legend', hp: 525, acc: 3.2, top: 296, face: 'L', by: "Alexander Migl", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Porsche_992_GT3_RS_DSC_9055.jpg" },
  { id: 'c30', no: 30, name: "Koenigsegg Agera RS", r: 'legend', hp: 1176, acc: 2.8, top: 447, face: 'R', by: "Calreyn88", lic: 'CC BY-SA 4.0', src: "https://commons.wikimedia.org/wiki/File:Koenigsegg_Agera_RST_2.jpg" }
].map(c => ({ ...c, img: `img/cars/${c.id}.webp` }));
export const cardById = id => CARDS.find(c => c.id === id);

const fmt = n => String(n).replace('.', ',');
export function stats(c) {
  const pct = (v, lo, hi) => Math.round(Math.max(6, Math.min(100, (v - lo) / (hi - lo) * 100)));
  return [
    ['Teljesítmény', `${c.hp} LE`, pct(c.hp, 80, 1500)],
    ['0–100 km/h', `${fmt(c.acc)} s`, pct(9.5 - c.acc, 0, 7.3)],
    ['Végsebesség', `${c.top} km/h`, pct(c.top, 180, 450)]
  ];
}

export function col() {
  state.cards = Object.assign({ owned: {}, packs: 1, opened: 0 }, state.cards || {});
  return state.cards;
}
export const ownedCount = () => Object.keys(col().owned).filter(id => cardById(id)).length;

// csomag: 3 kártya, a harmadik legalább ritka; ha lehet, új lapot ad
function rollRarity(minIdx = 0) {
  const opts = RORDER.slice(minIdx), tot = opts.reduce((a, r) => a + RARITY[r].weight, 0);
  let x = Math.random() * tot;
  for (const r of opts) { x -= RARITY[r].weight; if (x <= 0) return r; }
  return opts[opts.length - 1];
}
export function openPack() {
  const C = col();
  if (C.packs < 1) return null;
  C.packs--; C.opened++;
  const out = [];
  for (let k = 0; k < 3; k++) {
    const r = rollRarity(k === 2 ? 1 : 0);
    const pool = CARDS.filter(c => c.r === r && !out.some(o => o.card.id === c.id));
    const fresh = pool.filter(c => !C.owned[c.id]);
    const from = fresh.length && Math.random() < .75 ? fresh : pool;
    const card = from[Math.floor(Math.random() * from.length)];
    const dup = !!C.owned[card.id];
    C.owned[card.id] = (C.owned[card.id] || 0) + 1;
    out.push({ card, dup });
  }
  const xp = out.filter(o => o.dup).reduce((a, o) => a + RARITY[o.card.r].xpDup, 0);
  state.game.xp += xp;
  save();
  return { cards: out.sort((a, b) => RORDER.indexOf(a.card.r) - RORDER.indexOf(b.card.r)), xp };
}
export function givePacks(n) { if (n > 0) { col().packs += n; save(); } }

// ---------- megjelenítés ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function cardHTML(c, { locked = false, small = false, credit = false } = {}) {
  if (locked) return `<div class="tcard locked ${small ? 'sm' : ''}"><div class="tc-in"><img class="tc-img sil" src="${c.img}" alt="" loading="lazy"><span class="tc-no px">#${c.no}</span></div></div>`;
  return `<div class="tcard r-${c.r} ${small ? 'sm' : ''}" data-card="${c.id}">
    <div class="tc-in">
      <div class="tc-top"><span class="tc-rar px">${RARITY[c.r].name}</span><span class="tc-no px">#${c.no}</span></div>
      <img class="tc-img" src="${c.img}" alt="${esc(c.name)}" loading="lazy" draggable="false">
      <b class="tc-name px">${esc(c.name)}</b>
      ${small ? '' : `<div class="tc-stats">${stats(c).map(([l, v, p]) => `<div><span>${l}</span><i><i style="width:${p}%"></i></i><b>${v}</b></div>`).join('')}</div>`}
      ${credit ? `<span class="tc-credit">Fotó: ${esc(c.by)} · ${c.lic}</span>` : ''}
    </div>
    ${c.r === 'epic' || c.r === 'legend' ? '<div class="tc-holo"></div>' : ''}<div class="tc-glare"></div>
  </div>`;
}
export function paintCards() {}

// hologram: dőlés az ujj / egér helyzete szerint, telefonon a döntés szerint is
export function tilt(el) {
  const set = (x, y) => {
    el.style.setProperty('--rx', ((.5 - y) * 22).toFixed(1) + 'deg');
    el.style.setProperty('--ry', ((x - .5) * 26).toFixed(1) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  };
  const move = e => {
    const r = el.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
    set(Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (p.clientY - r.top) / r.height)));
  };
  const reset = () => set(.5, .5);
  el.addEventListener('pointermove', move); el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('pointerleave', reset);
  const ori = e => { if (e.gamma == null) return; set(.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, .5 + Math.max(-30, Math.min(30, (e.beta || 45) - 45)) / 60); };
  window.addEventListener('deviceorientation', ori);
  reset();
  return () => window.removeEventListener('deviceorientation', ori);
}
