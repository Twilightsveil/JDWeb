// Minimal streaming ZIP writer (store-only, no compression — our content is already
// compressed media, so DEFLATE would waste CPU for no size benefit). Uses the
// data-descriptor mechanism (general-purpose flag bit 3) so CRC32/size never need
// to be known before we start streaming a file's bytes — required since we pipe
// large files straight through from R2/Nextcloud without buffering them in memory.
// No ZIP64 support: fine for archives well under ~4GB / individual files under 4GB.
//
// Verified against a real `unzip -t` (CRC32 integrity) and byte-level UTF-8
// filename inspection before this was wired into any endpoint.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc, chunk) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < chunk.length; i++) {
    c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function u16(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]); }
function u32(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }
function concatBytes(arrs) {
  let total = 0;
  arrs.forEach(a => { total += a.length; });
  const out = new Uint8Array(total);
  let off = 0;
  arrs.forEach(a => { out.set(a, off); off += a.length; });
  return out;
}

const UTF8_FLAG_WITH_DATA_DESCRIPTOR = 0x0808;

// entries: array of { name: string, getStream: () => Promise<ReadableStream<Uint8Array>|null> }
// A null/failed stream becomes a valid zero-byte entry rather than aborting the whole archive.
export function createZipStream(entries) {
  const encoder = new TextEncoder();
  const centralRecords = [];
  let offset = 0;

  return new ReadableStream({
    async start(controller) {
      function push(bytes) {
        controller.enqueue(bytes);
        offset += bytes.length;
      }

      for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const { time, day } = dosDateTime(new Date());
        const localHeaderOffset = offset;

        push(concatBytes([
          u32(0x04034b50),
          u16(20),
          u16(UTF8_FLAG_WITH_DATA_DESCRIPTOR),
          u16(0),
          u16(time), u16(day),
          u32(0), u32(0), u32(0),
          u16(nameBytes.length),
          u16(0),
          nameBytes
        ]));

        let crc = 0;
        let size = 0;
        let stream = null;
        try {
          stream = await entry.getStream();
        } catch (e) {
          stream = null;
        }
        if (stream) {
          const reader = stream.getReader();
          while (true) {
            let result;
            try {
              result = await reader.read();
            } catch (e) {
              break;
            }
            if (result.done) break;
            const value = result.value;
            if (value && value.length) {
              crc = crc32Update(crc, value);
              size += value.length;
              push(value);
            }
          }
        }

        push(concatBytes([
          u32(0x08074b50),
          u32(crc), u32(size), u32(size)
        ]));

        centralRecords.push({ nameBytes, crc, size, time, day, localHeaderOffset });
      }

      const centralStart = offset;
      for (const rec of centralRecords) {
        push(concatBytes([
          u32(0x02014b50),
          u16(20), u16(20),
          u16(UTF8_FLAG_WITH_DATA_DESCRIPTOR),
          u16(0),
          u16(rec.time), u16(rec.day),
          u32(rec.crc), u32(rec.size), u32(rec.size),
          u16(rec.nameBytes.length),
          u16(0), u16(0), u16(0), u16(0),
          u32(0),
          u32(rec.localHeaderOffset),
          rec.nameBytes
        ]));
      }
      const centralSize = offset - centralStart;

      push(concatBytes([
        u32(0x06054b50),
        u16(0), u16(0),
        u16(centralRecords.length), u16(centralRecords.length),
        u32(centralSize),
        u32(centralStart),
        u16(0)
      ]));

      controller.close();
    }
  });
}
