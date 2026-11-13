const asset = path => new URL(`endcards/${path}`, import.meta.url).href;
const imagePromises = new Map();

function image(path) {
  if (!imagePromises.has(path)) imagePromises.set(path, new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${path}`));
    img.src = asset(path);
  }));
  return imagePromises.get(path);
}

export async function loadEndcards() {
  const response = await fetch(asset('rounds.json'));
  if (!response.ok) throw new Error('Could not load the endcard collection');
  return (await response.json()).map(card => ({...card, photo: `photos/${card.slug}.${card.slug === '11-saturn-sw' ? 'png' : 'jpg'}`}));
}

export function randomEndcard(cards, previousSlug = '') {
  if (!cards.length) return null;
  if (cards.length === 1) return cards[0];
  const eligible = cards.filter(card => card.slug !== previousSlug);
  const number = new Uint32Array(1);
  crypto.getRandomValues(number);
  return eligible[number[0] % eligible.length];
}

const INK = '#101411';
const PANEL = '#1e2520';
const CREAM = '#f4f0e6';
const LIME = '#d7ff24';
const MUTED = '#c6cdbf';

function font(size, weight = 600) { return `${weight} ${size}px Barlow, Arial, sans-serif`; }
function fittedText(ctx, text, x, y, maxWidth, size, color = CREAM, weight = 800) {
  ctx.fillStyle = color;
  let actual = size;
  do { ctx.font = font(actual, weight); actual -= 2; } while (ctx.measureText(text).width > maxWidth && actual > 25);
  ctx.fillText(text, x, y);
}
function wrap(ctx, text, x, y, width, lineHeight, maxLines = 4) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= width || !line) line = trial;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  for (const [index, value] of lines.slice(0, maxLines).entries()) ctx.fillText(value, x, y + index * lineHeight);
}
function roundedClip(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}
function corner(ctx, x, y, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(x + dx * 28, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 28);
  ctx.stroke();
}
function contain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return {x: dx, y: dy, scale};
}

export async function renderEndcard(canvas, card, format = '4:5') {
  if (!card) throw new Error('Choose an endcard');
  await Promise.all([document.fonts.load(font(100, 800)), document.fonts.load(font(48, 600))]);
  const [photo, logo, avatar, badge] = await Promise.all([
    image(card.photo), image('carspotter-lockup.svg'), image('qadantravels-avatar.png'), image('download-on-app-store.svg'),
  ]);
  const width = 1080, height = format === '3:4' ? 1440 : 1350;
  const stretch = height / 1350;
  const Y = number => number * stretch;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = INK; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LIME; ctx.fillRect(0, 0, width, 12);

  // The creator signature borrows the warmth of the carousel covers; the game owns the page.
  ctx.save(); roundedClip(ctx, 60, Y(48), 74, 74, 37);
  ctx.drawImage(avatar, 60, Y(48), 74, 74); ctx.restore();
  ctx.strokeStyle = CREAM; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(97, Y(48) + 37, 37, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = CREAM; ctx.font = font(39, 600); ctx.fillText('@qadantravels', 155, Y(99));
  ctx.drawImage(logo, 60, Y(150), 650, 142);
  // An editorial note fills the open corner without resembling a control.
  ctx.fillStyle = CREAM; ctx.font = font(42, 600); ctx.fillText('download', 755, Y(146));
  ctx.fillStyle = LIME; ctx.font = font(52, 800); ctx.fillText('my game', 755, Y(198));
  const smileX = 987, smileY = Y(127);
  ctx.strokeStyle = LIME; ctx.lineWidth = 3.7;
  ctx.beginPath(); ctx.arc(smileX, smileY, 24, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(smileX - 12, smileY + 4);
  ctx.quadraticCurveTo(smileX, smileY + 19, smileX + 13, smileY + 3); ctx.stroke();
  ctx.fillStyle = LIME;
  ctx.beginPath(); ctx.arc(smileX - 8, smileY - 7, 3.2, 0, Math.PI * 2);
  ctx.arc(smileX + 8, smileY - 6, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .45;
  ctx.beginPath(); ctx.arc(smileX - 17, smileY + 3, 3, 0, Math.PI * 2);
  ctx.arc(smileX + 18, smileY + 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#56634d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, Y(300)); ctx.lineTo(1020, Y(300)); ctx.stroke();

  fittedText(ctx, 'KNOW THIS CAR?', 60, Y(402), 960, 105, CREAM);
  ctx.fillStyle = LIME; ctx.font = font(31, 700); ctx.fillText('ONE DETAIL.', 60, Y(444));

  const clue = {x: 60, y: Y(467), w: 690, h: 414};
  ctx.save(); roundedClip(ctx, clue.x, clue.y, clue.w, clue.h);
  const [cx, cy, cw, ch] = card.crop;
  ctx.drawImage(photo, cx, cy, cw, ch, clue.x, clue.y, clue.w, clue.h);
  ctx.restore();
  ctx.strokeStyle = LIME; ctx.lineWidth = 6;
  corner(ctx, 77, clue.y + 17, 1, 1);
  corner(ctx, 733, clue.y + 17, -1, 1);
  corner(ctx, 77, clue.y + clue.h - 17, 1, -1);
  corner(ctx, 733, clue.y + clue.h - 17, -1, -1);

  ctx.fillStyle = MUTED; ctx.font = font(47, 600);
  wrap(ctx, card.caption, 787, Y(535), 230, Y(54), 4);
  ctx.fillStyle = LIME; ctx.font = font(42, 800);
  ctx.fillText('4 CHOICES.', 787, Y(788));

  ctx.fillStyle = CREAM; ctx.font = font(72, 800);
  ctx.fillText('THEN', 60, Y(967));
  ctx.fillText('THE', 60, Y(1041));
  ctx.fillStyle = LIME; ctx.fillText('REVEAL.', 60, Y(1115));

  const reveal = {x: 403, y: Y(852), w: 617, h: Y(274)};
  ctx.fillStyle = PANEL; ctx.fillRect(reveal.x - 10, reveal.y - 10, reveal.w + 20, reveal.h + 20);
  ctx.save(); roundedClip(ctx, reveal.x, reveal.y, reveal.w, reveal.h, 4);
  const placed = contain(ctx, photo, reveal.x, reveal.y, reveal.w, reveal.h);
  ctx.restore();
  ctx.strokeStyle = LIME; ctx.lineWidth = 3;
  ctx.strokeRect(placed.x + cx * placed.scale, placed.y + cy * placed.scale, cw * placed.scale, ch * placed.scale);
  fittedText(ctx, card.name.toUpperCase(), 403, Y(1183), 617, 58, CREAM, 700);

  ctx.strokeStyle = '#56634d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, Y(1210)); ctx.lineTo(1020, Y(1210)); ctx.stroke();
  ctx.fillStyle = LIME; ctx.font = font(53, 800); ctx.fillText('LINK IN MY BIO', 60, Y(1294));
  ctx.drawImage(badge, 692, Y(1230), 328, 109);
  return canvas;
}
