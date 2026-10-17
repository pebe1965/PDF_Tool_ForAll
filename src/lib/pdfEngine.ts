import {
  PDFDocument,
  rgb,
  StandardFonts,
  degrees,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
} from 'pdf-lib';
import {
  Annotation,
  MergePageItem,
  PdfFormFieldItem,
  PdfDocumentMetadata,
  PageDecorationsConfig,
  RedactionAnnotation,
} from '../types/pdf';
import { classifyLine } from './a4Pagination';
import { pdfjsLib } from './pdfWorker';

// Helper to convert hex color (#0071E3) to pdf-lib rgb(r, g, b)
export function hexToRgb(hex: string) {
  const cleanHex = (hex || '#000000').replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  if (isNaN(bigint)) return rgb(0, 0, 0);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

// Clean text to avoid pdf-lib WinAnsi encoding crashes while preserving Euro and common symbols where supported
export function sanitizeForPdf(text: string, font?: any): string {
  const normalized = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[\u2192\u2794\u27A1]/g, '->')
    .replace(/[\u2713\u2714\u2611]/g, '[x]')
    .replace(/[\u2717\u2718\u2612]/g, '[ ]');

  if (!font) {
    return normalized.replace(/\u20AC/g, 'EUR').replace(/[^\x00-\xFF]/g, '');
  }

  // Test character-by-character against the embedded font's encoding so € or WinAnsi chars work if supported
  let out = '';
  for (const ch of normalized) {
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch (_) {
      if (ch === '€') out += 'EUR';
    }
  }
  return out;
}

// Helper to wrap text into multiple lines if a max width is defined
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const resultLines: string[] = [];
  const safeText = sanitizeForPdf(text, font);
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
 * Renders a ShapeAnnotation ('check' | 'cross' | 'rect' | 'circle' | 'arrow') into a crisp high-DPI PNG dataUrl
 */
async function renderShapeToPngBytes(
  shapeType: 'check' | 'cross' | 'rect' | 'circle' | 'arrow',
  color: string,
  widthPt: number,
  heightPt: number,
  strokeWidth: number = 3
): Promise<ArrayBuffer> {
  const scale = 3;
  const w = Math.max(48, Math.round(widthPt * scale));
  const h = Math.max(48, Math.round(heightPt * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color || '#0071E3';
  ctx.fillStyle = color || '#0071E3';
  ctx.lineWidth = Math.max(2, strokeWidth * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pad = ctx.lineWidth;

  if (shapeType === 'check') {
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.54);
    ctx.lineTo(w * 0.42, h * 0.8);
    ctx.lineTo(w * 0.85, h * 0.2);
    ctx.stroke();
  } else if (shapeType === 'cross') {
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.2);
    ctx.lineTo(w * 0.8, h * 0.8);
    ctx.moveTo(w * 0.8, h * 0.2);
    ctx.lineTo(w * 0.2, h * 0.8);
    ctx.stroke();
  } else if (shapeType === 'rect') {
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
  } else if (shapeType === 'circle') {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, (w - pad * 2) / 2, (h - pad * 2) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeType === 'arrow') {
    const startX = pad;
    const startY = h / 2;
    const endX = w - pad;
    const endY = h / 2;
    const headLen = Math.min(w, h) * 0.28;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX - headLen, endY - headLen * 0.65);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen, endY + headLen * 0.65);
    ctx.stroke();
  }

  const dataUrl = canvas.toDataURL('image/png');
  return await fetch(dataUrl).then((r) => r.arrayBuffer());
}

/**
 * Applies text, signature, image, highlight, shape, freehand drawing, and true DSGVO redaction annotations onto a PDF
 */
