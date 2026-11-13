/**
 * Bild-Engine für den Bereich „Bilder“.
 *
 * Grundsatz: Das geladene Bild (base) wird nie verändert. Markierte Bereiche
 * (regions) liegen als Liste darüber und werden erst beim Rendern in die
 * Pixel eingebrannt. Beim Export entsteht ein neues Bild ohne Metadaten
 * (keine GPS-Daten, kein Kameramodell, keine eingebettete Vorschau).
 */

export type RegionShape = 'rect' | 'ellipse' | 'brush';
export type RedactMethod = 'fill' | 'pixelate' | 'blur' | 'frosted';
export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface Point {
  x: number;
  y: number;
}

export interface ImageRegion {
  id: string;
  shape: RegionShape;
  /** Begrenzungsrahmen in Bildpixeln (bei brush aus den Punkten berechnet) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nur für brush: Pfadpunkte in Bildpixeln */
  points?: Point[];
  brushSize?: number;
  method: RedactMethod;
  /** 1–100 */
  strength: number;
  /** Nur für fill */
  color: string;
  /** Effekt auf alles AUSSERHALB der Form anwenden */
  inverted?: boolean;
}

export const METHOD_LABELS: Record<RedactMethod, string> = {
  fill: 'Farbbalken',
  pixelate: 'Verpixeln',
  blur: 'Weichzeichnen',
  frosted: 'Milchglas',
};

export const FORMAT_INFO: Record<ExportFormat, { mime: string; ext: string; label: string }> = {
  png: { mime: 'image/png', ext: 'png', label: 'PNG (verlustfrei)' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG (kompakt)' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP (modern)' },
};

let idCounter = 0;
export function newRegionId(): string {
  idCounter += 1;
  return `r${Date.now().toString(36)}${idCounter}`;
}

/* ------------------------------------------------------------------ */
/* Laden                                                               */
/* ------------------------------------------------------------------ */

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  fileName: string;
  originalType: string;
  originalWidth: number;
  originalHeight: number;
  downscaled: boolean;
  meta: ImageMetaInfo;
}

export interface ImageMetaInfo {
  hasExif: boolean;
  hasGps: boolean;
  hasThumbnail: boolean;
  camera?: string;
  dateTime?: string;
}

/** iPad/iPhone-Safari verarbeitet nur Canvas bis ca. 16,7 Megapixel. */
function maxCanvasPixels(): number {
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIos ? 16_000_000 : 100_000_000;
}

export function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name);
}

export async function loadImageFile(file: Blob, fileName: string): Promise<LoadedImage> {
  const buffer = await file.arrayBuffer();
  const meta = readImageMeta(buffer);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try {
      await img.decode();
    } catch {
      const isHeic = /\.(heic|heif)$/i.test(fileName) || /heic|heif/i.test(file.type);
      throw new Error(
        isHeic
          ? 'HEIC-Fotos kann dieser Browser nicht öffnen. Auf dem Mac funktioniert es im Programmfenster; unter Windows das Foto bitte vorher als JPG speichern.'
          : 'Das Bild konnte nicht geöffnet werden. Unterstützt werden JPG, PNG, WebP, GIF und BMP.',
      );
    }
    // Browser wenden die EXIF-Drehung beim Zeichnen automatisch an
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error('Das Bild hat keine gültige Größe.');

    const limit = maxCanvasPixels();
    let scale = 1;
    if (w * h > limit) scale = Math.sqrt(limit / (w * h));
    const cw = Math.max(1, Math.floor(w * scale));
    const ch = Math.max(1, Math.floor(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Zeichenfläche konnte nicht erstellt werden.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);

    return {
      canvas,
      fileName,
      originalType: file.type,
      originalWidth: w,
      originalHeight: h,
      downscaled: scale < 1,
      meta,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Liest die wichtigsten EXIF-Angaben aus einer JPEG-Datei, nur um den
 * Nutzer zu informieren. Fehler werden ignoriert.
 */
export function readImageMeta(buffer: ArrayBuffer): ImageMetaInfo {
  const info: ImageMetaInfo = { hasExif: false, hasGps: false, hasThumbnail: false };
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return info;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        info.hasExif = true;
        parseTiff(view, offset + 10, info);
        break;
      }
      if (marker === 0xffda) break; // Bilddaten beginnen
      offset += 2 + size;
    }
  } catch {
    /* Metadaten sind nur ein Hinweis */
  }
  return info;
}

