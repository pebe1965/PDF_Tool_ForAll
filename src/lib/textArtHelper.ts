import { TextArtAnnotation } from '../types/pdf';

export interface TextArtPreset {
  id: string;
  name: string;
  description: string;
  previewGradient: string;
  data: Partial<TextArtAnnotation>;
}

export const TEXTART_PRESETS: TextArtPreset[] = [
  {
    id: 'gold-arc',
    name: '👑 Goldener Bogen',
    description: 'Edler Goldverlauf mit dezentem Bogen und Schatten',
    previewGradient: 'linear-gradient(135deg, #FFE57F 0%, #FFB300 50%, #795548 100%)',
    data: {
      fontFamily: 'Playfair Display',
      curveType: 'arc-up',
      bend: 45,
      fillMode: 'gradient',
      gradientPreset: 'gold',
      color: '#D97706',
      strokeWidth: 1,
      strokeColor: '#78350F',
      has3dShadow: true,
      shadowColor: '#451A03',
    },
  },
  {
    id: 'sunset-wave',
    name: '🌅 Sunset Wave',
    description: 'Dynamische Welle im warmen Sonnenuntergangs-Verlauf',
    previewGradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #EC4899 100%)',
    data: {
      fontFamily: 'Montserrat',
      curveType: 'wave',
      bend: 50,
      fillMode: 'gradient',
      gradientPreset: 'sunset',
      color: '#EF4444',
      strokeWidth: 0,
      has3dShadow: true,
      shadowColor: '#831843',
    },
  },
  {
    id: 'retro-3d',
    name: '🕹️ Retro 3D WordArt',
    description: 'Der legendäre 90er/2000er Plakat-Look mit tiefem 3D-Schatten',
    previewGradient: 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)',
    data: {
      fontFamily: 'Impact',
      curveType: 'arc-up',
      bend: 35,
      fillMode: 'color',
      color: '#FACC15',
      strokeWidth: 2,
      strokeColor: '#000000',
      has3dShadow: true,
      shadowColor: '#DC2626',
    },
  },
  {
    id: 'cyber-neon',
    name: '⚡ Cyber Neon',
    description: 'Leuchtendes Cyan & Violett mit futuristischem Kontrast',
    previewGradient: 'linear-gradient(135deg, #00F5D4 0%, #00BBF9 50%, #9B5DE5 100%)',
    data: {
      fontFamily: 'Impact',
      curveType: 'arc-up',
      bend: 30,
      fillMode: 'gradient',
      gradientPreset: 'neon',
      color: '#00F5D4',
      strokeWidth: 2,
      strokeColor: '#0F172A',
      has3dShadow: true,
      shadowColor: '#1E1B4B',
    },
  },
  {
    id: 'calligraphy-script',
    name: '🖋️ Elegante Kalligrafie',
    description: 'Schwungvolle Handschrift für Zitate, Danksagungen und Urkunden',
    previewGradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
    data: {
      fontFamily: 'Dancing Script',
      curveType: 'arc-up',
      bend: 25,
      fillMode: 'color',
      color: '#1E1B4B',
      strokeWidth: 1,
      strokeColor: '#D97706',
      has3dShadow: false,
    },
  },
  {
    id: 'seal-circle',
    name: '🎖️ Rundes Siegel & Stempel',
    description: 'Rundtext im Halbkreis – ideal für Logos, Prüfsiegel und Embleme',
    previewGradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    data: {
      fontFamily: 'Cinzel',
      curveType: 'circle',
      bend: 60,
      fillMode: 'color',
      color: '#047857',
      strokeWidth: 1,
      strokeColor: '#064E3B',
      has3dShadow: false,
    },
  },
  {
    id: 'photo-mask',
    name: '🖼️ Foto-im-Text (Bildmaske)',
    description: 'Das Foto füllt die dicken Buchstaben aus – Schablonen-Effekt',
    previewGradient: 'linear-gradient(135deg, #3B82F6 0%, #10B981 50%, #F59E0B 100%)',
    data: {
      fontFamily: 'Bungee',
      fontSize: 68,
      curveType: 'flat',
      bend: 0,
      fillMode: 'image',
      color: '#000000',
      strokeWidth: 2,
      strokeColor: '#FFFFFF',
      has3dShadow: true,
      shadowColor: '#000000',
    },
  },
];

