// Applies this site's patches (local sprites, modal/beam fixes, mobile layout + roll bar, bug fixes)
// on top of a fresh design drop of the simulator HTML.
// Usage: node tools/apply-site-patches.mjs index.html   (edits in place; every patch must match exactly once,
//        so if a new design changed one of the anchored snippets the script stops and names the patch to update)
import fs from 'node:fs';

const file = process.argv[2];
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function replaceOnce(label, oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error(`[${label}] expected 1 match, found ${n}`);
  html = html.replace(oldStr, () => newStr);
  console.log('ok  ', label);
}
function spliceBetween(label, startMarker, endMarker, replacement) {
  const a = html.indexOf(startMarker), b = html.indexOf(endMarker);
  if (a < 0 || b < 0 || b < a) throw new Error(`[${label}] markers not found`);
  html = html.slice(0, a) + replacement + html.slice(b);
  console.log('ok  ', label, `(${b - a} chars replaced)`);
}

// 1. Favicon (local sprite).
replaceOnce('favicon',
  '<title>The Fractured Archive — Personal Loot Simulator</title>',
  '<title>The Fractured Archive — Personal Loot Simulator</title>\n<link rel="icon" type="image/png" href="images/items/rondache.png">');

// 2. Sprite-loading status pill is meaningless once sprites are local.
replaceOnce('remove sprite status pill', '\n    <span class="pill" id="spriteStatus">LOADING ITEM SPRITES…</span>', '');

// 3. Credit the Wiki for the cached sprites.
replaceOnce('footer credit',
  ' · Session data stays in this browser tab.</div>',
  ' · Item &amp; chest sprites from the OSRS Wiki · Session data stays in this browser tab.</div>');

// 4. Replace the runtime OSRS Wiki API sprite resolver with local files.
spliceBetween('local item sprites', '// Resolve real inventory sprites', 'async function initChestSprites(){',
`// Item sprites are cached locally in images/ (sourced once from the OSRS Wiki), so the page makes no Wiki API calls.
// File names are the item name slugified: "Zorya's tome (uncharged)" -> images/items/zoryas-tome-uncharged.png
const spriteSlug=n=>n.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const spriteUrl=item=>item&&item.name?\`images/items/\${spriteSlug(item.name)}.png\`:null;
function lootIconHTML(item){
 const url=spriteUrl(item),fallback=\`<span class="icon-fallback" style="display:\${url?'none':'grid'}">\${esc(item.icon||'??')}</span>\`;
 if(!url)return fallback;
 return \`<img src="\${esc(url)}" alt="\${esc(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">\${fallback}\`;
}
function setItemImage(img,item){
 const fb=$('uniqueFallback'),url=spriteUrl(item);
 img.onload=()=>{img.style.display='block';fb.style.display='none';};
 img.onerror=()=>{img.style.display='none';fb.style.display='block';};
 if(url)img.src=url;else img.onerror();
}
`);

// 5. v16's hero-chest unique preview used the async Wiki resolver; use the local path directly.
replaceOnce('hero unique preview sprite',
  "resolveItemSprite(uniqueDropEntry.item).then(url=>{if(hImg.dataset.forItem===uniqueDropEntry.item.name&&url){hImg.src=url;hImg.style.display='block';}else{hImg.style.display='none';}});",
  "const hUrl=spriteUrl(uniqueDropEntry.item);if(hUrl){if(hImg.getAttribute('src')!==hUrl){hImg.onerror=()=>{hImg.style.display='none';};hImg.src=hUrl;}hImg.style.display='block';}else{hImg.style.display='none';}");

// 6. No async sprite hydration step any more.
replaceOnce('drop hydrate call', ' hydrateLootSprites();\n}', '}');

// 7. Chest sprites from local files.
spliceBetween('local chest sprites', 'async function initChestSprites(){', "  const a=document.createElement('img'),b=document.createElement('img');",
`function initChestSprites(){
 const closedUrl='images/chests/closed.png';
 const openUrl='images/chests/open.png';
 const stdUrl='images/chests/standard.webp';

 document.querySelectorAll('.chest').forEach(chest=>{
`);

// 8. The old retry compared an absolute img.src to a relative URL, so it would retry forever on error.
replaceOnce('remove infinite retry',
  "    if(img.classList.contains('chest-standard')&&img.src!==stdUrl){img.src=stdUrl;return;}\n", '');

