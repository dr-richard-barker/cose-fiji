/**
 * CoSE FIJI Bench — minimal ZIP writer (store, no compression).
 *
 * Deliberately dependency-free. The export path is the part of this tool that a
 * researcher relies on to get data OUT, so it must not stop working because a
 * CDN is unreachable, blocked on an institutional network, or offline in a
 * growth chamber. Store-only ZIP is ~90 lines and every unzip tool reads it;
 * the payload is CSV/JSON/XML text that compresses well but is small anyway.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// DOS date/time as used by the ZIP local header.
function dosDateTime(d) {
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { time, date };
}

class ByteWriter {
  constructor() { this.chunks = []; this.length = 0; }
  u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.raw(b); }
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.raw(b); }
  raw(bytes) { this.chunks.push(bytes); this.length += bytes.length; }
  blob(type) { return new Blob(this.chunks, { type: type || 'application/zip' }); }
}

/**
 * Build a ZIP blob from { filename: string | Uint8Array } entries.
 * @param {Object<string, string|Uint8Array>} files
 * @returns {Blob}
 */
export function makeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const { time, date } = dosDateTime(now);

  const out = new ByteWriter();
  const central = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = typeof content === 'string' ? enc.encode(content) : content;
    const crc = crc32(data);
    const offset = out.length;

    // Local file header
    out.u32(0x04034B50);
    out.u16(20);            // version needed
    out.u16(0x0800);        // UTF-8 filename
    out.u16(0);             // method: store
    out.u16(time); out.u16(date);
    out.u32(crc);
    out.u32(data.length);   // compressed == uncompressed for store
    out.u32(data.length);
    out.u16(nameBytes.length);
    out.u16(0);             // extra length
    out.raw(nameBytes);
    out.raw(data);

    central.push({ nameBytes, crc, size: data.length, offset });
  }

  // Central directory
  const cdStart = out.length;
  for (const e of central) {
    out.u32(0x02014B50);
    out.u16(20); out.u16(20);
    out.u16(0x0800);
    out.u16(0);
    out.u16(time); out.u16(date);
    out.u32(e.crc);
    out.u32(e.size); out.u32(e.size);
    out.u16(e.nameBytes.length);
    out.u16(0); out.u16(0);   // extra, comment
    out.u16(0);               // disk number start
    out.u16(0); out.u32(0);   // internal / external attrs
    out.u32(e.offset);
    out.raw(e.nameBytes);
  }
  const cdSize = out.length - cdStart;

  // End of central directory
  out.u32(0x06054B50);
  out.u16(0); out.u16(0);
  out.u16(central.length); out.u16(central.length);
  out.u32(cdSize); out.u32(cdStart);
  out.u16(0);

  return out.blob();
}

/** SHA-256 of a string or byte array, as lowercase hex. */
export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
