/**
 * Kleine PDF-Bausteine für die Smartphone-Werkzeuge (Scannen, Unterschreiben, Seiten, Verkleinern).
 * Alles läuft im Browser auf dem Gerät.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { pdfjsLib } from '../lib/pdfWorker';
import { loadImageFile } from '../lib/imageEngine';

export type PdfJsDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

/** A4 in PDF-Punkten */
export const A4 = { w: 595.28, h: 841.89 };

/** Öffnet ein PDF mit pdf.js; verständliche Fehlermeldung bei Passwort/Schaden. */
export async function openPdfJs(bytes: ArrayBuffer): Promise<PdfJsDoc> {
  try {
    return await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  } catch (err: any) {
    throw new Error(
      err?.name === 'PasswordException'
        ? 'Dieses PDF ist mit einem Passwort geschützt und kann hier nicht bearbeitet werden.'
        : 'Das PDF konnte nicht geöffnet werden. Ist die Datei beschädigt?',
    );
  }
}

/** Lädt ein PDF mit pdf-lib zum Verändern (verschlüsselte PDFs werden abgelehnt). */
export async function openPdfLib(bytes: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes.slice(0));
  } catch (err: any) {
    if (/encrypt/i.test(String(err?.message))) throw new Error('Dieses PDF ist verschlüsselt und kann nicht verändert werden.');
    throw new Error('Das PDF konnte nicht gelesen werden. Ist die Datei beschädigt?');
  }
}

/** Rastert eine Seite in der gewünschten Breite (Pixel). */
export async function renderPage(doc: PdfJsDoc, pageNumber: number, width: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const vp1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / vp1.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Kleines Vorschaubild einer Seite als Daten-URL. */
export async function pageThumb(doc: PdfJsDoc, pageNumber: number, width = 220): Promise<string> {
  const c = await renderPage(doc, pageNumber, width);
  const url = c.toDataURL('image/jpeg', 0.7);
  c.width = c.height = 0;
  return url;
}

export function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.82): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error('Bild konnte nicht erzeugt werden.'))), 'image/jpeg', quality),
  );
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error('Bild konnte nicht erzeugt werden.'))), 'image/png'),
  );
}

/** Verkleinert ein Canvas, falls die lange Seite größer als maxSide ist. */
export function limitCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const long = Math.max(src.width, src.height);
  if (long <= maxSide) return src;
  const k = maxSide / long;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Foto laden (EXIF-Drehung beachtet) und auf eine handliche Größe bringen. */
export async function loadPhoto(file: File, maxSide = 2400): Promise<HTMLCanvasElement> {
  const loaded = await loadImageFile(file, file.name);
  return limitCanvas(loaded.canvas, maxSide);
}

/**
 * Baut ein PDF aus Bildern: eine Seite je Bild.
 * fit 'a4' = Bild mit Rand auf eine A4-Seite (Fotos zum Zusammenführen),
 * fit 'page' = Seite so groß wie das Bild bei A4-Breite (Scans, randlos).
 */
export async function imagesToPdf(canvases: HTMLCanvasElement[], fit: 'a4' | 'page', quality = 0.82): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const c of canvases) {
    const img = await doc.embedJpg(await canvasToJpegBytes(c, quality));
    if (fit === 'page') {
      const landscape = c.width > c.height;
      const pw = landscape ? A4.h : A4.w;
      const ph = (pw * c.height) / c.width;
      doc.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    } else {
      const landscape = c.width > c.height * 1.15;
      const pw = landscape ? A4.h : A4.w;
      const ph = landscape ? A4.w : A4.h;
      const margin = 28;
      const k = Math.min((pw - margin * 2) / c.width, (ph - margin * 2) / c.height);
      const w = c.width * k;
      const h = c.height * k;
      doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  doc.setProducer('Toolbox – PDF, Bilder & mehr');
  return doc.save();
}

export interface PageRef {
  /** Schlüssel des Quell-PDFs */
  source: string;
  /** 0-basiert */
  index: number;
  /** zusätzliche Drehung (0, 90, 180, 270) */
  rotation: number;
}

/** Setzt Seiten aus einem oder mehreren PDFs in neuer Reihenfolge zusammen. */
export async function assemblePages(sources: Map<string, ArrayBuffer>, pages: PageRef[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const cache = new Map<string, PDFDocument>();
  for (const p of pages) {
    let src = cache.get(p.source);
    if (!src) {
      const bytes = sources.get(p.source);
      if (!bytes) throw new Error('Eine Quelldatei fehlt.');
      src = await openPdfLib(bytes);
      cache.set(p.source, src);
    }
    const [copy] = await out.copyPages(src, [p.index]);
    if (p.rotation) copy.setRotation(degrees((copy.getRotation().angle + p.rotation) % 360));
    out.addPage(copy);
  }
  return out.save();
}

export function pdfFile(bytes: Uint8Array, name: string): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`, { type: 'application/pdf' });
}

/** Datum für Dateinamen, z. B. 2026-11-13 */
export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