// 9. Room under the scaled modal chest for its CLICK CHEST / CLICK TO CONTINUE label.
//    v19: 220px chest at scale 1.16 (1.2 + translateY(-4px) on hover), label at bottom:-24px
//    => label ends ~46px below the chest's layout box; 36px margin + the reveal item's 20px top margin clears it.
replaceOnce('modal chest label room',
  '#modalChest { width: 270px; height: 220px; margin: 16px auto 12px; transform',
  `/* Bottom margin reserves room for the scaled chest + its "CLICK CHEST" label (bottom:-24px) so the label
   stays inside the modal when closed and above the revealed item when open. */
#modalChest { width: 270px; height: 220px; margin: 16px auto 36px; transform`);

// 10. Short viewports: scroll the backdrop instead of clipping the modal.
replaceOnce('modal backdrop scroll',
  '  z-index: 30;\n  padding: 18px;\n}\n.modalback.show { display: grid; }',
  '  z-index: 30;\n  padding: 18px;\n  overflow-y: auto; /* short viewports: scroll instead of clipping the modal */\n}\n.modalback.show { display: grid; }');
replaceOnce('modal auto margin',
  '.modal {\n  width: min(740px, 95vw);',
  '.modal {\n  width: min(740px, 95vw);\n  margin: auto; /* centers in the grid, but pins to top (scrollable) if taller than the viewport */');

// 11. Spinning purple beam: a centered square wider than the viewport diagonal covers every corner at any angle.
replaceOnce('beam coverage',
  '  position: fixed;\n  inset: -30%;\n  pointer-events: none;\n  background: repeating-conic-gradient',
  `  position: fixed;
  /* A square wider than the viewport diagonal (≤ 141.4vmax), centered, so it covers every corner at any rotation angle.
     Centered with margins rather than translate() because the beam-spin animation owns \`transform\`. */
  left: 50%;
  top: 50%;
  width: 150vmax;
  height: 150vmax;
  margin: -75vmax 0 0 -75vmax;
  pointer-events: none;
  background: repeating-conic-gradient`);

// 12. v16 bug: the pending unique is already counted in recentAdded when rolled, so claiming showed "+2".
replaceOnce('unique +1 badge',
  'state.recentAdded={[item.name]:(state.recentAdded[item.name]||0)+1};',
  'state.recentAdded={[item.name]:1};');

// 13. "Paused for unique chest" only makes sense when a batch/auto run is actually waiting; in Single mode it lingered.
replaceOnce('pause message only while running',
  "function stopAuto(interrupt=false){clearInterval(state.timer);if(interrupt){",
  "function stopAuto(interrupt=false){clearInterval(state.timer);if(interrupt&&state.running){");

// 14. Mobile: readable type, ≥44px tap targets, phone-sized unique modal, and a fixed bottom roll bar.
//     Breakpoint matches the design's own fit-to-viewport cutoff (no zoom at ≤900px).
replaceOnce('mobile css', '\n</style>', `

/* ===== Phones & small tablets (≤900px — the fit-to-viewport script stops zooming at the same width) ===== */
.mobile-bar { display: none; }
@media (max-width: 900px) {
  .wrap { padding-bottom: calc(118px + env(safe-area-inset-bottom, 0px)); } /* clear the fixed roll bar */

  /* Readable type: the desktop design uses 9–11px mono; bump ~2px on handheld screens */
  .field label, .checkline { font-size: 13px; }
  .field small, .reset-link { font-size: 12px; }
  .hero-copy p { font-size: 13px; line-height: 1.7; }
  .ratebox span, .stat .k, .stat .sub, .boxhead span, .lootmeta, .last-drop .lootmeta, .tag, .collect small, .auto-status, .stage-label { font-size: 11px; }
  .logrow, .lootname, .last-drop .lootname, .collect strong, .empty { font-size: 12px; }
  .footer { font-size: 11px; }

  /* Comfortable tap targets (≥44px) */
  .seg button, .primary, .secondary, .danger { min-height: 44px; font-size: 12px; }
  .select, input[type=number] { min-height: 46px; font-size: 16px; } /* ≥16px also stops iOS zoom-on-focus */
  .reset-link { padding: 12px 0 12px 16px; margin: -12px 0; }
  .checkline { min-height: 40px; }
  .checkline input { width: 22px; height: 22px; }

  /* Let collection names wrap to two lines instead of truncating to a few characters */
  .collect strong { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }

  /* Unique-chest modal sized for phones. Chest is 270x220 with its label at bottom:-24px; at scale .78 the
     label ends ~5px inside the chest box, so small margins keep it clear of the revealed item. */
  .modalback { padding: 12px; }
  .modal { width: 100%; min-height: 0; padding: 22px 16px 20px; }
  .modal h2 { font-size: 24px; margin: 6px 0; }
  #modalChest, #modalChest:hover, #modalChest.open:hover { transform: scale(.78); }
  #modalChest { margin: -20px auto 6px; }
  #modalChest:after { font-size: 14px; }
  .reveal-item { width: 120px; height: 120px; margin: 14px auto; }
  .reveal-item img { width: 90px; height: 90px; }
  .chest:hover { transform: none; } /* no sticky hover lift after a tap */

  /* Fixed bottom roll bar (mirrors the sidebar controls; see script at end of body) */
  .mobile-bar {
    display: block;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 25; /* above the page, below the unique-chest modal (30) */
    padding: 10px 14px calc(12px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(180deg, rgba(24, 29, 23, 0.97), rgba(10, 12, 10, 0.99));
    border-top: 2px solid var(--bark-mid);
    box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.75);
  }
  .mobile-bar [hidden] { display: none !important; }
  .mb-progress { position: absolute; left: 0; right: 0; top: -2px; height: 3px; }
  .mb-progress > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--moss-green), var(--lime-glow)); }
  .mb-status { font-size: 11px; color: var(--lime-glow); text-align: center; margin: 0 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb-row { display: flex; gap: 8px; }
  .mb-row .primary { flex: 1; font-size: 14px; letter-spacing: 1px; }
  .mb-row .secondary { flex: 0 0 auto; padding: 0 14px; }
}
/* Short phones / landscape: shrink the modal chest further so the opened state fits */
@media (max-width: 900px) and (max-height: 700px) {
  #modalChest, #modalChest:hover, #modalChest.open:hover { transform: scale(.64); }
  #modalChest { margin: -36px auto -14px; }
  .reveal-item { width: 100px; height: 100px; margin: 14px auto 10px; }
  .reveal-item img { width: 76px; height: 76px; }
  .modal h2 { font-size: 22px; }
}
@media (max-width: 620px) {
  .stats .stat:last-child { grid-column: 1 / -1; } /* 5 stat cards in 2 columns: let the last one span */
}
</style>`);

