// One-time sprite downloader: resolves every item/chest image via the OSRS Wiki API
// (same lookup rules as index.html) and saves them locally so the site never calls the Wiki.
// Usage: node tools/fetch-sprites.mjs index.html .   (only needed when a new design adds items)
import fs from 'node:fs';
import path from 'node:path';

const [, , htmlPath, repoRoot] = process.argv;
const API = 'https://oldschool.runescape.wiki/api.php';
const UA = 'fractured-archive-loot-simulator/1.0 (one-time sprite cache; https://github.com/ghoulboards/osrs-fractured-archive-loot-simulator)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pull the item data definitions straight out of the page so nothing drifts.
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const teamDenom');
const end = html.indexOf('const state=');
const { uniques, tertiaries, standard } = new Function(html.slice(start, end) + '; return {uniques,tertiaries,standard};')();
const items = [...uniques, ...tertiaries, ...standard];

function itemImageCandidates(item) {
  const n = item.name || '', c = [];
  if (item.file) c.push(item.file);
  c.push(n + '.png');
  if (n.includes(' (uncharged)')) c.push(n.replace(' (uncharged)', '') + '.png');
  const aliases = {
    'Elite clue scroll': ['Clue scroll (elite).png'],
    'Ascension crossbows': ['Ascension crossbow.png', 'Ascension crossbows.png'],
    'Horn of Bran': ['Horn of Bran.png', 'Horn of bran.png'],
    'Orion (pet)': ['Orion.png'],
    "Archivist's folio (inert)": ["Archivist's folio (inert).png", "Archivist's folio.png"],
    'Fragment of whispering wind': ['Fragment of Whispering Wind.png'],
    'Fragment of deep water': ['Fragment of Deep Water.png'],
    'Fragment of living earth': ['Fragment of Living Earth.png'],
    'Fragment of burning fire': ['Fragment of Burning Fire.png'],
    "Zorya's tome (uncharged)": ["Zorya's tome.png", "Zorya's tome (uncharged).png"],
    'Obligator (uncharged)': ['Obligator.png', 'Obligator (uncharged).png'],
  };
  if (aliases[n]) c.push(...aliases[n]);
  return [...new Set(c)];
}

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  await sleep(300);
  return res.json();
}

const key = s => s.replace(/_/g, ' ').toLowerCase();
const fileInfo = new Map(); // key(file) -> {url, thumburl, width}

async function resolveFiles(files, thumbWidth) {
  const todo = [...new Set(files)].filter(f => !fileInfo.has(key(f)));
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50);
    const params = { action: 'query', prop: 'imageinfo', iiprop: 'url|size', titles: chunk.map(f => 'File:' + f).join('|') };
    if (thumbWidth) params.iiurlwidth = String(thumbWidth);
    const data = await api(params);
    const norm = new Map((data.query?.normalized || []).map(n => [n.to, n.from]));
    for (const p of data.query?.pages || []) {
      const info = p.imageinfo?.[0];
      const title = p.title.replace(/^File:/, '');
      const v = info ? { url: info.url, thumburl: info.thumburl, width: info.width } : null;
      fileInfo.set(key(title), v);
      if (norm.has(p.title)) fileInfo.set(key(norm.get(p.title).replace(/^File:/, '')), v);
    }
    chunk.forEach(f => { if (!fileInfo.has(key(f))) fileInfo.set(key(f), null); });
  }
}

async function pageImageFallback(item) {
  const titles = [...new Set([item.name, item.name.replace(' (uncharged)', ''), item.name.replace(' (pet)', '')])];
  for (const t of titles) {
    const data = await api({ action: 'query', prop: 'pageimages', piprop: 'original', titles: t });
    const src = data.query?.pages?.[0]?.original?.source;
    if (src) return src;
  }
  return null;
}

const slug = s => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function download(url, relPath) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const abs = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  await sleep(200);
  return buf.length;
}
const extOf = url => (new URL(url).pathname.match(/\.(png|webp|gif|jpe?g)$/i)?.[1] || 'png').toLowerCase();

const manifest = { items: {}, chests: {} };
const missing = [];

// Items: originals (inventory sprites are tiny; originals render crisp with pixelated scaling).
await resolveFiles(items.flatMap(itemImageCandidates));
for (const item of items) {
  let url = null;
  for (const f of itemImageCandidates(item)) { const v = fileInfo.get(key(f)); if (v) { url = v.url; break; } }
  if (!url) url = await pageImageFallback(item);
  if (!url) { missing.push(item.name); continue; }
  const rel = `images/items/${slug(item.name)}.${extOf(url)}`;
  if (fs.existsSync(path.join(repoRoot, rel))) { manifest.items[item.name] = rel; continue; } // already cached
  const bytes = await download(url, rel);
  manifest.items[item.name] = rel;
  console.log(`item  ${item.name.padEnd(32)} ${String(bytes).padStart(7)} B  <- ${decodeURIComponent(url.split('/').pop().split('?')[0])}`);
}

// Chests: 2x the 220px display size is plenty.
const chestFiles = {
  closed: ['Chest (The Fractured Archive, unique, closed).png'],
  open: ['Chest (The Fractured Archive, unique, opened).png'],
  standard: ['Chest (The Fractured Archive, standard, mine).png', 'Chest (The Fractured Archive, standard, mine).webp'],
};
await resolveFiles(Object.values(chestFiles).flat(), 440);
for (const [name, files] of Object.entries(chestFiles)) {
  let v = null;
  for (const f of files) { v = fileInfo.get(key(f)); if (v) break; }
  if (!v) { missing.push('chest:' + name); continue; }
  const url = v.thumburl && v.width > 440 ? v.thumburl : v.url;
  const rel = `images/chests/${name}.${extOf(url)}`;
  if (fs.existsSync(path.join(repoRoot, rel))) { manifest.chests[name] = rel; continue; } // already cached
  const bytes = await download(url, rel);
  manifest.chests[name] = rel;
  console.log(`chest ${name.padEnd(32)} ${String(bytes).padStart(7)} B  (orig width ${v.width})`);
}

// (manifest is informational only; the page derives sprite paths from item names)
console.log(`\n${Object.keys(manifest.items).length} items, ${Object.keys(manifest.chests).length} chests saved. Missing: ${missing.length ? missing.join(', ') : 'none'}`);
