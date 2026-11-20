# The Fractured Archive — Personal Loot Simulator

A browser-based loot simulator for **The Fractured Archive** raid in Old School RuneScape. Roll chests, chase purples, and track your collection log, all in a single static page.

**▶ Play it here:** https://fractured-archive-loot-sim.pages.dev/

(Mirror: https://ghoulboards.github.io/osrs-fractured-archive-loot-simulator/. Both deploy automatically on every push to `main`.)

## Features

- **Team-size and contribution-aware purple rates.** Pick a team of 1–8 and set your contribution %. Your personal unique rate is worked out from the team rate.
- **Three roll modes:**
  - *Single*: one raid per click.
  - *Batch*: up to 100,000 raids at once.
  - *Auto*: rolls on a timer.

  Every mode pauses when you hit a purple so you can open the unique chest yourself. The unique stays hidden until you open it.
- **Weighted unique table:** Rondache, Zorya's tome, Horn of Bran, Ascension crossbows, Obligator.
- **Standard loot table:** three rolls per non-purple raid, with a 1/51 chance of ×5 quantity on each roll.
- **Tertiary drops:** elite clues, the Archivist's folio, elemental fragments, and the Orion pet.
- **Session stats:** dry streak, purple rate, GP estimates for uniques and standard drops, a collection log, and CSV export.
- **Session loot totals:** sorted by GP value, with a "+N" badge on whatever the latest raid added.
- **Saved progress:** your stats, collection log, last raid, settings, and even an unopened unique chest are saved in your browser's `localStorage`, so a refresh or a later visit picks up where you left off. **Reset Session** clears it. Each browser and each site address keeps its own save, and nothing is sent anywhere.
- **Real item and chest sprites,** stored in this repo. The page makes no calls to the OSRS Wiki at runtime.
- **Works on phones.** At 900px wide or narrower, the layout becomes a single column with larger text and buttons, and a roll bar stays fixed at the bottom of the screen.

## Running locally

There is no build step and nothing to install. Open `index.html` in any modern browser.

## Sprites

All item and chest images live in `images/` and were downloaded once from the [OSRS Wiki](https://oldschool.runescape.wiki/). Item sprites are found by item name: the name is lowercased, apostrophes are removed, and other symbols become hyphens. For example, `Zorya's tome (uncharged)` → `images/items/zoryas-tome-uncharged.png`.

To add a new item, drop its inventory sprite into `images/items/` under that name. If a sprite file is missing, the page shows a two-letter text icon instead.

## Updating to a new design version

New designs arrive as standalone HTML files that still load sprites from the Wiki API. To bring one in and re-apply this site's changes:

```sh
cp ~/Downloads/fractured-archive-loot-simulator-vNN.html index.html
node tools/apply-site-patches.mjs index.html   # local sprites, modal/beam fixes, mobile layout, bug fixes
node tools/fetch-sprites.mjs index.html .      # only if the new design adds items; skips sprites already cached
node tools/fetch-prices.mjs                    # refresh GP prices (also worth running every so often on its own)
```

Each patch must match its spot in the file exactly once. If a new design changes one of those spots, the script stops and names the patch that needs updating, so nothing is skipped without you knowing.

## Data sources

Drop rates and quantities come from the OSRS Wiki page [Chest (The Fractured Archive)](https://oldschool.runescape.wiki/w/Chest_(The_Fractured_Archive)). The last check against the wiki was revision 15405292 (November 2026). Solo and duo both have a 1/17 team rate, so in a duo your personal rate is 1/34 at an even contribution split. GP values come from a dated snapshot of Grand Exchange prices in `data/prices.js`. They're taken from the [OSRS Wiki real-time prices API](https://prices.runescape.wiki) as the midpoint of the 24-hour average high and low. Items the GE doesn't list, such as Desiccated page, count as 0. Visitors never call the price API. To refresh the snapshot, run `node tools/fetch-prices.mjs` (three requests) and push.

## Disclaimer

This is an independent fan-made project. It is not affiliated with or endorsed by Jagex Ltd. Old School RuneScape and all related names and assets are trademarks of Jagex Ltd. Item and chest sprites are from the OSRS Wiki.
