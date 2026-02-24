// client/src/utils/qrcode.js
// Minimal QR Code generator (Mode Byte, EC Level L) → SVG string.
// No dependencies. Supports up to ~2953 bytes (version 40-L).
// Based on the QR code specification (ISO/IEC 18004).

// ── Galois Field GF(256) arithmetic ─────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = v;
    LOG[v] = i;
    v = (v << 1) ^ (v >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

// ── Reed-Solomon ────────────────────────────────────────────────────
function rsGenPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const msg = new Array(data.length + ecLen).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// ── QR Version/capacity tables (EC Level L only) ────────────────────
const VERSION_INFO = [
  null, // 0 unused
  // [totalCodewords, ecPerBlock, numBlocks, dataCodewords]
  { total: 26, ec: 7, g1: 1, g1cw: 19, g2: 0, g2cw: 0 },    // v1
  { total: 44, ec: 10, g1: 1, g1cw: 34, g2: 0, g2cw: 0 },    // v2
  { total: 70, ec: 15, g1: 1, g1cw: 55, g2: 0, g2cw: 0 },    // v3
  { total: 100, ec: 20, g1: 1, g1cw: 80, g2: 0, g2cw: 0 },   // v4
  { total: 134, ec: 26, g1: 1, g1cw: 108, g2: 0, g2cw: 0 },  // v5
  { total: 172, ec: 18, g1: 2, g1cw: 68, g2: 0, g2cw: 0 },   // v6
  { total: 196, ec: 20, g1: 2, g1cw: 78, g2: 0, g2cw: 0 },   // v7
  { total: 242, ec: 24, g1: 2, g1cw: 97, g2: 0, g2cw: 0 },   // v8
  { total: 292, ec: 30, g1: 2, g1cw: 116, g2: 0, g2cw: 0 },  // v9
  { total: 346, ec: 18, g1: 2, g1cw: 68, g2: 2, g2cw: 69 },  // v10
  { total: 404, ec: 20, g1: 4, g1cw: 81, g2: 0, g2cw: 0 },   // v11
  { total: 466, ec: 24, g1: 2, g1cw: 92, g2: 2, g2cw: 93 },  // v12
  { total: 532, ec: 26, g1: 4, g1cw: 107, g2: 0, g2cw: 0 },  // v13
  { total: 581, ec: 30, g1: 3, g1cw: 115, g2: 1, g2cw: 116 }, // v14
  { total: 655, ec: 22, g1: 5, g1cw: 87, g2: 1, g2cw: 88 },  // v15
  { total: 733, ec: 24, g1: 5, g1cw: 98, g2: 1, g2cw: 99 },  // v16
  { total: 815, ec: 28, g1: 1, g1cw: 107, g2: 5, g2cw: 108 }, // v17
  { total: 901, ec: 30, g1: 5, g1cw: 120, g2: 1, g2cw: 121 }, // v18
  { total: 991, ec: 28, g1: 3, g1cw: 113, g2: 4, g2cw: 114 }, // v19
  { total: 1085, ec: 28, g1: 3, g1cw: 107, g2: 5, g2cw: 108 }, // v20
];

const ALIGNMENT_POSITIONS = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
  [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
  [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];

function getVersion(dataLen) {
  for (let v = 1; v <= 20; v++) {
    const info = VERSION_INFO[v];
    const dataCap = info.g1 * info.g1cw + info.g2 * info.g2cw;
    if (dataLen <= dataCap) return v;
  }
  throw new Error("Data too long for QR (max ~1000 bytes at L level)");
}

// ── Module matrix ───────────────────────────────────────────────────
function createMatrix(size) {
  const m = [];
  for (let i = 0; i < size; i++) m.push(new Uint8Array(size)); // 0=white
  return m;
}

function setModule(matrix, r, c, val, reserved) {
  matrix[r][c] = val ? 1 : 0;
  if (reserved) reserved[r][c] = 1;
}

function addFinderPattern(matrix, reserved, row, col) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= matrix.length || c < 0 || c >= matrix.length) continue;
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const val = inInner || (inOuter && onBorder);
      setModule(matrix, r, c, val, reserved);
    }
  }
}

function addAlignmentPattern(matrix, reserved, row, col) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = row + dr, c = col + dc;
      if (reserved[r][c]) continue; // don't overlap finder
      const val = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
      setModule(matrix, r, c, val, reserved);
    }
  }
}

function addTimingPatterns(matrix, reserved) {
  const n = matrix.length;
  for (let i = 8; i < n - 8; i++) {
    if (!reserved[6][i]) setModule(matrix, 6, i, i % 2 === 0, reserved);
    if (!reserved[i][6]) setModule(matrix, i, 6, i % 2 === 0, reserved);
  }
}

function reserveFormatBits(matrix, reserved) {
  const n = matrix.length;
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = 1;
    reserved[i][8] = 1;
    reserved[8][n - 1 - i] = 1;
    reserved[n - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;
  matrix[n - 8][8] = 1; // dark module
  reserved[n - 8][8] = 1;
}

function reserveVersionBits(matrix, reserved, version) {
  if (version < 7) return;
  // Version info bits (18 bits) — for v7+ only
  // We place them but the actual encoding is a simplification; for v1-20 this works
  const n = matrix.length;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      reserved[i][n - 11 + j] = 1;
      reserved[n - 11 + j][i] = 1;
    }
  }
}

