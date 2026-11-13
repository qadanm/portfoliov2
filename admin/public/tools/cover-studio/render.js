export const COVER_WIDTH = 1080;
export const HEIGHTS = {'3:4': 1440, '4:5': 1350};

const COLORS = {
  cream: [247, 224, 172],
  white: [250, 249, 242],
  ink: [24, 28, 24],
  dark: [8, 11, 9],
  light: [246, 240, 222],
};

function luminance(rgb) {
  const c = rgb.map(v => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }
function samplePhoto(ctx, boxes) {
  const pixels = [];
  for (const box of boxes) {
    const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y));
    const w = Math.min(ctx.canvas.width - x, Math.ceil(box.w));
    const h = Math.min(ctx.canvas.height - y, Math.ceil(box.h));
    if (w <= 0 || h <= 0) continue;
    const {data} = ctx.getImageData(x, y, w, h);
    for (let py = 0; py < h; py += 12) {
      for (let px = 0; px < w; px += 12) {
        const i = (py * w + px) * 4;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  return pixels;
}
function chooseTreatment(pixels, requested) {
  const names = requested === 'auto' ? ['cream', 'white', 'ink'] : [requested];
  const candidates = names.map(name => {
    const fill = COLORS[name];
    const outline = name === 'ink' ? COLORS.light : COLORS.dark;
    const scores = pixels.map(pixel => ratio(fill, pixel)).sort((a, b) => a - b);
    const photoContrast = scores[Math.floor(scores.length * 0.25)] || 1;
    const preference = name === 'cream' ? 0 : name === 'white' ? 0.15 : 0.35;
    return {name, fill, outline, photoContrast, contrast: ratio(fill, outline), score: photoContrast - preference};
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
function titleLayout(ctx, raw) {
  const text = (raw || 'MODEL').trim().toUpperCase();
  const maxW = 948;
  for (let size = 242; size >= 64; size -= 2) {
    ctx.font = `800 ${size}px Barlow`;
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const joined = line ? `${line} ${word}` : word;
      if (ctx.measureText(joined).width <= maxW) { line = joined; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of word) {
        if (ctx.measureText(line + char).width > maxW && line) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 3 && lines.length * size * 0.85 + 25 <= 520) return {lines, size, lineHeight: size * 0.85};
  }
  return {lines: [text.slice(0, 14), text.slice(14, 28), text.slice(28)], size: 64, lineHeight: 54};
}
function drawPhoto(ctx, photo, crop) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const base = Math.max(w / photo.width, h / photo.height);
  const scale = base * Math.max(1, crop.zoom || 1);
  const dw = photo.width * scale, dh = photo.height * scale;
  const x = Math.min(0, Math.max(w - dw, (w - dw) / 2 + (crop.x || 0)));
  const y = Math.min(0, Math.max(h - dh, (h - dh) / 2 + (crop.y || 0)));
  ctx.drawImage(photo, x, y, dw, dh);
  return {x, y, dw, dh, offsetX: x - (w - dw) / 2, offsetY: y - (h - dh) / 2};
}
function drawTitleText(ctx, text, x, y, size, fill, lightText) {
  ctx.save();
  ctx.font = `800 ${size}px Barlow`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.48)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = rgba(lightText ? COLORS.dark : COLORS.light, 0.96);
  ctx.lineWidth = size > 180 ? 6 : 4;
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = rgba(fill, 1);
  ctx.fillText(text, x, y);
  ctx.restore();
}
function drawSmall(ctx, text, x, y, size, maxWidth, color = '#fffaf0', weight = 700, darkText = false, strong = false, align = 'left') {
  const value = (text || '').trim().toUpperCase();
  let s = size;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  while (s > 25) {
    ctx.font = `${weight} ${s}px Barlow`;
    if (ctx.measureText(value).width <= maxWidth) break;
    s--;
  }
  ctx.font = `${weight} ${s}px Barlow`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = strong ? (s >= 40 ? 6 : 5) : (s >= 40 ? 3 : 2.5);
  ctx.strokeStyle = darkText ? 'rgba(246,240,222,.95)' : 'rgba(8,11,9,.95)';
  ctx.shadowColor = strong ? 'rgba(0,0,0,.8)' : 'rgba(0,0,0,.5)';
  ctx.shadowBlur = strong ? 11 : 6;
  ctx.shadowOffsetX = strong ? 2 : 1;
  ctx.shadowOffsetY = strong ? 3 : 2;
  ctx.strokeText(value, x, y, maxWidth);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, maxWidth);
  ctx.restore();
  return s;
}
function footerLayout(ctx, raw, maxWidth) {
  const text = (raw || 'CITY, REGION').trim().toUpperCase();
  let fallback = [];
  for (let size = 44; size >= 24; size--) {
    ctx.font = `800 ${size}px Barlow`;
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const joined = line ? `${line} ${word}` : word;
      if (ctx.measureText(joined).width <= maxWidth) { line = joined; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of word) {
        if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2) return {lines, size};
    fallback = lines;
  }
  const lines = [fallback[0], fallback.slice(1).join(' ')];
  ctx.font = '800 24px Barlow';
  while (lines[1] && ctx.measureText(lines[1] + '…').width > maxWidth) lines[1] = lines[1].slice(0, -1);
  lines[1] += '…';
  return {lines, size: 24};
}
function drawFooterPlace(ctx, raw, x, y, maxWidth) {
  const layout = footerLayout(ctx, raw, maxWidth);
  layout.lines.forEach((line, index) => drawSmall(ctx, line, x, y + index * (layout.size * 0.82), layout.size, maxWidth, '#fffaf2', 800, false, true));
  return layout.lines.length;
}
function drawFlag(ctx, code, x, y, cache, redraw) {
  if (!code) return 0;
  const url = code.includes('-') ? `assets/flags/region/${code}.png` : `assets/flags/country/${code.toLowerCase()}.svg`;
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    cache.set(url, img);
    img.onload = redraw;
    img.onerror = redraw;
    img.src = url;
  }
  if (!img.complete || !img.naturalWidth) return 0;
  const ratio = img.naturalWidth / img.naturalHeight;
  const height = 60;
  const width = Math.min(106, Math.round(height * ratio));
  const drawnHeight = Math.round(width / ratio);
  const top = y + (height - drawnHeight) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.58)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.drawImage(img, x, top, width, drawnHeight);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(8,11,9,.78)';
  ctx.strokeRect(x + 0.75, top + 0.75, width - 1.5, drawnHeight - 1.5);
  ctx.restore();
  return width;
}
export function renderCover(canvas, photo, state, flagCache, redraw) {
  const h = HEIGHTS[state.format] || 1440;
  if (canvas.width !== COVER_WIDTH) canvas.width = COVER_WIDTH;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.clearRect(0, 0, COVER_WIDTH, h);
  if (!photo) return {zones: {}, contrast: null, photoBox: null};
  const photoBox = drawPhoto(ctx, photo, state.crop);
  const title = titleLayout(ctx, state.title);
  const titleY = 125, lineH = title.lineHeight;
  const titleH = title.lines.length * lineH + 25;
  ctx.font = `800 ${title.size}px Barlow`;
  const bottomLine = title.lines[title.lines.length - 1];
  const bottomWidth = ctx.measureText(bottomLine).width;
  const subtitleRight = (COVER_WIDTH + bottomWidth) / 2;
  const titlePixels = samplePhoto(ctx, title.lines.map((line, index) => {
    const width = ctx.measureText(line).width;
    return {x: (COVER_WIDTH - width) / 2, y: titleY + index * lineH, w: width, h: title.size * 0.72};
  }));
  const treatment = chooseTreatment(titlePixels, state.titleColor || 'auto');

  drawSmall(ctx, state.eyebrow || 'MAKE', 65, 51, 43, 920, treatment.name === 'ink' ? '#182019' : '#f8f3e7', 700, treatment.name === 'ink');
  title.lines.forEach((line, i) => drawTitleText(ctx, line, COVER_WIDTH / 2, titleY + i * lineH, title.size, treatment.fill, treatment.name !== 'ink'));
  let subtitleZone = null;
  if (state.subtitle && state.subtitle.trim()) {
    const sy = titleY + titleH + 9;
    const subtitleMaxWidth = Math.max(1, bottomWidth - 5);
    const subtitleSize = drawSmall(ctx, state.subtitle, subtitleRight, sy, 52, subtitleMaxWidth, treatment.name === 'ink' ? '#182019' : '#f6e2af', 700, treatment.name === 'ink', false, 'right');
    ctx.font = `700 ${subtitleSize}px Barlow`;
    const subtitleWidth = Math.min(ctx.measureText(state.subtitle.trim().toUpperCase()).width, subtitleMaxWidth);
    subtitleZone = {x: subtitleRight - subtitleWidth - 8, y: sy - 5, w: subtitleWidth + 16, h: 70};
  }

  const labelY = h - 203, placeY = h - 164, flagsY = h - 105;
  const columnW = state.showPlates ? 490 : 940;
  drawSmall(ctx, 'SPOTTED IN', 48, labelY, 34, columnW, '#fffaf2', 800, false, true);
  const spottedLines = drawFooterPlace(ctx, state.spottedPlace || 'CITY, REGION', 48, placeY, columnW);
  let fx = 51;
  for (const code of [state.spottedRegion, state.spottedCountry]) {
    const width = drawFlag(ctx, code, fx, spottedLines > 1 ? h - 72 : flagsY, flagCache, redraw);
    if (width) fx += width + 13;
  }
  if (state.showPlates) {
    ctx.fillStyle = 'rgba(255,255,255,.21)';
    ctx.fillRect(535, labelY, 1, 147);
    drawSmall(ctx, 'PLATES FROM', 565, labelY, 34, 468, '#fffaf2', 800, false, true);
    const plateLines = drawFooterPlace(ctx, state.platesPlace || 'REGION, COUNTRY', 565, placeY, 465);
    let px = 568;
    for (const code of [state.platesRegion, state.platesCountry]) {
      const width = drawFlag(ctx, code, px, plateLines > 1 ? h - 72 : flagsY, flagCache, redraw);
      if (width) px += width + 13;
    }
  }
  ctx.font = '700 30px Barlow';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0,0,0,.95)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,11,9,.95)';
  ctx.strokeText(state.handle || '@qadantravels', 1031, h - 41);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.fillText(state.handle || '@qadantravels', 1031, h - 41);
  ctx.textAlign = 'left';

  const zones = {
    eyebrow: {x: 55, y: 41, w: 970, h: 70},
    title: {x: 53, y: titleY - 6, w: 975, h: titleH + 12},
    spottedPlace: {x: 37, y: labelY - 9, w: state.showPlates ? 493 : 980, h: 164},
    handle: {x: 742, y: h - 58, w: 300, h: 55},
  };
  if (subtitleZone) zones.subtitle = subtitleZone;
  if (state.showPlates) zones.platesPlace = {x: 550, y: labelY - 9, w: 485, h: 164};
  return {zones, contrast: {title: treatment.contrast, footer: ratio(COLORS.white, COLORS.dark), name: treatment.name, alpha: 0}, photoBox};
}
