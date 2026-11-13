import {renderCover, COVER_WIDTH, HEIGHTS} from './render.js?v=3';
import {loadEndcards, randomEndcard, renderEndcard} from './endcards.js?v=3';
import {zipFiles} from './zip.js?v=3';
import {startUpdateChecks} from '../../update-check.js?v=3';

const $ = id => document.getElementById(id);
const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canvas = $('coverCanvas');
const stage = $('stage');
const hitLayer = $('hitLayer');
const photoInput = $('photoInput');
const fieldInputs = Object.fromEntries([...document.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
const flagPreviews = {
  spottedRegion: $('spottedRegionPreview'), spottedCountry: $('spottedCountryPreview'),
  platesRegion: $('platesRegionPreview'), platesCountry: $('platesCountryPreview'),
};
const fieldNames = {eyebrow: 'Eyebrow / make', title: 'Large title', subtitle: 'Small title line', spottedPlace: 'Spotted in', platesPlace: 'Plates from', handle: 'Signature'};
const initial = {
  eyebrow: 'MAKE', title: 'MODEL', subtitle: '', spottedPlace: 'CITY, REGION',
  platesPlace: '', handle: '@qadantravels', showPlates: false,
  spottedRegion: '', spottedCountry: '', platesRegion: '', platesCountry: '',
  titleColor: 'auto', format: '3:4', crop: {x: 0, y: 0, zoom: 1}, endcardSlug: '',
  manualFlags: {spottedRegion: false, spottedCountry: false, platesRegion: false, platesCountry: false},
};
let state = structuredClone(initial);
let photo = null, photoBlob = null, catalog = {countries: [], regions: []};
let flagTarget = null, activeFlagCountry = 'all', selectedField = null, lastRender = null, drawing = false;
let saveTimer = 0, toastTimer = 0, activeDrag = null;
let endcards = [], endcardPreviewVersion = 0;
const flagCache = new Map();

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3700);
}
function setBusy(on, message = 'Preparing photo…') {
  $('busyOverlay').hidden = !on;
  $('busyOverlay').querySelector('span').textContent = message;
}
function updateEnabled() {
  const has = !!photo;
  $('emptyState').hidden = has;
  hitLayer.hidden = !has;
  $('downloadButton').disabled = !has;
  $('downloadButtonSide').disabled = !has;
  $('coverOnlyButton').disabled = !has;
  $('zoomSlider').disabled = !has;
  $('resetCrop').disabled = !has;
  $('stagePhotoActions').hidden = !has;
  $('replacePhoto').textContent = has ? 'Replace photo' : 'Add photo';
  $('shareButton').hidden = !has || (!appleMobile && !navigator.share);
}
function syncForm() {
  for (const [key, input] of Object.entries(fieldInputs)) input.value = state[key] || '';
  $('platesToggle').checked = state.showPlates;
  $('platesFields').hidden = !state.showPlates;
  $('titleColor').value = state.titleColor;
  $('formatSelect').value = state.format;
  $('dimensionChip').textContent = `1080 × ${HEIGHTS[state.format]}`;
  stage.style.aspectRatio = `1080 / ${HEIGHTS[state.format]}`;
  $('endcardPreview').style.aspectRatio = `1080 / ${HEIGHTS[state.format]}`;
  $('zoomSlider').value = Math.round(state.crop.zoom * 100);
  $('zoomValue').textContent = `${Math.round(state.crop.zoom * 100)}%`;
  for (const [key, el] of Object.entries(flagPreviews)) {
    const code = state[key];
    el.replaceChildren();
    if (code) {
      const img = document.createElement('img');
      img.alt = code;
      img.src = flagUrl(code);
      el.appendChild(img);
    } else el.textContent = '+';
  }
}
function flagUrl(code) { return code.includes('-') ? `assets/flags/region/${code}.png` : `assets/flags/country/${code.toLowerCase()}.svg`; }
function render() {
  if (drawing) return;
  drawing = true;
  requestAnimationFrame(() => {
    drawing = false;
    lastRender = renderCover(canvas, photo, state, flagCache, render);
    renderHits(lastRender.zones);
    if (lastRender.contrast) {
      const c = lastRender.contrast;
      $('contrastReadout').textContent = `Title ${c.name} · minimum ${c.title.toFixed(1)}:1 contrast · photo shading ${Math.round(c.alpha * 100)}%`;
      $('stageNote').textContent = c.alpha > .4 ? 'A stronger title backing was added for this photo.' : 'The photo keeps a light touch; lettering stays readable.';
    } else {
      $('contrastReadout').textContent = 'Contrast is measured after you add a photo.';
      $('stageNote').textContent = 'The preview and saved image use the same renderer.';
    }
  });
}
function renderHits(zones) {
  hitLayer.replaceChildren();
  for (const [field, box] of Object.entries(zones)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hit${selectedField === field ? ' active' : ''}`;
    button.dataset.hint = 'Edit ' + (fieldNames[field] || field);
    button.setAttribute('aria-label', 'Edit ' + (fieldNames[field] || field));
    button.style.left = `${box.x / COVER_WIDTH * 100}%`;
    button.style.top = `${box.y / HEIGHTS[state.format] * 100}%`;
    button.style.width = `${box.w / COVER_WIDTH * 100}%`;
    button.style.height = `${box.h / HEIGHTS[state.format] * 100}%`;
    button.addEventListener('click', () => selectField(field));
    hitLayer.appendChild(button);
  }
}
function selectField(field) {
  selectedField = field;
  render();
  if (matchMedia('(max-width: 900px)').matches) {
    const bar = $('quickEdit');
    $('quickEditLabel').textContent = fieldNames[field];
    $('quickEditInput').value = state[field] || '';
    $('quickEditInput').maxLength = field === 'spottedPlace' || field === 'platesPlace' ? 64 : 42;
    bar.hidden = false;
    $('quickEditInput').focus();
    $('quickEditInput').select();
  } else {
    fieldInputs[field]?.focus();
    fieldInputs[field]?.select();
  }
}
function closeQuickEdit() { $('quickEdit').hidden = true; selectedField = null; render(); }
function normalize(s) { return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function detectFlags(text) {
  const parts = text.split(',').map(normalize).filter(Boolean);
  let region = catalog.regions.find(r => parts.some(p => normalize(r.name) === p || normalize(r.code) === p));
  let country = catalog.countries.find(c => parts.some(p => normalize(c.name) === p || normalize(c.code) === p));
  if (!country && region) country = catalog.countries.find(c => c.code === region.country);
  if (!country) {
    const aliases = {usa: 'US', 'united states': 'US', america: 'US', uk: 'GB', 'united kingdom': 'GB', uae: 'AE'};
    const code = parts.map(p => aliases[p]).find(Boolean);
    if (code) country = catalog.countries.find(c => c.code === code);
  }
  return {region: region?.code || '', country: country?.code || ''};
}
function applyLocationFlags(field) {
  const prefix = field === 'spottedPlace' ? 'spotted' : 'plates';
  const codes = detectFlags(state[field]);
  if (!state.manualFlags[`${prefix}Region`]) state[`${prefix}Region`] = codes.region;
  if (!state.manualFlags[`${prefix}Country`]) state[`${prefix}Country`] = codes.country;
}
function updateField(field, value, origin = 'form') {
  state[field] = value;
  if (origin !== 'form' && fieldInputs[field]) fieldInputs[field].value = value;
  if (origin !== 'quick' && selectedField === field && !$('quickEdit').hidden) $('quickEditInput').value = value;
  if (field === 'spottedPlace' || field === 'platesPlace') applyLocationFlags(field);
  syncFlagPreviews();
  render();
  queueSave();
}
function syncFlagPreviews() {
  for (const [key, el] of Object.entries(flagPreviews)) {
    const code = state[key];
    el.replaceChildren();
    if (!code) { el.textContent = '+'; continue; }
    const img = document.createElement('img');
    img.alt = code;
    img.src = flagUrl(code);
    img.onerror = () => { el.textContent = code; };
    el.appendChild(img);
  }
}
function openFlagPicker(key) {
  flagTarget = key;
  const isRegion = key.endsWith('Region');
  activeFlagCountry = 'all';
  $('flagDialogTitle').textContent = key.toLowerCase().includes('plates') ? 'Plate origin flag' : 'Spotted location flag';
  $('flagDialogHint').textContent = isRegion ? 'Choose a state, province, or territory' : 'Choose a country';
  $('flagRegionFilters').hidden = !isRegion;
  $('flagSearch').placeholder = isRegion ? 'Search e.g. Oregon or Sonora' : 'Search e.g. United States or Mexico';
  $('flagSearch').value = '';
  showFlagResults();
  $('flagDialog').showModal();
  $('flagSearch').focus();
}
function showFlagResults() {
  const query = normalize($('flagSearch').value);
  const isRegion = flagTarget?.endsWith('Region');
  const entries = isRegion ? catalog.regions : catalog.countries;
  for (const button of $('flagRegionFilters').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.countryFilter === activeFlagCountry));
  const countryNames = {US: 'united states', CA: 'canada', MX: 'mexico'};
  const matches = entries.filter(entry => {
    if (isRegion && activeFlagCountry !== 'all' && entry.country !== activeFlagCountry) return false;
    return !query || normalize(entry.name).includes(query) || normalize(entry.code).includes(query) || (isRegion && countryNames[entry.country]?.includes(query));
  });
  const results = matches.filter((entry, index) => matches.findIndex(other => other.code === entry.code) === index);
  if (isRegion) results.sort((a, b) => ['US', 'CA', 'MX'].indexOf(a.country) - ['US', 'CA', 'MX'].indexOf(b.country) || a.name.localeCompare(b.name));
  $('flagCount').textContent = `${results.length} ${isRegion ? 'regional' : 'country'} flag${results.length === 1 ? '' : 's'}`;
  const container = $('flagResults');
  container.replaceChildren();
  if (!results.length) { const p = document.createElement('p'); p.className = 'flag-empty'; p.textContent = 'No matching flag. You can leave this slot empty.'; container.appendChild(p); return; }
  for (const entry of results) {
    const button = document.createElement('button');
    button.className = 'flag-option'; button.type = 'button';
    const img = document.createElement('img'); img.src = entry.asset; img.alt = '';
    const label = document.createElement('span'); label.textContent = entry.name;
    const code = document.createElement('small'); code.textContent = entry.code;
    button.append(img, label, code);
    button.addEventListener('click', () => {
      state[flagTarget] = entry.code;
      state.manualFlags[flagTarget] = true;
      if (isRegion) {
        const countryKey = flagTarget.replace('Region', 'Country');
        if (!state.manualFlags[countryKey]) state[countryKey] = entry.country;
      }
      syncFlagPreviews(); render(); queueSave(); $('flagDialog').close();
    });
    container.appendChild(button);
  }
}
function openPhotoPicker() { photoInput.click(); }
async function loadHeicFallback(file) {
  if (!window.HeicTo) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/heic-to.js'; script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return await window.HeicTo({blob: file, type: 'image/jpeg', quality: 0.92});
}
async function decodePhoto(blob) {
  try { return await createImageBitmap(blob, {imageOrientation: 'from-image'}); }
  catch (error) {
    const isHeic = /\.(heic|heif)$/i.test(blob.name || '') || /heic|heif/i.test(blob.type || '');
    if (!isHeic) throw error;
    setBusy(true, 'Converting HEIC on this device…');
    const jpeg = await loadHeicFallback(blob);
    return await createImageBitmap(jpeg);
  }
}
async function usePhoto(file, restore = false) {
  if (!file) return;
  if (file.size > 80 * 1024 * 1024) { toast('This photo is over 80 MB. Choose a smaller file.'); return; }
  setBusy(true);
  try {
    const image = await decodePhoto(file);
    if (photo?.close) photo.close();
    photo = image;
    photoBlob = file;
    if (!restore) state.crop = {x: 0, y: 0, zoom: 1};
    updateEnabled(); syncForm(); render(); queueSave();
    if (!restore) toast('Photo added. Tap the cover text to edit it.');
  } catch (error) {
    console.error(error);
    toast('Could not open this image. Try a JPEG, PNG, or another HEIC.');
  } finally { setBusy(false); photoInput.value = ''; }
}
function onDragStart(event) {
  if (!photo || event.target !== canvas) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  activeDrag = {id: event.pointerId, x: event.clientX, y: event.clientY, cropX: state.crop.x, cropY: state.crop.y};
}
function onDragMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.id) return;
  const rect = canvas.getBoundingClientRect();
  state.crop.x = activeDrag.cropX + (event.clientX - activeDrag.x) * COVER_WIDTH / rect.width;
  state.crop.y = activeDrag.cropY + (event.clientY - activeDrag.y) * HEIGHTS[state.format] / rect.height;
  render();
}
function onDragEnd(event) {
  if (!activeDrag || event.pointerId !== activeDrag.id) return;
  activeDrag = null;
  const w = COVER_WIDTH, h = HEIGHTS[state.format];
  const scale = Math.max(w / photo.width, h / photo.height) * state.crop.zoom;
  const dw = photo.width * scale, dh = photo.height * scale;
  state.crop.x = Math.min(0, Math.max(w - dw, (w - dw) / 2 + state.crop.x)) - (w - dw) / 2;
  state.crop.y = Math.min(0, Math.max(h - dh, (h - dh) / 2 + state.crop.y)) - (h - dh) / 2;
  queueSave();
}
function clearDraft() {
  $('newCoverDialog').close();
  if (photo?.close) photo.close();
  photo = null; photoBlob = null; state = structuredClone(initial);
  state.endcardSlug = randomEndcard(endcards)?.slug || '';
  updateEndcardPreview();
  selectedField = null; closeQuickEdit(); syncForm(); updateEnabled(); render(); queueSave();
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('qadan-cover-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('draft');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveDraft() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('draft', 'readwrite');
      tx.objectStore('draft').put({state, photoBlob}, 'current');
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
    $('saveStatus').textContent = 'Saved on this device';
    return true;
  } catch (error) { $('saveStatus').textContent = 'Session only'; return false; }
}
function queueSave() {
  $('saveStatus').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 500);
}
async function restoreDraft() {
  try {
    const db = await openDB();
    const draft = await new Promise((resolve, reject) => {
      const tx = db.transaction('draft', 'readonly');
      const req = tx.objectStore('draft').get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!draft) return;
    state = {...structuredClone(initial), ...draft.state, crop: {...initial.crop, ...draft.state.crop}, manualFlags: {...initial.manualFlags, ...draft.state.manualFlags}};
    syncForm();
    if (draft.photoBlob) await usePhoto(draft.photoBlob, true);
    $('saveStatus').textContent = 'Saved on this device';
  } catch (error) { $('saveStatus').textContent = 'Ready'; }
}
function validateCover() {
  if (!photo) { toast('Choose a photo first.'); return false; }
  const required = [['eyebrow', 'MAKE'], ['title', 'MODEL'], ['spottedPlace', 'CITY, REGION']];
  for (const [field, placeholder] of required) {
    if (!state[field]?.trim() || state[field].trim().toUpperCase() === placeholder) {
      selectField(field);
      toast(`Replace “${placeholder}” before saving.`);
      return false;
    }
  }
  if (state.showPlates && !state.platesPlace.trim()) { selectField('platesPlace'); toast('Add the plate origin or turn that section off.'); return false; }
  return true;
}
function canvasBlob(target) { return new Promise(resolve => target.toBlob(resolve, 'image/png')); }
async function waitForFlags() {
  const codes = [state.spottedRegion, state.spottedCountry];
  if (state.showPlates) codes.push(state.platesRegion, state.platesCountry);
  await Promise.all(codes.filter(Boolean).map(code => new Promise(resolve => {
    const url = flagUrl(code);
    let image = flagCache.get(url);
    if (image?.complete) { resolve(); return; }
    if (!image) { image = new Image(); flagCache.set(url, image); }
    image.addEventListener('load', resolve, {once: true});
    image.addEventListener('error', resolve, {once: true});
    if (!image.src) image.src = url;
  })));
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function selectedEndcard() { return endcards.find(card => card.slug === state.endcardSlug); }
function copyEndcardToDialog() {
  const source = $('endcardPreview'), target = $('endcardLargePreview');
  target.width = source.width; target.height = source.height;
  target.getContext('2d').drawImage(source, 0, 0);
  $('endcardDialogName').textContent = selectedEndcard()?.name || 'CarSpotter';
}
async function updateEndcardPreview() {
  const card = selectedEndcard();
  $('shuffleEndcard').disabled = endcards.length < 2;
  $('endcardPreviewButton').disabled = true;
  $('endcardName').textContent = card?.name || 'Cards unavailable';
  if (!card) return;
  const version = ++endcardPreviewVersion;
  try {
    const preview = document.createElement('canvas');
    await renderEndcard(preview, card, state.format);
    if (version !== endcardPreviewVersion) return;
    const visible = $('endcardPreview');
    visible.width = preview.width; visible.height = preview.height;
    visible.getContext('2d').drawImage(preview, 0, 0);
    visible.setAttribute('aria-label', `${card.name} CarSpotter endcard preview`);
    $('endcardPreviewButton').disabled = false;
    if ($('endcardDialog').open) copyEndcardToDialog();
  } catch (error) {
    console.error(error);
    $('endcardName').textContent = 'Card preview unavailable';
  }
}
function pickAnotherEndcard() {
  const next = randomEndcard(endcards, state.endcardSlug);
  if (!next) return;
  state.endcardSlug = next.slug;
  updateEndcardPreview(); queueSave();
}
async function exportImage(mode = 'pair') {
  if (!validateCover()) return;
  const card = selectedEndcard();
  if (mode !== 'cover' && !card) { toast('Endcards are unavailable. Reload the page or download the cover only.'); return; }
  setBusy(true, 'Preparing your slides…');
  try {
    await document.fonts.ready;
    await waitForFlags();
    lastRender = renderCover(canvas, photo, state, flagCache, render);
    const coverBlob = await canvasBlob(canvas);
    if (!coverBlob) throw new Error('Could not create the cover PNG');
    const base = `${state.eyebrow}-${state.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'cover';
    if (mode === 'cover') {
      saveBlob(coverBlob, `${base}-cover.png`);
      toast('Cover PNG saved.');
      return;
    }
    const endcardCanvas = document.createElement('canvas');
    await renderEndcard(endcardCanvas, card, state.format);
    const endcardBlob = await canvasBlob(endcardCanvas);
    if (!endcardBlob) throw new Error('Could not create the endcard PNG');
    const files = [
      new File([coverBlob], `01-${base}-cover.png`, {type: 'image/png'}),
      new File([endcardBlob], `02-carspotter-${card.slug}-endcard.png`, {type: 'image/png'}),
    ];
    if (mode === 'share' && navigator.canShare?.({files})) {
      setBusy(false);
      try { await navigator.share({files}); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    const archive = await zipFiles(files);
    saveBlob(archive, `${base}-carousel.zip`);
    toast(mode === 'share' ? 'Saving to Photos is unavailable here. Downloaded both slides as a ZIP.' : 'Two slides saved in one ZIP.');
  } catch (error) {
    console.error(error);
    toast('Could not export the slides. Please try again.');
  } finally {
    setBusy(false);
  }
}

for (const [field, input] of Object.entries(fieldInputs)) input.addEventListener('input', () => updateField(field, input.value));
for (const button of document.querySelectorAll('[data-flag]')) button.addEventListener('click', () => openFlagPicker(button.dataset.flag));
for (const id of ['choosePhoto', 'replacePhoto']) $(id).addEventListener('click', openPhotoPicker);
$('changePhotoBelow').addEventListener('click', openPhotoPicker);
$('newCover').addEventListener('click', () => $('newCoverDialog').showModal());
$('cancelNewCover').addEventListener('click', () => $('newCoverDialog').close());
$('confirmNewCover').addEventListener('click', clearDraft);
photoInput.addEventListener('change', () => usePhoto(photoInput.files[0]));
$('platesToggle').addEventListener('change', event => { state.showPlates = event.target.checked; $('platesFields').hidden = !state.showPlates; render(); queueSave(); if (state.showPlates) $('platesInput').focus(); });
$('titleColor').addEventListener('change', event => { state.titleColor = event.target.value; render(); queueSave(); });
$('formatSelect').addEventListener('change', event => { state.format = event.target.value; syncForm(); render(); updateEndcardPreview(); queueSave(); });
$('zoomSlider').addEventListener('input', event => { state.crop.zoom = Number(event.target.value) / 100; $('zoomValue').textContent = event.target.value + '%'; render(); queueSave(); });
$('resetCrop').addEventListener('click', () => { state.crop = {x: 0, y: 0, zoom: 1}; syncForm(); render(); queueSave(); });
$('quickEditInput').addEventListener('input', event => { if (selectedField) updateField(selectedField, event.target.value, 'quick'); });
$('quickEditDone').addEventListener('click', closeQuickEdit);
$('quickEditInput').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); closeQuickEdit(); } });
$('flagSearch').addEventListener('input', showFlagResults);
for (const button of $('flagRegionFilters').querySelectorAll('button')) button.addEventListener('click', () => { activeFlagCountry = button.dataset.countryFilter; showFlagResults(); });
$('clearFlag').addEventListener('click', () => { state[flagTarget] = ''; state.manualFlags[flagTarget] = true; syncFlagPreviews(); render(); queueSave(); $('flagDialog').close(); });
$('closeFlagDialog').addEventListener('click', () => $('flagDialog').close());
$('downloadButton').addEventListener('click', () => exportImage(appleMobile ? 'share' : 'pair'));
$('downloadButtonSide').addEventListener('click', () => exportImage(appleMobile ? 'share' : 'pair'));
$('shareButton').addEventListener('click', () => exportImage(appleMobile ? 'pair' : 'share'));
$('coverOnlyButton').addEventListener('click', () => exportImage('cover'));
$('shuffleEndcard').addEventListener('click', pickAnotherEndcard);
$('shuffleEndcardDialog').addEventListener('click', pickAnotherEndcard);
$('endcardPreviewButton').addEventListener('click', () => { copyEndcardToDialog(); $('endcardDialog').showModal(); });
$('closeEndcardDialog').addEventListener('click', () => $('endcardDialog').close());
canvas.addEventListener('pointerdown', onDragStart);
canvas.addEventListener('pointermove', onDragMove);
canvas.addEventListener('pointerup', onDragEnd);
canvas.addEventListener('pointercancel', onDragEnd);
stage.addEventListener('dragover', event => { event.preventDefault(); stage.classList.add('dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
stage.addEventListener('drop', event => { event.preventDefault(); stage.classList.remove('dragging'); usePhoto([...event.dataTransfer.files].find(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))); });
document.addEventListener('paste', event => {
  if (document.activeElement?.matches('input,textarea')) return;
  const item = [...(event.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) usePhoto(item.getAsFile());
});

async function start() {
  if (appleMobile) {
    $('downloadButton').textContent = 'Save to Photos';
    $('downloadButtonSide').textContent = 'Save both to Photos';
    $('shareButton').textContent = 'Download ZIP instead';
    $('endcardFootnote').textContent = 'Opens the iOS share sheet with both images. Tap “Save 2 Images” to add them to Photos.';
  }
  updateEnabled(); syncForm();
  try { catalog = await (await fetch('assets/regions.json')).json(); }
  catch (error) { toast('Flag list could not load. Other editing still works.'); }
  try { endcards = await loadEndcards(); }
  catch (error) { console.error(error); toast('CarSpotter endcards could not load. Cover-only export is available.'); }
  await document.fonts.ready;
  await restoreDraft();
  if (!selectedEndcard()) state.endcardSlug = randomEndcard(endcards)?.slug || '';
  updateEndcardPreview();
  render();
  startUpdateChecks(async () => {
    if (activeDrag || !$('quickEdit').hidden || document.activeElement?.matches('input, textarea, select')) return false;
    clearTimeout(saveTimer);
    $('saveStatus').textContent = 'Updating…';
    const saved = await saveDraft();
    if (!saved) toast('An update is ready. Save your images and reopen the app to get it.');
    return saved;
  });
}
start();