export async function applyAnnotationsToPdf(
  originalPdfBytes: ArrayBuffer,
  annotations: Annotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontCache = new Map<string, any>();
  const pages = pdfDoc.getPages();

  // 1. Check if any pages have DSGVO Redaction annotations.
  // True redaction rasterizes the page with blacked-out areas burned into the bitmap
  // so underlying text cannot be copied or extracted from the PDF stream!
  const redactionsByPage = new Map<number, RedactionAnnotation[]>();
  for (const ann of annotations) {
    if (ann.type === 'redaction') {
      const list = redactionsByPage.get(ann.pageNumber) || [];
      list.push(ann);
      redactionsByPage.set(ann.pageNumber, list);
    }
  }

  if (redactionsByPage.size > 0) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) });
      const pdfJsDoc = await loadingTask.promise;

      for (const [pageNumber, redactions] of redactionsByPage.entries()) {
        const pageIndex = pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const pdfJsPage = await pdfJsDoc.getPage(pageNumber);
        const renderScale = 2.2; // High-DPI rasterization for redacted pages
        const viewport = pdfJsPage.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await pdfJsPage.render({ canvasContext: ctx, viewport }).promise;

        // Burn solid black rectangles directly over the pixels
        ctx.fillStyle = '#000000';
        for (const red of redactions) {
          const rx = red.x * canvas.width;
          const ry = red.y * canvas.height;
          const rw = red.width * canvas.width;
          const rh = red.height * canvas.height;
          ctx.fillRect(rx, ry, rw, rh);
        }

        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpgBytes = await fetch(jpgDataUrl).then((r) => r.arrayBuffer());
        const embeddedRedactedPage = await pdfDoc.embedJpg(jpgBytes);

        // Replace original vector page with clean redacted page of identical dimensions
        const origPage = pdfDoc.getPage(pageIndex);
        const { width, height } = origPage.getSize();
        const newPage = pdfDoc.insertPage(pageIndex, [width, height]);
        pdfDoc.removePage(pageIndex + 1);
        newPage.drawImage(embeddedRedactedPage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }
    } catch (err) {
      console.error('Fehler beim DSGVO-Schwärzen:', err);
    }
  }

  const updatedPages = pdfDoc.getPages();

  // 2. Apply all other annotations (Highlights first so they sit behind added text, then shapes/drawings/text/images)
  const sortedAnnotations = [...annotations].filter((a) => a.type !== 'redaction').sort((a, b) => {
    if (a.type === 'highlight' && b.type !== 'highlight') return -1;
    if (a.type !== 'highlight' && b.type === 'highlight') return 1;
    return 0;
  });

  for (const ann of sortedAnnotations) {
    const pageIndex = ann.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= updatedPages.length) continue;

    const page = updatedPages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (ann.type === 'highlight') {
      try {
        const hlX = ann.x * pageWidth;
        const hlW = ann.width * pageWidth;
        const hlH = ann.height * pageHeight;
        const hlY = pageHeight - ((ann.y + ann.height) * pageHeight);

        page.drawRectangle({
          x: Math.max(0, hlX),
          y: Math.max(0, hlY),
          width: hlW,
          height: hlH,
          color: hexToRgb(ann.color || '#FACC15'),
          opacity: 0.38,
        });
      } catch (err) {
        console.error('Fehler beim Zeichnen des Textmarkers:', err);
      }
    } else if (ann.type === 'shape') {
      try {
        const shW = ann.width * pageWidth;
        const shH = ann.height * pageHeight;
        const shX = ann.x * pageWidth;
        const shY = pageHeight - ((ann.y + ann.height) * pageHeight);

        const pngBytes = await renderShapeToPngBytes(
          ann.shapeType,
          ann.color || '#0071E3',
          shW,
          shH,
          ann.strokeWidth || 3
        );
        const embeddedShape = await pdfDoc.embedPng(pngBytes);
        page.drawImage(embeddedShape, {
          x: Math.max(0, shX),
          y: Math.max(0, shY),
          width: shW,
          height: shH,
        });
      } catch (err) {
        console.error('Fehler beim Zeichnen des Symbols:', err);
      }
    } else if (ann.type === 'drawing') {
      try {
        if (ann.points && ann.points.length > 1) {
          const strokeColor = hexToRgb(ann.color || '#0071E3');
          const thickness = ann.strokeWidth || 2.5;
          for (let i = 0; i < ann.points.length - 1; i++) {
            const p1 = ann.points[i];
            const p2 = ann.points[i + 1];
            page.drawLine({
              start: { x: p1.x * pageWidth, y: pageHeight - p1.y * pageHeight },
              end: { x: p2.x * pageWidth, y: pageHeight - p2.y * pageHeight },
              thickness,
              color: strokeColor,
            });
          }
        }
      } catch (err) {
        console.error('Fehler beim Freihand-Zeichnen:', err);
      }
    } else if (ann.type === 'text') {
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

        // Process lines and segment by typography (H1, H2, bullet, numbered, checklist, divider, body)
        const rawLines = ann.text.split('\n');
        interface RenderSegment {
          text: string;
          size: number;
          font: any;
          lineHeight: number;
          topGap: number;
          indentX: number;
          kind: 'h1' | 'h2' | 'bullet' | 'numbered' | 'checklist' | 'divider' | 'body' | 'empty';
          isFirstSubline: boolean;
          checked?: boolean;
          marker?: string;
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
              indentX: 0,
              kind: 'empty',
              isFirstSubline: true,
            });
            continue;
          }

          if (classified.type === 'divider') {
            segments.push({
              text: '',
              size: baseSize,
              font: regularFont,
              lineHeight: baseSize * 0.8,
              topGap: 6,
              indentX: 0,
              kind: 'divider',
              isFirstSubline: true,
            });
            continue;
          }

          let lineFont = classified.isBold ? boldFont : regularFont;
          const lineSize = classified.fontSize;
          const lineH = classified.lineHeight;

          if (ann.isBold) lineFont = boldFont;

          const indentX =
            classified.type === 'bullet'
              ? 14
              : classified.type === 'checklist'
              ? 18
              : classified.type === 'numbered'
              ? 20
              : 0;

          const availWidth = Math.max(40, boxWidth - indentX);
          const wrappedSublines = wrapText(classified.text, availWidth, lineFont, lineSize);
          for (let i = 0; i < wrappedSublines.length; i++) {
            segments.push({
              text: wrappedSublines[i],
              size: lineSize,
              font: lineFont,
              lineHeight: lineH,
              topGap: i === 0 ? classified.topGap : 0,
              indentX,
              kind: classified.type,
              isFirstSubline: i === 0,
              checked: classified.checked,
              marker: classified.marker,
            });
          }
        }

        const totalHeight = segments.reduce((sum, s) => sum + s.topGap + s.lineHeight, 0);
        const pdfY = pageHeight - (ann.y * pageHeight) - 16;

        // Draw background rectangle if configured
        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          const bgPad = 6;
          const isFullPageCover = ann.x <= 0.12 && (ann.width || 0.84) >= 0.8 && ann.y <= 0.12;
          const rectBottom = isFullPageCover ? 35 : Math.max(0, pdfY - totalHeight);
          const rectHeight = isFullPageCover
            ? Math.max(totalHeight + bgPad * 2, pdfY + bgPad - 35)
            : totalHeight + bgPad * 2;

          page.drawRectangle({
            x: Math.max(0, pdfX - bgPad),
            y: rectBottom,
            width: boxWidth + bgPad * 2,
            height: rectHeight,
            color: hexToRgb(ann.backgroundColor),
          });
        }

        let currentY = pdfY;
        const align = ann.textAlign || 'left';

        for (const seg of segments) {
          currentY -= seg.topGap;
          if (currentY > 30) {
            if (seg.kind === 'divider') {
              const lineY = currentY + seg.size * 0.3;
              page.drawLine({
                start: { x: Math.max(0, pdfX), y: lineY },
                end: { x: Math.max(0, pdfX + boxWidth), y: lineY },
                thickness: 0.9,
                color: rgb(0.75, 0.75, 0.78),
              });
            } else if (seg.kind !== 'empty') {
              // Draw list marker on the first subline
              if (seg.isFirstSubline) {
                if (seg.kind === 'bullet') {
                  page.drawCircle({
                    x: Math.max(0, pdfX + 4.5),
                    y: currentY + seg.size * 0.3,
                    size: Math.max(2, seg.size * 0.16),
                    color: textColor,
                  });
                } else if (seg.kind === 'numbered' && seg.marker) {
                  const safeMarker = sanitizeForPdf(seg.marker, boldFont);
                  page.drawText(safeMarker, {
                    x: Math.max(0, pdfX),
                    y: Math.max(0, currentY),
                    size: seg.size,
                    font: boldFont,
                    color: textColor,
                  });
                } else if (seg.kind === 'checklist') {
                  const boxSize = Math.max(8, seg.size * 0.72);
                  const boxX = Math.max(0, pdfX + 1);
                  const boxY = currentY + seg.size * 0.06;
                  if (seg.checked) {
                    page.drawRectangle({
                      x: boxX,
                      y: boxY,
                      width: boxSize,
                      height: boxSize,
                      color: rgb(0.06, 0.49, 0.25),
                      borderColor: rgb(0.06, 0.49, 0.25),
                      borderWidth: 1,
                    });
                    // Draw crisp white checkmark inside box
                    page.drawLine({
                      start: { x: boxX + boxSize * 0.2, y: boxY + boxSize * 0.48 },
                      end: { x: boxX + boxSize * 0.44, y: boxY + boxSize * 0.22 },
                      thickness: 1.5,
                      color: rgb(1, 1, 1),
                    });
                    page.drawLine({
                      start: { x: boxX + boxSize * 0.44, y: boxY + boxSize * 0.22 },
                      end: { x: boxX + boxSize * 0.82, y: boxY + boxSize * 0.76 },
                      thickness: 1.5,
                      color: rgb(1, 1, 1),
                    });
                  } else {
                    page.drawRectangle({
                      x: boxX,
                      y: boxY,
                      width: boxSize,
                      height: boxSize,
                      borderColor: textColor,
                      borderWidth: 1.1,
                    });
                  }
                }
              }

              // Draw the text itself with alignment and hanging indent
              if (seg.text) {
                let drawX = pdfX + seg.indentX;
                if (seg.indentX === 0 && (align === 'center' || align === 'right')) {
                  try {
                    const tw = seg.font.widthOfTextAtSize(seg.text, seg.size);
                    if (align === 'center') {
                      drawX = pdfX + Math.max(0, (boxWidth - tw) / 2);
                    } else if (align === 'right') {
                      drawX = pdfX + Math.max(0, boxWidth - tw);
                    }
                  } catch (_) {}
                }

                page.drawText(seg.text, {
                  x: Math.max(0, drawX),
                  y: Math.max(0, currentY),
                  size: seg.size,
                  font: seg.font,
                  color: textColor,
                });
              }
            }
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
 * Converts an image File/Blob into a 1-page A4 PDF ArrayBuffer so images can be merged directly with PDFs
 */
export async function convertImageFileToA4PdfBytes(fileOrBlob: Blob): Promise<ArrayBuffer> {
  const { dataUrl, naturalWidth, naturalHeight } = await processImageFile(fileOrBlob);
  const pdfDoc = await PDFDocument.create();
  const isLandscape = naturalWidth > naturalHeight * 1.15;
  const pageW = isLandscape ? 841.89 : 595.28;
  const pageH = isLandscape ? 595.28 : 841.89;
  const page = pdfDoc.addPage([pageW, pageH]);

  const imgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  const embedded = await pdfDoc.embedPng(imgBytes);

  const margin = 28;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / naturalWidth, availH / naturalHeight);
  const drawW = naturalWidth * scale;
  const drawH = naturalHeight * scale;
  const drawX = (pageW - drawW) / 2;
  const drawY = (pageH - drawH) / 2;

  page.drawImage(embedded, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  });

  const saved = await pdfDoc.save();
  return saved.buffer as ArrayBuffer;
}

