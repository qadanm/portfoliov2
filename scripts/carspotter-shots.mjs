// carspotter-shots — turn raw iPhone screenshots into the case-study webps.
//
// The case study used to show App Store *posters* (marketing headlines wrapping a phone). Those sell;
// they don't show the work. These are the plain screens instead.
//
// Re-run this after reshooting: drop the new PNGs in --src (named or ordered as below) and go. The
// output paths are fixed, so the page picks them up with no markup change.
//
//   node scripts/carspotter-shots.mjs --src <dir-of-pngs> [--dry-run]
//
// Requires ImageMagick (`magick`).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/images/car-spotter');
const QUALITY = 82;

// slot → what the screen has to show. Order is the fallback when filenames don't match.
const SLOTS = [
  { out: 'clue.webp', want: 'clue: cropped detail in the viewfinder, tach running, four answers' },
  { out: 'reveal.webp', want: 'reveal: crop bloomed to the whole car + the fact' },
  { out: 'daily.webp', want: 'home: marquee wall, streak, today’s Daily 5 card' },
  { out: 'combo.webp', want: 'clue mid-run: pips filled, score climbing' },
  { out: 'share.webp', want: 'results: score, tier, the spoiler-free share card' },
  { out: 'learn.webp', want: 'miss / time’s up: the reveal that teaches the tell' },
  { out: 'clue2.webp', want: 'clue: a different detail category' },
  { out: 'reveal2.webp', want: 'reveal: a second car + fact' },
];

const args = (() => {
  const a = { src: null, 'dry-run': false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === '--dry-run') a['dry-run'] = true;
    else if (k.startsWith('--')) a[k.slice(2)] = process.argv[++i];
  }
  return a;
})();

const fail = (m) => {
  console.error(`\n✖ ${m}\n`);
  process.exit(1);
};

if (!args.src) fail('Required: --src <dir of screenshots>\n\nSlots, in order:\n' + SLOTS.map((s, i) => `  ${i + 1}. ${s.out.padEnd(14)} ${s.want}`).join('\n'));
const SRC = path.resolve(args.src);
if (!existsSync(SRC)) fail(`Not found: ${SRC}`);

const pngs = readdirSync(SRC)
  .filter((f) => /\.(png|jpe?g|heic)$/i.test(f))
  .sort();
if (!pngs.length) fail(`No images in ${SRC}`);
if (pngs.length < SLOTS.length) {
  console.warn(`⚠ ${pngs.length} image(s) for ${SLOTS.length} slots — the remaining slots keep their current file.`);
}

// A file named after its slot wins; otherwise fall back to sorted order.
const picked = SLOTS.map((slot, i) => {
  const stem = slot.out.replace('.webp', '');
  const named = pngs.find((f) => path.parse(f).name.toLowerCase() === stem);
  return { ...slot, src: named ?? pngs[i] ?? null };
});

for (const p of picked) {
  if (!p.src) {
    console.log(`— ${p.out.padEnd(14)} (no source, left as-is)`);
    continue;
  }
  const from = path.join(SRC, p.src);
  const to = path.join(OUT, p.out);
  console.log(`${p.src.padEnd(16)} → ${p.out}`);
  if (args['dry-run']) continue;
  // Strip metadata, keep the phone's native pixels — the page already declares 1290x2796.
  execFileSync('magick', [from, '-strip', '-quality', String(QUALITY), to]);
}

console.log(args['dry-run'] ? '\nDry run — nothing written.' : `\n✓ Wrote ${picked.filter((p) => p.src).length} file(s) to public/images/car-spotter/`);