export const GRADIENT_DEFS: Record<string, string[]> = {
  gold: ['#FFF0B3', '#FFD54F', '#FFA000', '#6D4C41'],
  sunset: ['#FDE047', '#F97316', '#EF4444', '#EC4899', '#7C3AED'],
  neon: ['#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5'],
  rainbow: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
  silver: ['#FFFFFF', '#E5E7EB', '#9CA3AF', '#374151'],
  ocean: ['#A5F3FC', '#38BDF8', '#2563EB', '#1E3A8A'],
};

export function getFontFamilyCss(family?: string): string {
  if (family === 'Bungee') return 'Bungee, "Arial Black", Impact, sans-serif';
  if (family === 'Anton') return 'Anton, "Arial Black", Impact, sans-serif';
  if (family === 'Alfa Slab One') return '"Alfa Slab One", Impact, serif';
  if (family === 'Archivo Black') return '"Archivo Black", "Arial Black", sans-serif';
  if (family === 'Paytone One') return '"Paytone One", sans-serif';
  if (family === 'Times') return '"Times New Roman", Times, Georgia, serif';
  if (family === 'Courier') return '"Courier New", Courier, monospace';
  if (family === 'Impact') return 'Impact, "Arial Black", sans-serif';
  if (family === 'Arial Black') return '"Arial Black", Impact, sans-serif';
  if (family === 'Playfair Display') return '"Playfair Display", Georgia, serif';
  if (family === 'Dancing Script') return '"Dancing Script", "Brush Script MT", cursive';
  if (family === 'Caveat') return 'Caveat, "Comic Sans MS", cursive';
  if (family === 'Cinzel') return 'Cinzel, "Times New Roman", serif';
  if (family === 'Montserrat') return 'Montserrat, -apple-system, sans-serif';
  return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
}

export const FONT_WIDTH_FACTORS: Record<string, number> = {
  Bungee: 0.92,
  Anton: 0.65,
  'Alfa Slab One': 0.88,
  'Archivo Black': 0.84,
  'Paytone One': 0.80,
  Impact: 0.62,
  'Arial Black': 0.82,
  Montserrat: 0.78,
  'Playfair Display': 0.68,
  Cinzel: 0.76,
  'Dancing Script': 0.55,
  Caveat: 0.50,
  Helvetica: 0.68,
  Times: 0.65,
  Courier: 0.60,
};

/**
 * Calculates estimated rendered text width for the longest line of text
 */
export function getEstimatedTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
  letterSpacing = 0
): number {
  const lines = (text || 'TextArt').split('\n').map((l) => l.trim()).filter(Boolean);
  const factor = FONT_WIDTH_FACTORS[fontFamily] || 0.75;
  let maxW = 0;
  for (const line of lines) {
    const chars = Math.max(1, line.length);
    const w = chars * fontSize * factor + (chars - 1) * letterSpacing;
    if (w > maxW) maxW = w;
  }
  return maxW;
}

/**
 * Calculates the ideal font size in pixels so text fills the target width and height
 * cleanly between the margins (never overflowing or clipping).
 */
export function calculateFitToWidthFontSize(
  text: string,
  fontFamily: string,
  letterSpacing = 0,
  targetWidth = 720,
  maxHeight = 250
): number {
  const lines = (text || 'TextArt').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 64;

  const factor = FONT_WIDTH_FACTORS[fontFamily] || 0.75;

  let minIdealSize = 220;
  for (const line of lines) {
    const chars = Math.max(1, line.length);
    const spacingTotal = (chars - 1) * letterSpacing;
    const avail = Math.max(80, targetWidth - spacingTotal);
    const ideal = Math.round(avail / (chars * factor));
    if (ideal < minIdealSize) minIdealSize = ideal;
  }

  // Also respect vertical room so multi-line text never gets cut off top/bottom
  const totalLines = Math.max(1, lines.length);
  const maxVert = Math.floor(maxHeight / (totalLines === 1 ? 1.0 : totalLines * 1.15));

  const safe = Math.min(minIdealSize, maxVert);
  return Math.max(16, Math.min(220, safe));
}

/**
 * Generates an SVG path definition centered at (400, midY) in 800x320 space
 */
