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
 * Calculates the ideal font size in pixels so the longest line fills the target width
 * cleanly between the margins (e.g. 720px in an 800px box).
 */
export function calculateFitToWidthFontSize(
  text: string,
  fontFamily: string,
  letterSpacing = 0,
  targetWidth = 720
): number {
  const lines = (text || 'TextArt').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 64;

  const factor = FONT_WIDTH_FACTORS[fontFamily] || 0.75;

  let minIdealSize = 200;
  for (const line of lines) {
    const chars = Math.max(1, line.length);
    const spacingTotal = (chars - 1) * letterSpacing;
    const avail = Math.max(80, targetWidth - spacingTotal);
    const ideal = Math.round(avail / (chars * factor));
    if (ideal < minIdealSize) minIdealSize = ideal;
  }

  return Math.max(16, Math.min(200, minIdealSize));
}

/**
 * Generates an SVG path definition based on curveType and bend (-100 to +100)
 * Bounding coordinate space is 800 x 320 with true circular curvature so short words bend visibly
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

  switch (curveType) {
    case 'arc-up': {
      // True circular/elliptical arch that visibly curls letters at any word length
      const R = Math.max(120, 420 - intensity * 290) + lineOffset;
      const arcAngleRad = (Math.PI / 180) * (20 + intensity * 130);
      const cx = 400;
      const cy = 160 + R * Math.cos(arcAngleRad / 2) - lineOffset;

      // Span at least 240 degrees so long text never falls off the path ends
      const halfSpan = Math.max(arcAngleRad / 2, Math.PI * 0.68);
      const startAngle = -Math.PI / 2 - halfSpan;
      const endAngle = -Math.PI / 2 + halfSpan;

      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);

      return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${R.toFixed(1)},${R.toFixed(1)} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    case 'arc-down': {
      // True smiling downward arc
      const R = Math.max(120, 420 - intensity * 290) - lineOffset;
      const arcAngleRad = (Math.PI / 180) * (20 + intensity * 130);
      const cx = 400;
      const cy = 160 - R * Math.cos(arcAngleRad / 2) + lineOffset;

      // Span at least 240 degrees so long text never falls off the path ends
      const halfSpan = Math.max(arcAngleRad / 2, Math.PI * 0.68);
      const startAngle = Math.PI / 2 - halfSpan;
      const endAngle = Math.PI / 2 + halfSpan;

      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);

      return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${R.toFixed(1)},${R.toFixed(1)} 0 0,0 ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    case 'circle': {
      // Upper ring for seal / circular emblem
      const R = Math.max(130, 240 - intensity * 80) + lineOffset;
      const cx = 400;
      const cy = 250;
      return `M ${(cx - R).toFixed(1)},${cy} A ${R.toFixed(1)},${R.toFixed(1)} 0 0,1 ${(cx + R).toFixed(1)},${cy}`;
    }
    case 'wave': {
      // Smooth sinusoidal wave centered at 400 with ample length so characters never clip
      const waveH = intensity * 75;
      const midY = 160 + lineOffset;
      return `M -2000,${midY} Q -800,${midY - waveH} 400,${midY} T 2800,${midY}`;
    }
    case 'flat':
    default: {
      // Unbounded horizontal line centered at 400 so characters never fall off path bounds
      const lineY = 160 + lineOffset;
      return `M -4000,${lineY} L 4800,${lineY}`;
    }
  }
}

/**
 * Builds standalone SVG markup string for rendering or exporting to PNG
 */
export function buildTextArtSvgMarkup(
  art: TextArtAnnotation,
  viewWidth = 800,
  viewHeight = 320,
  uniqueId = `art_${Date.now()}`
): string {
  // Support multi-line text (e.g. "NOTIONARY\nATLAS" or "NEW YORK\nCITY")
  const rawText = art.text ?? 'TextArt';
  const rawLines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const lines = rawLines.length > 0 ? rawLines : ['TextArt'];

  const maxLineLen = Math.max(...lines.map((l) => l.length));
  // Smart default font size if not set:
  const baseSize = maxLineLen > 25 ? 28 : maxLineLen > 18 ? 36 : maxLineLen > 10 ? 48 : maxLineLen > 5 ? 64 : 84;
  const effectiveSize = art.fontSize || (lines.length > 1 ? Math.min(baseSize, 56) : baseSize);
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

  const estimatedW = getEstimatedTextWidth(rawText, art.fontFamily, effectiveSize, letterSpacing);
  // Dynamic viewBox so all characters remain completely visible without clipping
  const contentWidth = Math.max(viewWidth, Math.round(estimatedW + 80));
  const viewBoxX = (viewWidth - contentWidth) / 2;
  const viewBoxW = contentWidth;

  const gradientColors = GRADIENT_DEFS[art.gradientPreset || 'gold'] || GRADIENT_DEFS.gold;

  const imgScale = art.imageScale || 1.0;
  const imgW = viewWidth * imgScale;
  const imgH = viewHeight * imgScale;
  const imgX = 400 - imgW / 2 + ((art.imageOffsetX || 0) / 100) * viewWidth;
  const imgY = 160 - imgH / 2 + ((art.imageOffsetY || 0) / 100) * viewHeight;

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
            opacity="${0.18 + step * 0.12}"
            dx="${step * 1.5}"
            dy="${step * 1.5}"
          >
            <textPath href="#path_${uniqueId}_${i}" startOffset="50%">
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
          stroke-width="${strokeW * 2.5}"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <textPath href="#path_${uniqueId}_${i}" startOffset="50%">
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
        <textPath href="#path_${uniqueId}_${i}" startOffset="50%">
          ${escapeXml(lines[i])}
        </textPath>
      </text>
    `
    )
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} 0 ${viewBoxW} ${viewHeight}" width="100%" height="100%" overflow="visible" style="overflow: visible;">
      <defs>
        ${pathsDef}
        ${
          art.fillMode === 'gradient'
            ? `
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
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
          <pattern id="${patId}" patternUnits="userSpaceOnUse" x="${viewBoxX}" y="0" width="${viewBoxW}" height="${viewHeight}">
            <image href="${art.imageDataUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        `
            : ''
        }
      </defs>

      ${shadowMarkup}
      ${strokeMarkup}
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