function parseTiff(view: DataView, start: number, info: ImageMetaInfo) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o: number) => view.getUint16(start + o, little);
  const u32 = (o: number) => view.getUint32(start + o, little);
  const readAscii = (o: number, len: number) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      const c = view.getUint8(start + o + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };
  const ifd0 = u32(4);
  const count = u16(ifd0);
  let make = '';
  let model = '';
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12;
    const tag = u16(e);
    const len = u32(e + 4);
    const valOff = len > 4 ? u32(e + 8) : e + 8;
    if (tag === 0x8825) info.hasGps = true;
    if (tag === 0x010f) make = readAscii(valOff, len);
    if (tag === 0x0110) model = readAscii(valOff, len);
    if (tag === 0x0132) info.dateTime = readAscii(valOff, len);
  }
  const camera = [make, model.startsWith(make) ? model.slice(make.length).trim() : model]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (camera) info.camera = camera;
  const ifd1 = u32(ifd0 + 2 + count * 12);
  if (ifd1 > 0) info.hasThumbnail = true;
}

/* ------------------------------------------------------------------ */
/* Geometrie                                                           */
/* ------------------------------------------------------------------ */

export function brushBounds(points: Point[], size: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const r = size / 2;
  return { x: minX - r, y: minY - r, w: maxX - minX + size, h: maxY - minY + size };
}

