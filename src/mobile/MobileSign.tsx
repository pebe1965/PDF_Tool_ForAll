import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, LoaderCircle, PenLine, Plus, Trash2, Type, X, ZoomIn, ZoomOut } from 'lucide-react';
import { degrees } from 'pdf-lib';
import SignaturePad from './SignaturePad';
import ShareSheet from './ShareSheet';
import { BottomSheet, EditorHeader, PrimaryButton, SecondaryButton, Toast } from './MobileUi';
import { baseName, useHistory } from './mobileShared';
import { openPdfJs, openPdfLib, pdfFile, renderPage, type PdfJsDoc } from './pdfMobileOps';

/** Ein platziertes Element (Unterschrift, Text, Häkchen). Lage relativ zur angezeigten Seite (0..1). */
interface Placed {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** PNG als Daten-URL */
  src: string;
  /** Seitenverhältnis Breite/Höhe des Bildes */
  aspect: number;
  label: string;
}

const STORE_KEY = 'toolbox_mobile_signatures';
const MAX_SAVED = 6;

function loadSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
function storeSaved(list: string[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    /* Speicher voll oder gesperrt – dann eben nicht merken */
  }
}

/** Text als scharfes PNG (transparent). */
function textImage(text: string, color: string): { src: string; aspect: number } {
  const size = 96;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = `500 ${size}px Helvetica, Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  const h = Math.ceil(size * 1.3);
  c.width = Math.max(8, w);
  c.height = h;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 8, h / 2 + size * 0.04);
  return { src: c.toDataURL('image/png'), aspect: c.width / c.height };
}

function checkImage(color: string): { src: string; aspect: number } {
  const c = document.createElement('canvas');
  c.width = c.height = 120;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 64);
  ctx.lineTo(48, 94);
  ctx.lineTo(102, 26);
  ctx.stroke();
  return { src: c.toDataURL('image/png'), aspect: 1 };
}

function imageAspect(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
    img.onerror = () => resolve(3);
    img.src = src;
  });
}

let counter = 0;
const newId = () => `p${Date.now().toString(36)}_${counter++}`;

type Drag =
  | { kind: 'move'; id: string; pointer: number; startX: number; startY: number; orig: Placed; moved: boolean }
  | { kind: 'resize'; id: string; pointer: number; orig: Placed; startX: number };

export default function MobileSign({ file, onClose }: { file: File; onClose: () => void }) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [doc, setDoc] = useState<PdfJsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageImg, setPageImg] = useState<{ num: number; url: string; aspect: number } | null>(null);
  const history = useHistory<Placed[]>([]);
  const items = history.value;
  const [live, setLive] = useState<Placed[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sheet, setSheet] = useState<'signatures' | 'text' | 'export' | null>(null);
  const [pad, setPad] = useState(false);
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [text, setText] = useState('');
  const [inkColor, setInkColor] = useState('#1D1D1F');
  const [toast, setToast] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfJsDoc | null = null;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const pdf = await openPdfJs(buf);
        loaded = pdf;
        if (cancelled) return pdf.destroy();
        setBytes(buf);
        setDoc(pdf);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Das PDF konnte nicht geöffnet werden.');
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await renderPage(doc, pageNum, Math.min(1800, Math.round(window.innerWidth * Math.min(3, window.devicePixelRatio || 1) * 1.5)));
        const url = c.toDataURL('image/jpeg', 0.85);
        if (!cancelled) setPageImg({ num: pageNum, url, aspect: c.width / c.height });
      } catch {
        if (!cancelled) setError('Die Seite konnte nicht angezeigt werden.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  const shown = live || items;
  const pageItems = shown.filter((it) => it.page === pageNum);
  const pageAspect = pageImg?.aspect || 0.707;

  /** Neues Element mittig im sichtbaren Bereich der Seite */
  const place = (src: string, aspect: number, label: string, widthShare: number) => {
    let w = widthShare;
    let h = (w / aspect) * pageAspect;
    if (h > 0.25) {
      h = 0.25;
      w = (h * aspect) / pageAspect;
    }
    // Mitte des sichtbaren Ausschnitts
    let cx = 0.5;
    let cy = 0.5;
    const sc = scrollRef.current;
    const pg = pageRef.current;
    if (sc && pg) {
      const sr = sc.getBoundingClientRect();
      const pr = pg.getBoundingClientRect();
      cx = Math.min(0.9, Math.max(0.1, (sr.left + sr.width / 2 - pr.left) / pr.width));
      cy = Math.min(0.9, Math.max(0.1, (sr.top + sr.height / 2 - pr.top) / pr.height));
    }
    const item: Placed = {
      id: newId(),
      page: pageNum,
      x: Math.min(1 - w, Math.max(0, cx - w / 2)),
      y: Math.min(1 - h, Math.max(0, cy - h / 2)),
      w,
      h,
      src,
      aspect,
      label,
    };
    history.commit([...items, item]);
    setSelectedId(item.id);
  };

  const addSignature = async (src: string) => {
    setSheet(null);
    place(src, await imageAspect(src), 'Unterschrift', 0.32);
  };

  const today = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  /* ---------- Ziehen & Größe ändern ---------- */
  const rel = (clientX: number, clientY: number) => {
    const r = pageRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const startMove = (it: Placed) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (drag.current) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
    const p = rel(e.clientX, e.clientY);
    drag.current = { kind: 'move', id: it.id, pointer: e.pointerId, startX: p.x, startY: p.y, orig: it, moved: false };
    setSelectedId(it.id);
  };
  const startResize = (it: Placed) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (drag.current) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
    drag.current = { kind: 'resize', id: it.id, pointer: e.pointerId, orig: it, startX: rel(e.clientX, e.clientY).x };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    e.preventDefault();
    const p = rel(e.clientX, e.clientY);
    const o = d.orig;
    let next: Placed;
    if (d.kind === 'move') {
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 0.005) d.moved = true;
      next = { ...o, x: Math.min(1 - o.w, Math.max(0, o.x + dx)), y: Math.min(1 - o.h, Math.max(0, o.y + dy)) };
    } else {
      const w = Math.min(1 - o.x, Math.max(0.04, o.w + (p.x - d.startX)));
      const h = (w / o.aspect) * pageAspect;
      if (o.y + h > 1) return;
      next = { ...o, w, h };
    }
    setLive(items.map((it) => (it.id === o.id ? next : it)));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (live) history.commit(live);
    setLive(null);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    history.commit(items.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  };

  const close = () => {
    if (history.dirty && !window.confirm('Änderungen verwerfen? Das PDF wurde noch nicht gesichert.')) return;
    onClose();
  };

  /* ---------- Sichern ---------- */
  const build = async (): Promise<File[]> => {
    if (!bytes || !doc) throw new Error('Das PDF ist noch nicht geladen.');
    const out = await openPdfLib(bytes);
    const pages = out.getPages();
    const embedded = new Map<string, Awaited<ReturnType<typeof out.embedPng>>>();
    for (const it of items) {
      const target = pages[it.page - 1];
      if (!target) continue;
      let img = embedded.get(it.src);
      if (!img) {
        img = await out.embedPng(await fetch(it.src).then((r) => r.arrayBuffer()));
        embedded.set(it.src, img);
      }
      const vp = (await doc.getPage(it.page)).getViewport({ scale: 1 });
      const W = vp.width;
      const H = vp.height;
      // Ecken der angezeigten Fläche in PDF-Koordinaten (berücksichtigt gedrehte Seiten)
      const [blx, bly] = vp.convertToPdfPoint(it.x * W, (it.y + it.h) * H);
      const [brx, bry] = vp.convertToPdfPoint((it.x + it.w) * W, (it.y + it.h) * H);
      const [tlx, tly] = vp.convertToPdfPoint(it.x * W, it.y * H);
      const width = Math.hypot(brx - blx, bry - bly);
      const height = Math.hypot(tlx - blx, tly - bly);
      const angle = (Math.atan2(bry - bly, brx - blx) * 180) / Math.PI;
      target.drawImage(img, { x: blx, y: bly, width, height, rotate: degrees(Math.round(angle)) });
    }
    const saved = await out.save();
    return [pdfFile(saved, `${baseName(file.name)}_unterschrieben.pdf`)];
  };

  if (error || !doc) {
    return (
      <div className="flex h-full flex-col">
        <EditorHeader title={file.name} onClose={onClose} onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} action={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-[#6E6E73]">
          {error ? (
            <>
              <p className="font-semibold text-[#FF3B30]">{error}</p>
              <SecondaryButton onClick={onClose}>Anderes PDF wählen</SecondaryButton>
            </>
          ) : (
            <>
              <LoaderCircle className="h-6 w-6 animate-spin text-[#0071E3]" />
              PDF wird geöffnet …
            </>
          )}
        </div>
      </div>
    );
  }

  const otherPages = new Set(items.filter((it) => it.page !== pageNum).map((it) => it.page)).size;

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        title={file.name}
        onClose={close}
        onUndo={() => {
          history.undo();
          setSelectedId(null);
        }}
        onRedo={() => {
          history.redo();
          setSelectedId(null);
        }}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        action={
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setSheet('export');
            }}
            className="ml-1 rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white active:bg-[#0062C4]"
          >
            Sichern
          </button>
        }
      />

      <div className="safe-x flex shrink-0 items-center gap-2 border-b border-black/5 bg-white px-2 py-1.5">
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setPageNum((n) => Math.max(1, n - 1));
          }}
          disabled={pageNum <= 1}
          aria-label="Vorherige Seite"
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 whitespace-nowrap text-center text-sm font-medium tabular-nums">
          Seite {pageNum} von {doc.numPages}
          {otherPages > 0 && <span className="ml-1.5 rounded-full bg-[#0071E3]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#0071E3]">+{otherPages}</span>}
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setPageNum((n) => Math.min(doc.numPages, n + 1));
          }}
          disabled={pageNum >= doc.numPages}
          aria-label="Nächste Seite"
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setZoom((z) => (z >= 2.5 ? 1 : z + 0.75))} aria-label="Zoom" className="flex h-9 items-center gap-1 rounded-full bg-[#F5F5F7] px-3 text-sm font-semibold text-[#0071E3]">
          {zoom >= 2.5 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          {Math.round(zoom * 100)}%
        </button>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-[#E8E8ED]" onPointerDown={() => setSelectedId(null)}>
        {pageImg && pageImg.num === pageNum ? (
          <div className="p-3" style={{ width: `${zoom * 100}%` }}>
            <div
              ref={pageRef}
              className="relative w-full bg-white shadow-md"
              style={{ aspectRatio: `${pageImg.aspect}` }}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <img src={pageImg.url} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
              {pageItems.map((it) => {
                const sel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    className={`absolute touch-none ${sel ? 'outline outline-2 outline-[#0071E3]' : 'outline outline-1 outline-dashed outline-[#0071E3]/40'}`}
                    style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: `${it.w * 100}%`, height: `${it.h * 100}%` }}
                    onPointerDown={startMove(it)}
                  >
                    <img src={it.src} alt={it.label} className="pointer-events-none h-full w-full select-none" draggable={false} />
                    {sel && (
                      <>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={removeSelected}
                          aria-label="Entfernen"
                          className="absolute -left-3.5 -top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#FF3B30] text-white shadow"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div
                          onPointerDown={startResize(it)}
                          aria-label="Größe ändern"
                          className="absolute -bottom-4 -right-4 flex h-8 w-8 touch-none items-center justify-center"
                        >
                          <div className="h-5 w-5 rounded-full border-[3px] border-white bg-[#0071E3] shadow" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-[#0071E3]" />
          </div>
        )}
        {items.length === 0 && pageImg && (
          <div className="pointer-events-none sticky bottom-3 flex justify-center px-4">
            <div className="rounded-full bg-black/60 px-3.5 py-1.5 text-center text-xs font-medium text-white">Unten „Unterschrift“ wählen – dann an die richtige Stelle ziehen</div>
          </div>
        )}
      </div>

      <div className="safe-bottom safe-x grid shrink-0 grid-cols-4 gap-1 border-t border-black/5 bg-white px-3 pt-2">
        <BarButton icon={<PenLine className="h-5 w-5" />} label="Unterschrift" onClick={() => (saved.length ? setSheet('signatures') : setPad(true))} />
        <BarButton
          icon={<Type className="h-5 w-5" />}
          label="Text"
          onClick={() => {
            setText('');
            setSheet('text');
          }}
        />
        <BarButton
          icon={<Calendar className="h-5 w-5" />}
          label="Datum"
          onClick={() => {
            const t = textImage(today(), inkColor);
            place(t.src, t.aspect, 'Datum', 0.2);
          }}
        />
        <BarButton
          icon={<Check className="h-5 w-5" />}
          label="Häkchen"
          onClick={() => {
            const t = checkImage(inkColor);
            place(t.src, t.aspect, 'Häkchen', 0.05);
          }}
        />
      </div>

      {sheet === 'signatures' && (
        <BottomSheet title="Unterschrift einfügen" onClose={() => setSheet(null)}>
          <div className="space-y-2">
            {saved.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <button type="button" onClick={() => addSignature(s)} className="flex h-20 flex-1 items-center justify-center rounded-xl border border-black/5 bg-white p-2 active:bg-[#F5F5F7]">
                  <img src={s} alt="Gespeicherte Unterschrift" className="max-h-full max-w-full" />
                </button>
                <button
                  type="button"
                  aria-label="Unterschrift löschen"
                  onClick={() => {
                    const next = saved.filter((x) => x !== s);
                    setSaved(next);
                    storeSaved(next);
                    if (next.length === 0) setSheet(null);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7] text-[#FF3B30]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <SecondaryButton
              onClick={() => {
                setSheet(null);
                setPad(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Neue Unterschrift
            </SecondaryButton>
            <p className="text-xs leading-snug text-[#86868B]">Gemerkte Unterschriften bleiben nur in diesem Browser auf deinem Gerät.</p>
          </div>
        </BottomSheet>
      )}

      {sheet === 'text' && (
        <BottomSheet title="Text einfügen" onClose={() => setSheet(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = text.trim();
              if (!v) return;
              setSheet(null);
              const t = textImage(v, inkColor);
              place(t.src, t.aspect, v, Math.min(0.6, 0.025 * v.length + 0.05));
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="z. B. Name, Ort"
              className="w-full rounded-xl bg-[#F5F5F7] px-3.5 py-3 text-[16px] outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
            <div className="flex flex-wrap gap-1.5">
              {[`${today()}`, 'Ort, Datum', 'Gelesen und einverstanden'].map((s) => (
                <button key={s} type="button" onClick={() => setText(s)} className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-sm font-semibold">
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-[#3A3A3C]">
              Farbe:
              {['#1D1D1F', '#1747A6'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInkColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${inkColor === c ? 'border-[#0071E3]' : 'border-white shadow'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <PrimaryButton disabled={!text.trim()}>Einfügen</PrimaryButton>
          </form>
        </BottomSheet>
      )}

      {pad && (
        <SignaturePad
          onCancel={() => setPad(false)}
          onDone={(src, remember) => {
            setPad(false);
            if (remember) {
              const next = [src, ...saved.filter((s) => s !== src)].slice(0, MAX_SAVED);
              setSaved(next);
              storeSaved(next);
            }
            addSignature(src);
          }}
        />
      )}

      {sheet === 'export' && (
        <ShareSheet
          title="Unterschriebenes PDF"
          build={build}
          onClose={() => setSheet(null)}
          onDone={(t: string) => {
            history.markSaved();
            showToast(t);
          }}
          info={
            items.length === 0 ? (
              <p className="rounded-xl bg-[#FFF4E5] px-3 py-2 text-xs text-[#8A5300]">Es ist noch nichts eingefügt – das PDF wird unverändert gespeichert.</p>
            ) : (
              <p className="text-xs leading-snug text-[#6E6E73]">
                {items.length} {items.length === 1 ? 'Element wird' : 'Elemente werden'} fest ins PDF eingefügt. Gespeichert wird eine Kopie.
              </p>
            )
          }
        />
      )}
      <Toast text={toast} />
    </div>
  );
}

function BarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-[#0071E3] active:bg-black/5">
      {icon}
      {label}
    </button>
  );
}
