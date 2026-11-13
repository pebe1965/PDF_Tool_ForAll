import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Pt, Quad } from './scanEngine';

/**
 * Vier Ecken eines Blatts auf dem Foto verschieben. Beim Ziehen zeigt eine Lupe die Stelle unter dem Finger.
 */
export default function CornerEditor({ image, quad, onChange }: { image: HTMLCanvasElement; quad: Quad; onChange: (q: Quad) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ idx: number; pointer: number } | null>(null);
  const live = useRef(quad);
  const [, force] = useState(0);
  live.current = drag ? live.current : quad;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const pad = 28;
  const fit = stage.w > 0 ? Math.min((stage.w - pad * 2) / image.width, (stage.h - pad * 2) / image.height) : 0;
  const dw = image.width * fit;
  const dh = image.height * fit;
  const ox = (stage.w - dw) / 2;
  const oy = (stage.h - dh) / 2;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || fit <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(dw * dpr);
    c.height = Math.round(dh * dpr);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, c.width, c.height);
  }, [image, dw, dh, fit]);

  const toScreen = (p: Pt) => ({ x: ox + p.x * fit, y: oy + p.y * fit });
  const toImage = (clientX: number, clientY: number): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(image.width, Math.max(0, (clientX - r.left - ox) / fit)),
      y: Math.min(image.height, Math.max(0, (clientY - r.top - oy) / fit)),
    };
  };

  const drawLoupe = (p: Pt) => {
    const l = loupeRef.current;
    if (!l) return;
    const size = 220;
    const zoom = 3.2;
    l.width = size;
    l.height = size;
    const ctx = l.getContext('2d')!;
    const srcSize = size / (fit * zoom);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, p.x - srcSize / 2, p.y - srcSize / 2, srcSize, srcSize, 0, 0, size, size);
    ctx.strokeStyle = '#0071E3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2 - 16);
    ctx.lineTo(size / 2, size / 2 + 16);
    ctx.moveTo(size / 2 - 16, size / 2);
    ctx.lineTo(size / 2 + 16, size / 2);
    ctx.stroke();
  };

  const onDown = (idx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
    live.current = quad;
    setDrag({ idx, pointer: e.pointerId });
    requestAnimationFrame(() => drawLoupe(quad[idx]));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const p = toImage(e.clientX, e.clientY);
    const next = [...live.current] as Quad;
    next[drag.idx] = p;
    live.current = next;
    drawLoupe(p);
    force((n) => n + 1);
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    setDrag(null);
    onChange(live.current);
  };

  const q = (drag ? live.current : quad).map(toScreen);
  const poly = q.map((p) => `${p.x},${p.y}`).join(' ');
  // Lupe auf der dem Finger abgewandten Seite
  const loupeLeft = drag && q[drag.idx].x < stage.w / 2;

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-[#1C1C1E]" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {fit > 0 && (
        <>
          <canvas ref={canvasRef} className="absolute" style={{ left: ox, top: oy, width: dw, height: dh }} />
          <svg className="absolute inset-0 h-full w-full" width={stage.w} height={stage.h}>
            <defs>
              <mask id="scan-mask">
                <rect width="100%" height="100%" fill="white" />
                <polygon points={poly} fill="black" />
              </mask>
            </defs>
            <rect x={ox} y={oy} width={dw} height={dh} fill="rgba(0,0,0,0.45)" mask="url(#scan-mask)" />
            <polygon points={poly} fill="rgba(0,113,227,0.08)" stroke="#0A84FF" strokeWidth={2} />
          </svg>
          {q.map((p, i) => (
            <div
              key={i}
              onPointerDown={onDown(i)}
              className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: p.x, top: p.y, touchAction: 'none' }}
              aria-label={['Ecke oben links', 'Ecke oben rechts', 'Ecke unten rechts', 'Ecke unten links'][i]}
            >
              <div className={`h-6 w-6 rounded-full border-[3px] border-white shadow-md ${drag?.idx === i ? 'bg-[#0A84FF] scale-110' : 'bg-[#0A84FF]/80'}`} />
            </div>
          ))}
        </>
      )}
      <canvas
        ref={loupeRef}
        className={`pointer-events-none absolute top-3 h-[110px] w-[110px] rounded-full border-[3px] border-white shadow-xl ${drag ? '' : 'hidden'}`}
        style={loupeLeft ? { right: 12 } : { left: 12 }}
      />
    </div>
  );
}
