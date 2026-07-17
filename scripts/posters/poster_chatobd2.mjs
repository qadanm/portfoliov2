// poster_chatobd2 — the homepage/case-study poster. Scripted, like the rest of the brand art.
//
//   node scripts/posters/poster_chatobd2.mjs [--out <path>]
//
// Design brief: utilitarian, tech-forward. The old poster was neither. It was light and glossy while
// the actual product is near-black; it had a grey blur smeared across the middle, a cartoon ECG
// heartbeat (wrong metaphor — this reads a car, not a patient), decorative orbital rings, and an
// AI-generated phone whose screen said "Vandlct". It sold a product that doesn't exist.
//
// This one takes its cues from the real thing (see public/images/chatobd2/hero.webp):
//   • near-black on the project's own tokens (#0B0D12 → #1A1F2B, per chatobd2.mdx `placeholder`);
//   • an engineering grid instead of a decorative dot field — the surface reads as an instrument;
//   • the REAL app UI, cropped from the shipped hero, chips and all (VIN confirmed / ECT 93°C /
//     P0420 stored / 11/11 monitors). Real data beats a render;
//   • monospace for every measured value, sans for prose — the same split the product itself uses;
//   • no glow, no orbits, no blur — ink, grid, and the device.
// Utilitarian means nothing on the canvas that isn't carrying information.
//
// Requires ImageMagick (`magick`).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PORTFOLIO = '/Users/muhammedqadan/Documents/dev/portfoliov2';
const FROOT = '/Users/muhammedqadan/Documents/dev/car-spotter-game/node_modules/@expo-google-fonts/inter';
const F = {
  x: `${FROOT}/800ExtraBold/Inter_800ExtraBold.ttf`,
  b: `${FROOT}/700Bold/Inter_700Bold.ttf`,
  sb: `${FROOT}/600SemiBold/Inter_600SemiBold.ttf`,
  md: `${FROOT}/500Medium/Inter_500Medium.ttf`,
  r: `${FROOT}/400Regular/Inter_400Regular.ttf`,
  mono: '/System/Library/Fonts/SFNSMono.ttf',
};
const HERO = `${PORTFOLIO}/public/images/chatobd2/hero.webp`;
const T = '/tmp/cobdposter';

const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : `${PORTFOLIO}/public/images/chatobd2/poster.webp`;

const W = 2560, H = 1600;
// The product's own palette, read off the shipped site.
const INK = '#0B0D12';        // near-black — the mdx placeholder's `from`
const PANEL = '#12151C';
const BLUE = '#4B6FFF';
const WHITE = '#F2F4F8';
const MUTE = 'rgba(242,244,248,0.46)';
const LINE = 'rgba(242,244,248,0.10)';

const m = (a) => execFileSync('magick', a.map(String), { stdio: ['ignore', 'pipe', 'pipe'] });
const textW = (font, size, s) =>
  Number(execFileSync('magick', ['-font', font, '-pointsize', String(size), `label:${s}`, '-format', '%w', 'info:']).toString());

for (const [k, v] of Object.entries(F)) if (!existsSync(v)) throw new Error(`Missing font ${k}: ${v}`);
if (!existsSync(HERO)) throw new Error(`Missing hero: ${HERO}`);
mkdirSync(path.dirname(OUT), { recursive: true });

// ── 1. Surface: ink + an engineering grid ────────────────────────────────────
// A real grid, not a dot field. Fine minor rule every 40px, a heavier major every 200 — the visual
// language of a measuring instrument. Low enough alpha that you feel it rather than read it.
//
// Draw with a SOLID stroke and scale the layer's alpha channel afterwards. Passing the alpha inline
// (`-stroke 'rgba(242,244,248,0.028)'`) does not survive here: it gets premultiplied into the colour
// (242 × 0.028 ≈ rgb(7,7,7)) and stamped opaque, which on this ink produced a 1/255 difference — a
// grid that measured as present and read as absent. Same bug the MagTek poster had, opposite symptom:
// there it was near-black on white and screamed; here it was near-black on near-black and vanished.
m(['-size', `${W}x${H}`, `xc:${INK}`, `${T}_ink.png`]);

const gridLines = (step) => {
  const a = [];
  for (let x = 0; x <= W; x += step) a.push('-draw', `line ${x},0 ${x},${H}`);
  for (let y = 0; y <= H; y += step) a.push('-draw', `line 0,${y} ${W},${y}`);
  return a;
};
m(['-size', `${W}x${H}`, 'xc:none', '-stroke', WHITE, '-strokewidth', '1', ...gridLines(40),
   '-alpha', 'set', '-channel', 'A', '-evaluate', 'multiply', '0.035', '+channel', `${T}_grid_minor.png`]);
