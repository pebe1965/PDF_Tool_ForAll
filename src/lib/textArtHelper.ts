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
      fontFamily: 'Impact',
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

/**
 * Generates an SVG path definition based on curveType and bend (-100 to +100)
 * Bounding coordinate space is 800 x 320 with plenty of headroom
 */
export function getSvgPathD(curveType: TextArtAnnotation['curveType'], bend: number): string {
  const normBend = Math.max(5, Math.min(100, Math.abs(bend)));
  const intensity = normBend / 100;

  switch (curveType) {
    case 'arc-up': {
      // Middle arcs up (smaller Y), ends point down
      const startY = 245 + intensity * 15;
      const endY = 245 + intensity * 15;
      const midY = 245 - intensity * 145;
      return `M 40,${startY} Q 400,${midY} 760,${endY}`;
    }
    case 'arc-down': {
      // Middle dips down (larger Y), ends point up
      const startY = 85 - intensity * 15;
      const endY = 85 - intensity * 15;
      const midY = 85 + intensity * 145;
      return `M 40,${startY} Q 400,${midY} 760,${endY}`;
    }
    case 'wave': {
      // S-curve wave
      const waveH = intensity * 75;
      return `M 40,160 Q 220,${160 - waveH} 400,160 T 760,160`;
    }
    case 'circle': {
      // Upper half circle / arch for seals and circular stamps
      // Generous radius and arc length so full words fit without cutoffs
      const r = Math.max(160, 240 - intensity * 60);
      const cx = 400;
      const cy = 275;
      return `M ${cx - r},${cy - 20} A ${r},${r} 0 0,1 ${cx + r},${cy - 20}`;
    }
    case 'flat':
    default:
      return `M 40,160 L 760,160`;
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
  const pathD = getSvgPathD(art.curveType, art.bend);
  const pathId = `path_${uniqueId}`;
  const gradId = `grad_${uniqueId}`;
  const patId = `pat_${uniqueId}`;

  // Font size calculation: scale text nicely according to character count or user setting
  const textLen = (art.text || 'TextArt').length;
  const baseSize = textLen > 25 ? 28 : textLen > 18 ? 34 : textLen > 12 ? 42 : textLen > 7 ? 50 : 60;
  const effectiveSize = art.fontSize || baseSize;
  const fontFamilyCss = getFontFamilyCss(art.fontFamily);
  const strokeW = art.strokeWidth || 0;
  const strokeC = art.strokeColor || '#000000';

  let fillAttr = art.color || '#0071E3';
  if (art.fillMode === 'gradient') {
    fillAttr = `url(#${gradId})`;
  } else if (art.fillMode === 'image' && art.imageDataUrl) {
    fillAttr = `url(#${patId})`;
  }

  const gradientColors = GRADIENT_DEFS[art.gradientPreset || 'gold'] || GRADIENT_DEFS.gold;

  const imgScale = art.imageScale || 1.0;
  const imgW = viewWidth * imgScale;
  const imgH = viewHeight * imgScale;
  const imgX = ((art.imageOffsetX || 0) / 100) * viewWidth + (viewWidth - imgW) / 2;
  const imgY = ((art.imageOffsetY || 0) / 100) * viewHeight + (viewHeight - imgH) / 2;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" width="100%" height="100%" overflow="visible" style="overflow: visible;">
      <defs>
        <path id="${pathId}" d="${pathD}" fill="none" />
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
          <pattern id="${patId}" patternUnits="userSpaceOnUse" width="${viewWidth}" height="${viewHeight}">
            <image href="${art.imageDataUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        `
            : ''
        }
      </defs>

      <!-- 3D Retro Shadow Extrusion -->
      ${
        art.has3dShadow
          ? [5, 4, 3, 2, 1]
              .map(
                (step) => `
          <text
            font-family='${fontFamilyCss}'
            font-size="${effectiveSize}"
            font-weight="900"
            text-anchor="middle"
            fill="${art.shadowColor || '#1D1D1F'}"
            opacity="${0.18 + step * 0.12}"
            dx="${step * 1.5}"
            dy="${step * 1.5}"
          >
            <textPath href="#${pathId}" startOffset="50%">
              ${escapeXml(art.text)}
            </textPath>
          </text>
        `
              )
              .join('')
          : ''
      }

      <!-- Main Text Outline (if stroke enabled) -->
      ${
        strokeW > 0
          ? `
        <text
          font-family='${fontFamilyCss}'
          font-size="${effectiveSize}"
          font-weight="900"
          text-anchor="middle"
          fill="none"
          stroke="${strokeC}"
          stroke-width="${strokeW * 2.5}"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <textPath href="#${pathId}" startOffset="50%">
            ${escapeXml(art.text)}
          </textPath>
        </text>
      `
          : ''
      }

      <!-- Main Text Body -->
      <text
        font-family='${fontFamilyCss}'
        font-size="${effectiveSize}"
        font-weight="900"
        text-anchor="middle"
        fill="${fillAttr}"
      >
        <textPath href="#${pathId}" startOffset="50%">
          ${escapeXml(art.text)}
        </textPath>
      </text>
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
