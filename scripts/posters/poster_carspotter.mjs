// poster_carspotter — the homepage/case-study poster. Scripted, like the rest of the brand art.
//
//   node scripts/posters/poster_carspotter.mjs [--out <path>]
//
// Design brief: confident and premium. The old one shouted three headlines at once over a flat void
// and sold the game on chassis codes — the exact thing the game no longer does. This one:
//   • sits on the app's own marquee wall (the real 43 car photos), pushed almost to black so it reads
//     as texture, not clipart — the same ambient wall behind the app's home screen;
//   • says ONE thing, big, in the app's display face, with room around it;
//   • lets the product carry the rest: three real screens, tilted, lit, reflected.
// Restraint is the premium part. No stacked headlines, no lime on lime, no fake "download now".
//
// Requires ImageMagick (`magick`).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CS = '/Users/muhammedqadan/Documents/dev/car-spotter-game';
const PORTFOLIO = '/Users/muhammedqadan/Documents/dev/portfoliov2';
const FROOT = `${CS}/node_modules/@expo-google-fonts`;
const F = {
  // Oswald is the app's display face; Inter is its body. Same tokens the app compiles from.
  display: `${FROOT}/oswald/700Bold/Oswald_700Bold.ttf`,
  displayMed: `${FROOT}/oswald/500Medium/Oswald_500Medium.ttf`,
  body: `${FROOT}/inter/400Regular/Inter_400Regular.ttf`,
  bodyMed: `${FROOT}/inter/500Medium/Inter_500Medium.ttf`,
  bodySemi: `${FROOT}/inter/600SemiBold/Inter_600SemiBold.ttf`,
};
const WALL = `${CS}/apps/mobile/assets/wall`;
const SHOTS = `${PORTFOLIO}/public/images/car-spotter`;
const T = '/tmp/csposter';

const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : `${PORTFOLIO}/public/images/car-spotter/poster.webp`;

const W = 2560, H = 1600;
const LIME = '#C8FF00';
const INK = '#08090B';
const WHITE = '#F4F6F8';

const m = (a) => execFileSync('magick', a.map(String), { stdio: ['ignore', 'pipe', 'pipe'] });

/** Measure rendered text. Hard-coding an offset for the lime word is how you get "FROM TIDETAIL." */
const textW = (font, size, s) =>
  Number(execFileSync('magick', ['-font', font, '-pointsize', String(size), `label:${s}`, '-format', '%w', 'info:']).toString());

for (const [k, v] of Object.entries(F)) if (!existsSync(v)) throw new Error(`Missing font ${k}: ${v}`);
if (!existsSync(WALL)) throw new Error(`Missing marquee wall: ${WALL}`);
mkdirSync(path.dirname(OUT), { recursive: true });

// ── 1. The marquee wall ──────────────────────────────────────────────────────
// The app's ambient wall, pushed to near-black. It must read as depth you feel rather than photos you
// look at — anything brighter competes with the headline and the phones.
const walls = readdirSync(WALL).filter((f) => /\.jpe?g$/i.test(f)).sort();
if (!walls.length) throw new Error(`No wall images in ${WALL}`);

const CELL_W = 232, CELL_H = 232, GAP = 10;
const cols = Math.ceil(W / (CELL_W + GAP)) + 1;
const rows = Math.ceil(H / (CELL_H + GAP)) + 1;

const tiles = [];
for (let i = 0; i < cols * rows; i++) tiles.push(path.join(WALL, walls[i % walls.length]));

m([
  '-size', `${cols * (CELL_W + GAP)}x${rows * (CELL_H + GAP)}`, `xc:${INK}`,
  `${T}_wallbase.png`,
]);

// Build the grid row by row so tiles stagger — a perfect lattice looks like a contact sheet.
const montageArgs = [];
for (const t of tiles) montageArgs.push(t);
m([
  ...montageArgs,
  '-resize', `${CELL_W}x${CELL_H}^`, '-gravity', 'center', '-extent', `${CELL_W}x${CELL_H}`,
  '+append', // placeholder; real tiling below via montage
  `${T}_scrap.png`,
]);

