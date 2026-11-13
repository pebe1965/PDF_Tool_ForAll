/**
 * Textsuche in PDFs für „Text suchen und schwärzen“.
 * Liefert für jede Fundstelle einen Rahmen auf der Seite (Werte 0..1, Ursprung oben links).
 * Wird von der Smartphone-Version genutzt und ist für den PDF-Editor am Mac vorbereitet.
 */
import { pdfjsLib } from './pdfWorker';

export interface TextMatchBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextMatch {
  id: string;
  pageNumber: number;
  /** Gefundener Text, wie er im PDF steht */
  text: string;
  /** Etwas Text drumherum, damit man die Fundstelle wiedererkennt */
  context: string;
  /** Ein Rahmen je Textstück (eine Fundstelle kann über mehrere Stücke/Zeilen gehen) */
  boxes: TextMatchBox[];
}

export type SearchPreset = 'iban' | 'email' | 'phone' | 'date';

export const SEARCH_PRESETS: Record<SearchPreset, { label: string; hint: string; regex: RegExp }> = {
  iban: {
    label: 'IBAN',
    hint: 'Kontonummern wie DE89 3704 …',
    regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g,
  },
  email: {
    label: 'E-Mail',
    hint: 'Adressen wie name@firma.de',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  phone: {
    label: 'Telefon',
    hint: 'Nummern wie +49 171 1234567',
    regex: /(?:\+\d{1,3}[ ]?|\b0)(?:\(?\d{1,5}\)?[ /-]?){1,4}\d{2,}\b/g,
  },
  date: {
    label: 'Datum',
    hint: 'z. B. Geburtsdatum 01.02.1980',
    regex: /\b\d{1,2}\.\s?\d{1,2}\.\s?(?:19|20)?\d{2}\b/g,
  },
};

type PdfDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

interface CharRef {
  item: number;
  offset: number;
}

interface PageText {
  text: string;
  refs: (CharRef | null)[];
  items: { str: string; transform: number[]; width: number; height: number }[];
  viewport: { width: number; height: number; transform: number[] };
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Anteil der Breite eines Textstücks bis zu einem Zeichen (proportionale Schrift genähert). */
function widthRatio(str: string, offset: number): number {
  if (offset <= 0) return 0;
  if (offset >= str.length) return 1;
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
    if (measureCtx) measureCtx.font = '100px Helvetica, Arial, sans-serif';
  }
  if (!measureCtx) return offset / str.length;
  const full = measureCtx.measureText(str).width;
  return full > 0 ? measureCtx.measureText(str.slice(0, offset)).width / full : offset / str.length;
}

async function readPageText(doc: PdfDoc, pageNumber: number): Promise<PageText> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PageText['items'] = [];
  let text = '';
  const refs: (CharRef | null)[] = [];
  for (const raw of content.items as any[]) {
    if (typeof raw.str !== 'string') continue;
    const idx = items.length;
    items.push({ str: raw.str, transform: raw.transform, width: raw.width, height: raw.height });
    for (let i = 0; i < raw.str.length; i++) {
      text += raw.str[i];
      refs.push({ item: idx, offset: i });
    }
    // Trenner zwischen Textstücken, damit Wörter nicht zusammenkleben
    text += raw.hasEOL ? '\n' : ' ';
    refs.push(null);
  }
  page.cleanup();
  return { text, refs, items, viewport: { width: viewport.width, height: viewport.height, transform: viewport.transform } };
}

/** Rahmen für einen Zeichenbereich [start, end) des Seitentexts. */
function boxesFor(pt: PageText, start: number, end: number): TextMatchBox[] {
  // Zeichen nach Textstück gruppieren
  const groups = new Map<number, { from: number; to: number }>();
  for (let i = start; i < end; i++) {
    const ref = pt.refs[i];
    if (!ref) continue;
    const g = groups.get(ref.item);
    if (g) {
      g.from = Math.min(g.from, ref.offset);
      g.to = Math.max(g.to, ref.offset + 1);
    } else groups.set(ref.item, { from: ref.offset, to: ref.offset + 1 });
  }
  const boxes: TextMatchBox[] = [];
  const { width: vw, height: vh, transform: vt } = pt.viewport;
  for (const [idx, g] of groups) {
    const it = pt.items[idx];
    const m = pdfjsLib.Util.transform(vt, it.transform);
    const fontH = Math.hypot(m[2], m[3]) || it.height || 10;
    // Breite im Seitenraster: Textbreite × horizontale Skalierung der Ansicht
    const scaleX = Math.hypot(vt[0], vt[1]) || 1;
    const itemW = it.width * scaleX;
    const x0 = m[4] + itemW * widthRatio(it.str, g.from);
    const x1 = m[4] + itemW * widthRatio(it.str, g.to);
    const baseline = m[5];
    const pad = fontH * 0.15;
    const top = baseline - fontH * 0.95 - pad;
    const bottom = baseline + fontH * 0.28 + pad;
    const left = Math.min(x0, x1) - pad;
    const right = Math.max(x0, x1) + pad;
    boxes.push({
      x: Math.max(0, left / vw),
      y: Math.max(0, top / vh),
      width: Math.min(1, (right - left) / vw),
      height: Math.min(1, (bottom - top) / vh),
    });
  }
  return boxes;
}