export function getSvgPathD(
  curveType: TextArtAnnotation['curveType'],
  bend: number,
  lineIndex = 0,
  totalLines = 1,
  fontSize = 54
): string {
  const normBend = Math.max(5, Math.min(100, Math.abs(bend)));
  const intensity = normBend / 100;
  const lineSpacing = fontSize * 1.15;
  const lineOffset = (lineIndex - (totalLines - 1) / 2) * lineSpacing;
  const midY = 160 + lineOffset;
  const cx = 400;

  switch (curveType) {
    case 'arc-up': {
      const R = Math.max(120, 420 - intensity * 290) + lineOffset;
      const cy = midY + R;

      const halfSpan = Math.PI * 0.72;
      const startAngle = -Math.PI / 2 - halfSpan;
      const endAngle = -Math.PI / 2 + halfSpan;

      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);

      return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${R.toFixed(1)},${R.toFixed(1)} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    case 'arc-down': {
      const R = Math.max(120, 420 - intensity * 290) - lineOffset;
      const cy = midY - R;

      const halfSpan = Math.PI * 0.72;
      const startAngle = Math.PI / 2 - halfSpan;
      const endAngle = Math.PI / 2 + halfSpan;

      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);

      return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${R.toFixed(1)},${R.toFixed(1)} 0 0,0 ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    case 'circle': {
      const r = Math.max(150, 240 - intensity * 60) + lineOffset;
      return `M ${cx - r},${midY + r * 0.4} A ${r},${r} 0 0,1 ${cx + r},${midY + r * 0.4}`;
    }
    case 'wave': {
      const waveH = intensity * 75;
      return `M -2000,${midY} Q -800,${midY - waveH} 400,${midY} T 2800,${midY}`;
    }
    case 'flat':
    default: {
      return `M -2000,${midY} L 2800,${midY}`;
    }
  }
}

/**
 * Calculates the tight visual bounding box of the rendered text
 * for any font, letter spacing, font size, and curve/bend distortion.
 */
export function getTextArtBoundingBox(
  art: TextArtAnnotation,
  effectiveSize: number
): { minX: number; minY: number; width: number; height: number } {
  const rawText = art.text ?? 'TextArt';
  const rawLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const lines = rawLines.length > 0 ? rawLines : ['TextArt'];
  const totalLines = lines.length;
  const factor = FONT_WIDTH_FACTORS[art.fontFamily] || 0.75;
  const letterSpacing = art.letterSpacing || 0;
  const fontSize = effectiveSize;
  const lineSpacing = fontSize * 1.15;
  const normBend = Math.max(5, Math.min(100, Math.abs(art.bend ?? 40)));
  const intensity = normBend / 100;
  const curveType = art.curveType || 'flat';

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i];
    const chars = Math.max(1, line.length);
    const lineW = chars * fontSize * factor + (chars - 1) * letterSpacing;
    const hw = lineW / 2;
    const lineOffset = (i - (totalLines - 1) / 2) * lineSpacing;
    const midY = 160 + lineOffset;

    let lMinX: number;
    let lMaxX: number;
    let lMinY: number;
    let lMaxY: number;

    if (curveType === 'arc-up') {
      const R = Math.max(120, 420 - intensity * 290) + lineOffset;
      const cy = midY + R;
      const theta = Math.min(Math.PI * 1.2, lineW / R);
      const spanX = theta >= Math.PI ? R : R * Math.sin(theta / 2);
      lMinX = 400 - spanX;
      lMaxX = 400 + spanX;
      lMinY = midY - fontSize * 0.88;
      lMaxY = Math.max(midY + fontSize * 0.25, cy - R * Math.cos(theta / 2) + fontSize * 0.25);
    } else if (curveType === 'arc-down') {
      const R = Math.max(120, 420 - intensity * 290) - lineOffset;
      const cy = midY - R;
      const theta = Math.min(Math.PI * 1.2, lineW / R);
      const spanX = theta >= Math.PI ? R : R * Math.sin(theta / 2);
      lMinX = 400 - spanX;
      lMaxX = 400 + spanX;
      lMaxY = midY + fontSize * 0.25;
      lMinY = Math.min(midY - fontSize * 0.88, cy + R * Math.cos(theta / 2) - fontSize * 0.88);
    } else if (curveType === 'circle') {
      const r = Math.max(150, 240 - intensity * 60) + lineOffset;
      const theta = Math.min(Math.PI * 1.5, lineW / r);
      const spanX = theta >= Math.PI ? r : r * Math.sin(theta / 2);
      lMinX = 400 - spanX;
      lMaxX = 400 + spanX;
      lMinY = midY + r * 0.4 - r - fontSize * 0.88;
      lMaxY = midY + r * 0.4 - r * Math.cos(theta / 2) + fontSize * 0.25;
    } else if (curveType === 'wave') {
      const waveH = intensity * 75;
      const effWaveH = Math.min(waveH, waveH * (lineW / 400));
      lMinX = 400 - hw;
      lMaxX = 400 + hw;
      lMinY = midY - effWaveH - fontSize * 0.88;
      lMaxY = midY + effWaveH + fontSize * 0.25;
    } else {
      lMinX = 400 - hw;
      lMaxX = 400 + hw;
      lMinY = midY - fontSize * 0.88;
      lMaxY = midY + fontSize * 0.25;
    }

    if (lMinX < minX) minX = lMinX;
    if (lMaxX > maxX) maxX = lMaxX;
    if (lMinY < minY) minY = lMinY;
    if (lMaxY > maxY) maxY = lMaxY;
  }

  const strokeW = art.strokeWidth || 0;
  if (strokeW > 0) {
    const sExtra = strokeW * 2.5;
    minX -= sExtra;
    maxX += sExtra;
    minY -= sExtra;
    maxY += sExtra;
  }
  if (art.has3dShadow) {
    maxX += 9;
    maxY += 9;
  }
  const padX = Math.max(8, fontSize * 0.06);
  const padY = Math.max(8, fontSize * 0.06);
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    width: Math.max(40, Math.round(maxX - minX)),
    height: Math.max(30, Math.round(maxY - minY)),
  };
}

