import festiveMotifs from '../assets/festive-motifs.json';

export interface Motif {
  symbol: string;
  x: number;
  y: number;
  size: number;
  style?: 'original' | 'silhouette';
  color?: string;
  opacity?: number;
}

export interface PageDesign {
  start: string;
  end: string;
  gradient: boolean;
  opacity: number;
  intensity: number;
  motifs: Motif[];
  locked: boolean;
}

// Earlier projects store a plain hex colour.
export type PageBackground = string | PageDesign;
export type PageBackgrounds = Record<number, PageBackground>;

export function asDesign(background: PageBackground): PageDesign {
  return typeof background === 'string'
    ? { start: background, end: '#ffffff', gradient: false, opacity: 100, intensity: 100, motifs: [], locked: false }
    : background;
}

export const gradients = [
  ['Tannenwald', '#195744', '#f4e8c2'],
  ['Winterabend', '#344477', '#e5eafa'],
  ['Frühlingswiese', '#87c8a5', '#fff0be'],
  ['Rosengarten', '#cb7895', '#fff1de'],
  ['Mitternacht', '#242440', '#c7a563'],
  ['Sommerhimmel', '#8ec5ef', '#fff4cf'],
];

export const occasions: Record<string, [string, string][]> = {
  Weihnachten: [['🕯️', 'Kerze'], ['Christbaumkugel', 'Christbaumkugel'], ['🎄', 'Tannenbaum'], ['⭐', 'Stern'], ['🎁', 'Geschenk']],
  Ostern: [['🥚', 'Ei'], ['🐇', 'Hase'], ['🌷', 'Tulpe']],
  Silvester: [['🎆', 'Feuerwerk'], ['🥂', 'Sektgläser'], ['🍀', 'Glücksklee']],
  Geburtstag: [['🎂', 'Torte'], ['🎈', 'Luftballon'], ['🎉', 'Konfetti']],
  Geburt: [['🧸', 'Teddybär'], ['🍼', 'Fläschchen'], ['👣', 'Fußabdrücke']],
  Hochzeit: [['💍', 'Ring'], ['💐', 'Brautstrauß'], ['🕊️', 'Taube']],
  Einschulung: [['🎒', 'Schulranzen'], ['✏️', 'Bleistift'], ['📚', 'Bücher']],
  Laternenfest: [['🏮', 'Laterne'], ['🌙', 'Mond'], ['✨', 'Sterne']],
  Sommerfest: [['🌻', 'Sonnenblume'], ['☀️', 'Sonne'], ['🦋', 'Schmetterling']],
};

// Artwork attribution is included in public/licenses/festive-motifs.txt.
const motifPaths = new Map(Object.entries(festiveMotifs).map(([symbol, layers]) =>
  [symbol, layers.map(layer => ({ fill: layer.fill, path: new Path2D(layer.path) }))] as const
));

function paintMotif(ctx: CanvasRenderingContext2D, motif: Motif, size: number, baseColor: string) {
  const tint = motif.style === 'silhouette' ? motif.color ?? baseColor : undefined;
  if (motif.symbol === 'Christbaumkugel') {
    ctx.scale(size, size);
    ctx.strokeStyle = tint ?? '#ab803e';
    ctx.lineWidth = .025;
    ctx.strokeRect(-.055, -.47, .11, .16);
    ctx.fillStyle = tint ?? '#be3846';
    ctx.beginPath();
    ctx.arc(0, .07, .37, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = tint ?? '#f1cd83';
    ctx.fillRect(-.10, -.34, .20, .08);
    ctx.fillRect(-.36, .04, .72, .07);
    return;
  }
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(size / 36, size / 36);
  for (const layer of motifPaths.get(motif.symbol) ?? []) {
    ctx.fillStyle = tint ?? layer.fill;
    ctx.fill(layer.path);
  }
}

export function drawDesign(ctx: CanvasRenderingContext2D, design: PageDesign, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const tone = (shift: number, blend: number) => {
    const start = (parseInt(design.start.slice(1), 16) >> shift) & 255;
    const end = (parseInt(design.end.slice(1), 16) >> shift) & 255;
    return Math.round(255 + (start + (end - start) * blend - 255) * design.opacity / 100);
  };
  const color = (blend: number) => `rgb(${[16, 8, 0].map(shift => tone(shift, blend)).join(',')})`;
  if (design.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, color(0));
    gradient.addColorStop(1, color(design.intensity / 100));
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = color(0);
  }
  ctx.fillRect(0, 0, w, h);
  for (const motif of design.motifs) {
    const opacity = Math.max(0, Math.min(100, motif.opacity ?? 100)) / 100;
    const size = Math.min(w, h) * motif.size;
    if (!opacity || !(size > 0)) continue;
    ctx.save();
    ctx.translate(w * motif.x, h * motif.y);
    if (opacity === 1) {
      paintMotif(ctx, motif, size, design.start);
    } else {
      // Composite the finished illustration once, so overlapping colour areas
      // have the same opacity as the rest of the motif.
      const layer = document.createElement('canvas');
      const side = Math.max(1, Math.ceil(size));
      layer.width = layer.height = side;
      const layerCtx = layer.getContext('2d')!;
      layerCtx.translate(side / 2, side / 2);
      paintMotif(layerCtx, motif, side, design.start);
      ctx.globalAlpha = opacity;
      ctx.drawImage(layer, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function designCanvas(design: PageDesign, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  drawDesign(canvas.getContext('2d')!, design, canvas.width, canvas.height);
  return canvas;
}

export function backgroundPaint(ctx: CanvasRenderingContext2D, bg: PageBackground | undefined, w: number, h: number) {
  if (!bg || typeof bg === 'string') return bg || '#ffffff';
  return ctx.createPattern(designCanvas(bg, w, h), 'no-repeat')!;
}