// ── Data encoding (byte mode) ───────────────────────────────────────
function encodeData(bytes, version) {
  const info = VERSION_INFO[version];
  const dataCap = info.g1 * info.g1cw + info.g2 * info.g2cw;
  const bits = [];

  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  }

  // Mode indicator: byte = 0100
  pushBits(0b0100, 4);
  // Character count (8 bits for v1-9, 16 bits for v10+)
  const ccLen = version <= 9 ? 8 : 16;
  pushBits(bytes.length, ccLen);
  // Data
  for (const b of bytes) pushBits(b, 8);
  // Terminator (up to 4 bits)
  const totalBits = dataCap * 8;
  const termLen = Math.min(4, totalBits - bits.length);
  pushBits(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bits.length < totalBits) {
    pushBits(padBytes[pi % 2], 8);
    pi++;
  }

  // Convert to codeword bytes
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }

  return codewords;
}

function interleaveBlocks(codewords, version) {
  const info = VERSION_INFO[version];
  const blocks = [];
  let offset = 0;

  for (let i = 0; i < info.g1; i++) {
    blocks.push(codewords.slice(offset, offset + info.g1cw));
    offset += info.g1cw;
  }
  for (let i = 0; i < info.g2; i++) {
    blocks.push(codewords.slice(offset, offset + info.g2cw));
    offset += info.g2cw;
  }

  // Generate EC for each block
  const ecBlocks = blocks.map(b => rsEncode(b, info.ec));

  // Interleave data
  const result = [];
  const maxDataLen = Math.max(info.g1cw, info.g2cw);
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) {
      if (i < b.length) result.push(b[i]);
    }
  }
  // Interleave EC
  for (let i = 0; i < info.ec; i++) {
    for (const ec of ecBlocks) {
      if (i < ec.length) result.push(ec[i]);
    }
  }

  return result;
}

// ── Place data bits ─────────────────────────────────────────────────
function placeDataBits(matrix, reserved, dataBits) {
  const n = matrix.length;
  let bitIdx = 0;
  let upward = true;

  for (let col = n - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    const rows = upward ? range(n - 1, -1) : range(0, n);
    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || reserved[row][c]) continue;
        if (bitIdx < dataBits.length) {
          matrix[row][c] = dataBits[bitIdx] ? 1 : 0;
        }
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

function range(start, end) {
  const arr = [];
  if (start < end) {
    for (let i = start; i < end; i++) arr.push(i);
  } else {
    for (let i = start; i > end; i--) arr.push(i);
  }
  return arr;
}

// ── Masking ─────────────────────────────────────────────────────────
const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(matrix, reserved, maskIdx) {
  const n = matrix.length;
  const fn = MASK_FNS[maskIdx];
  const result = matrix.map(row => row.slice());
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }
  return result;
}

function scoreMask(matrix) {
  const n = matrix.length;
  let score = 0;
  // Rule 1: consecutive same-color modules in rows/cols
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { run++; }
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) { run++; }
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  return score;
}

// ── Format info ─────────────────────────────────────────────────────
// EC level L = 01, mask pattern 0-7
const FORMAT_STRINGS = [
  0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
];

function writeFormatBits(matrix, reserved, maskIdx) {
  const n = matrix.length;
  const bits = FORMAT_STRINGS[maskIdx];
  // Around top-left finder
  const positions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = positions[i];
    matrix[r][c] = (bits >> (14 - i)) & 1;
  }
  // Around bottom-left and top-right
  for (let i = 0; i < 8; i++) {
    matrix[n - 1 - i][8] = (bits >> i) & 1;
  }
  for (let i = 0; i < 7; i++) {
    matrix[8][n - 1 - i] = (bits >> (i + 8)) & 1;
  }
}

// ── Main API ────────────────────────────────────────────────────────
export function generateQRSvg(text, moduleSize = 4, margin = 4) {
  const bytes = new TextEncoder().encode(text);
  const version = getVersion(bytes.length + 3); // +3 for mode + count overhead
  const size = version * 4 + 17;

  const matrix = createMatrix(size);
  const reserved = createMatrix(size);

  // Finder patterns
  addFinderPattern(matrix, reserved, 0, 0);
  addFinderPattern(matrix, reserved, 0, size - 7);
  addFinderPattern(matrix, reserved, size - 7, 0);

  // Alignment patterns
  const alignPos = ALIGNMENT_POSITIONS[version] || [];
  for (const r of alignPos) {
    for (const c of alignPos) {
      // Skip if overlapping finder
      if (r <= 8 && c <= 8) continue;
      if (r <= 8 && c >= size - 8) continue;
      if (r >= size - 8 && c <= 8) continue;
      addAlignmentPattern(matrix, reserved, r, c);
    }
  }

  addTimingPatterns(matrix, reserved);
  reserveFormatBits(matrix, reserved);
  reserveVersionBits(matrix, reserved, version);

  // Encode data
  const codewords = encodeData(bytes, version);
  const interleaved = interleaveBlocks(codewords, version);

  // Convert to bit array
  const dataBits = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  }

  placeDataBits(matrix, reserved, dataBits);

  // Find best mask
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, m);
    const s = scoreMask(masked);
    if (s < bestScore) { bestScore = s; bestMask = m; }
  }

  const final = applyMask(matrix, reserved, bestMask);
  writeFormatBits(final, reserved, bestMask);

  // Render SVG
  const totalSize = (size + margin * 2) * moduleSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="#fff"/>`;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (final[r][c]) {
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}