/**
 * Merges and reorders individual pages from one or multiple PDF documents
 */
export async function mergeAndExportPages(pagesToMerge: MergePageItem[]): Promise<Uint8Array> {
  const newPdfDoc = await PDFDocument.create();
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
 * Triggers a browser download of a PDF binary (or native OS "Save As" dialog if useFilePicker is true and supported)
 */
export async function downloadPdf(
  bytes: Uint8Array,
  filename: string,
  useFilePicker: boolean = false
): Promise<boolean> {
  const finalName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([bytes as any], { type: 'application/pdf' });

  if (useFilePicker && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: finalName,
        types: [
          {
            description: 'PDF-Dokument',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return false; // User cancelled the OS file picker
      }
      // Fall through to standard download if showSaveFilePicker failed for other reasons
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Creates a brand new 1-page blank A4 PDF document
 */
export async function createBlankPdfDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
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

  doc.insertPage(pageIndex, [width, height]);
  doc.removePage(pageIndex + 1);

  for (let i = 0; i < additionalPages; i++) {
    doc.insertPage(pageIndex + 1 + i, [width, height]);
  }

  return await doc.save();
}

/**
 * Rotates a specific page in a PDF by deltaDegrees (90, 180, 270)
 */
export async function rotatePageInPdf(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  deltaDegrees: number = 90
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(pageIndex);
  const currentAngle = page.getRotation().angle;
  page.setRotation(degrees((currentAngle + deltaDegrees) % 360));
  return await doc.save();
}

/**
 * Inspects a PDF for interactive AcroForm fields (Text, Checkbox, Dropdown, Radio)
 */
export async function inspectPdfFormFields(pdfBytes: ArrayBuffer): Promise<PdfFormFieldItem[]> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const items: PdfFormFieldItem[] = [];

    for (const field of fields) {
      const name = field.getName();
      const readOnly = field.isReadOnly();

      if (field instanceof PDFTextField) {
        items.push({
          name,
          type: 'text',
          value: field.getText() || '',
          readOnly,
        });
      } else if (field instanceof PDFCheckBox) {
        items.push({
          name,
          type: 'checkbox',
          value: field.isChecked(),
          readOnly,
        });
      } else if (field instanceof PDFDropdown) {
        const selected = field.getSelected();
        items.push({
          name,
          type: 'dropdown',
          value: selected[0] || '',
          options: field.getOptions(),
          readOnly,
        });
      } else if (field instanceof PDFOptionList) {
        const selected = field.getSelected();
        items.push({
          name,
          type: 'optionlist',
          value: selected[0] || '',
          options: field.getOptions(),
          readOnly,
        });
      } else if (field instanceof PDFRadioGroup) {
        items.push({
          name,
          type: 'radio',
          value: field.getSelected() || '',
          options: field.getOptions(),
          readOnly,
        });
      }
    }

    return items;
  } catch (err) {
    console.warn('Konnte Formularfelder nicht auslesen:', err);
    return [];
  }
}

/**
 * Fills interactive AcroForm fields and optionally flattens (locks) them into static PDF graphics
 */
export async function fillAndSavePdfForm(
  pdfBytes: ArrayBuffer,
  updatedFields: PdfFormFieldItem[],
  flattenForm: boolean = false
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const item of updatedFields) {
    try {
      const field = form.getFieldMaybe(item.name);
      if (!field) continue;

      if (field instanceof PDFTextField && typeof item.value === 'string') {
        field.setText(sanitizeForPdf(item.value, font));
        field.updateAppearances(font);
      } else if (field instanceof PDFCheckBox && typeof item.value === 'boolean') {
        if (item.value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown && typeof item.value === 'string') {
        if (item.value) field.select(item.value);
      } else if (field instanceof PDFOptionList && typeof item.value === 'string') {
        if (item.value) field.select(item.value);
      } else if (field instanceof PDFRadioGroup && typeof item.value === 'string') {
        if (item.value) field.select(item.value);
      }
    } catch (err) {
      console.warn(`Feld "${item.name}" konnte nicht gesetzt werden:`, err);
    }
  }

  if (flattenForm) {
    try {
      form.flatten();
    } catch (err) {
      console.warn('Formular konnte nicht vollständig geglättet werden:', err);
    }
  }

  return await pdfDoc.save();
}

/**
 * Applies page numbers, Bates numbering, headers/footers, and diagonal watermarks across all pages
 */
export async function applyPageDecorationsToPdf(
  pdfBytes: ArrayBuffer,
  config: PageDecorationsConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  for (let idx = 0; idx < totalPages; idx++) {
    const page = pages[idx];
    const { width, height } = page.getSize();
    const pageNum = idx + 1;

    // 1. Diagonal Watermark
    if (config.enableWatermark && config.watermarkText.trim()) {
      const wmText = sanitizeForPdf(config.watermarkText.trim(), boldFont);
      const wmSize = Math.min(width, height) * 0.095;
      const textWidth = boldFont.widthOfTextAtSize(wmText, wmSize);
      const wmColor = hexToRgb(config.watermarkColor || '#DC2626');
      const opacity = Math.max(0.04, Math.min(0.6, config.watermarkOpacity || 0.16));

      page.drawText(wmText, {
        x: width / 2 - (textWidth * Math.cos(Math.PI / 4)) / 2,
        y: height / 2 - (textWidth * Math.sin(Math.PI / 4)) / 2,
        size: wmSize,
        font: boldFont,
        color: wmColor,
        opacity,
        rotate: degrees(45),
      });
    }

    // 2. Header Texts
    const headerY = height - 24;
    const metaSize = 9.5;
    const metaColor = rgb(0.35, 0.35, 0.38);

    if (config.headerLeft?.trim()) {
      page.drawText(sanitizeForPdf(config.headerLeft.trim(), font), {
        x: 36,
        y: headerY,
        size: metaSize,
        font,
        color: metaColor,
      });
    }
    if (config.headerCenter?.trim()) {
      const t = sanitizeForPdf(config.headerCenter.trim(), font);
      const tw = font.widthOfTextAtSize(t, metaSize);
      page.drawText(t, {
        x: (width - tw) / 2,
        y: headerY,
        size: metaSize,
        font,
        color: metaColor,
      });
    }
    if (config.headerRight?.trim()) {
      const t = sanitizeForPdf(config.headerRight.trim(), font);
      const tw = font.widthOfTextAtSize(t, metaSize);
      page.drawText(t, {
        x: Math.max(36, width - 36 - tw),
        y: headerY,
        size: metaSize,
        font,
        color: metaColor,
      });
    }

    // 3. Footer Left
    const footerY = 20;
    if (config.footerLeft?.trim()) {
      page.drawText(sanitizeForPdf(config.footerLeft.trim(), font), {
        x: 36,
        y: footerY,
        size: metaSize,
        font,
        color: metaColor,
      });
    }

    // 4. Page Number / Bates Numbering
    if (config.enablePageNumbers) {
      let label = '';
      if (config.pageNumberFormat === 'page_x_of_y') {
        label = `Seite ${pageNum} von ${totalPages}`;
      } else if (config.pageNumberFormat === 'x_slash_y') {
        label = `${pageNum} / ${totalPages}`;
      } else if (config.pageNumberFormat === 'only_x') {
        label = `${pageNum}`;
      } else if (config.pageNumberFormat === 'bates') {
        const prefix = config.batesPrefix || 'DOK-';
        const start = config.batesStartNumber || 1;
        const numStr = String(start + idx).padStart(6, '0');
        label = `${prefix}${numStr}`;
      }

      const safeLabel = sanitizeForPdf(label, font);
      const labelW = font.widthOfTextAtSize(safeLabel, metaSize);
      let numX = width - 36 - labelW;
      let numY = footerY;

      if (config.pageNumberPosition === 'bottom-center') {
        numX = (width - labelW) / 2;
      } else if (config.pageNumberPosition === 'bottom-left') {
        numX = 36;
      } else if (config.pageNumberPosition === 'top-right') {
        numX = width - 36 - labelW;
        numY = headerY;
      }

      page.drawText(safeLabel, {
        x: Math.max(20, numX),
        y: numY,
        size: metaSize,
        font,
        color: metaColor,
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Splits a PDF by custom range expressions (e.g., "1-3, 4-5, 6") into separate PDF files
 */
export async function splitPdfByRanges(
  pdfBytes: ArrayBuffer,
  rangeExpression: string,
  baseFileName: string = 'Dokument'
): Promise<{ fileName: string; pageSummary: string; bytes: Uint8Array }[]> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const cleanBase = baseFileName.replace(/\.pdf$/i, '') || 'Dokument';

  const parts = rangeExpression
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Bitte mindestens einen Seitenbereich angeben (z. B. 1-3, 4-6).');
  }

  const results: { fileName: string; pageSummary: string; bytes: Uint8Array }[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const pageIndices: number[] = [];

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10));
      const end = endStr.toLowerCase() === 'ende' || endStr === '' ? totalPages : Math.min(totalPages, parseInt(endStr, 10));

      if (isNaN(start) || isNaN(end) || start > end || start > totalPages) {
        throw new Error(`Ungültiger Seitenbereich: "${part}" (Dokument hat ${totalPages} Seiten).`);
      }
      for (let p = start; p <= end; p++) {
        pageIndices.push(p - 1);
      }
    } else {
      const single = parseInt(part, 10);
      if (isNaN(single) || single < 1 || single > totalPages) {
        throw new Error(`Ungültige Seitenzahl: "${part}" (Dokument hat ${totalPages} Seiten).`);
      }
      pageIndices.push(single - 1);
    }

    if (pageIndices.length > 0) {
      const subDoc = await PDFDocument.create();
      const copied = await subDoc.copyPages(srcDoc, pageIndices);
      for (const cp of copied) subDoc.addPage(cp);
      const saved = await subDoc.save();
      const label = part.replace(/\s+/g, '');
      results.push({
        fileName: `${cleanBase}_Seiten_${label}.pdf`,
        pageSummary: `Seite ${part} (${pageIndices.length} S.)`,
        bytes: saved,
      });
    }
  }

  return results;
}

/**
 * Splits a PDF automatically every N pages (e.g. N=1 for individual pages, N=2 for 2-page invoices)
 */
export async function splitPdfEveryNPages(
  pdfBytes: ArrayBuffer,
  pagesPerChunk: number = 1,
  baseFileName: string = 'Dokument'
): Promise<{ fileName: string; pageSummary: string; bytes: Uint8Array }[]> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const step = Math.max(1, pagesPerChunk);
  const cleanBase = baseFileName.replace(/\.pdf$/i, '') || 'Dokument';
  const results: { fileName: string; pageSummary: string; bytes: Uint8Array }[] = [];

  for (let start = 0; start < totalPages; start += step) {
    const end = Math.min(totalPages, start + step);
    const indices: number[] = [];
    for (let i = start; i < end; i++) indices.push(i);

    const subDoc = await PDFDocument.create();
    const copied = await subDoc.copyPages(srcDoc, indices);
    for (const cp of copied) subDoc.addPage(cp);
    const saved = await subDoc.save();

    const startNum = start + 1;
    const endNum = end;
    const suffix = startNum === endNum ? `Seite_${startNum}` : `Seiten_${startNum}-${endNum}`;
    results.push({
      fileName: `${cleanBase}_${suffix}.pdf`,
      pageSummary: startNum === endNum ? `Seite ${startNum}` : `Seite ${startNum}–${endNum}`,
      bytes: saved,
    });
  }

  return results;
}

