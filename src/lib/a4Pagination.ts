/**
 * A4 Document Pagination and Typography Engine
 * Splits long structured text into clean A4 page slices, preventing any overflow
 * and keeping paragraphs (Absätze) together while maximizing page utilization.
 */

export interface FormattedLine {
  type: 'h1' | 'h2' | 'bullet' | 'numbered' | 'checklist' | 'divider' | 'body' | 'empty';
  text: string;
  fontSize: number;
  isBold: boolean;
  lineHeight: number;
  topGap: number;
  checked?: boolean;
  marker?: string;
}

/**
 * Checks whether a line of text represents a section title or heading
 */
export function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Never treat checklists, bullets, or dividers as headings
  if (/^(\[\s*\]|\[[xX✓✔]\]|☐|☑|•|-|\*)\s*/.test(trimmed)) return false;
  if (/^[-=_]{3,}$/.test(trimmed)) return false;

  // 1. Markdown headings (#, ##, ###)
  if (/^#{1,4}\s+/.test(trimmed)) return true;

  // 2. Multi-level numbered section titles (e.g. "1.1 Bedingungen", "2.1.3 Details")
  if (/^[0-9]+\.[0-9]+(\.[0-9]+)*[.)]?\s+[A-Za-zÄÖÜäöü]/.test(trimmed)) return true;

  // Single-level numbered lines ("1. Punkt") are numbered list items, NOT headings
  if (/^[0-9]+[.)]\s+/.test(trimmed)) return false;

  // 3. Standalone UPPERCASE titles (length >= 4, no digits/bullets at start)
  if (trimmed === trimmed.toUpperCase() && trimmed.length >= 4 && !/^[0-9•\-\*\[]/.test(trimmed)) {
    return true;
  }

  // 4. Lines ending with colon, up to 90 chars, not starting with list bullets
  if (trimmed.endsWith(':') && trimmed.length <= 90 && !/^[•\-\*\[]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Classifies a line of text into H1, H2, bullet, numbered list, checklist, divider, or body
 */
export function classifyLine(line: string, baseFontSize: number = 14): FormattedLine {
  const trimmed = line.trim();

  if (!trimmed) {
    return {
      type: 'empty',
      text: '',
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 0.7,
      topGap: 2,
    };
  }

  // Divider line (---)
  if (/^[-=_]{3,}$/.test(trimmed)) {
    return {
      type: 'divider',
      text: '',
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 0.8,
      topGap: 6,
    };
  }

  // Checklist: [ ] / [x] / ☐ / ☑
  const uncheckedMatch = trimmed.match(/^(?:\[\s*\]|☐)\s*(.*)$/);
  if (uncheckedMatch) {
    return {
      type: 'checklist',
      checked: false,
      text: uncheckedMatch[1].trim(),
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 1.4,
      topGap: 3,
    };
  }

  const checkedMatch = trimmed.match(/^(?:\[[xX✓✔]\]|☑)\s*(.*)$/);
  if (checkedMatch) {
    return {
      type: 'checklist',
      checked: true,
      text: checkedMatch[1].trim(),
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 1.4,
      topGap: 3,
    };
  }

  // Bullet list: • / - / *
  if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed === '•') {
    const clean = trimmed.replace(/^[*•\-]\s*/, '').trim();
    return {
      type: 'bullet',
      text: clean,
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 1.35,
      topGap: 2,
    };
  }

  // Numbered list: 1. / 2. / 1) / 2)
  const numberedMatch = trimmed.match(/^([0-9]+[.)])\s+(.*)$/);
  if (numberedMatch) {
    return {
      type: 'numbered',
      marker: numberedMatch[1],
      text: numberedMatch[2].trim(),
      fontSize: baseFontSize,
      isBold: false,
      lineHeight: baseFontSize * 1.35,
      topGap: 2,
    };
  }

  // H1: Markdown # or standalone uppercase title (length > 5, no digits/bullets at start)
  if (
    trimmed.startsWith('# ') ||
    (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && !/^[0-9•\-\*\[]/.test(trimmed))
  ) {
    const clean = trimmed.replace(/^#\s+/, '').trim();
    return {
      type: 'h1',
      text: clean,
      fontSize: Math.round(baseFontSize * 1.4),
      isBold: true,
      lineHeight: Math.round(baseFontSize * 1.75),
      topGap: 10,
    };
  }

  // H2: Markdown ## / ###, multi-level numbered section headers, or isHeadingLine
  if (isHeadingLine(trimmed)) {
    const clean = trimmed.replace(/^###?\s+/, '').trim();
    return {
      type: 'h2',
      text: clean,
      fontSize: Math.round(baseFontSize * 1.15),
      isBold: true,
      lineHeight: Math.round(baseFontSize * 1.5),
      topGap: 8,
    };
  }

  // Regular body text
  return {
    type: 'body',
    text: trimmed,
    fontSize: baseFontSize,
    isBold: false,
    lineHeight: baseFontSize * 1.35,
    topGap: 2,
  };
}

/**
 * Wraps text by whole words based on max character threshold per line
 */
function wrapLineWords(text: string, maxChars: number = 75): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Calculates vertical height consumed by a single line in points
 */
export function calculateLineHeight(
  rawLine: string,
  baseFontSize: number = 14
): number {
  const c = classifyLine(rawLine, baseFontSize);
  if (c.type === 'empty' || c.type === 'divider') {
    return c.lineHeight + c.topGap;
  }
  const maxChars = c.type === 'h1' ? 45 : c.type === 'h2' ? 58 : 72;
  const sublines = wrapLineWords(c.text, maxChars);
  return c.topGap + (sublines.length * c.lineHeight);
}

/**
 * Splits document into cohesive paragraphs / sections ("Absätze")
 * Keeps headings and introductory lines bound to the content that follows them.
 */
export function parseIntoBlocks(text: string): string[][] {
  const rawLines = text.split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock.length > 0) {
        // If the last line in current block is a heading or ends with a colon,
        // do NOT break the block yet! Keep heading/intro bound to its following content.
        const lastLine = currentBlock[currentBlock.length - 1];
        if (!isHeadingLine(lastLine) && !lastLine.endsWith(':')) {
          blocks.push([...currentBlock]);
          currentBlock = [];
        }
      }
      continue;
    }

    const isHead = isHeadingLine(trimmed);
    // If a heading appears and current block already has non-heading body content:
    if (isHead && currentBlock.length > 0) {
      const hasContent = currentBlock.some((l) => !isHeadingLine(l) && !l.endsWith(':'));
      if (hasContent) {
        blocks.push([...currentBlock]);
        currentBlock = [line];
        continue;
      }
    }
    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }
  return blocks;
}

/**
 * Paginates structured text into clean slices that fit within standard A4 page limits (595 x 842 pt).
 * Base font size defaults to 14px.
 * Prevents orphan headings, avoids splitting introductory lines, and maximizes page utilization.
 */
export function paginateDocumentForA4(text: string, baseFontSize: number = 14): string[] {
  if (!text || !text.trim()) return [''];

  // Standard A4 height is 841.89 pt. Top margin at y=0.08 is ~67 pt. Extra padding ~16 pt.
  // Usable height of 705 pt leaves a generous ~65 pt safety clearance from bottom.
  const MAX_USABLE_HEIGHT = 705;
  const PARAGRAPH_SPACING = 8; // spacing between paragraphs in points

  const blocks = parseIntoBlocks(text);
  const pages: string[] = [];
  let currentPageLines: string[] = [];
  let currentAccumulatedHeight = 0;

  for (let b = 0; b < blocks.length; b++) {
    const blockLines = blocks[b];

    // Calculate height of this entire block
    let blockHeight = 0;
    for (const line of blockLines) {
      blockHeight += calculateLineHeight(line, baseFontSize);
    }

    const lastLineInBlock = blockLines[blockLines.length - 1].trim();
    const endsWithIntro = lastLineInBlock.endsWith(':') || isHeadingLine(lastLineInBlock);

    // Protection against orphan intro lines:
    // If block ends with an intro line (ending with ':' or heading), check if the NEXT block can follow
    let shouldIntroBreak = false;
    if (endsWithIntro && b + 1 < blocks.length && currentPageLines.length > 0) {
      let nextH = 0;
      for (const line of blocks[b + 1]) {
        nextH += calculateLineHeight(line, baseFontSize);
      }
      if (currentAccumulatedHeight + blockHeight + PARAGRAPH_SPACING + Math.min(80, nextH) > MAX_USABLE_HEIGHT) {
        shouldIntroBreak = true;
      }
    }

    const neededHeight = blockHeight + (currentPageLines.length > 0 ? PARAGRAPH_SPACING : 0);
    const remainingSpace = MAX_USABLE_HEIGHT - currentAccumulatedHeight;
    const canFitEntireBlock = neededHeight <= remainingSpace && !shouldIntroBreak;

    if (canFitEntireBlock) {
      if (currentPageLines.length > 0) {
        currentPageLines.push('');
        currentAccumulatedHeight += PARAGRAPH_SPACING;
      }
      currentPageLines.push(...blockLines);
      currentAccumulatedHeight += blockHeight;
    } else if (currentPageLines.length > 0) {
      // Entire block does NOT fit on current page.
      // Check if we can partially split it to utilize the page without orphan headings
      let canSplit = false;
      let splitIdx = 0;

      // Allow splitting only if there is substantial space (>= 180 pt) and the block has multiple lines (>= 6)
      if (remainingSpace >= 180 && blockLines.length >= 6) {
        let acc = 0;
        for (let i = 0; i < blockLines.length; i++) {
          const lh = calculateLineHeight(blockLines[i], baseFontSize);
          if (acc + lh + PARAGRAPH_SPACING <= remainingSpace) {
            acc += lh;
            splitIdx = i + 1;
          } else {
            break;
          }
        }
        const fitLines = blockLines.slice(0, splitIdx);
        const remLines = blockLines.slice(splitIdx);
        const fitSubstantive = fitLines.filter(
          (l) => !isHeadingLine(l) && !l.trim().endsWith(':') && l.trim().length > 0
        );
        const remSubstantive = remLines.filter(
          (l) => !isHeadingLine(l) && !l.trim().endsWith(':') && l.trim().length > 0
        );

        const lastFitting = fitLines[fitLines.length - 1];
        const endsWithOrphan = lastFitting && (isHeadingLine(lastFitting) || lastFitting.trim().endsWith(':'));

        if (!endsWithOrphan && fitSubstantive.length >= 3 && remSubstantive.length >= 2) {
          canSplit = true;
        }
      }

      if (canSplit && splitIdx > 0 && splitIdx < blockLines.length) {
        currentPageLines.push('');
        currentPageLines.push(...blockLines.slice(0, splitIdx));
        pages.push(currentPageLines.join('\n').trim());

        const remainingLines = blockLines.slice(splitIdx);
        currentPageLines = [...remainingLines];
        currentAccumulatedHeight = 0;
        for (const l of remainingLines) {
          currentAccumulatedHeight += calculateLineHeight(l, baseFontSize);
        }
      } else {
        // Entire block moves to next page
        pages.push(currentPageLines.join('\n').trim());
        currentPageLines = [...blockLines];
        currentAccumulatedHeight = blockHeight;
      }
    } else {
      // Empty page and block exceeds MAX_USABLE_HEIGHT: slice line by line
      let accH = 0;
      let i = 0;
      let fitting: string[] = [];
      for (; i < blockLines.length; i++) {
        const lh = calculateLineHeight(blockLines[i], baseFontSize);
        if (accH + lh <= MAX_USABLE_HEIGHT || fitting.length === 0) {
          fitting.push(blockLines[i]);
          accH += lh;
        } else {
          break;
        }
      }
      pages.push(fitting.join('\n').trim());
      const remainingLines = blockLines.slice(i);
      currentPageLines = [...remainingLines];
      currentAccumulatedHeight = 0;
      for (const l of remainingLines) {
        currentAccumulatedHeight += calculateLineHeight(l, baseFontSize);
      }
    }
  }

  if (currentPageLines.length > 0) {
    const lastContent = currentPageLines.join('\n').trim();
    if (lastContent) pages.push(lastContent);
  }

  return pages.length > 0 ? pages : [text];
}