/** Normalisiert ein Rechteck mit evtl. negativer Breite/Höhe. */
export function normRect(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function moveRegion(r: ImageRegion, dx: number, dy: number): ImageRegion {
  return {
    ...r,
    x: r.x + dx,
    y: r.y + dy,
    points: r.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

type PointMap = (p: Point) => Point;

function mapRegion(r: ImageRegion, map: PointMap): ImageRegion {
  if (r.shape === 'brush' && r.points) {
    const points = r.points.map(map);
    return { ...r, points, ...brushBounds(points, r.brushSize || 20) };
  }
  const a = map({ x: r.x, y: r.y });
  const b = map({ x: r.x + r.w, y: r.y + r.h });
  return { ...r, ...normRect(a.x, a.y, b.x, b.y) };
}

/* ------------------------------------------------------------------ */
/* Drehen, Spiegeln, Zuschneiden (erzeugen ein neues Grundbild)        */
/* ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function rotateImage(
  base: HTMLCanvasElement,
  regions: ImageRegion[],
  direction: 'left' | 'right',
): { base: HTMLCanvasElement; regions: ImageRegion[] } {
  const W = base.width;
  const H = base.height;
  const out = makeCanvas(H, W);
  const ctx = out.getContext('2d')!;
  if (direction === 'right') {
    ctx.translate(H, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, W);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(base, 0, 0);
  const map: PointMap = direction === 'right' ? (p) => ({ x: H - p.y, y: p.x }) : (p) => ({ x: p.y, y: W - p.x });
  return { base: out, regions: regions.map((r) => mapRegion(r, map)) };
}

export function flipImage(
  base: HTMLCanvasElement,
  regions: ImageRegion[],
  axis: 'horizontal' | 'vertical',
): { base: HTMLCanvasElement; regions: ImageRegion[] } {
  const W = base.width;
  const H = base.height;
  const out = makeCanvas(W, H);
  const ctx = out.getContext('2d')!;
  if (axis === 'horizontal') {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, H);
    ctx.scale(1, -1);
  }
  ctx.drawImage(base, 0, 0);
  const map: PointMap = axis === 'horizontal' ? (p) => ({ x: W - p.x, y: p.y }) : (p) => ({ x: p.x, y: H - p.y });
  return { base: out, regions: regions.map((r) => mapRegion(r, map)) };
}

export function cropImage(
  base: HTMLCanvasElement,
  regions: ImageRegion[],
  crop: { x: number; y: number; w: number; h: number },
): { base: HTMLCanvasElement; regions: ImageRegion[] } {
  const x = Math.max(0, Math.round(crop.x));
  const y = Math.max(0, Math.round(crop.y));
  const w = Math.min(base.width - x, Math.round(crop.w));
  const h = Math.min(base.height - y, Math.round(crop.h));
  const out = makeCanvas(w, h);
  out.getContext('2d')!.drawImage(base, x, y, w, h, 0, 0, w, h);
  const moved = regions
    .map((r) => moveRegion(r, -x, -y))
    .filter((r) => r.inverted || (r.x + r.w > 0 && r.y + r.h > 0 && r.x < w && r.y < h));
  return { base: out, regions: moved };
}

/** Verkleinert das Grundbild (für die Vorschau und für „Größe ändern“). */
export function scaleCanvas(base: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const out = makeCanvas(base.width * scale, base.height * scale);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, out.width, out.height);
  return out;
}

export function resizeImage(
  base: HTMLCanvasElement,
  regions: ImageRegion[],
  newWidth: number,
): { base: HTMLCanvasElement; regions: ImageRegion[] } {
  const s = newWidth / base.width;
  const out = scaleCanvas(base, s);
  const map: PointMap = (p) => ({ x: p.x * s, y: p.y * s });
  return {
    base: out,
    regions: regions.map((r) => {
      const m = mapRegion({ ...r, brushSize: (r.brushSize || 20) * s }, map);
      return m;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Rendern                                                             */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet Grundbild + alle Bereiche in eine neue Zeichenfläche.
 * scale < 1 erzeugt eine verkleinerte Vorschau; die Effektstärken hängen von
 * der Bereichsgröße ab und sehen deshalb in Vorschau und Export gleich aus.
 * Wird `previewBase` übergeben, ist es bereits auf `scale` verkleinert.
 */
export function renderImage(
  base: HTMLCanvasElement,
  regions: ImageRegion[],
  scale = 1,
  previewBase?: HTMLCanvasElement,
): HTMLCanvasElement {
  const src = previewBase || (scale === 1 ? base : scaleCanvas(base, scale));
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  for (const r of regions) {
    const scaled = scale === 1 ? r : mapRegion({ ...r, brushSize: (r.brushSize || 20) * scale }, (p) => ({ x: p.x * scale, y: p.y * scale }));
    applyRegion(out, scaled);
  }
  return out;
}

function drawShapePath(ctx: CanvasRenderingContext2D, r: ImageRegion, ox: number, oy: number) {
  if (r.shape === 'brush' && r.points && r.points.length > 0) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r.brushSize || 20;
    ctx.beginPath();
    ctx.moveTo(r.points[0].x - ox, r.points[0].y - oy);
    if (r.points.length === 1) ctx.lineTo(r.points[0].x - ox + 0.01, r.points[0].y - oy);
    for (let i = 1; i < r.points.length; i++) ctx.lineTo(r.points[i].x - ox, r.points[i].y - oy);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  if (r.shape === 'ellipse') {
    ctx.ellipse(r.x - ox + r.w / 2, r.y - oy + r.h / 2, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, Math.PI * 2);
  } else {
    ctx.rect(r.x - ox, r.y - oy, r.w, r.h);
  }
  ctx.fill();
}

function applyRegion(target: HTMLCanvasElement, r: ImageRegion) {
  const W = target.width;
  const H = target.height;
  // Betroffener Ausschnitt
  let bx: number;
  let by: number;
  let bw: number;
  let bh: number;
  if (r.inverted) {
    bx = 0;
    by = 0;
    bw = W;
    bh = H;
  } else {
    bx = Math.max(0, Math.floor(r.x));
    by = Math.max(0, Math.floor(r.y));
    bw = Math.min(W, Math.ceil(r.x + r.w)) - bx;
    bh = Math.min(H, Math.ceil(r.y + r.h)) - by;
  }
  if (bw < 1 || bh < 1) return;

  // Effekt-Ebene
  const effect = makeCanvas(bw, bh);
  const ectx = effect.getContext('2d')!;
  // Bezugsgröße für die Effektstärke: Bereichsgröße bzw. bei „umkehren“ ein Drittel des Bildes
  const refSize = r.inverted ? Math.max(4, Math.min(W, H) / 3) : Math.max(4, Math.min(r.w, r.h));
  const s = Math.min(100, Math.max(1, r.strength)) / 100;

  if (r.method === 'fill') {
    ectx.fillStyle = r.color || '#000000';
    ectx.fillRect(0, 0, bw, bh);
  } else if (r.method === 'pixelate') {
    // Kachelgröße: mind. 6 px und mind. 4 % der Bereichsgröße
    const block = Math.max(6, Math.round(refSize * (0.04 + s * 0.21)));
    pixelateInto(target, ectx, bx, by, bw, bh, block);
  } else {
    const radius = Math.max(3, Math.round(refSize * (r.method === 'frosted' ? 0.06 + s * 0.14 : 0.03 + s * 0.17)));
    blurInto(target, ectx, bx, by, bw, bh, radius);
    if (r.method === 'frosted') {
      ectx.fillStyle = 'rgba(255,255,255,0.32)';
      ectx.fillRect(0, 0, bw, bh);
      addNoise(ectx, bw, bh, 14);
    } else {
      addNoise(ectx, bw, bh, 5);
    }
  }

  // Maske: nur die Form (bzw. alles außer der Form) behalten
  const mask = makeCanvas(bw, bh);
  const mctx = mask.getContext('2d')!;
  mctx.fillStyle = '#000';
  mctx.strokeStyle = '#000';
  if (r.inverted) {
    mctx.fillRect(0, 0, bw, bh);
    mctx.globalCompositeOperation = 'destination-out';
  }
  drawShapePath(mctx, r, bx, by);

  ectx.globalCompositeOperation = 'destination-in';
  ectx.drawImage(mask, 0, 0);
  ectx.globalCompositeOperation = 'source-over';

  target.getContext('2d')!.drawImage(effect, bx, by);
}

function pixelateInto(
  src: HTMLCanvasElement,
  ectx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  block: number,
) {
  const sw = Math.max(1, Math.ceil(bw / block));
  const sh = Math.max(1, Math.ceil(bh / block));
  // Mittelwert je Kachel exakt berechnen (Browser-Verkleinerung mittelt nicht zuverlässig)
  const data = src.getContext('2d')!.getImageData(bx, by, bw, bh).data;
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext('2d')!;
  const out = sctx.createImageData(sw, sh);
  for (let ty = 0; ty < sh; ty++) {
    for (let tx = 0; tx < sw; tx++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      let n = 0;
      const x0 = tx * block;
      const y0 = ty * block;
      const x1 = Math.min(bw, x0 + block);
      const y1 = Math.min(bh, y0 + block);
      for (let y = y0; y < y1; y++) {
        let i = (y * bw + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          rr += data[i];
          gg += data[i + 1];
          bb += data[i + 2];
          aa += data[i + 3];
          n++;
        }
      }
      const o = (ty * sw + tx) * 4;
      out.data[o] = rr / n;
      out.data[o + 1] = gg / n;
      out.data[o + 2] = bb / n;
      out.data[o + 3] = aa / n;
    }
  }
  sctx.putImageData(out, 0, 0);
  ectx.imageSmoothingEnabled = false;
  ectx.drawImage(small, 0, 0, sw * block, sh * block);
  ectx.imageSmoothingEnabled = true;
}

/**
 * Eigener Weichzeichner (3 × Box-Blur ≈ Gauß). ctx.filter = 'blur()' fehlt in
 * der Browser-Engine älterer macOS-Versionen, deshalb rechnen wir selbst.
 */
function blurInto(
  src: HTMLCanvasElement,
  ectx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  radius: number,
) {
  const W = src.width;
  const H = src.height;
  // Rand mitnehmen, damit die Kanten nicht ausfransen
  const pad = radius * 2;
  const px = Math.max(0, bx - pad);
  const py = Math.max(0, by - pad);
  const pw = Math.min(W, bx + bw + pad) - px;
  const ph = Math.min(H, by + bh + pad) - py;
  const img = src.getContext('2d')!.getImageData(px, py, pw, ph);
  const boxR = Math.max(1, Math.round(radius / 1.7));
  const a = new Float32Array(img.data);
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(a, b, pw, ph, boxR);
    boxBlurV(b, a, pw, ph, boxR);
  }
  for (let i = 0; i < a.length; i++) img.data[i] = a[i];
  const tmp = makeCanvas(pw, ph);
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ectx.drawImage(tmp, px - bx, py - by);
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const div = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k)) * 4 + c];
      for (let x = 0; x < w; x++) {
        dst[row + x * 4 + c] = acc / div;
        const add = Math.min(w - 1, x + r + 1);
        const rem = Math.max(0, x - r);
        acc += src[row + add * 4 + c] - src[row + rem * 4 + c];
      }
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const div = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 4 + c] = acc / div;
        const add = Math.min(h - 1, y + r + 1);
        const rem = Math.max(0, y - r);
        acc += src[(add * w + x) * 4 + c] - src[(rem * w + x) * 4 + c];
      }
    }
  }
}

