import { crc32, deflateSync } from 'node:zlib';

// A small RGBA PNG with a drawn wave, standing in for the browser signature pad output.
export function signaturePngBytes({ width = 600, height = 200 } = {}) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let x = 0; x < width; x++) {
    const y = Math.round(height / 2 + Math.sin(x / 23) * height / 4 + Math.sin(x / 7) * 6);
    for (let dy = -1; dy <= 1; dy++) {
      const row = Math.min(height - 1, Math.max(0, y + dy));
      const offset = row * (width * 4 + 1) + 1 + x * 4;
      raw[offset] = 20; raw[offset + 1] = 33; raw[offset + 2] = 61; raw[offset + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function signaturePng(size) {
  return 'data:image/png;base64,' + signaturePngBytes(size).toString('base64');
}
