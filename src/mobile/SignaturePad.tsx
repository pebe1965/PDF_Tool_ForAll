import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

const COLORS = [
  { id: '#1D1D1F', label: 'Schwarz' },
  { id: '#1747A6', label: 'Blau' },
];

/** Unterschreiben mit dem Finger. Liefert ein PNG (transparent, auf die Schrift zugeschnitten). */
export default function SignaturePad({ onDone, onCancel }: { onDone: (dataUrl: string, remember: boolean) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0].id);
  const [empty, setEmpty] = useState(true);
  const [remember, setRemember] = useState(true);
  const last = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);
  const active = useRef<number | null>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const resize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      // Inhalt bleibt beim Drehen des Geräts nicht erhalten – das ist in Ordnung (vorher leer)
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      setEmpty(true);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const lineWidth = () => (canvasRef.current!.width / 260) * 2.2;

  const down = (e: React.PointerEvent) => {
    if (active.current !== null) return;
    e.preventDefault();
    active.current = e.pointerId;
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
    const p = pos(e);
    last.current = { ...p, mx: p.x, my: p.y };
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, lineWidth() / 2, 0, Math.PI * 2);
    ctx.fill();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !last.current) return;
    const p = pos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    const mx = (last.current.x + p.x) / 2;
    const my = (last.current.y + p.y) / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.mx, last.current.my);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mx, my);
    ctx.stroke();
    last.current = { x: p.x, y: p.y, mx, my };
  };
  const up = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    // Letztes Stück bis zum Abheben zeichnen
    const l = last.current;
    if (l) {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(l.mx, l.my);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
    }
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  const finish = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return;
    const pad = Math.round(lineWidth());
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(c.width - 1, x1 + pad);
    y1 = Math.min(c.height - 1, y1 + pad);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL('image/png'), remember);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#F5F5F7]">
      <header className="safe-top safe-x shrink-0 bg-white">
        <div className="flex h-12 items-center gap-1 px-2">
          <button type="button" onClick={onCancel} className="rounded-full px-3 py-2 text-sm font-semibold text-[#0071E3] active:bg-black/5">
            Abbrechen
          </button>
          <div className="flex-1 text-center text-sm font-semibold">Unterschreiben</div>
          <button type="button" disabled={empty} onClick={finish} className="rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Fertig
          </button>
        </div>
      </header>
      <div className="safe-x flex min-h-0 flex-1 flex-col p-4">
        <div className="relative min-h-0 flex-1 rounded-2xl bg-white shadow-sm">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none rounded-2xl"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <div className="pointer-events-none absolute inset-x-8 bottom-[30%] border-b-2 border-dashed border-[#D2D2D7]" />
          {empty && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[30%] mb-3 text-center text-sm text-[#AEAEB2]">Hier mit dem Finger unterschreiben</div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-[#86868B]">Tipp: Handy quer halten – dann ist mehr Platz.</p>
      </div>
      <div className="safe-bottom safe-x flex shrink-0 items-center gap-2 bg-white px-4 pt-3">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            aria-label={c.label}
            className={`h-8 w-8 rounded-full border-2 ${color === c.id ? 'border-[#0071E3] ring-2 ring-[#0071E3]/30' : 'border-white shadow'}`}
            style={{ background: c.id }}
          />
        ))}
        <button type="button" onClick={clear} className="ml-1 flex items-center gap-1 rounded-full bg-[#F5F5F7] px-3 py-2 text-sm font-semibold text-[#1D1D1F]">
          <Eraser className="h-4 w-4" />
          Löschen
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-[#3A3A3C]">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#0071E3]" />
          Merken
        </label>
      </div>
    </div>
  );
}