/**
 * Builds standalone SVG markup string for rendering or exporting to PNG
 * Using tight adaptive bounding box so the text fills the full width and length
 */
export function buildTextArtSvgMarkup(
  art: TextArtAnnotation,
  _viewWidth = 800,
  _viewHeight = 320,
  uniqueId = `art_${Date.now()}`,
  forceAspect?: 'meet' | 'none'
): string {
  const rawText = art.text ?? 'TextArt';
  const rawLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const lines = rawLines.length > 0 ? rawLines : ['TextArt'];

  // Font size chosen by user; fallback to 68 without artificial clamp
  const effectiveSize = art.fontSize || 68;

  // Compute tight visual bounding box so text fills the entire frame cleanly
  const bbox = getTextArtBoundingBox(art, effectiveSize);

  const fontFamilyCss = getFontFamilyCss(art.fontFamily);
  const strokeW = art.strokeWidth || 0;
  const strokeC = art.strokeColor || '#000000';
  const letterSpacing = art.letterSpacing || 0;

  const gradId = `grad_${uniqueId}`;
  const patId = `pat_${uniqueId}`;

  let fillAttr = art.color || '#0071E3';
  if (art.fillMode === 'gradient') {
    fillAttr = `url(#${gradId})`;
  } else if (art.fillMode === 'image' && art.imageDataUrl) {
    fillAttr = `url(#${patId})`;
  }

  const gradientColors = GRADIENT_DEFS[art.gradientPreset || 'gold'] || GRADIENT_DEFS.gold;

  const imgScale = art.imageScale || 1.0;
  const imgW = bbox.width * imgScale;
  const imgH = bbox.height * imgScale;
  const imgX = bbox.minX + (bbox.width - imgW) / 2 + ((art.imageOffsetX || 0) / 100) * bbox.width;
  const imgY = bbox.minY + (bbox.height - imgH) / 2 + ((art.imageOffsetY || 0) / 100) * bbox.height;

  // Build path defs for each line
  const pathsDef = lines
    .map((_, i) => {
      const d = getSvgPathD(art.curveType, art.bend, i, lines.length, effectiveSize);
      return `<path id="path_${uniqueId}_${i}" d="${d}" fill="none" />`;
    })
    .join('\n');

  // Build 3D Shadow Layers (for each line)
  const shadowMarkup = art.has3dShadow
    ? [5, 4, 3, 2, 1]
        .map((step) =>
          lines
            .map(
              (_, i) => `
          <text
            font-family='${fontFamilyCss}'
            font-size="${effectiveSize}"
            font-weight="900"
            letter-spacing="${letterSpacing}px"
            text-anchor="middle"
            fill="${art.shadowColor || '#1D1D1F'}"
            opacity="${0.16 + step * 0.12}"
            dx="${step * 1.5}"
            dy="${step * 1.5}"
          >
            <textPath href="#path_${uniqueId}_${i}" startOffset="50%" text-anchor="middle">
              ${escapeXml(lines[i])}
            </textPath>
          </text>
        `
            )
            .join('')
        )
        .join('')
    : '';

  // Build stroke outlines (for each line)
  const strokeMarkup =
    strokeW > 0
      ? lines
          .map(
            (_, i) => `
        <text
          font-family='${fontFamilyCss}'
          font-size="${effectiveSize}"
          font-weight="900"
          letter-spacing="${letterSpacing}px"
          text-anchor="middle"
          fill="none"
          stroke="${strokeC}"
          stroke-width="${strokeW * 2}"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <textPath href="#path_${uniqueId}_${i}" startOffset="50%" text-anchor="middle">
            ${escapeXml(lines[i])}
          </textPath>
        </text>
      `
          )
          .join('')
      : '';

  // Base solid fill ensuring inner stroke is covered identically on all lines (never leaving double-thick exposed borders for image masks)
  const baseFillMarkup =
    art.fillMode === 'image'
      ? lines
          .map(
            (_, i) => `
        <text
          font-family='${fontFamilyCss}'
          font-size="${effectiveSize}"
          font-weight="900"
          letter-spacing="${letterSpacing}px"
          text-anchor="middle"
          fill="${art.color || '#1D1D1F'}"
        >
          <textPath href="#path_${uniqueId}_${i}" startOffset="50%" text-anchor="middle">
            ${escapeXml(lines[i])}
          </textPath>
        </text>
      `
          )
          .join('')
      : '';

  // Build main text lines (all filled with gradient or image pattern)
  const mainTextMarkup = lines
    .map(
      (_, i) => `
      <text
        font-family='${fontFamilyCss}'
        font-size="${effectiveSize}"
        font-weight="900"
        letter-spacing="${letterSpacing}px"
        text-anchor="middle"
        fill="${fillAttr}"
      >
        <textPath href="#path_${uniqueId}_${i}" startOffset="50%" text-anchor="middle">
          ${escapeXml(lines[i])}
        </textPath>
      </text>
    `
    )
    .join('');

  const preserveAspect =
    forceAspect === 'meet'
      ? 'xMidYMid meet'
      : forceAspect === 'none'
      ? 'none'
      : art.stretchToFit === false
      ? 'xMidYMid meet'
      : 'none';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}" width="100%" height="100%" preserveAspectRatio="${preserveAspect}" overflow="visible" style="overflow: visible;">
      <defs>
        ${pathsDef}
        ${
          art.fillMode === 'gradient'
            ? `
          <linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${bbox.minX}" y1="${bbox.minY}" x2="${bbox.minX + bbox.width}" y2="${bbox.minY + bbox.height}">
            ${gradientColors
              .map((c, i) => `<stop offset="${(i / (gradientColors.length - 1)) * 100}%" stop-color="${c}" />`)
              .join('')}
          </linearGradient>
        `
            : ''
        }
        ${
          art.fillMode === 'image' && art.imageDataUrl
            ? `
          <pattern id="${patId}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="${bbox.minX}" y="${bbox.minY}" width="${bbox.width}" height="${bbox.height}">
            <rect x="${bbox.minX}" y="${bbox.minY}" width="${bbox.width}" height="${bbox.height}" fill="${art.color || '#1D1D1F'}" />
            <image href="${art.imageDataUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        `
            : ''
        }
      </defs>

      ${shadowMarkup}
      ${strokeMarkup}
      ${baseFillMarkup}
      ${mainTextMarkup}
    </svg>
  `;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders a TextArtAnnotation to a crisp high-DPI PNG ArrayBuffer for pdf-lib embedding
 */
export async function renderTextArtToPngBytes(
  art: TextArtAnnotation,
  widthPt: number,
  heightPt: number
): Promise<ArrayBuffer> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const scale = 3;
  const w = Math.max(160, Math.round(widthPt * scale));
  const h = Math.max(80, Math.round(heightPt * scale));

  // Canonical 800x320 SVG space matching the editor preview 100%
  const svgMarkup = buildTextArtSvgMarkup(art, 800, 320, `pdf_${art.id}_${Date.now()}`);
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error('Konnte TextArt nicht rendern'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);

  const dataUrl = canvas.toDataURL('image/png');
  return await fetch(dataUrl).then((r) => r.arrayBuffer());
}
