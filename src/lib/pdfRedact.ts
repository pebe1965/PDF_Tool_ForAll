import type { PDFDocument } from 'pdf-lib';
import { applyRegionToCanvas, pdfRedactionRegion, type RedactMethod } from './imageEngine';
import { pdfjsLib } from './pdfWorker';

/** Eine Schwärzung auf einer PDF-Seite (Werte 0..1 der Seite, Ursprung oben links). */
export interface PdfRedaction {
  id: string;
  pageNumber: number; // 1-basiert
  x: number;
  y: number;
  width: number;
  height: number;
  method?: RedactMethod;
  strength?: number;
  color?: string;
}

/**
 * Brennt Schwärzungen dauerhaft in die betroffenen Seiten ein: Die Seite wird gerastert,
 * Balken/Verpixelung/Weichzeichner/Milchglas werden in die Pixel gezeichnet und die Seite
 * wird durch dieses Bild ersetzt. Der Text darunter ist danach nicht mehr im PDF enthalten.
 * Seiten ohne Schwärzung bleiben unverändert (Text bleibt auswählbar).
 */
export async function burnRedactionsIntoPdf(
  pdfDoc: PDFDocument,
  originalPdfBytes: ArrayBuffer,
  redactions: PdfRedaction[],
  renderScale = 2.2,
): Promise<void> {
  const byPage = new Map<number, PdfRedaction[]>();
  for (const red of redactions) {
    const list = byPage.get(red.pageNumber) || [];
    list.push(red);
    byPage.set(red.pageNumber, list);
  }
  if (byPage.size === 0) return;

  const pdfJsDoc = await pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise;
  const pageCount = pdfDoc.getPageCount();
  try {
    for (const [pageNumber, list] of byPage.entries()) {
      const pageIndex = pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pageCount) continue;

      const pdfJsPage = await pdfJsDoc.getPage(pageNumber);
      const viewport = pdfJsPage.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pdfJsPage.render({ canvasContext: ctx, viewport }).promise;

      for (const red of list) {
        applyRegionToCanvas(canvas, pdfRedactionRegion(red, canvas.width, canvas.height));
      }

      const jpgBytes = await new Promise<ArrayBuffer>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error('Seite konnte nicht erzeugt werden.'))),
          'image/jpeg',
          0.92,
        ),
      );
      // Speicher sofort freigeben (wichtig auf dem iPhone)
      canvas.width = 0;
      canvas.height = 0;
      const image = await pdfDoc.embedJpg(jpgBytes);

      const { width, height } = pdfDoc.getPage(pageIndex).getSize();
      const newPage = pdfDoc.insertPage(pageIndex, [width, height]);
      pdfDoc.removePage(pageIndex + 1);
      newPage.drawImage(image, { x: 0, y: 0, width, height });
    }
  } finally {
    pdfJsDoc.destroy();
  }
}