function contextAround(text: string, start: number, end: number): string {
  const before = text.slice(Math.max(0, start - 24), start).replace(/\s+/g, ' ');
  const after = text.slice(end, end + 24).replace(/\s+/g, ' ');
  return `${start > 24 ? '…' : ''}${before}[[${text.slice(start, end).replace(/\s+/g, ' ')}]]${after}${end + 24 < text.length ? '…' : ''}`;
}

/** Hat das PDF überhaupt auswählbaren Text? (Gescannte Seiten haben keinen.) */
export async function pdfHasText(doc: PdfDoc, maxPages = 5): Promise<boolean> {
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const pt = await readPageText(doc, p);
    if (pt.text.replace(/\s/g, '').length > 0) return true;
  }
  return false;
}

/**
 * Sucht einen Begriff (Groß-/Kleinschreibung und Leerzeichen egal, „DE893704“ findet „DE89 3704“)
 * oder ein vorgegebenes Muster (IBAN, E-Mail, …) in allen Seiten.
 */
export async function searchPdfText(
  doc: PdfDoc,
  query: string | SearchPreset,
  onProgress?: (page: number, total: number) => void,
): Promise<TextMatch[]> {
  const preset = (Object.keys(SEARCH_PRESETS) as SearchPreset[]).includes(query as SearchPreset)
    ? SEARCH_PRESETS[query as SearchPreset]
    : null;
  const needle = preset ? '' : query.replace(/\s+/g, '').toLocaleLowerCase('de');
  if (!preset && needle.length === 0) return [];

  const matches: TextMatch[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(p, doc.numPages);
    const pt = await readPageText(doc, p);
    const ranges: [number, number][] = [];

    if (preset) {
      const re = new RegExp(preset.regex.source, preset.regex.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(pt.text))) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        ranges.push([m.index, m.index + m[0].length]);
      }
      if (query === 'phone') {
        // Ziffernblöcke einer IBAN sind keine Telefonnummer
        const ibanRe = new RegExp(SEARCH_PRESETS.iban.regex.source, SEARCH_PRESETS.iban.regex.flags);
        const ibans: [number, number][] = [];
        while ((m = ibanRe.exec(pt.text))) ibans.push([m.index, m.index + m[0].length]);
        for (let i = ranges.length - 1; i >= 0; i--) {
          const [s, e] = ranges[i];
          if (ibans.some(([a, b]) => s < b && e > a)) ranges.splice(i, 1);
        }
      }
    } else {
      // Ohne Leerzeichen vergleichen, Positionen auf den Originaltext zurückrechnen
      let compact = '';
      const map: number[] = [];
      for (let i = 0; i < pt.text.length; i++) {
        if (/\s/.test(pt.text[i])) continue;
        compact += pt.text[i].toLocaleLowerCase('de');
        map.push(i);
      }
      let from = 0;
      while (from <= compact.length - needle.length) {
        const hit = compact.indexOf(needle, from);
        if (hit < 0) break;
        ranges.push([map[hit], map[hit + needle.length - 1] + 1]);
        from = hit + needle.length;
      }
    }

    ranges.forEach(([s, e], i) => {
      const boxes = boxesFor(pt, s, e);
      if (boxes.length === 0) return;
      matches.push({
        id: `m${p}_${i}_${s}`,
        pageNumber: p,
        text: pt.text.slice(s, e).replace(/\s+/g, ' ').trim(),
        context: contextAround(pt.text, s, e),
        boxes,
      });
    });
  }
  return matches;
}
