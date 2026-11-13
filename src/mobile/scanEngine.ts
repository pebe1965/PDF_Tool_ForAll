/**
 * Scannen: Seite aus einem Foto gerade ziehen (Perspektive) und wie ein Scan aufbereiten.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Vier Ecken in Bildpixeln: oben links, oben rechts, unten rechts, unten links */
export type Quad = [Pt, Pt, Pt, Pt];

export type ScanFilter = 'original' | 'color' | 'gray' | 'bw';

export const SCAN_FILTERS: { id: ScanFilter; label: string }[] = [
  { id: 'color', label: 'Farbe' },
  { id: 'gray', label: 'Graustufen' },
  { id: 'bw', label: 'Schwarz-Weiß' },
  { id: 'original', label: 'Original' },
];

export function fullQuad(w: number, h: number, inset = 0): Quad {
  const ix = w * inset;
  const iy = h * inset;
  return [
    { x: ix, y: iy },
    { x: w - ix, y: iy },
    { x: w - ix, y: h - iy },
    { x: ix, y: h - iy },
  ];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Löst A·x = b (8×8) mit Gauß-Elimination. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row[n]);
}

/** Homographie, die Zielpunkte (dst) auf Quellpunkte (src) abbildet. */
function homography(dst: Pt[], src: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

/** Größe der gerade gezogenen Seite (lange Seite höchstens maxSide). */
export function warpSize(q: Quad, maxSide: number): { w: number; h: number } {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(16, Math.round(w * k));
  h = Math.max(16, Math.round(h * k));
  return { w, h };
}

/** Zieht den Bereich innerhalb der vier Ecken auf ein gerades Rechteck. */
export function warpQuad(src: HTMLCanvasElement, q: Quad, maxSide = 2000): HTMLCanvasElement {
  const { w, h } = warpSize(q, maxSide);
  const H = homography(
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    q,
  );
  const sw = src.width;
  const sh = src.height;
  const sData = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(w, h);
  const o = img.data;
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5;
    for (let x = 0; x < w; x++) {
      const xc = x + 0.5;
      const den = H[6] * xc + H[7] * yc + H[8];
      let sx = (H[0] * xc + H[1] * yc + H[2]) / den - 0.5;
      let sy = (H[3] * xc + H[4] * yc + H[5]) / den - 0.5;
      sx = Math.min(sw - 1.001, Math.max(0, sx));
      sy = Math.min(sh - 1.001, Math.max(0, sy));
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const oi = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sData[i00 + c] + (sData[i10 + c] - sData[i00 + c]) * fx;
        const bot = sData[i01 + c] + (sData[i11 + c] - sData[i01 + c]) * fx;
        o[oi + c] = top + (bot - top) * fy;
      }
      o[oi + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export function rotateCanvas(src: HTMLCanvasElement, rotation: number): HTMLCanvasElement {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 0) return src;
  const c = document.createElement('canvas');
  const swap = r === 90 || r === 270;
  c.width = swap ? src.height : src.width;
  c.height = swap ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/**
 * Hintergrund (Papier) schätzen: stark verkleinern, je Kachel die hellsten Werte nehmen, glätten.
 * Damit werden Schatten und ungleichmäßiges Licht ausgeglichen.
 */
function paperBackground(src: HTMLCanvasElement): HTMLCanvasElement {
  const small = document.createElement('canvas');
  const k = 48 / Math.max(src.width, src.height);
  small.width = Math.max(4, Math.round(src.width * k));
  small.height = Math.max(4, Math.round(src.height * k));
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(src, 0, 0, small.width, small.height);
  // Hellste Nachbarn (Maximum) – entfernt Schrift aus der Hintergrundschätzung
  const { width: w, height: h } = small;
  const d = sctx.getImageData(0, 0, w, h);
  const m = new Uint8ClampedArray(d.data);
  const R = 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let best = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            best = Math.max(best, d.data[(yy * w + xx) * 4 + c]);
          }
        m[(y * w + x) * 4 + c] = best;
      }
  d.data.set(m);
  sctx.putImageData(d, 0, 0);
  const big = document.createElement('canvas');
  big.width = src.width;
  big.height = src.height;
  const bctx = big.getContext('2d', { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = 'high';
  bctx.filter = 'blur(2px)';
  bctx.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

/** Bereitet die Seite wie einen Scan auf. */
export function applyScanFilter(src: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  if (filter === 'original') return src;
  const w = src.width;
  const h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  const bg = paperBackground(src).getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;

  if (filter === 'color') {
    // Papier weiß, Farben kräftiger
    for (let i = 0; i < p.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = Math.min(1, p[i + c] / Math.max(40, bg[i + c]));
        // Kontrast: dunkle Töne etwas dunkler
        p[i + c] = 255 * Math.pow(v, 1.6);
      }
    }
  } else {
    // Graustufen mit ausgeglichenem Licht
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) {
      const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const bl = 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2];
      gray[j] = Math.min(1, lum / Math.max(40, bl));
    }
    if (filter === 'gray') {
      for (let j = 0, i = 0; j < gray.length; j++, i += 4) {
        const v = 255 * Math.pow(gray[j], 1.8);
        p[i] = p[i + 1] = p[i + 2] = v;
      }
    } else {
      // Schwarz-Weiß: Schwelle relativ zum Papier, leicht weiche Kante gegen Treppen
      for (let j = 0, i = 0; j < gray.length; j++, i += 4) {
        const t = (gray[j] - 0.72) / 0.08;
        const v = t <= 0 ? 0 : t >= 1 ? 255 : 255 * t;
        p[i] = p[i + 1] = p[i + 2] = v;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Komplette Aufbereitung einer gescannten Seite. */
export function processScan(src: HTMLCanvasElement, quad: Quad, rotation: number, filter: ScanFilter, maxSide = 2000): HTMLCanvasElement {
  const warped = warpQuad(src, quad, maxSide);
  return applyScanFilter(rotateCanvas(warped, rotation), filter);
}

/**
 * Sucht das Blatt im Foto (helles Papier vor dunklerem Hintergrund).
 * Gibt null zurück, wenn nichts Eindeutiges gefunden wird – dann zieht man die Ecken selbst.
 */
export function detectDocument(src: HTMLCanvasElement): Quad | null {
  const k = 240 / Math.max(src.width, src.height);
  const w = Math.max(8, Math.round(src.width * k));
  const h = Math.max(8, Math.round(src.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = 'blur(1px)';
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) {
    // Papier ist hell und wenig farbig
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const v = Math.max(0, Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - (mx - mn) * 0.5));
    lum[j] = v;
    hist[v]++;
  }
  // Otsu-Schwelle
  const total = lum.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  // Größte helle zusammenhängende Fläche
  const label = new Int32Array(total).fill(-1);
  let bestSize = 0;
  let bestId = -1;
  const stack: number[] = [];
  let id = 0;
  for (let s = 0; s < total; s++) {
    if (label[s] !== -1 || lum[s] <= thr) continue;
    let size = 0;
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const q = stack.pop()!;
      size++;
      const x = q % w;
      const y = (q / w) | 0;
      const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1];
      for (const n of nb) {
        if (n >= 0 && label[n] === -1 && lum[n] > thr) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }
  if (bestId < 0) return null;
  const share = bestSize / total;
  if (share < 0.15 || share > 0.97) return null;
  // Extrempunkte: oben links = min(x+y), oben rechts = max(x−y), unten rechts = max(x+y), unten links = min(x−y)
  let tl = { v: Infinity, x: 0, y: 0 };
  let tr = { v: -Infinity, x: 0, y: 0 };
  let br = { v: -Infinity, x: 0, y: 0 };
  let bl = { v: Infinity, x: 0, y: 0 };
  for (let q = 0; q < total; q++) {
    if (label[q] !== bestId) continue;
    const x = q % w;
    const y = (q / w) | 0;
    if (x + y < tl.v) tl = { v: x + y, x, y };
    if (x - y > tr.v) tr = { v: x - y, x, y };
    if (x + y > br.v) br = { v: x + y, x, y };
    if (x - y < bl.v) bl = { v: x - y, x, y };
  }
  const s = 1 / k;
  const quad: Quad = [
    { x: tl.x * s, y: tl.y * s },
    { x: (tr.x + 1) * s, y: tr.y * s },
    { x: (br.x + 1) * s, y: (br.y + 1) * s },
    { x: bl.x * s, y: (bl.y + 1) * s },
  ].map((p) => ({ x: Math.min(src.width, Math.max(0, p.x)), y: Math.min(src.height, Math.max(0, p.y)) })) as Quad;
  // Plausibel? Fläche des Vierecks gegen Pixelzahl prüfen
  const area =
    Math.abs(
      quad.reduce((acc, p, i) => {
        const n = quad[(i + 1) % 4];
        return acc + p.x * n.y - n.x * p.y;
      }, 0),
    ) / 2;
  const pixelArea = bestSize * s * s;
  if (area < pixelArea * 0.85 || area > pixelArea * 1.35) return null;
  return quad;
}