/**
 * Compresses a PDF by rendering pages at a chosen resolution/quality and rebuilding a streamlined PDF
 */
export async function compressPdfBuffer(
  pdfBytes: ArrayBuffer,
  level: 'compact' | 'balanced' | 'high' = 'balanced',
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const settings = {
    compact: { scale: 1.15, quality: 0.6 }, // Ideal for email & <2.8MB AI limit
    balanced: { scale: 1.5, quality: 0.75 }, // Ideal office balance
    high: { scale: 2.0, quality: 0.85 }, // Print quality
  }[level];

  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdfJsDoc = await loadingTask.promise;
  const outDoc = await PDFDocument.create();

  for (let p = 1; p <= pdfJsDoc.numPages; p++) {
    if (onProgress) onProgress(p, pdfJsDoc.numPages);
    const page = await pdfJsDoc.getPage(p);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const renderViewport = page.getViewport({ scale: settings.scale });

    const canvas = document.createElement('canvas');
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
    const jpgDataUrl = canvas.toDataURL('image/jpeg', settings.quality);
    const jpgBytes = await fetch(jpgDataUrl).then((r) => r.arrayBuffer());
    const embeddedJpg = await outDoc.embedJpg(jpgBytes);

    const newPage = outDoc.addPage([baseViewport.width, baseViewport.height]);
    newPage.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height,
    });
  }

  return await outDoc.save({ useObjectStreams: true });
}

