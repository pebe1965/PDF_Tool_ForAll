import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import {
  brushBounds,
  normalizeAngle,
  normRect,
  moveRegion,
  regionCenter,
  regionContains,
  regionCorners,
  renderImage,
  rotatePoint,
  scaleCanvas,
  type ImageRegion,
  type Point,
} from '../lib/imageEngine';

export type MobileTool = 'rect' | 'ellipse' | 'brush' | 'select';

interface RegionCanvasProps {
  /** Grundbild in voller Auflösung (Foto oder gerasterte PDF-Seite) */
  base: HTMLCanvasElement;
  regions: ImageRegion[];
  selectedId: string | null;
  tool: MobileTool;
  allowRotate: boolean;
  /** Pinselstärke in Bildpixeln */
  brushSize: number;
  /** Erzeugt einen neuen Bereich mit den aktuellen Einstellungen */
  createRegion: (shape: ImageRegion['shape'], geom: { x: number; y: number; w: number; h: number; points?: Point[] }) => ImageRegion;
  onSelect: (id: string | null) => void;
  onCommit: (regions: ImageRegion[]) => void;
  /** Wechselt, wenn ein anderes Bild/eine andere Seite gezeigt wird (setzt den Zoom zurück) */
  viewKey: string;
}

type Gesture =
  | { kind: 'draw'; start: Point; region: ImageRegion | null; startClient: Point }
  | { kind: 'brush'; points: Point[]; startClient: Point }
  | { kind: 'move'; id: string; start: Point; orig: ImageRegion; moved: boolean }
  | { kind: 'resize'; id: string; anchor: Point; orig: ImageRegion }
  | { kind: 'rotate'; id: string; center: Point; orig: ImageRegion; below: boolean }
  | { kind: 'pan'; startClient: Point; tx0: number; ty0: number; moved: boolean; start: Point };

interface Pinch {
  d0: number;
  mid0: Point;
  s0: number;
  tx0: number;
  ty0: number;
}

/** Vorschau höchstens so groß – Telefone sind beim Weichzeichnen sonst zu langsam. */
const PREVIEW_MAX_PIXELS = 3_000_000;
const STAGE_PADDING = 14;
const MAX_ZOOM = 10;
/** Unter dieser Bewegung (Bildschirmpunkte) gilt eine Berührung als Antippen. */
const TAP_SLOP = 8;

