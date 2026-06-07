import { execFileSync } from 'node:child_process';

const FROOT = '/Users/muhammedqadan/Documents/dev/car-spotter-game/node_modules/@expo-google-fonts/inter';
const F = {
  x: `${FROOT}/800ExtraBold/Inter_800ExtraBold.ttf`,
  b: `${FROOT}/700Bold/Inter_700Bold.ttf`,
  sb: `${FROOT}/600SemiBold/Inter_600SemiBold.ttf`,
  md: `${FROOT}/500Medium/Inter_500Medium.ttf`,
  r: `${FROOT}/400Regular/Inter_400Regular.ttf`,
};
const IMG = '/Users/muhammedqadan/Documents/dev/portfoliov2/public/images/financial-platforms';
const OUT = '/tmp/poster_investcloud_out.png';
const T = '/tmp/icl';
const W = 2560, H = 1600;

// Corporate navy palette — gold accent, restrained, trustworthy (wealth management).
const LIGHT = '#F4F7FB', BODY = '#A9B8CC', MUTE = '#7488A2';
const GOLD = '#C6A86B', GOLDB = '#D7BC82';
const LINE = '#26406B', CHROME = '#0E1F38', CHROMEBORDER = '#2C4A72';

const m = (a) => execFileSync('magick', a.map(String), { stdio: ['ignore', 'pipe', 'pipe'] });
const dim = (f) => execFileSync('magick', ['identify', '-format', '%w %h', f]).toString().split(' ').map(Number);