/**
 * Exports all pages of a PDF as high-resolution PNG or JPEG images
 */
export async function exportPdfPagesAsImages(
  pdfBytes: ArrayBuffer,
  format: 'png' | 'jpeg' = 'png',
  scale: number = 2.0,
  baseFileName: string = 'Seite'
): Promise<{ pageNumber: number; fileName: string; dataUrl: string }[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdfJsDoc = await loadingTask.promise;
  const cleanBase = baseFileName.replace(/\.pdf$/i, '') || 'Seite';
  const results: { pageNumber: number; fileName: string; dataUrl: string }[] = [];

  for (let p = 1; p <= pdfJsDoc.numPages; p++) {
    const page = await pdfJsDoc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);

    results.push({
      pageNumber: p,
      fileName: `${cleanBase}_Seite_${p}.${ext}`,
      dataUrl,
    });
  }

  return results;
}

/**
 * Reads PDF document metadata (Title, Author, Subject, Keywords, Creator, Producer)
 */
export async function getPdfMetadata(pdfBytes: ArrayBuffer): Promise<PdfDocumentMetadata> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return {
    title: doc.getTitle() || '',
    author: doc.getAuthor() || '',
    subject: doc.getSubject() || '',
    keywords: doc.getKeywords() || '',
    creator: doc.getCreator() || '',
    producer: doc.getProducer() || '',
  };
}