m([
  'montage', ...tiles,
  '-tile', `${cols}x${rows}`,
  '-geometry', `${CELL_W}x${CELL_H}^+${GAP / 2}+${GAP / 2}`,
  '-background', INK,
  `${T}_wall_raw.png`,
]);

// Offset every other row by half a cell, then crush it: desaturate, darken hard, blur slightly.
m([
  `${T}_wall_raw.png`,
  '-resize', `${W + CELL_W}x${H + CELL_H}^`,
  '-gravity', 'center', '-extent', `${W}x${H}`,
  '-modulate', '100,14,100',        // almost fully desaturated — a hint of colour survives
  '-brightness-contrast', '-70x-16', // near-black; the wall is depth, not subject matter
  '-blur', '0x3.2',                  // kills the contact-sheet edge; leaves the rhythm of the grid
  `${T}_wall.png`,
]);

// ── 2. Atmosphere: vignette + one lime source, low and left ──────────────────
m(['-size', `${W}x${H}`, `xc:${INK}`, `${T}_ink.png`]);
m([
  '-size', `${W}x${H}`,
  `radial-gradient:rgba(200,255,0,0.16)-rgba(0,0,0,0)`,
  '-resize', `${W}x${H}!`,
  `${T}_glow_raw.png`,
]);
// Push the glow behind the phones (right of centre, low) so the type side stays clean and readable.
m([
  '-size', `${W}x${H}`, 'xc:none',
  '-draw', `image over ${Math.round(W * 0.30)},${Math.round(H * 0.10)} ${Math.round(W * 0.95)},${Math.round(H * 1.1)} '${T}_glow_raw.png'`,
  `${T}_glow.png`,
]);

m([`${T}_ink.png`, `${T}_wall.png`, '-compose', 'over', '-composite', `${T}_bg0.png`]);
m([`${T}_bg0.png`, `${T}_glow.png`, '-compose', 'screen', '-composite', `${T}_bg1.png`]);

// Vignette: darken the edges so the centre carries the eye.
m([
  '-size', `${W}x${H}`, 'radial-gradient:rgba(0,0,0,0)-rgba(0,0,0,0.92)',
  '-resize', `${W}x${H}!`,
  `${T}_vig.png`,
]);
m([`${T}_bg1.png`, `${T}_vig.png`, '-compose', 'over', '-composite', `${T}_bg.png`]);

// ── 3. Phones ────────────────────────────────────────────────────────────────
// Three real screens: the clue (the question), the reveal (the payoff), the result (the flex).
function phone(src, w, tag) {
  const h = Math.round(w * (2796 / 1290));
  const rad = Math.round(w * 0.085);
  m([src, '-resize', `${w}x${h}^`, '-gravity', 'north', '-extent', `${w}x${h}`, `${T}_${tag}_s.png`]);
  // Round the corners.
  m([
    '-size', `${w}x${h}`, 'xc:none',
    '-fill', 'white', '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`,
    `${T}_${tag}_mask.png`,
  ]);
  m([`${T}_${tag}_s.png`, `${T}_${tag}_mask.png`, '-alpha', 'off', '-compose', 'copy_opacity', '-composite', `${T}_${tag}_r.png`]);
  // A hairline bezel — the premium tell is the edge, not a drop shadow.
  m([
    `${T}_${tag}_r.png`,
    '-stroke', 'rgba(255,255,255,0.16)', '-strokewidth', '2.5', '-fill', 'none',
    '-draw', `roundrectangle 1,1,${w - 2},${h - 2},${rad},${rad}`,
    `${T}_${tag}_b.png`,
  ]);
  return { path: `${T}_${tag}_b.png`, w, h };
}

// Type geometry, measured — the phone stage is derived from where the headline actually ends, so the
// two never collide and the gap between them is a real decision instead of a guess.
const X = 168;
const HEAD = 150;
const headRight = X + Math.max(textW(F.display, HEAD, 'GUESS THE CAR'), textW(F.display, HEAD, 'FROM THE DETAIL.'));

