import { execFileSync } from 'node:child_process';

const FROOT = '/Users/muhammedqadan/Documents/dev/car-spotter-game/node_modules/@expo-google-fonts/inter';
const F = {
  x: `${FROOT}/800ExtraBold/Inter_800ExtraBold.ttf`,
  b: `${FROOT}/700Bold/Inter_700Bold.ttf`,
  sb: `${FROOT}/600SemiBold/Inter_600SemiBold.ttf`,
  md: `${FROOT}/500Medium/Inter_500Medium.ttf`,
  r: `${FROOT}/400Regular/Inter_400Regular.ttf`,
};
const IMG = '/Users/muhammedqadan/Documents/dev/portfoliov2/public/images/magtek';
const OUT = '/tmp/poster_magtek_out.png';
const T = '/tmp/mtk';
const W = 2560, H = 1600;

// Corporate light palette — steel-blue accent, graphite ink, generous whitespace.
const INK = '#14181F', BODY = '#48515E', MUTE = '#8A94A3', STEEL = '#1E50A8', STEELD = '#0F3A86';
const LINE = '#DDE3EB', CHROME = '#FFFFFF';

const m = (a) => execFileSync('magick', a.map(String), { stdio: ['ignore', 'pipe', 'pipe'] });
const dim = (f) => execFileSync('magick', ['identify', '-format', '%w %h', f]).toString().split(' ').map(Number);

