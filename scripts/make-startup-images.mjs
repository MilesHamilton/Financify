/**
 * scripts/make-startup-images.mjs  (T-063)
 *
 * Generates the full iOS apple-touch-startup-image set using only Node.js
 * built-ins. PNG encoder (CRC-32 + zlib DEFLATE chunk assembly) and the "F"
 * glyph bitmap are copied from scripts/make-icons.mjs and extended for
 * non-square canvases.
 *
 * Device matrix source (canonical): pwa-asset-generator apple fallback data
 *   https://github.com/elegantapp/pwa-asset-generator
 *   src/config/apple-fallback-data.json  (57 devices, deduplicated below to
 *   20 unique logical-size x DPR specs; each emitted portrait + landscape).
 *
 * Each PNG: solid #0B0E14 background, accent "F" glyph centered at ~15% of
 * the short edge. Written to public/apple-touch-startup-image/<name>.png.
 *
 * Run: node scripts/make-startup-images.mjs
 * Also prints the TS entries for app/layout.tsx metadata.appleWebApp.startupImage.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const OUT_DIR = join(ROOT_DIR, "public", "apple-touch-startup-image");

// --- CRC-32 table (standard PNG CRC) — copied from make-icons.mjs ---
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

// --- PNG chunk builder — copied from make-icons.mjs ---
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

// --- PNG IHDR — copied from make-icons.mjs ---
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

// --- "F" glyph for a rectangular canvas — extended from make-icons.mjs ---
// Returns a Set of pixel offsets (y * width + x) that should be accent-colored.
// glyphBox is the target glyph bounding-box size in pixels (square-ish).
function glyphPixelsRect(width, height, glyphBox) {
  const pixels = new Set();
  // 7x9 bitmap for the letter "F" (same as make-icons.mjs)
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
  const cellW = Math.max(1, Math.floor(glyphBox / cols));
  const cellH = Math.max(1, Math.floor(glyphBox / rows));
  const offX = Math.floor((width - cellW * cols) / 2);
  const offY = Math.floor((height - cellH * rows) / 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!F[row][col]) continue;
      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const px = offX + col * cellW + dx;
          const py = offY + row * cellH + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            pixels.add(py * width + px);
          }
        }
      }
    }
  }
  return pixels;
}

// --- Color constants (same brand values as make-icons.mjs) ---
const BG = [0x0b, 0x0e, 0x14]; // #0B0E14 — canvas color
const FG = [0x6c, 0x8c, 0xff]; // #6C8CFF — accent

/**
 * Encode a splash PNG: solid BG with the "F" glyph centered at ~15% of the
 * short edge. Background scanlines are filled via a prototype-row copy so
 * megapixel canvases encode in milliseconds (extension of make-icons.mjs's
 * per-pixel encodePng, which is too slow at splash sizes).
 */