// ---- dark browser window (navy chrome + bar + muted dots), no shadow ----
function portalWindow(src, w, h, tag) {
  const bar = 44, rad = 16, cH = h - bar;
  m([src, '-resize', `${w}x${cH}^`, '-gravity', 'north', '-extent', `${w}x${cH}`, `${T}_${tag}_shot.png`]);
  m(['-size', `${w}x${h}`, 'xc:none', '-fill', CHROME, '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`, `${T}_${tag}_chrome.png`]);
  m([`${T}_${tag}_chrome.png`, `${T}_${tag}_shot.png`, '-geometry', `+0+${bar}`, '-compose', 'over', '-composite', `${T}_${tag}_w0.png`]);
  m([`${T}_${tag}_w0.png`, '(', '-size', `${w}x${h}`, 'xc:none', '-draw', `roundrectangle 0,0,${w - 1},${h - 1},${rad},${rad}`, ')', '-alpha', 'set', '-compose', 'DstIn', '-composite', `${T}_${tag}_w1.png`]);
  const dy = Math.round(bar / 2);
  m([`${T}_${tag}_w1.png`,
     '-stroke', 'none', '-fill', '#3C5A82', '-draw', `circle 26,${dy} 26,${dy - 5}`, '-draw', `circle 48,${dy} 48,${dy - 5}`, '-draw', `circle 70,${dy} 70,${dy - 5}`,
     '-fill', 'none', '-stroke', CHROMEBORDER, '-strokewidth', '1.5', '-draw', `roundrectangle 1,1,${w - 2},${h - 2},${rad},${rad}`,
     `${T}_${tag}_win.png`]);
  return { path: `${T}_${tag}_win.png`, w, h };
}

// ---------------- BACKGROUND (diagonal navy + subtle vignette) ----------------
const D = 3400;
m(['-size', `${D}x${D}`, 'gradient:#0A1526-#1E3A5F', '-rotate', '45', '-gravity', 'center', '-extent', `${W}x${H}`, `${T}_grad.png`]);
// faint navy grid (matched grammar with MagTek, barely there)
m(['-size', '84x84', 'xc:none', '-stroke', '#9FB6D40A', '-strokewidth', '1', '-draw', 'line 0,0 0,84', '-draw', 'line 0,0 84,0', '-write', 'mpr:cell', '+delete',
   '-size', `${W}x${H}`, 'tile:mpr:cell', `${T}_grid.png`]);
// soft gold glow upper-left (premium warmth)
m(['-size', `${W}x${H}`, 'xc:none', '-fill', 'rgba(198,168,107,0.10)', '-draw', 'translate 520,360 ellipse 0,0 760,520 0,360', '-blur', '0x150', `${T}_glow.png`]);
m(['-size', `${W}x${H}`, 'radial-gradient:rgba(0,0,0,0)-rgba(0,0,0,0.42)', `${T}_vig.png`]);
m([`${T}_grad.png`, `${T}_grid.png`, '-composite', `${T}_glow.png`, '-compose', 'screen', '-composite',
   `${T}_vig.png`, '-compose', 'over', '-composite',
   '-fill', GOLD, '-draw', `rectangle 0,0 ${W},7`,            // gold top accent
   `${T}_bg.png`]);

// ---------------- RIGHT VISUAL: two portal windows (different banks) ----------------
const winW = 1100, winH = 398, winX = 1300;
const top = portalWindow(`${IMG}/chase.webp`, winW, winH, 'chase');
const bot = portalWindow(`${IMG}/northwestern-mutual.webp`, winW, winH, 'nwm');
const topY = 372, botY = topY + winH + 40;
const shadow = (x, y, w, h) => ['-size', `${W}x${H}`, 'xc:none', '-fill', 'rgba(0,0,0,0.34)', '-draw', `roundrectangle ${x + 12},${y + 22},${x + w + 12},${y + h + 22},20,20`, '-blur', '0x30'];
m([...shadow(winX, topY, winW, winH), `${T}_sh1.png`]);
m([...shadow(winX, botY, winW, winH), `${T}_sh2.png`]);

m([`${T}_bg.png`, '-compose', 'over',
   `${T}_sh1.png`, '-composite', `${T}_sh2.png`, '-composite',
   top.path, '-geometry', `+${winX}+${topY}`, '-composite',
   bot.path, '-geometry', `+${winX}+${botY}`, '-composite',
   `${T}_wp.png`]);

// ---------------- TEXT (left column) ----------------
const X = 140;
m([`${T}_wp.png`, '-gravity', 'northwest',
   // letterhead
   '-font', F.x, '-fill', LIGHT, '-pointsize', '40', '-kerning', '-1', '-annotate', `+${X}+120`, 'INVESTCLOUD',
   '-font', F.sb, '-fill', GOLD, '-pointsize', '20', '-kerning', '3', '-annotate', `+${X + 2}+188`, 'FRONTEND IMPLEMENTATION & DESIGN TRANSLATION',
   // period chip
   '-font', F.sb, '-fill', MUTE, '-pointsize', '20', '-kerning', '3', '-annotate', `+${X + 838}+128`, 'EARLIER',
   '-fill', '#5B6E8A', '-draw', `circle ${X + 820},137 ${X + 820},131`,
   // letterhead rule
   '-stroke', LINE, '-strokewidth', '2', '-draw', `line ${X},244 ${X + 1010},244`, '-stroke', 'none',
   // headline
   '-font', F.b, '-fill', LIGHT, '-pointsize', '108', '-kerning', '-3', '-annotate', `+${X}+392`, '50+ institutions.',
   '-fill', GOLDB, '-annotate', `+${X}+520`, 'One platform.',
   // paragraph
   '-font', F.r, '-fill', BODY, '-pointsize', '28', '-annotate', `+${X}+632`, 'Hand-written CSS translating Figma intent into production',
   '-annotate', `+${X}+674`, 'advisor and client portals — per institution, on a shared',
   '-annotate', `+${X}+716`, 'multi-tenant substrate.',
   `${T}_txt.png`]);

// ---------------- METRIC BAND ----------------
const band = [
  ['50+', 'INSTITUTIONS', 'DEPLOYED'],
  ['0→PROD', 'ENGAGEMENTS', 'LED & SHIPPED'],
  ['6', 'NAMED', 'CLIENTS'],
  ['100%', 'HAND-WRITTEN', 'CSS'],
];
const bx = X, bw = 1010, cw = Math.round(bw / 4), bTop = 880, vY = 940;
const bandArgs = [`${T}_txt.png`, '-gravity', 'northwest',
  '-stroke', LINE, '-strokewidth', '2', '-draw', `line ${bx},${bTop} ${bx + bw},${bTop}`, '-stroke', 'none'];
band.forEach(([v, la, lb], i) => {
  const cx = bx + i * cw;
  if (i > 0) bandArgs.push('-stroke', LINE, '-strokewidth', '1.5', '-draw', `line ${cx - 8},${bTop + 28} ${cx - 8},${bTop + 150}`, '-stroke', 'none');
  bandArgs.push('-font', F.b, '-fill', GOLDB, '-pointsize', v.length > 3 ? '40' : '52', '-kerning', '-1', '-annotate', `+${cx + 4}+${v.length > 3 ? vY - 6 : vY}`, v);
  bandArgs.push('-font', F.sb, '-fill', MUTE, '-pointsize', '17', '-kerning', '2', '-annotate', `+${cx + 6}+1028`, la);
  bandArgs.push('-annotate', `+${cx + 6}+1054`, lb);
});
bandArgs.push(`${T}_band.png`);
m(bandArgs);

// Flatten FIRST (removes alpha + the stale page geometry from many composites) so the
// bottom-edge strip annotate lands at the real y instead of falling outside the page box.
m([`${T}_band.png`, '-background', '#0A1526', '-alpha', 'remove', '-alpha', 'off', '+repage', '-depth', '8', '-colorspace', 'sRGB', '-strip', `${T}_flat.png`]);

// ---------------- CLIENT TRUST STRIP (full-width bottom, on the clean flattened image) ----------------
const sy = 1474;
m([`${T}_flat.png`, '+repage', '-gravity', 'northwest',
   '-stroke', '#3A557F', '-strokewidth', '1.5', '-draw', `line ${X},${sy - 28} ${W - X},${sy - 28}`, '-stroke', 'none',
   '-font', F.sb, '-fill', GOLD, '-pointsize', '18', '-kerning', '4', '-annotate', `+${X}+${sy}`, 'DEPLOYED FOR',
   '-font', F.sb, '-fill', '#CBD7E8', '-pointsize', '22', '-kerning', '3', '-annotate', `+${X + 210}+${sy + 1}`,
   'CHASE      CETERA      NORTHWESTERN MUTUAL      VOYA      SILICON VALLEY BANK      EAST WEST BANK',
   '-alpha', 'off', '-depth', '8', '-colorspace', 'sRGB', '-strip', OUT]);
console.log('investcloud done →', dim(OUT).join('x'));
