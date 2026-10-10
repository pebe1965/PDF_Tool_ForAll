import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Annotation, MergePageItem } from '../types/pdf';

// Helper to convert hex color (#0071E3) to pdf-lib rgb(r, g, b)
function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

// Clean text to avoid pdf-lib WinAnsi encoding crashes (curly quotes, dashes, emojis)
function sanitizeForPdf(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[^\x00-\xFF]/g, '');
}

// Helper to wrap text into multiple lines if a max width is defined
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const resultLines: string[] = [];
  const safeText = sanitizeForPdf(text);
  const paragraphs = safeText.split('\n');

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      try {
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (textWidth > maxWidth && currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      } catch (_) {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

async function getEmbeddedFont(
  pdfDoc: PDFDocument,
  fontCache: Map<string, any>,
  family: string = 'Helvetica',
  isBold: boolean = false,
  isItalic: boolean = false
) {
  let fontName: StandardFonts = StandardFonts.Helvetica;

  if (family === 'Times') {
    if (isBold && isItalic) fontName = StandardFonts.TimesRomanBoldItalic;
    else if (isBold) fontName = StandardFonts.TimesRomanBold;
    else if (isItalic) fontName = StandardFonts.TimesRomanItalic;
    else fontName = StandardFonts.TimesRoman;
  } else if (family === 'Courier') {
    if (isBold && isItalic) fontName = StandardFonts.CourierBoldOblique;
    else if (isBold) fontName = StandardFonts.CourierBold;
    else if (isItalic) fontName = StandardFonts.CourierOblique;
    else fontName = StandardFonts.Courier;
  } else {
    if (isBold && isItalic) fontName = StandardFonts.HelveticaBoldOblique;
    else if (isBold) fontName = StandardFonts.HelveticaBold;
    else if (isItalic) fontName = StandardFonts.HelveticaOblique;
    else fontName = StandardFonts.Helvetica;
  }

  if (fontCache.has(fontName)) {
    return fontCache.get(fontName);
  }

  const embedded = await pdfDoc.embedFont(fontName);
  fontCache.set(fontName, embedded);
  return embedded;
}

/**
 * Applies text, signature, and annotations onto an existing PDF and returns modified bytes
 */
export async function applyAnnotationsToPdf(
  originalPdfBytes: ArrayBuffer,
  annotations: Annotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontCache = new Map<string, any>();
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = ann.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (ann.type === 'text') {
      try {
        const textColor = hexToRgb(ann.color || '#000000');
        const font = await getEmbeddedFont(
          pdfDoc,
          fontCache,
          ann.fontFamily || 'Helvetica',
          ann.isBold || false,
          ann.isItalic || false
        );

        // Convert normalized top-left coordinates to PDF bottom-left coordinates
        const pdfX = ann.x * pageWidth;
        const pdfY = pageHeight - (ann.y * pageHeight) - (ann.fontSize * 0.85);

        // Wrap text based on box width (or remainder of the page)
        const boxWidth = ann.width ? ann.width * pageWidth : pageWidth - pdfX;
        const lines = wrapText(ann.text, boxWidth, font, ann.fontSize);
        const lineHeight = ann.fontSize * 1.25;
        const totalHeight = Math.max(1, lines.length) * lineHeight;

        // Draw background rectangle if configured (e.g. white to cover old text, yellow note)
        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          const bgPad = 4;
          page.drawRectangle({
            x: Math.max(0, pdfX - bgPad),
            y: Math.max(0, pdfY - totalHeight + (ann.fontSize * 0.4)),
            width: boxWidth + (bgPad * 2),
            height: totalHeight + (bgPad * 2),
            color: hexToRgb(ann.backgroundColor),
          });
        }

        let currentY = pdfY;
        for (const line of lines) {
          if (line) {
            page.drawText(line, {
              x: Math.max(0, pdfX),
              y: Math.max(0, currentY),
              size: ann.fontSize,
              font: font,
              color: textColor,
            });
          }
          currentY -= lineHeight;
        }
      } catch (err) {
        console.error('Fehler beim Zeichnen des Texts:', err);
      }
    } else if (ann.type === 'signature' || ann.type === 'image') {
      try {
        const imageBytes = await fetch(ann.dataUrl).then((res) => res.arrayBuffer());
        let embeddedImage;
        if (ann.dataUrl.startsWith('data:image/jpeg') || ann.dataUrl.startsWith('data:image/jpg')) {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        }

        const imgWidth = ann.width * pageWidth;
        const imgHeight = ann.height * pageHeight;
        const pdfX = ann.x * pageWidth;
        const pdfY = pageHeight - ((ann.y + ann.height) * pageHeight);

        page.drawImage(embeddedImage, {
          x: Math.max(0, pdfX),
          y: Math.max(0, pdfY),
          width: imgWidth,
          height: imgHeight,
        });
      } catch (err) {
        console.error('Fehler beim Einbetten des Bildes/der Signatur:', err);
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Converts any image file or blob (PNG, JPG, WebP, Screenshot) to a clean PNG data URL
 * and calculates natural dimensions and aspect ratio.
 */
export async function processImageFile(
  fileOrBlob: Blob
): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas-Kontext konnte nicht erstellt werden'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          resolve({
            dataUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            aspectRatio,
          });
        } catch (_) {
          // Fallback to raw dataUrl if canvas fails
          resolve({
            dataUrl: e.target?.result as string,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight,
          });
        }
      };
      img.onerror = () => reject(new Error('Bild konnte nicht dekodiert werden'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Merges and reorders individual pages from one or multiple PDF documents
 */
export async function mergeAndExportPages(pagesToMerge: MergePageItem[]): Promise<Uint8Array> {
  const newPdfDoc = await PDFDocument.create();

  // Cache loaded source documents to avoid re-parsing the same file multiple times
  const loadedDocsCache = new Map<string, PDFDocument>();

  for (const item of pagesToMerge) {
    let srcDoc = loadedDocsCache.get(item.fileId);
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(item.fileBytes);
      loadedDocsCache.set(item.fileId, srcDoc);
    }

    const [copiedPage] = await newPdfDoc.copyPages(srcDoc, [item.pageIndex]);
    if (item.rotation) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
    }
    newPdfDoc.addPage(copiedPage);
  }

  return await newPdfDoc.save();
}

