import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, LoaderCircle, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Seite im Vollbild ansehen: mit zwei Fingern zoomen, doppelt tippen zum Vergrößern,
 * seitlich wischen für die nächste Seite.
 */
export default function PagePreview({
  count,
  index,
  onIndex,
  render,
  thumb,
  thumbRotation,
  selected,
  onToggleSelect,
  onRotate,
  onClose,
}: {
  count: number;
  index: number;
  onIndex: (i: number) => void;
  /** Liefert eine scharfe Ansicht der Seite (bereits gedreht) */
  render: (i: number, width: number) => Promise<string>;
  /** Vorschaubild, solange die scharfe Ansicht lädt */
  thumb?: string;
  thumbRotation: number;
  selected: boolean;
  onToggleSelect: () => void;
  onRotate: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const renderRef = useRef(render);
  renderRef.current = render;
  // Neue Seite oder gedreht → scharfe Ansicht neu holen
  const renderKey = `${index}:${thumbRotation}`;
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    const el = scrollRef.current;
    const w = Math.min(2200, Math.round((el?.clientWidth || 400) * Math.min(3, window.devicePixelRatio || 1) * 2));
    renderRef
      .current(index, w)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [renderKey, index]);

  // Beim Seitenwechsel wieder ganze Seite zeigen
  useEffect(() => {
    applyZoom(1);
    setZoom(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const applyZoom = (z: number) => {
    zoomRef.current = z;
    if (innerRef.current) innerRef.current.style.width = `${z * 100}%`;
  };

  /** Zoomen um einen Punkt (relativ zum Scrollbereich): dieser Punkt der Seite bleibt unter dem Finger */
  const pointOnPage = (sx: number, sy: number) => {
    const el = scrollRef.current;
    const img = innerRef.current?.querySelector('img');
    if (!el || !img) return null;
    const er = el.getBoundingClientRect();
    const r0 = img.getBoundingClientRect();
    return { fx: (er.left + sx - r0.left) / r0.width, fy: (er.top + sy - r0.top) / r0.height };
  };

  const zoomAt = (z: number, sx: number, sy: number, fixed?: { fx: number; fy: number } | null) => {
    const el = scrollRef.current;
    const img = innerRef.current?.querySelector('img');
    const nz = clamp(z);
    const f = fixed || pointOnPage(sx, sy);
    if (!el || !img || !f) return applyZoom(nz);
    const er = el.getBoundingClientRect();
    const px = er.left + sx;
    const py = er.top + sy;
    const { fx, fy } = f;
    applyZoom(nz);
    const r1 = img.getBoundingClientRect();
    el.scrollLeft += r1.left + fx * r1.width - px;
    el.scrollTop += r1.top + fy * r1.height - py;
  };

  // Gesten: eigene Touch-Listener, damit preventDefault wirkt (React-Listener sind passiv)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pinch: { d0: number; z0: number; f: { fx: number; fy: number } | null } | null = null;
    let swipe: { x: number; y: number; t: number } | null = null;
    let lastTap = 0;

    const rel = (t: Touch) => {
      const r = el.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const pa = rel(e.touches[0]);
        const pb = rel(e.touches[1]);
        // Der Punkt der Seite zwischen den Fingern bleibt dort, solange gezoomt wird
        pinch = { d0: dist(e.touches[0], e.touches[1]), z0: zoomRef.current, f: pointOnPage((pa.x + pb.x) / 2, (pa.y + pb.y) / 2) };
        swipe = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        swipe = { x: t.clientX, y: t.clientY, t: Date.now() };
      }
    };
    const move = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const pa = rel(a);
        const pb = rel(b);
        zoomAt(pinch.z0 * (dist(a, b) / pinch.d0), (pa.x + pb.x) / 2, (pa.y + pb.y) / 2, pinch.f);
      }
    };
    const end = (e: TouchEvent) => {
      if (pinch) {
        if (e.touches.length < 2) {
          pinch = null;
          setZoom(zoomRef.current);
        }
        return;
      }
      if (!swipe || e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;
      const quick = Date.now() - swipe.t < 600;
      swipe = null;
      // Wischen nur bei ganzer Seite (sonst verschiebt man den Ausschnitt)
      if (zoomRef.current <= 1.02 && quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) onIndexRef.current(Math.min(countRef.current - 1, indexRef.current + 1));
        else onIndexRef.current(Math.max(0, indexRef.current - 1));
        return;
      }
      // Doppelt tippen
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const now = Date.now();
        if (now - lastTap < 320) {
          e.preventDefault();
          const p = rel(t);
          zoomAt(zoomRef.current > 1.5 ? 1 : 2.5, p.x, p.y);
          setZoom(zoomRef.current);
          lastTap = 0;
        } else lastTap = now;
      }
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;
  const countRef = useRef(count);
  countRef.current = count;
  const indexRef = useRef(index);
  indexRef.current = index;

  // Tastatur (am Computer)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndexRef.current(Math.min(countRef.current - 1, indexRef.current + 1));
      else if (e.key === 'ArrowLeft') onIndexRef.current(Math.max(0, indexRef.current - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const zoomButton = () => {
    const el = scrollRef.current;
    if (!el) return;
    const next = zoom >= 4 ? 1 : zoom < 2 ? 2 : 4;
    zoomAt(next, el.clientWidth / 2, el.clientHeight / 2);
    setZoom(next);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#1C1C1E] text-white">
      <header className="safe-top safe-x shrink-0">
        <div className="flex h-12 items-center gap-1 px-2">
          <button type="button" onClick={onClose} aria-label="Vorschau schließen" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center text-sm font-semibold">
            Seite {index + 1} von {count}
          </div>
          <button type="button" onClick={zoomButton} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold active:bg-white/20">
            {zoom >= 4 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain" style={{ touchAction: 'pan-x pan-y' }}>
        <div ref={innerRef} className="flex min-h-full w-full items-center justify-center p-3">
          {src ? (
            <img src={src} alt={`Seite ${index + 1}`} draggable={false} className="block w-full select-none bg-white shadow-lg" />
          ) : thumb ? (
            <div className="relative w-full">
              <img
                src={thumb}
                alt=""
                draggable={false}
                className="mx-auto block max-h-[75vh] max-w-full select-none bg-white opacity-90 blur-[1px]"
                style={{ transform: `rotate(${thumbRotation}deg)` }}
              />
              {!failed && <LoaderCircle className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-spin text-[#0071E3]" />}
            </div>
          ) : (
            <LoaderCircle className="h-7 w-7 animate-spin text-white/70" />
          )}
        </div>
        {failed && <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/70">Die Seite konnte nicht scharf dargestellt werden.</p>}
      </div>

      <div className="safe-bottom safe-x shrink-0 pt-2">
        <p className="mb-1.5 text-center text-[11px] text-white/50">Mit zwei Fingern zoomen · doppelt tippen · zur Seite wischen</p>
        <div className="grid grid-cols-4 gap-1 px-3">
          <DarkBar icon={<ChevronLeft className="h-5 w-5" />} label="Zurück" disabled={index === 0} onClick={() => onIndex(index - 1)} />
          <DarkBar icon={<RotateCw className="h-5 w-5" />} label="Drehen" onClick={onRotate} />
          <DarkBar
            icon={
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-[#0A84FF] bg-[#0A84FF]' : 'border-white/70'}`}>
                {selected && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
            }
            label={selected ? 'Ausgewählt' : 'Auswählen'}
            onClick={onToggleSelect}
          />
          <DarkBar icon={<ChevronRight className="h-5 w-5" />} label="Weiter" disabled={index >= count - 1} onClick={() => onIndex(index + 1)} />
        </div>
      </div>
    </div>
  );
}

function DarkBar({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-white active:bg-white/10 disabled:opacity-30"
    >
      {icon}
      {label}
    </button>
  );
}