export default function RegionCanvas({
  base,
  regions,
  selectedId,
  tool,
  allowRotate,
  brushSize,
  createRegion,
  onSelect,
  onCommit,
  viewKey,
}: RegionCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const [live, setLive] = useState<ImageRegion[] | null>(null);
  const [brushPath, setBrushPath] = useState<Point[] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  /** Nach dem Zoomen erst wieder reagieren, wenn alle Finger weg sind */
  const waitAllUp = useRef(false);

  const W = base.width;
  const H = base.height;
  const shown = live || regions;
  const selected = shown.find((r) => r.id === selectedId) || null;

  // Vorschau-Grundbild (verkleinert)
  const preview = useMemo(() => {
    const scale = Math.min(1, Math.sqrt(PREVIEW_MAX_PIXELS / (W * H)));
    return { scale, canvas: scale < 1 ? scaleCanvas(base, scale) : base };
  }, [base, W, H]);

  // Bühnengröße beobachten
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom beim Wechsel des Inhalts zurücksetzen
  useEffect(() => {
    setView({ s: 1, tx: 0, ty: 0 });
    setLive(null);
    gesture.current = null;
  }, [viewKey]);

  const hasStage = stage.w > 0 && stage.h > 0;
  const fit = hasStage ? Math.min((stage.w - STAGE_PADDING * 2) / W, (stage.h - STAGE_PADDING * 2) / H) : 0;
  const dw = W * fit;
  const dh = H * fit;
  const left = (stage.w - dw) / 2;
  const top = (stage.h - dh) / 2;
  /** Bildschirmpunkte je Bildpixel */
  const k = fit * view.s || 1;

  // Effekte zeichnen (gebündelt pro Bildschirmbild)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = requestAnimationFrame(() => {
      const out = renderImage(base, shown, preview.scale, preview.canvas);
      if (canvas.width !== out.width || canvas.height !== out.height) {
        canvas.width = out.width;
        canvas.height = out.height;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(out, 0, 0);
    });
    return () => cancelAnimationFrame(id);
    // hasStage: die Zeichenfläche gibt es erst, wenn die Bühnengröße bekannt ist
  }, [base, shown, preview, hasStage]);

  const clampView = (s: number, tx: number, ty: number) => {
    const cw = dw * s;
    const ch = dh * s;
    const clampAxis = (t: number, size: number, stageSize: number, offset: number) => {
      if (size <= stageSize - STAGE_PADDING * 2) return (stageSize - size) / 2 - offset;
      const min = stageSize - STAGE_PADDING - offset - size;
      const max = STAGE_PADDING - offset;
      return Math.min(max, Math.max(min, t));
    };
    return { s, tx: clampAxis(tx, cw, stage.w, left), ty: clampAxis(ty, ch, stage.h, top) };
  };

  const stagePoint = (e: { clientX: number; clientY: number }): Point => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const toImage = (sp: Point): Point => ({
    x: (sp.x - left - view.tx) / view.s / fit,
    y: (sp.y - top - view.ty) / view.s / fit,
  });

  const hitRadius = 24 / k;
  const rotateDistance = 36 / k;

  const rotateHandleBelow = (r: ImageRegion) => {
    const above = rotatePoint({ x: r.x + r.w / 2, y: r.y - rotateDistance }, regionCenter(r), r.rotation || 0);
    return !(above.x >= 0 && above.x <= W && above.y >= 0 && above.y <= H);
  };
  const rotateHandleLocalY = (r: ImageRegion) => (rotateHandleBelow(r) ? r.y + r.h + rotateDistance : r.y - rotateDistance);
  const rotateHandlePos = (r: ImageRegion) => rotatePoint({ x: r.x + r.w / 2, y: rotateHandleLocalY(r) }, regionCenter(r), r.rotation || 0);

  const hitRegion = (p: Point): ImageRegion | null => {
    for (let i = shown.length - 1; i >= 0; i--) {
      const r = shown[i];
      // Kleine Bereiche großzügiger treffen
      const grow = Math.max(0, 16 / k - Math.min(r.w, r.h) / 2);
      const grown = { ...r, x: r.x - grow, y: r.y - grow, w: r.w + grow * 2, h: r.h + grow * 2 };
      if (regionContains(grown, p)) return r;
    }
    return null;
  };

  const startSingle = (sp: Point) => {
    const p = toImage(sp);
    // Griffe des ausgewählten Bereichs haben Vorrang
    if (selected && selected.shape !== 'brush') {
      if (allowRotate) {
        const rh = rotateHandlePos(selected);
        if (Math.hypot(p.x - rh.x, p.y - rh.y) <= hitRadius) {
          gesture.current = { kind: 'rotate', id: selected.id, center: regionCenter(selected), orig: selected, below: rotateHandleBelow(selected) };
          return;
        }
      }
      const corners = regionCorners(selected);
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(p.x - corners[i].x, p.y - corners[i].y) <= hitRadius) {
          gesture.current = { kind: 'resize', id: selected.id, anchor: corners[(i + 2) % 4], orig: selected };
          return;
        }
      }
    }
    const hit = hitRegion(p);
    if (hit && (hit.id === selectedId || tool === 'select')) {
      if (hit.id !== selectedId) onSelect(hit.id);
      gesture.current = { kind: 'move', id: hit.id, start: p, orig: hit, moved: false };
      return;
    }
    if (tool === 'select') {
      gesture.current = { kind: 'pan', startClient: sp, tx0: view.tx, ty0: view.ty, moved: false, start: p };
      return;
    }
    if (tool === 'brush') {
      gesture.current = { kind: 'brush', points: [p], startClient: sp };
      setBrushPath([p]);
      return;
    }
    gesture.current = { kind: 'draw', start: p, region: null, startClient: sp };
  };

  const moveSingle = (sp: Point) => {
    const g = gesture.current;
    if (!g) return;
    const p = toImage(sp);
    if (g.kind === 'draw') {
      if (Math.hypot(sp.x - g.startClient.x, sp.y - g.startClient.y) < TAP_SLOP && !g.region) return;
      const geom = normRect(g.start.x, g.start.y, Math.min(W, Math.max(0, p.x)), Math.min(H, Math.max(0, p.y)));
      const region = g.region ? { ...g.region, ...geom } : createRegion(tool === 'ellipse' ? 'ellipse' : 'rect', geom);
      g.region = region;
      setLive([...regions, region]);
    } else if (g.kind === 'brush') {
      const last = g.points[g.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= Math.max(1, brushSize / 6)) {
        g.points = [...g.points, p];
        setBrushPath(g.points);
      }
    } else if (g.kind === 'move') {
      const moved = moveRegion(g.orig, p.x - g.start.x, p.y - g.start.y);
      g.moved = true;
      setLive(regions.map((r) => (r.id === g.id ? moved : r)));
    } else if (g.kind === 'resize') {
      const deg = g.orig.rotation || 0;
      const d = rotatePoint({ x: p.x - g.anchor.x, y: p.y - g.anchor.y }, { x: 0, y: 0 }, -deg);
      const w = Math.max(4 / k, Math.abs(d.x));
      const h = Math.max(4 / k, Math.abs(d.y));
      const cx = (g.anchor.x + p.x) / 2;
      const cy = (g.anchor.y + p.y) / 2;
      const resized = { ...g.orig, x: cx - w / 2, y: cy - h / 2, w, h };
      setLive(regions.map((r) => (r.id === g.id ? resized : r)));
    } else if (g.kind === 'rotate') {
      let angle = (Math.atan2(p.y - g.center.y, p.x - g.center.x) * 180) / Math.PI + (g.below ? -90 : 90);
      // Nahe 0°/90°/180° einrasten
      const nearest = Math.round(angle / 90) * 90;
      if (Math.abs(angle - nearest) < 4) angle = nearest;
      const rotated = { ...g.orig, rotation: normalizeAngle(angle) };
      setLive(regions.map((r) => (r.id === g.id ? rotated : r)));
    } else if (g.kind === 'pan') {
      if (!g.moved && Math.hypot(sp.x - g.startClient.x, sp.y - g.startClient.y) < TAP_SLOP) return;
      g.moved = true;
      setView((v) => clampView(v.s, g.tx0 + sp.x - g.startClient.x, g.ty0 + sp.y - g.startClient.y));
    }
  };

  const endSingle = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'draw') {
      const minSize = 6 / k;
      if (g.region && g.region.w >= minSize && g.region.h >= minSize) {
        onCommit([...regions, g.region]);
        onSelect(g.region.id);
      } else if (!g.region) {
        // Antippen: Bereich auswählen bzw. Auswahl aufheben
        onSelect(hitRegion(g.start)?.id || null);
      }
    } else if (g.kind === 'brush') {
      setBrushPath(null);
      const hit = g.points.length === 1 ? hitRegion(g.points[0]) : null;
      if (hit) onSelect(hit.id);
      else {
        const region = createRegion('brush', { ...brushBounds(g.points, brushSize), points: g.points });
        onCommit([...regions, region]);
        onSelect(region.id);
      }
    } else if (g.kind === 'move' || g.kind === 'resize' || g.kind === 'rotate') {
      if (live && (g.kind !== 'move' || g.moved)) onCommit(live);
    } else if (g.kind === 'pan' && !g.moved) {
      onSelect(hitRegion(g.start)?.id || null);
    }
    setLive(null);
  };

  const cancelSingle = () => {
    gesture.current = null;
    setLive(null);
    setBrushPath(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* z. B. bereits beendete Berührung */
    }
    const sp = stagePoint(e);
    pointers.current.set(e.pointerId, sp);
    if (pointers.current.size === 1) {
      waitAllUp.current = false;
      startSingle(sp);
    } else if (pointers.current.size === 2) {
      // Zwei Finger: angefangene Geste verwerfen, zoomen/verschieben
      cancelSingle();
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        s0: view.s,
        tx0: view.tx,
        ty0: view.ty,
      };
      waitAllUp.current = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const sp = stagePoint(e);
    pointers.current.set(e.pointerId, sp);
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const pc = pinch.current;
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(MAX_ZOOM, Math.max(1, (pc.s0 * d) / pc.d0));
      // Der Punkt unter den Fingern bleibt unter den Fingern
      const px = (pc.mid0.x - left - pc.tx0) / pc.s0;
      const py = (pc.mid0.y - top - pc.ty0) / pc.s0;
      setView(clampView(s, mid.x - left - s * px, mid.y - top - s * py));
      return;
    }
    if (!waitAllUp.current) moveSingle(sp);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    if (pointers.current.size === 0 && !waitAllUp.current) endSingle();
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    cancelSingle();
  };

  // Mausrad/Trackpad (zum Testen am Computer)
  const onWheel = (e: React.WheelEvent) => {
    const sp = stagePoint(e);
    const s = Math.min(MAX_ZOOM, Math.max(1, view.s * Math.exp(-e.deltaY / 300)));
    const px = (sp.x - left - view.tx) / view.s;
    const py = (sp.y - top - view.ty) / view.s;
    setView(clampView(s, sp.x - left - s * px, sp.y - top - s * py));
  };

  const handleR = 9 / k;
  const stroke = (r: ImageRegion) => (r.method === 'fill' && r.color === '#000000' ? '#FFFFFF' : '#0071E3');

  return (
    <div
      ref={stageRef}
      className="relative flex-1 min-h-0 overflow-hidden bg-[#E8E8ED] touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    >
      {fit > 0 && (
        <div
          className="absolute shadow-[0_2px_16px_rgba(0,0,0,0.18)]"
          style={{
            left,
            top,
            width: dw,
            height: dh,
            transformOrigin: '0 0',
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
          }}
        >
          <canvas ref={canvasRef} className="block w-full h-full bg-white" />
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {shown.map((r) => {
              const isSel = r.id === selectedId;
              if (r.shape === 'brush') {
                return isSel ? (
                  <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#0071E3" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                ) : null;
              }
              const c = regionCenter(r);
              return (
                <g key={r.id} transform={`rotate(${r.rotation || 0} ${c.x} ${c.y})`}>
                  {r.shape === 'ellipse' ? (
                    <ellipse cx={c.x} cy={c.y} rx={r.w / 2} ry={r.h / 2} fill="none" stroke={isSel ? '#0071E3' : stroke(r)} strokeWidth={isSel ? 2 : 1} strokeDasharray={isSel ? undefined : '5 4'} vectorEffect="non-scaling-stroke" opacity={isSel ? 1 : 0.8} />
                  ) : (
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={isSel ? '#0071E3' : stroke(r)} strokeWidth={isSel ? 2 : 1} strokeDasharray={isSel ? undefined : '5 4'} vectorEffect="non-scaling-stroke" opacity={isSel ? 1 : 0.8} />
                  )}
                  {isSel && r.shape === 'ellipse' && (
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#0071E3" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity={0.6} />
                  )}
                  {isSel && allowRotate && (
                    <>
                      <line x1={c.x} y1={rotateHandleBelow(r) ? r.y + r.h : r.y} x2={c.x} y2={rotateHandleLocalY(r)} stroke="#0071E3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                      <circle cx={c.x} cy={rotateHandleLocalY(r)} r={handleR * 1.1} fill="#0071E3" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                  {isSel &&
                    [
                      [r.x, r.y],
                      [r.x + r.w, r.y],
                      [r.x + r.w, r.y + r.h],
                      [r.x, r.y + r.h],
                    ].map(([hx, hy], i) => (
                      <circle key={i} cx={hx} cy={hy} r={handleR} fill="#fff" stroke="#0071E3" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    ))}
                </g>
              );
            })}
            {brushPath && brushPath.length > 0 && (
              <polyline
                points={brushPath.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#0071E3"
                strokeOpacity={0.45}
                strokeWidth={brushSize}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      )}
      {view.s > 1.01 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setView({ s: 1, tx: 0, ty: 0 })}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Ganzes {Math.round(view.s * 100)} %
        </button>
      )}
    </div>
  );
}