m(['-size', `${W}x${H}`, 'xc:none', '-stroke', WHITE, '-strokewidth', '1', ...gridLines(200),
   '-alpha', 'set', '-channel', 'A', '-evaluate', 'multiply', '0.075', '+channel', `${T}_grid_major.png`]);

m([`${T}_ink.png`, `${T}_grid_minor.png`, '-composite', `${T}_grid_major.png`, '-composite', `${T}_surface.png`]);

// No glow. An earlier pass put a blue source behind the phone; because the cropped hero carries its
// own darker background, that source showed through as a rectangle — and the fix for a decoration
// that fights the composite is to delete the decoration, not to feather it harder. Ink and grid are
// enough to sit a device on, and "utilitarian" means nothing on the canvas that isn't information.

// Vignette — pulls the corners down so the grid never competes with the type.
m(['-size', `${W}x${H}`, 'radial-gradient:rgba(0,0,0,0)-rgba(0,0,0,0.80)', '-resize', `${W}x${H}!`, `${T}_vig.png`]);
m([`${T}_surface.png`, `${T}_vig.png`, '-compose', 'over', '-composite', `${T}_bg.png`]);

// ── 2. The real app, cropped from the shipped hero ───────────────────────────
// Chips included on purpose: VIN confirmed / ECT 93°C / P0420 stored / 11/11 monitors are the whole
// argument. A render can't say any of that.
// The hero's own background is rgb(4,4,8) — DARKER than this poster's ink — so a straight paste reads
// as a dark rectangle sitting on the surface. Crop with a generous margin instead and feather that
// margin to nothing: near-black fading into near-black leaves no seam, and the device is untouched.
// (A `lighten` blend would also kill the seam, but it would dissolve the phone's own dark screen and
// outline into the ink — the device would lose its edges.)
const CROP_W = 1010, CROP_H = 1470, FEATHER = 34, INSET = 78;
m([HERO, '-crop', `${CROP_W}x${CROP_H}+1375+360`, '+repage', `${T}_phone_raw.png`]);
m([
  '-size', `${CROP_W}x${CROP_H}`, 'xc:black',
  '-fill', 'white', '-draw', `rectangle ${INSET},${INSET} ${CROP_W - INSET},${CROP_H - INSET}`,
  '-blur', `0x${FEATHER}`,
  `${T}_phone_mask.png`,
]);
m([`${T}_phone_raw.png`, `${T}_phone_mask.png`, '-alpha', 'off', '-compose', 'copy_opacity', '-composite', `${T}_phone_feathered.png`]);

const PHONE_W = 860;
m([`${T}_phone_feathered.png`, '-resize', `${PHONE_W}x`, `${T}_phone.png`]);
const phoneH = Number(execFileSync('magick', ['identify', '-format', '%h', `${T}_phone.png`]).toString());

const PHONE_X = W - PHONE_W - 120;
const PHONE_Y = Math.round((H - phoneH) / 2);
m([`${T}_bg.png`, `${T}_phone.png`, '-geometry', `+${PHONE_X}+${PHONE_Y}`, '-compose', 'over', '-composite', `${T}_stage.png`]);

// ── 3. Type — left column, one measure, everything on the same left edge ─────
const X = 190;
const HEAD = 104;
const cobdW = textW(F.x, HEAD, 'ChatOBD-2 ');
// The wordmark stays pinned top-left like a letterhead; everything below is one block, nudged down so
// its optical centre matches the phone's (which is centred on the canvas). Without this the whole
// composition rides ~140px high and leaves dead space along the bottom edge.
const B = 70;

m([
  `${T}_stage.png`,

  // Wordmark
  '-font', F.b, '-pointsize', '30', '-fill', WHITE,
  '-annotate', `+${X}+${196}`, 'ChatOBD-2',

  // Eyebrow — the product's own label, with its status dot.
  '-fill', BLUE, '-draw', `circle ${X + 5},${357 + B} ${X + 5},${352 + B}`,
  '-font', F.sb, '-pointsize', '23', '-fill', BLUE,
  '-annotate', `+${X + 24}+${365 + B}`, 'A I   C A R   D I A G N O S T I C S',

  // Headline — the shipped line. It is already the best sentence the product has.
  '-font', F.x, '-pointsize', String(HEAD), '-fill', WHITE,
  '-annotate', `+${X}+${500 + B}`, 'Your car is talking.',
  '-fill', BLUE,
  '-annotate', `+${X}+${624 + B}`, 'ChatOBD-2',
  '-fill', 'rgba(242,244,248,0.42)',
  '-annotate', `+${X + cobdW}+${624 + B}`, 'translates.',

  `${T}_type.png`,
]);

