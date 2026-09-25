// Vers beszerzése: Wikiforrás keresés és fotóból szövegfelismerés
const API = 'https://hu.wikisource.org/w/api.php';

async function api(params) {
  const url = API + '?' + new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' });
  const r = await fetch(url);
  if (!r.ok) throw new Error('A Wikiforrás most nem érhető el.');
  return r.json();
}

export async function searchPoems(q) {
  const d = await api({ action: 'query', list: 'search', srsearch: q, srnamespace: '0', srlimit: '12', srprop: 'snippet' });
  return (d.query?.search || []).map(r => ({
    title: r.title,
    snippet: r.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  }));
}

function cleanWiki(s) {
  return s
    .replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/^[:*#]+/gm, '')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export async function fetchPoem(title) {
  const d = await api({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  if (d.error) throw new Error('Ezt a lapot nem sikerült betölteni.');
  const wt = d.parse.wikitext;
  const author = (wt.match(/\|\s*szerző\s*=\s*([^\n|}]+)/) || [])[1]?.trim() || '';
  const nice = (wt.match(/\|\s*cím\s*=\s*([^\n|}]+)/) || [])[1]?.trim() || d.parse.title;
  const blocks = [...wt.matchAll(/<poem[^>]*>([\s\S]*?)<\/poem>/gi)].map(m => cleanWiki(m[1]));
  let text = blocks.join('\n\n');
  if (!text) {
    // nincs <poem> jelölés: a fejléc sablon utáni szöveg
    text = cleanWiki(wt.replace(/^\{\{fej[\s\S]*?\n\}\}/i, '').replace(/\[\[Kategória:[^\]]*\]\]/g, '').replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/g, ''));
  }
  if (!text) throw new Error('Ezen a lapon nem találtam verset.');
  return { title: cleanWiki(nice), author: cleanWiki(author), text };
}

// ---- fotó → szöveg (Tesseract, magyar nyelv) ----
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tessLoading) tessLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => { tessLoading = null; rej(new Error('Nem sikerült betölteni a szövegfelismerőt. Van internet?')); };
    document.head.appendChild(s);
  });
  return tessLoading;
}

export async function ocrImage(file, onProgress) {
  await loadTesseract();
  const res = await window.Tesseract.recognize(file, 'hun', {
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); }
  });
  return tidyOcr(res.data.text);
}

function tidyOcr(t) {
  return t.replace(/\r/g, '')
    .split('\n').map(l => l.replace(/\s+/g, ' ').replace(/^[|\\/_~•·]+\s*/, '').trim())
    .filter(l => !/^\d{1,3}$/.test(l)) // oldalszámok
    .join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
