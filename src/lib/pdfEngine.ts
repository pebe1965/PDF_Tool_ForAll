import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Annotation, MergePageItem } from '../types/pdf';
import { classifyLine } from './a4Pagination';

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
    .replace(/\u2022/g, '-')
    .replace(/[\u2192\u2794\u27A1]/g, '->')
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
        const baseSize = ann.fontSize || 14;

        const regularFont = await getEmbeddedFont(
          pdfDoc,
          fontCache,
          ann.fontFamily || 'Helvetica',
          false,
          ann.isItalic || false
        );
        const boldFont = await getEmbeddedFont(
          pdfDoc,
          fontCache,
          ann.fontFamily || 'Helvetica',
          true,
          ann.isItalic || false
        );

        // Convert normalized top-left coordinates to PDF bottom-left coordinates
        const pdfX = ann.x * pageWidth;
        const boxWidth = ann.width ? ann.width * pageWidth : pageWidth - pdfX;

        // Process lines and segment by typography (H1, H2, body)
        const rawLines = ann.text.split('\n');
        interface RenderSegment {
          text: string;
          size: number;
          font: any;
          lineHeight: number;
          topGap: number;
        }
        const segments: RenderSegment[] = [];

        for (const rawLine of rawLines) {
          const classified = classifyLine(rawLine, baseSize);
          if (classified.type === 'empty') {
            segments.push({
              text: '',
              size: baseSize,
              font: regularFont,
              lineHeight: baseSize * 0.7,
              topGap: 4,
            });
            continue;
          }

          let lineFont = classified.isBold ? boldFont : regularFont;
          let lineSize = classified.fontSize;
          let lineH = classified.lineHeight;

          if (ann.isBold) lineFont = boldFont;

          const wrappedSublines = wrapText(classified.text, boxWidth, lineFont, lineSize);
          for (let i = 0; i < wrappedSublines.length; i++) {
            let lineText = wrappedSublines[i];
            if (classified.type === 'bullet') {
              lineText = i === 0 ? `- ${lineText}` : `  ${lineText}`;
            }
            segments.push({
              text: lineText,
              size: lineSize,
              font: lineFont,
              lineHeight: lineH,
              topGap: i === 0 ? classified.topGap : 0,
            });
          }
        }

        const totalHeight = segments.reduce((sum, s) => sum + s.topGap + s.lineHeight, 0);
        const pdfY = pageHeight - (ann.y * pageHeight) - 16;

        // Draw background rectangle if configured
        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          const bgPad = 6;
          // If this is a page-covering text box (full width, starts near top), extend background to bottom margin (35 pt)
          const isFullPageCover = (ann.x <= 0.12 && (ann.width || 0.84) >= 0.8 && ann.y <= 0.12);
          const rectBottom = isFullPageCover ? 35 : Math.max(0, pdfY - totalHeight);
          const rectHeight = isFullPageCover ? Math.max(totalHeight + (bgPad * 2), pdfY + bgPad - 35) : (totalHeight + (bgPad * 2));

          page.drawRectangle({
            x: Math.max(0, pdfX - bgPad),
            y: rectBottom,
            width: boxWidth + (bgPad * 2),
            height: rectHeight,
            color: hexToRgb(ann.backgroundColor),
          });
        }

        let currentY = pdfY;
        for (const seg of segments) {
          currentY -= seg.topGap;
          if (seg.text && currentY > 35) { // Protect from drawing off the bottom of the page
            page.drawText(seg.text, {
              x: Math.max(0, pdfX),
              y: Math.max(0, currentY),
              size: seg.size,
              font: seg.font,
              color: textColor,
            });
          }
          currentY -= seg.lineHeight;
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

  if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < doc.getPageCount()) {
    doc.insertPage(afterIndex + 1, [width, height]);
  } else {
    doc.addPage([width, height]);
  }

  return await doc.save();
}

/**
 * Adds multiple blank pages to an existing PDF (after a specific page or at the end)
 */
export async function addMultipleBlankPagesToPdf(
  pdfBytes: ArrayBuffer,
  count: number = 1,
  afterIndex?: number
): Promise<Uint8Array> {
  if (count <= 0) return new Uint8Array(pdfBytes);
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const samplePage = pages[0];
  const { width, height } = samplePage ? samplePage.getSize() : { width: 595.28, height: 841.89 };

  for (let i = 0; i < count; i++) {
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < doc.getPageCount()) {
      doc.insertPage(afterIndex + 1 + i, [width, height]);
    } else {
      doc.addPage([width, height]);
    }
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

/**
 * Extracts a single page from a PDF document into a standalone 1-page PDF buffer
 */
export async function extractSinglePageAsPdf(
  pdfBytes: ArrayBuffer,
  pageNumber: number // 1-indexed
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();
  const pageIndex = Math.max(0, Math.min(srcDoc.getPageCount() - 1, pageNumber - 1));
  const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
  newDoc.addPage(copiedPage);
  return await newDoc.save();
}

/**
 * Replaces an existing page with a fresh blank page, and optionally inserts continuation blank pages directly after it.
 * This completely wipes out any old content on pageIndex so no leftover text or ghost graphics remain.
 */
export async function replacePageWithBlank(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  additionalPages: number = 0
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  if (pageIndex < 0 || pageIndex >= doc.getPageCount()) {
    return new Uint8Array(pdfBytes);
  }
  const origPage = doc.getPage(pageIndex);
  const { width, height } = origPage.getSize();

  // 1. Insert clean replacement page at pageIndex
  doc.insertPage(pageIndex, [width, height]);
  // 2. Remove the old page (which shifted to pageIndex + 1)
  doc.removePage(pageIndex + 1);

  // 3. Insert any additional continuation blank pages directly after pageIndex
  for (let i = 0; i < additionalPages; i++) {
    doc.insertPage(pageIndex + 1 + i, [width, height]);
  }

  return await doc.save();
}
