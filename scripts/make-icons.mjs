/**
 * scripts/make-icons.mjs
 *
 * Generates placeholder PWA icons using only Node.js built-ins.
 * No external dependencies. Uses manual PNG chunk encoding with
 * CRC-32 and zlib DEFLATE compression.
 *
 * Writes three files to public/icons/:
 *   icon-192.png      192x192  solid #0B0E14 background + light "F" glyph
 *   icon-512.png      512x512  solid #0B0E14 background + light "F" glyph
 *   maskable-512.png  512x512  solid #0B0E14 background with safe-zone padding
 *
 * Also writes the iOS apple-touch-icon (Next.js App Router file convention):
 *   app/apple-icon.png          180x180  Next.js auto-injects <link rel="apple-touch-icon">
 *   public/apple-touch-icon.png 180x180  Fallback for non-Next consumers (harmless duplicate)
 *
 * Replace with real branding assets before launch.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const OUT_DIR = join(ROOT_DIR, "public", "icons");

// --- CRC-32 table (standard PNG CRC) ---
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}
const CRC_TABLE = buildCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- PNG chunk builder ---
function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const dataLen = data ? data.length : 0;
  const buf = Buffer.alloc(4 + 4 + dataLen + 4);
  buf.writeUInt32BE(dataLen, 0);
  typeBytes.copy(buf, 4);
  if (data) data.copy(buf, 8);
  const crcBuf = buf.slice(4, 8 + dataLen);
  buf.writeUInt32BE(crc32(crcBuf), 8 + dataLen);
  return buf;
}

// --- PNG IHDR ---
function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;  // bit depth
  data[9] = 2;  // color type: RGB truecolor
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return chunk("IHDR", data);
}

// --- Draw a simple glyph (thick "F") into the pixel buffer ---
// Returns a Set of pixel offsets (y * width + x) that should be light-colored.
function glyphPixels(size, scale) {
  const pixels = new Set();
  // Build a 7x9 bitmap for the letter "F"
  const F = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
  ];
  const rows = F.length;    // 9
  const cols = F[0].length; // 7
  const cellW = Math.floor((size * scale) / cols);
  const cellH = Math.floor((size * scale) / rows);
  const glyphW = cellW * cols;
  const glyphH = cellH * rows;
  const offX = Math.floor((size - glyphW) / 2);
  const offY = Math.floor((size - glyphH) / 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!F[row][col]) continue;
      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const px = offX + col * cellW + dx;
          const py = offY + row * cellH + dy;
          if (px >= 0 && px < size && py >= 0 && py < size) {
            pixels.add(py * size + px);
          }
        }
      }
    }
  }
  return pixels;
}

/**
 * Encode an RGBA image as a PNG buffer.
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => [number, number, number]} colorFn - returns [r, g, b]
 */
function encodePng(width, height, colorFn) {
  // Build raw scanlines: filter byte (0) + RGB pixels
  const scanlineLen = 1 + width * 3;
  const raw = Buffer.alloc(height * scanlineLen);
  for (let y = 0; y < height; y++) {
    const base = y * scanlineLen;
    raw[base] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorFn(x, y);
      const p = base + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    PNG_SIG,
    ihdr(width, height),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Color constants ---
const BG = [0x0b, 0x0e, 0x14];       // #0B0E14 — canvas color
const FG = [0x6c, 0x8c, 0xff];       // #6C8CFF — accent (light enough on dark bg)

/**
 * Make a standard icon (glyph fills ~55% of the canvas).
 */
function makeIcon(size) {
  const glyph = glyphPixels(size, 0.55);
  return encodePng(size, size, (x, y) => {
    return glyph.has(y * size + x) ? FG : BG;
  });
}

/**
 * Make a maskable icon.
 * Maskable icons must keep all meaningful content inside the "safe zone"
 * (center 80% circle per the spec). We shrink the glyph to 40% to stay
 * safely inside the safe zone even on circular crops.
 */
function makeMaskable(size) {
  const glyph = glyphPixels(size, 0.40);
  return encodePng(size, size, (x, y) => {
    return glyph.has(y * size + x) ? FG : BG;
  });
}

// --- Write files ---
mkdirSync(OUT_DIR, { recursive: true });

const appleTouchIcon = makeIcon(180);

const files = [
  { path: join(OUT_DIR, "icon-192.png"),                    buf: makeIcon(192) },
  { path: join(OUT_DIR, "icon-512.png"),                    buf: makeIcon(512) },
  { path: join(OUT_DIR, "maskable-512.png"),                buf: makeMaskable(512) },
  // Next.js App Router file convention: auto-injects <link rel="apple-touch-icon">
  { path: join(ROOT_DIR, "app", "apple-icon.png"),          buf: appleTouchIcon },
  // Fallback for non-Next consumers (harmless duplicate per output-rendering.md)
  { path: join(ROOT_DIR, "public", "apple-touch-icon.png"), buf: appleTouchIcon },
];

for (const { path: dest, buf } of files) {
  writeFileSync(dest, buf);
  console.log(`wrote ${dest}  (${buf.length} bytes)`);
}
