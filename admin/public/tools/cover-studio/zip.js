// PNGs are already compressed, so a ZIP with stored entries is fast and lossless.
const encoder = new TextEncoder();
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  table[n] = value >>> 0;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function stamp(date) {
  const year = Math.max(1980, date.getFullYear());
  return {time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()};
}

export async function zipFiles(files) {
  if (!files.length || files.length > 65535) throw new Error('Invalid file count');
  const local = [], directory = [];
  const now = stamp(new Date());
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    if (name.length > 65535 || data.length > 0xffffffff) throw new Error('File is too large for ZIP');
    const checksum = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true); // UTF-8 file names
    view.setUint16(10, now.time, true); view.setUint16(12, now.day, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    local.push(header, data);

    const record = new Uint8Array(46 + name.length);
    const central = new DataView(record.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); central.setUint16(6, 20, true);
    central.setUint16(8, 0x800, true);
    central.setUint16(12, now.time, true); central.setUint16(14, now.day, true);
    central.setUint32(16, checksum, true);
    central.setUint32(20, data.length, true); central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    record.set(name, 46);
    directory.push(record);
    offset += header.length + data.length;
    centralSize += record.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  return new Blob([...local, ...directory, end], {type: 'application/zip'});
}