/**
 * Updates or completely clears PDF metadata for privacy compliance
 */
export async function updatePdfMetadata(
  pdfBytes: ArrayBuffer,
  meta: PdfDocumentMetadata
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  doc.setTitle(meta.title || '');
  doc.setAuthor(meta.author || '');
  doc.setSubject(meta.subject || '');
  doc.setKeywords(meta.keywords ? meta.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []);
  doc.setCreator(meta.creator || '');
  doc.setProducer(meta.producer || '');
  return await doc.save();
}

/**
 * Inspects a PDF for embedded E-Rechnung XML (ZUGFeRD / Factur-X / XRechnung) and parses key fields
 */
export interface EInvoiceParsedData {
  found: boolean;
  standard?: string; // 'ZUGFeRD / Factur-X (CII)' | 'XRechnung (UBL)'
  invoiceNumber?: string;
  issueDate?: string;
  sellerName?: string;
  sellerVatId?: string;
  buyerName?: string;
  currency?: string;
  netTotal?: string;
  taxTotal?: string;
  grandTotal?: string;
  dueDate?: string;
  iban?: string;
  lineItems: { name: string; quantity: string; netPrice: string; total: string }[];
  rawXml?: string;
}

export function extractEInvoiceFromPdfBytes(pdfBytes: ArrayBuffer): EInvoiceParsedData {
  try {
    const uint8 = new Uint8Array(pdfBytes);
    // Decode latin1/utf8 slices to locate XML blocks inside uncompressed PDF streams
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawStr = decoder.decode(uint8);

    // Search for CrossIndustryInvoice (ZUGFeRD / Factur-X) or UBL Invoice
    const ciiMatch = rawStr.match(/<([a-zA-Z0-9_]+:)?CrossIndustryInvoice[\s\S]*?<\/([a-zA-Z0-9_]+:)?CrossIndustryInvoice>/);
    const ublMatch = rawStr.match(/<([a-zA-Z0-9_]+:)?Invoice[\s\S]*?<\/([a-zA-Z0-9_]+:)?Invoice>/);

    const xmlString = ciiMatch ? ciiMatch[0] : ublMatch ? ublMatch[0] : null;
    if (!xmlString) {
      return { found: false, lineItems: [] };
    }

    return parseEInvoiceXmlString(xmlString);
  } catch (err) {
    console.warn('Fehler beim Suchen nach E-Rechnungs-XML:', err);
    return { found: false, lineItems: [] };
  }
}