replaceOnce('mobile bar html', '<div class="modalback" id="modal">', `<!-- Phone-only roll bar: mirrors the sidebar controls so rolling is always one tap away -->
<div class="mobile-bar" id="mobileBar">
  <div class="mb-progress" aria-hidden="true"><i id="mProgress"></i></div>
  <div class="mb-status" id="mStatus" role="status" hidden></div>
  <div class="mb-row">
    <button type="button" class="secondary" id="mSettings">SETTINGS</button>
    <button type="button" class="primary" id="mRoll">ROLL CHEST</button>
    <button type="button" class="secondary" id="mPause" hidden>PAUSE</button>
  </div>
</div>

<div class="modalback" id="modal">`);

replaceOnce('mobile bar script', '\n</body>', `
<script>
// Mobile roll bar: proxies clicks to the real sidebar controls and mirrors their state (label, disabled,
// pause/resume, run status, auto-roll progress) via MutationObservers, so no simulation code needs to know about it.
(function(){
 const roll=$('rollBtn'),pause=$('pauseBtn'),resume=$('resumeBtn'),status=$('runStatus'),bar=$('progressBar');
 const mRoll=$('mRoll'),mPause=$('mPause'),mStatus=$('mStatus'),mProgress=$('mProgress');
 if(!roll||!mRoll)return;
 function sync(){
  mRoll.textContent=roll.textContent;mRoll.disabled=roll.disabled;
  const canResume=!resume.disabled,canPause=!pause.disabled;
  mPause.hidden=!(canPause||canResume);mPause.textContent=canResume?'RESUME':'PAUSE';
  const s=status.textContent.trim();mStatus.textContent=s;mStatus.hidden=!s;
  mProgress.style.width=(bar&&bar.style.width)||'0%';
 }
 mRoll.addEventListener('click',()=>roll.click());
 mPause.addEventListener('click',()=>(resume.disabled?pause:resume).click());
 $('mSettings').addEventListener('click',()=>document.querySelector('.settings').scrollIntoView({behavior:'smooth',block:'start'}));
 const mo=new MutationObserver(sync);
 [roll,pause,resume].forEach(b=>mo.observe(b,{attributes:true,attributeFilter:['disabled'],childList:true,characterData:true,subtree:true}));
 mo.observe(status,{childList:true,characterData:true,subtree:true});
 if(bar)mo.observe(bar,{attributes:true,attributeFilter:['style']});
 sync();
})();
</script>
</body>`);

// Sanity: nothing left that talks to the Wiki API at runtime.
for (const needle of ['api.php', 'resolveItemSprite', 'hydrateLootSprites', 'wikiFileCache', 'spriteStatus', 'fetch(']) {
  if (html.includes(needle)) throw new Error(`leftover reference: ${needle}`);
}
fs.writeFileSync(file, html);
console.log('done');