// The stage the phones live in, sized so the fan actually reads: each outer phone keeps ~70% of itself
// visible instead of hiding behind the hero. Phone sizes are tuned to this width — the arc is
// question → answer → result, and you have to be able to see all three to read it.
const STAGE_L = Math.round(headRight + 96);
const STAGE_R = W - 64;
const HERO_W = 470, SIDE_W = 380, TILT = 7;

const clue = phone(`${SHOTS}/clue.webp`, SIDE_W, 'clue');
const reveal = phone(`${SHOTS}/reveal.webp`, HERO_W, 'reveal');
const result = phone(`${SHOTS}/share.webp`, SIDE_W, 'result');

// Rotate the outer two; the hero stays upright and forward.
m([clue.path, '-background', 'none', '-rotate', `-${TILT}`, `${T}_clue_rot.png`]);
m([result.path, '-background', 'none', '-rotate', `${TILT}`, `${T}_result_rot.png`]);

// Rotation grows the bounding box — measure it rather than assume, or the right phone clips.
const rotW = Number(execFileSync('magick', ['identify', '-format', '%w', `${T}_result_rot.png`]).toString());

// Soft shadow under the hero so it sits on the wall rather than floating over it.
m([
  reveal.path, '(', '+clone', '-background', 'black', '-shadow', '58x40+0+24', ')',
  '+swap', '-background', 'none', '-layers', 'merge', '+repage',
  `${T}_reveal_sh.png`,
]);

const HERO_X = Math.round((STAGE_L + STAGE_R) / 2 - HERO_W / 2);
const HERO_Y = Math.round((H - reveal.h) / 2) + 18; // optically centred, a touch low
const SIDE_Y = HERO_Y + 104;

m([
  `${T}_bg.png`,
  `${T}_clue_rot.png`, '-geometry', `+${STAGE_L}+${SIDE_Y}`, '-compose', 'over', '-composite',
  `${T}_result_rot.png`, '-geometry', `+${STAGE_R - rotW}+${SIDE_Y}`, '-compose', 'over', '-composite',
  `${T}_reveal_sh.png`, '-geometry', `+${HERO_X}+${HERO_Y}`, '-compose', 'over', '-composite',
  `${T}_stage.png`,
]);

// ── 4. Type ──────────────────────────────────────────────────────────────────
// One headline. The old poster stacked three and shouted; confidence is saying it once.
// Measured, so the lime word lands exactly one space after "FROM THE" at any size.
const fromW = textW(F.display, HEAD, 'FROM THE ');

m([
  `${T}_stage.png`,

  // Wordmark
  '-font', F.bodySemi, '-pointsize', '30', '-fill', LIME,
  '-annotate', `+${X}+${300}`, 'C A R S P O T T E R',

  // Headline — Oswald, tight, two lines. Lime lands on the payoff word only.
  '-font', F.display, '-pointsize', String(HEAD), '-fill', WHITE,
  '-annotate', `+${X}+${466}`, 'GUESS THE CAR',
  '-annotate', `+${X}+${610}`, 'FROM THE',
  '-fill', LIME,
  '-annotate', `+${X + fromW}+${610}`, 'DETAIL.',

  // Sub — the rule of the game, in a person's words.
  '-font', F.body, '-pointsize', '38', '-fill', 'rgba(244,246,248,0.70)',
  '-annotate', `+${X}+${706}`, 'Five details. Four answers. Ten seconds.',

  `${T}_type.png`,
]);

// Rule + meta row, low-left — the quiet confidence line.
m([
  `${T}_type.png`,
  '-fill', LIME, '-draw', `rectangle ${X},${818} ${X + 86},${822}`,
  '-font', F.bodyMed, '-pointsize', '25', '-fill', 'rgba(244,246,248,0.46)',
  '-annotate', `+${X}+${898}`, 'iOS   ·   A NEW DAILY 5 EVERY MORNING   ·   SPOILER-FREE SHARE',
  `${T}_final.png`,
]);

// ── 5. Out ───────────────────────────────────────────────────────────────────
m([`${T}_final.png`, '-quality', '86', '-define', 'webp:method=6', OUT]);
console.log(`✓ ${path.relative(PORTFOLIO, OUT)}  (${W}×${H}, marquee wall + 3 real screens)`);