function encodeSplashPng(width, height) {
  const glyphBox = Math.round(Math.min(width, height) * 0.15);
  const glyph = glyphPixelsRect(width, height, glyphBox);

  const scanlineLen = 1 + width * 3;
  const proto = Buffer.alloc(scanlineLen);
  proto[0] = 0; // filter type None
  for (let x = 0; x < width; x++) {
    const p = 1 + x * 3;
    proto[p] = BG[0];
    proto[p + 1] = BG[1];
    proto[p + 2] = BG[2];
  }

  const raw = Buffer.alloc(height * scanlineLen);
  for (let y = 0; y < height; y++) {
    proto.copy(raw, y * scanlineLen);
  }
  for (const offset of glyph) {
    const y = Math.floor(offset / width);
    const x = offset % width;
    const p = y * scanlineLen + 1 + x * 3;
    raw[p] = FG[0];
    raw[p + 1] = FG[1];
    raw[p + 2] = FG[2];
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

/**
 * Device matrix — pwa-asset-generator apple-fallback-data.json (57 devices)
 * deduplicated to unique (logical width x logical height x DPR) tuples.
 * w/h are LOGICAL (CSS) portrait dimensions; pixel size = logical x dpr.
 * Names follow the newest device with that spec; `covers` lists the rest.
 */
const MATRIX = [
  // iPhones
  { name: "iphone-17-pro-max", w: 440, h: 956, dpr: 3, covers: "17 Pro Max, 16 Pro Max" },
  { name: "iphone-17-pro",     w: 402, h: 874, dpr: 3, covers: "17 Pro, 17, 16 Pro" },
  { name: "iphone-air",        w: 420, h: 912, dpr: 3, covers: "Air" },
  { name: "iphone-16-plus",    w: 430, h: 932, dpr: 3, covers: "16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max" },
  { name: "iphone-16",         w: 393, h: 852, dpr: 3, covers: "16, 15 Pro, 15, 14 Pro" },
  { name: "iphone-16e",        w: 390, h: 844, dpr: 3, covers: "16e, 14, 13 Pro, 13, 12 Pro, 12" },
  { name: "iphone-14-plus",    w: 428, h: 926, dpr: 3, covers: "14 Plus, 13 Pro Max, 12 Pro Max" },
  { name: "iphone-13-mini",    w: 375, h: 812, dpr: 3, covers: "13 mini, 12 mini, 11 Pro, XS, X" },
  { name: "iphone-11-pro-max", w: 414, h: 896, dpr: 3, covers: "11 Pro Max, XS Max" },
  { name: "iphone-11",         w: 414, h: 896, dpr: 2, covers: "11, XR" },
  { name: "iphone-8-plus",     w: 414, h: 736, dpr: 3, covers: "8 Plus, 7 Plus, 6s Plus, 6 Plus" },
  { name: "iphone-se",         w: 375, h: 667, dpr: 2, covers: "SE 4.7-inch, 8, 7, 6s, 6" },
  { name: "iphone-se-4in",     w: 320, h: 568, dpr: 2, covers: "SE 4-inch, iPod touch" },
  // iPads
  { name: "ipad-pro-12-9",     w: 1024, h: 1366, dpr: 2, covers: "Pro 12.9-inch, Air 13-inch" },
  { name: "ipad-pro-11",       w: 834,  h: 1194, dpr: 2, covers: "Pro 11-inch, Pro 10.5-inch" },
  { name: "ipad-air-11",       w: 820,  h: 1180, dpr: 2, covers: "Air 11-inch, Air 10.9-inch, iPad 11-inch" },
  { name: "ipad-air-10-5",     w: 834,  h: 1112, dpr: 2, covers: "Air 10.5-inch" },
  { name: "ipad-10-2",         w: 810,  h: 1080, dpr: 2, covers: "iPad 10.2-inch" },
  { name: "ipad-9-7",          w: 768,  h: 1024, dpr: 2, covers: "9.7-inch iPads, mini 7.9-inch" },
  { name: "ipad-mini-8-3",     w: 744,  h: 1133, dpr: 2, covers: "mini 8.3-inch" },
];

function media(spec, orientation) {
  return (
    `screen and (device-width: ${spec.w}px) and (device-height: ${spec.h}px) ` +
    `and (-webkit-device-pixel-ratio: ${spec.dpr}) and (orientation: ${orientation})`
  );
}

// --- Generate ---
mkdirSync(OUT_DIR, { recursive: true });

const rows = [];
const tsEntries = [];
for (const spec of MATRIX) {
  for (const orientation of ["portrait", "landscape"]) {
    const pxW = (orientation === "portrait" ? spec.w : spec.h) * spec.dpr;
    const pxH = (orientation === "portrait" ? spec.h : spec.w) * spec.dpr;
    const file = `${spec.name}-${orientation}.png`;
    const buf = encodeSplashPng(pxW, pxH);
    writeFileSync(join(OUT_DIR, file), buf);
    rows.push({ file, px: `${pxW}x${pxH}`, bytes: buf.length });
    tsEntries.push(
      `    {\n      url: "/apple-touch-startup-image/${file}",\n      media:\n        "${media(spec, orientation)}",\n    },`
    );
  }
}

// --- Report ---
const wName = Math.max(...rows.map((r) => r.file.length));
console.log(`${"file".padEnd(wName)}  ${"pixels".padEnd(11)}  bytes`);
for (const r of rows) {
  console.log(`${r.file.padEnd(wName)}  ${r.px.padEnd(11)}  ${r.bytes}`);
}
console.log(`\n${rows.length} images -> ${OUT_DIR}`);

console.log("\n// --- paste into app/layout.tsx metadata.appleWebApp.startupImage ---");
console.log(`  startupImage: [\n${tsEntries.join("\n")}\n  ],`);