/** Leichtes Rauschen erschwert das Zurückrechnen weichgezeichneter Inhalte. */
function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 2;
    d[i] = d[i] + n;
    d[i + 1] = d[i + 1] + n;
    d[i + 2] = d[i + 2] + n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Hinweis, ob die gewählte Stärke für Text als sicher gilt. */
export function isMethodSecure(method: RedactMethod, strength: number): boolean {
  if (method === 'fill') return true;
  if (method === 'pixelate') return strength >= 30;
  if (method === 'frosted') return strength >= 40;
  return strength >= 60;
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

let webpSupport: boolean | undefined;
export function canExportWebp(): boolean {
  if (webpSupport === undefined) {
    try {
      webpSupport = makeCanvas(2, 2).toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

export function formatFromType(type: string, fileName: string): ExportFormat {
  if (/png|gif|bmp/i.test(type) || /\.(png|gif|bmp)$/i.test(fileName)) return 'png';
  if (/webp/i.test(type) || /\.webp$/i.test(fileName)) return canExportWebp() ? 'webp' : 'png';
  return 'jpeg';
}

export async function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat, quality = 0.9): Promise<Blob> {
  let source = canvas;
  if (format === 'jpeg') {
    // JPEG kennt keine Transparenz – weißer Hintergrund statt Schwarz
    source = makeCanvas(canvas.width, canvas.height);
    const ctx = source.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(canvas, 0, 0);
  }
  const mime = FORMAT_INFO[format].mime;
  return new Promise((resolve, reject) => {
    source.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      mime,
      format === 'png' ? undefined : quality,
    );
  });
}

export function suggestFileName(original: string, format: ExportFormat, suffix = 'bearbeitet'): string {
  const base = original.replace(/\.[a-z0-9]+$/i, '') || 'Bild';
  return `${base}_${suffix}.${FORMAT_INFO[format].ext}`;
}

/** Speichert eine Datei – mit „Speichern unter“-Dialog, wenn der Browser ihn hat. */
export async function saveBlob(blob: Blob, fileName: string): Promise<boolean> {
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const ext = fileName.split('.').pop() || '';
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: 'Bild', accept: { [blob.type || 'application/octet-stream']: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

/** Kopiert ein Bild als PNG in die Zwischenablage. */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const ClipboardItemCtor = (window as any).ClipboardItem;
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || !ClipboardItemCtor) {
    throw new Error('Dieser Browser kann keine Bilder in die Zwischenablage kopieren.');
  }
  // Safari verlangt, dass das Promise sofort (innerhalb des Klicks) übergeben wird
  const item = new ClipboardItemCtor({ 'image/png': canvasToBlob(canvas, 'png') });
  await navigator.clipboard.write([item]);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