// ---- clean browser window (rounded chrome + bar + 3 muted dots), no shadow ----
function browserWindow(src, w, h, tag) {
  const bar = 48, rad = 18, cH = h - bar;
  m([src, '-resize', `${w}x${cH}^`, '-gravity', 'north', '-extent', `${w}x${cH}`, `${T}_${tag}_shot.png`]);
  m(['-size', `${w}x${h}`, 'xc:none', '-fill', CHROME, '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`, `${T}_${tag}_chrome.png`]);
  m([`${T}_${tag}_chrome.png`, `${T}_${tag}_shot.png`, '-geometry', `+0+${bar}`, '-compose', 'over', '-composite', `${T}_${tag}_w0.png`]);
  m([`${T}_${tag}_w0.png`, '(', '-size', `${w}x${h}`, 'xc:none', '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`, ')', '-alpha', 'set', '-compose', 'DstIn', '-composite', `${T}_${tag}_w1.png`]);
  const dy = Math.round(bar / 2);
  m([`${T}_${tag}_w1.png`,
     '-stroke', 'none', '-fill', '#C9D0DA', '-draw', `circle 28,${dy} 28,${dy - 6}`, '-draw', `circle 52,${dy} 52,${dy - 6}`, '-draw', `circle 76,${dy} 76,${dy - 6}`,
     '-fill', 'none', '-stroke', '#ECEFF3', '-strokewidth', '1', '-draw', `line 0,${bar - 1} ${w},${bar - 1}`,
     '-stroke', '#E4E8EE', '-strokewidth', '1.5', '-fill', 'none', '-draw', `roundrectangle 1,1,${w - 2},${h - 2},${rad},${rad}`,
     `${T}_${tag}_win.png`]);
  return { path: `${T}_${tag}_win.png`, w, h };
}

// rounded thumbnail (for the hardware strip)
function thumb(src, w, h, tag) {
  const rad = 12;
  m([src, '-resize', `${w}x${h}^`, '-gravity', 'center', '-extent', `${w}x${h}`,
     '(', '-size', `${w}x${h}`, 'xc:none', '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`, ')',
     '-alpha', 'set', '-compose', 'DstIn', '-composite',
     '-compose', 'over', '-bordercolor', '#E4E8EE', '-border', '1', `${T}_${tag}.png`]);
  return `${T}_${tag}.png`;
}

// ---------------- BACKGROUND (soft light, restrained) ----------------
m(['-size', `${W}x${H}`, 'radial-gradient:#FFFFFF-#ECF1F7', `${T}_grad.png`]);
// faint engineering grid, very low opacity (corporate texture)
m(['-size', '84x84', 'xc:none', '-stroke', '#1E50A807', '-strokewidth', '1', '-draw', 'line 0,0 0,84', '-draw', 'line 0,0 84,0', '-write', 'mpr:cell', '+delete',
   '-size', `${W}x${H}`, 'tile:mpr:cell', `${T}_gridraw.png`]);
m([`${T}_grad.png`, `${T}_gridraw.png`, '-compose', 'over', '-composite',
   '-fill', STEEL, '-draw', `rectangle 0,0 ${W},7`,            // top accent bar
   `${T}_bg.png`]);

// ---------------- RIGHT VISUAL: homepage browser window + hardware strip ----------------
const win = browserWindow(`${IMG}/homepage.webp`, 1120, 760, 'home');
const winX = 1300, winY = 372;
// soft shadow
m(['-size', `${W}x${H}`, 'xc:none', '-fill', 'rgba(20,34,64,0.18)',
   '-draw', `roundrectangle ${winX + 14},${winY + 26},${winX + win.w + 14},${winY + win.h + 26},22,22`, '-blur', '0x34', `${T}_winshadow.png`]);

const hw = ['hardware-card-readers', 'hardware-check-scanners', 'hardware-instant-issuance', 'hardware-oem-components']
  .map((n, i) => thumb(`${IMG}/${n}.webp`, 262, 150, `hw${i}`));
const stripY = winY + win.h + 38, stripX = winX, gap = 24, tw = 262;

m([`${T}_bg.png`, '-compose', 'over',
   `${T}_winshadow.png`, '-composite',
   win.path, '-geometry', `+${winX}+${winY}`, '-composite',
   ...hw.flatMap((p, i) => [p, '-geometry', `+${stripX + i * (tw + gap)}+${stripY}`, '-composite']),
   `${T}_wp.png`]);

// ---------------- TEXT (left column) ----------------
const X = 140;
m([`${T}_wp.png`, '-gravity', 'northwest',
   // letterhead
   '-font', F.x, '-fill', INK, '-pointsize', '40', '-kerning', '-1', '-annotate', `+${X}+120`, 'MAGTEK',
   '-font', F.sb, '-fill', STEEL, '-pointsize', '21', '-kerning', '3', '-annotate', `+${X + 2}+188`, 'UX ENGINEERING & FRONTEND SYSTEMS',
   // period chip (right of text column)
   '-font', F.sb, '-fill', MUTE, '-pointsize', '20', '-kerning', '3', '-annotate', `+${X + 760}+128`, 'CURRENT · LIVE',
   '-fill', '#22B45E', '-draw', `circle ${X + 742},137 ${X + 742},131`,
   // letterhead rule
   '-stroke', LINE, '-strokewidth', '2', '-draw', `line ${X},244 ${X + 1010},244`, '-stroke', 'none',
   // headline
   '-font', F.b, '-fill', INK, '-pointsize', '108', '-kerning', '-3', '-annotate', `+${X}+392`, 'Eleven sites.',
   '-fill', STEEL, '-annotate', `+${X}+520`, 'One system.',
   // paragraph
   '-font', F.r, '-fill', BODY, '-pointsize', '28', '-annotate', `+${X}+632`, 'A shared component library on Razor partials — 100+',
   '-annotate', `+${X}+674`, 'strongly-typed components, built, owned, and migrated',
   '-annotate', `+${X}+716`, 'in place across MagTek’s web platform.',
   `${T}_txt.png`]);

// ---------------- METRIC BAND ----------------
const band = [
  ['$11B', 'PROCESSED', 'ANNUALLY'],
  ['99.9%', 'PLATFORM', 'UPTIME'],
  ['11', 'SITES', 'OWNED'],
  ['100+', 'SHARED', 'COMPONENTS'],
];
const bx = X, bw = 1010, cw = Math.round(bw / 4), bTop = 880, vY = 940, l1 = 1010, l2 = 1036;
const bandArgs = [`${T}_txt.png`, '-gravity', 'northwest',
  '-stroke', LINE, '-strokewidth', '2', '-draw', `line ${bx},${bTop} ${bx + bw},${bTop}`, '-stroke', 'none'];
band.forEach(([v, la, lb], i) => {
  const cx = bx + i * cw;
  if (i > 0) bandArgs.push('-stroke', LINE, '-strokewidth', '1.5', '-draw', `line ${cx - 8},${bTop + 28} ${cx - 8},${bTop + 150}`, '-stroke', 'none');
  bandArgs.push('-font', F.b, '-fill', STEELD, '-pointsize', '52', '-kerning', '-1', '-annotate', `+${cx + 4}+${vY}`, v);
  bandArgs.push('-font', F.sb, '-fill', MUTE, '-pointsize', '17', '-kerning', '2', '-annotate', `+${cx + 6}+${l1 + 18}`, la);
  bandArgs.push('-annotate', `+${cx + 6}+${l2 + 18}`, lb);
});
bandArgs.push(OUT);
m(bandArgs);

m([OUT, '-background', '#FFFFFF', '-alpha', 'remove', '-alpha', 'off', '-depth', '8', '-colorspace', 'sRGB', '-strip', OUT]);
console.log('magtek done →', dim(OUT).join('x'));