export function parseEInvoiceXmlString(xmlString: string): EInvoiceParsedData {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const getTagText = (parent: Element | Document, localName: string): string => {
      const els = parent.getElementsByTagName('*');
      for (let i = 0; i < els.length; i++) {
        if (els[i].localName === localName && els[i].textContent?.trim()) {
          return els[i].textContent!.trim();
        }
      }
      return '';
    };

    const findElement = (parent: Element | Document, localName: string): Element | null => {
      const els = parent.getElementsByTagName('*');
      for (let i = 0; i < els.length; i++) {
        if (els[i].localName === localName) return els[i];
      }
      return null;
    };

    const isCII = xmlString.includes('CrossIndustryInvoice');
    const standard = isCII ? 'ZUGFeRD / Factur-X (CrossIndustryInvoice)' : 'XRechnung / UBL Invoice';

    let invoiceNumber = '';
    let issueDate = '';
    let sellerName = '';
    let sellerVatId = '';
    let buyerName = '';
    let currency = 'EUR';
    let netTotal = '';
    let taxTotal = '';
    let grandTotal = '';
    let iban = '';
    const lineItems: { name: string; quantity: string; netPrice: string; total: string }[] = [];

    if (isCII) {
      const docHeader = findElement(xmlDoc, 'ExchangedDocument');
      if (docHeader) {
        invoiceNumber = getTagText(docHeader, 'ID');
        const dtStr = getTagText(docHeader, 'DateTimeString');
        if (dtStr && dtStr.length === 8) {
          issueDate = `${dtStr.slice(6, 8)}.${dtStr.slice(4, 6)}.${dtStr.slice(0, 4)}`;
        } else {
          issueDate = dtStr;
        }
      }

      const sellerParty = findElement(xmlDoc, 'SellerTradeParty');
      if (sellerParty) {
        sellerName = getTagText(sellerParty, 'Name');
        sellerVatId = getTagText(sellerParty, 'ID');
      }

      const buyerParty = findElement(xmlDoc, 'BuyerTradeParty');
      if (buyerParty) {
        buyerName = getTagText(buyerParty, 'Name');
      }

      const settlement = findElement(xmlDoc, 'ApplicableHeaderTradeSettlement');
      if (settlement) {
        currency = getTagText(settlement, 'InvoiceCurrencyCode') || 'EUR';
        iban = getTagText(settlement, 'IBANID');
        const summation = findElement(settlement, 'SpecifiedTradeSettlementHeaderMonetarySummation');
        if (summation) {
          netTotal = getTagText(summation, 'TaxBasisTotalAmount') || getTagText(summation, 'LineTotalAmount');
          taxTotal = getTagText(summation, 'TaxTotalAmount');
          grandTotal = getTagText(summation, 'GrandTotalAmount') || getTagText(summation, 'DuePayableAmount');
        }
      }

      const allEls = xmlDoc.getElementsByTagName('*');
      for (let i = 0; i < allEls.length; i++) {
        if (allEls[i].localName === 'IncludedSupplyChainTradeLineItem') {
          const itemEl = allEls[i];
          const prod = findElement(itemEl, 'SpecifiedTradeProduct');
          const deliv = findElement(itemEl, 'SpecifiedLineTradeDelivery');
          const agree = findElement(itemEl, 'SpecifiedLineTradeAgreement');
          const settle = findElement(itemEl, 'SpecifiedLineTradeSettlement');
          lineItems.push({
            name: prod ? getTagText(prod, 'Name') : 'Position',
            quantity: deliv ? getTagText(deliv, 'BilledQuantity') : '1',
            netPrice: agree ? getTagText(agree, 'ChargeAmount') : '',
            total: settle ? getTagText(settle, 'LineTotalAmount') : '',
          });
        }
      }
    } else {
      // UBL XRechnung
      invoiceNumber = getTagText(xmlDoc, 'ID');
      issueDate = getTagText(xmlDoc, 'IssueDate');
      currency = getTagText(xmlDoc, 'DocumentCurrencyCode') || 'EUR';

      const supplier = findElement(xmlDoc, 'AccountingSupplierParty');
      if (supplier) {
        sellerName = getTagText(supplier, 'RegistrationName') || getTagText(supplier, 'Name');
        sellerVatId = getTagText(supplier, 'CompanyID');
      }
      const customer = findElement(xmlDoc, 'AccountingCustomerParty');
      if (customer) {
        buyerName = getTagText(customer, 'RegistrationName') || getTagText(customer, 'Name');
      }
      const monetary = findElement(xmlDoc, 'LegalMonetaryTotal');
      if (monetary) {
        netTotal = getTagText(monetary, 'TaxExclusiveAmount') || getTagText(monetary, 'LineExtensionAmount');
        grandTotal = getTagText(monetary, 'PayableAmount') || getTagText(monetary, 'TaxInclusiveAmount');
      }
      const taxTotalEl = findElement(xmlDoc, 'TaxTotal');
      if (taxTotalEl) {
        taxTotal = getTagText(taxTotalEl, 'TaxAmount');
      }

      const allEls = xmlDoc.getElementsByTagName('*');
      for (let i = 0; i < allEls.length; i++) {
        if (allEls[i].localName === 'InvoiceLine') {
          const lineEl = allEls[i];
          lineItems.push({
            name: getTagText(lineEl, 'Name') || getTagText(lineEl, 'Description') || 'Position',
            quantity: getTagText(lineEl, 'InvoicedQuantity') || '1',
            netPrice: getTagText(lineEl, 'PriceAmount'),
            total: getTagText(lineEl, 'LineExtensionAmount'),
          });
        }
      }
    }

    return {
      found: true,
      standard,
      invoiceNumber,
      issueDate,
      sellerName,
      sellerVatId,
      buyerName,
      currency,
      netTotal,
      taxTotal,
      grandTotal,
      iban,
      lineItems,
      rawXml: xmlString,
    };
  } catch (err) {
    return { found: false, lineItems: [] };
  }
}