// Sub — plain sentence, wrapped by hand so the rag is deliberate.
m([
  `${T}_type.png`,
  '-font', F.r, '-pointsize', '35', '-fill', MUTE,
  '-annotate', `+${X}+${718 + B}`, 'Reads every sensor, decodes every fault, and explains',
  '-annotate', `+${X}+${768 + B}`, 'your car in plain English — in 45 seconds.',
  `${T}_sub.png`,
]);

// ── 4. The contract, in mono ─────────────────────────────────────────────────
// Every scan returns the same four things (chatobd2.mdx). Monospace because they are a fixed shape,
// not prose — and because that is exactly how the product renders its own measured values.
const CONTRACT = ['SAFE TO DRIVE', 'CONFIDENCE', 'WHAT MATTERS', 'WHAT NEXT'];
let cx = X;
const contractArgs = [];
for (const [i, c] of CONTRACT.entries()) {
  contractArgs.push('-fill', i === 0 ? BLUE : 'rgba(242,244,248,0.30)');
  contractArgs.push('-draw', `rectangle ${cx},${846 + B} ${cx + 26},${848 + B}`);
  contractArgs.push('-font', F.mono, '-pointsize', '19', '-fill', i === 0 ? 'rgba(242,244,248,0.72)' : 'rgba(242,244,248,0.34)');
  contractArgs.push('-annotate', `+${cx}+${886 + B}`, c);
  cx += textW(F.mono, 19, c) + 58;
}
m([`${T}_sub.png`, ...contractArgs, `${T}_contract.png`]);

// ── 5. Stats — the site's own numbers, mono figures, sans labels ─────────────
m([
  `${T}_contract.png`,
  '-fill', LINE, '-draw', `rectangle ${X},${982 + B} ${X + 980},${983 + B}`,
  `${T}_rule.png`,
]);

const STATS = [
  ['6', 'AI LAYERS'],
  ['45s', 'FULL SCAN'],
  ['38k', 'TOKENS / SCAN'],
  ['4', 'TIERS · ANY ADAPTER'],
];
let sx = X;
const statArgs = [];
for (const [value, label] of STATS) {
  statArgs.push('-font', F.b, '-pointsize', '58', '-fill', WHITE, '-annotate', `+${sx}+${1082 + B}`, value);
  statArgs.push('-font', F.md, '-pointsize', '20', '-fill', 'rgba(242,244,248,0.38)', '-annotate', `+${sx}+${1124 + B}`, label);
  sx += Math.max(textW(F.b, 58, value), textW(F.md, 20, label)) + 74;
}
m([`${T}_rule.png`, ...statArgs, `${T}_stats.png`]);

// ── 6. Registration ticks — a drawing, not a picture ─────────────────────────
const TICK = 26, PAD = 64;
m([
  `${T}_stats.png`,
  '-stroke', 'rgba(242,244,248,0.20)', '-strokewidth', '2', '-fill', 'none',
  '-draw', `line ${PAD},${PAD} ${PAD + TICK},${PAD}`, '-draw', `line ${PAD},${PAD} ${PAD},${PAD + TICK}`,
  '-draw', `line ${W - PAD - TICK},${PAD} ${W - PAD},${PAD}`, '-draw', `line ${W - PAD},${PAD} ${W - PAD},${PAD + TICK}`,
  '-draw', `line ${PAD},${H - PAD - TICK} ${PAD},${H - PAD}`, '-draw', `line ${PAD},${H - PAD} ${PAD + TICK},${H - PAD}`,
  '-draw', `line ${W - PAD - TICK},${H - PAD} ${W - PAD},${H - PAD}`, '-draw', `line ${W - PAD},${H - PAD - TICK} ${W - PAD},${H - PAD}`,
  '-stroke', 'none',
  // Clear of the corner tick — a registration mark that something is printed through is just a smudge.
  '-font', F.mono, '-pointsize', '17', '-fill', 'rgba(242,244,248,0.26)',
  '-annotate', `+${PAD + TICK + 28}+${H - PAD + 6}`, 'OBD-II  ·  BLE  ·  iOS',
  `${T}_final.png`,
]);

m([`${T}_final.png`, '-quality', '88', '-define', 'webp:method=6', OUT]);
console.log(`✓ ${path.relative(PORTFOLIO, OUT)}  (${W}×${H}, engineering grid + the real shipped UI)`);