/**
 * Triggers a browser download of a PDF binary
 */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Creates a brand new 1-page blank A4 PDF document
 */
export async function createBlankPdfDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Standard A4 dimensions in points: 595.28 x 841.89
  doc.addPage([595.28, 841.89]);
  return await doc.save();
}

/**
 * Adds a new blank page to an existing PDF (after a specific page or at the end)
 */
export async function addBlankPageToPdf(
  pdfBytes: ArrayBuffer,
  afterIndex?: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const samplePage = pages[0];
  const { width, height } = samplePage ? samplePage.getSize() : { width: 595.28, height: 841.89 };

  if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < pages.length - 1) {
    doc.insertPage(afterIndex + 1, [width, height]);
  } else {
    doc.addPage([width, height]);
  }

  return await doc.save();
}

/**
 * Appends another PDF's pages to the end of the base PDF
 */
export async function appendPdfToPdf(
  baseBytes: ArrayBuffer,
  secondBytes: ArrayBuffer
): Promise<Uint8Array> {
  const baseDoc = await PDFDocument.load(baseBytes);
  const secondDoc = await PDFDocument.load(secondBytes);
  const secondPageIndices = secondDoc.getPageIndices();

  const copiedPages = await baseDoc.copyPages(secondDoc, secondPageIndices);
  for (const page of copiedPages) {
    baseDoc.addPage(page);
  }

  return await baseDoc.save();
}

/**
 * Removes a page from an existing PDF
 */
export async function deletePageFromPdf(
  pdfBytes: ArrayBuffer,
  pageIndex: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  if (doc.getPageCount() <= 1) {
    throw new Error('Ein Dokument muss mindestens eine Seite enthalten.');
  }
  doc.removePage(pageIndex);
  return await doc.save();
}
