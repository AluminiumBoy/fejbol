// Szómagyarázat: nehéz vagy régies szavak gyerekbarát magyarázata, és versszakonként "Miről szól?"
let data = null;
export async function loadGloss() {
  if (!data) { try { data = await (await fetch('voice/gloss/index.json')).json(); } catch (e) { data = { words: {}, stanzas: [] }; } }
  return data;
}
export const glossOf = w => data?.words?.[String(w).toLowerCase()] || null; // { h, t }
export const hasGloss = w => !!glossOf(w);
export const stanzaAbout = i => data?.stanzas?.[i] || null;
