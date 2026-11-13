import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Brush,
  Circle,
  Copy,
  Crop,
  Download,
  Droplets,
  EyeOff,
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  ImagePlus,
  Info,
  Maximize,
  MousePointer2,
  Redo2,
  RotateCcw,
  RotateCw,
  RotateCcwSquare,
  Scaling,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ExportFormat,
  FORMAT_INFO,
  ImageMetaInfo,
  ImageRegion,
  METHOD_LABELS,
  Point,
  RedactMethod,
  brushBounds,
  canExportWebp,
  canvasToBlob,
  copyCanvasToClipboard,
  cropImage,
  flipImage,
  formatBytes,
  formatFromType,
  isMethodSecure,
  isSupportedImageFile,
  loadImageFile,
  moveRegion,
  newRegionId,
  normRect,
  normalizeAngle,
  regionCenter,
  regionContains,
  regionCorners,
  rotatePoint,
  renderImage,
  resizeImage,
  rotateImage,
  saveBlob,
  scaleCanvas,
  suggestFileName,
} from '../lib/imageEngine';
import { convertImageFileToA4PdfBytes, downloadPdf } from '../lib/pdfEngine';

type Tool = 'select' | 'rect' | 'ellipse' | 'brush' | 'crop';

interface DocState {
  base: HTMLCanvasElement;
  regions: ImageRegion[];
}

interface ImageInfo {
  fileName: string;
  originalType: string;
  originalWidth: number;
  originalHeight: number;
  downscaled: boolean;
  meta: ImageMetaInfo;
}

type DragState =
  | { kind: 'draw'; start: Point; current: Point }
  | { kind: 'brush'; points: Point[] }
  | { kind: 'move'; id: string; start: Point; orig: ImageRegion; moved: boolean }
  | { kind: 'resize'; id: string; anchor: Point; orig: ImageRegion }
  | { kind: 'rotate'; id: string; center: Point; orig: ImageRegion }
  | { kind: 'crop'; start: Point; current: Point };

interface ImageEditorViewProps {
  isActive: boolean;
  onGoHome: () => void;
  onSendToEditor: (bytes: ArrayBuffer, fileName: string) => void;
}

const PREVIEW_MAX_PIXELS = 4_000_000;
const HISTORY_LIMIT = 40;

const METHOD_ICONS: Record<RedactMethod, React.ReactNode> = {
  fill: <EyeOff size={16} />,
  pixelate: <Grid3x3 size={16} />,
  blur: <Droplets size={16} />,
  frosted: <Droplets size={16} className="opacity-60" />,
};

const FILL_COLORS = ['#000000', '#FFFFFF', '#6B7280', '#0071E3', '#DC2626'];

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Auswählen', hint: 'Bereiche auswählen, verschieben und in der Größe ändern (V)', icon: <MousePointer2 size={18} /> },
  { id: 'rect', label: 'Rechteck', hint: 'Rechteckigen Bereich aufziehen (R)', icon: <Square size={18} /> },
  { id: 'ellipse', label: 'Ellipse', hint: 'Runden Bereich aufziehen, z. B. für Gesichter (E)', icon: <Circle size={18} /> },
  { id: 'brush', label: 'Pinsel', hint: 'Frei übermalen, z. B. schräge Schrift (B)', icon: <Brush size={18} /> },
  { id: 'crop', label: 'Zuschneiden', hint: 'Ausschnitt wählen und zuschneiden (C)', icon: <Crop size={18} /> },
];

export const ImageEditorView: React.FC<ImageEditorViewProps> = ({ isActive, onGoHome, onSendToEditor }) => {
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [doc, setDoc] = useState<DocState | null>(null);
  const [past, setPast] = useState<DocState[]>([]);
  const [future, setFuture] = useState<DocState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [method, setMethod] = useState<RedactMethod>('pixelate');
  const [strength, setStrength] = useState(50);
  const [fillColor, setFillColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(40);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveRegions, setLiveRegions] = useState<ImageRegion[] | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitBox, setFitBox] = useState({ w: 800, h: 600 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(90);
  const [exportName, setExportName] = useState('');
  const [resizeWidth, setResizeWidth] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' | 'info' } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const renderFrame = useRef<number | null>(null);

  const regions = liveRegions ?? doc?.regions ?? [];
  const selected = regions.find((r) => r.id === selectedId) || null;
  const imgW = doc?.base.width ?? 1;
  const imgH = doc?.base.height ?? 1;

  /* ---------------- Hinweise ---------------- */
  const showToast = useCallback((text: string, tone: 'ok' | 'error' | 'info' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), tone === 'error' ? 7000 : 4000);
  }, []);

  /* ---------------- Verlauf ---------------- */
  const commit = useCallback(
    (next: DocState) => {
      if (doc) setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), doc]);
      setFuture([]);
      setDoc(next);
    },
    [doc],
  );

  const undo = useCallback(() => {
    if (!doc || past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [doc, ...f]);
    setDoc(prev);
    if (selectedId && !prev.regions.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [doc, past, selectedId]);

  const redo = useCallback(() => {
    if (!doc || future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, doc]);
    setDoc(next);
  }, [doc, future]);

  /* ---------------- Laden ---------------- */
  const openFile = useCallback(
    async (file: Blob, name: string) => {
      setBusy('Bild wird geöffnet …');
      try {
        const loaded = await loadImageFile(file, name);
        setInfo({
          fileName: loaded.fileName,
          originalType: loaded.originalType,
          originalWidth: loaded.originalWidth,
          originalHeight: loaded.originalHeight,
          downscaled: loaded.downscaled,
          meta: loaded.meta,
        });
        setDoc({ base: loaded.canvas, regions: [] });
        setPast([]);
        setFuture([]);
        setSelectedId(null);
        setCropRect(null);
        setZoom(1);
        setTool('rect');
        const fmt = formatFromType(loaded.originalType, loaded.fileName);
        setExportFormat(fmt);
        setExportName(suggestFileName(loaded.fileName, fmt));
        setResizeWidth(String(loaded.canvas.width));
        if (loaded.downscaled) {
          showToast(
            `Das Bild war sehr groß (${loaded.originalWidth} × ${loaded.originalHeight}) und wurde für dieses Gerät auf ${loaded.canvas.width} × ${loaded.canvas.height} verkleinert.`,
            'info',
          );
        }
      } catch (err: any) {
        showToast(err?.message || 'Das Bild konnte nicht geöffnet werden.', 'error');
      } finally {
        setBusy(null);
      }
    },
    [showToast],
  );

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      const file = files ? Array.from(files).find(isSupportedImageFile) : undefined;
      if (!file) {
        if (files && files.length) showToast('Bitte eine Bilddatei wählen (JPG, PNG, WebP, GIF, BMP oder HEIC).', 'error');
        return;
      }
      openFile(file, file.name);
    },
    [openFile, showToast],
  );

  /* ---------------- Vorschau ---------------- */
  const previewScale = useMemo(() => {
    if (!doc) return 1;
    const px = doc.base.width * doc.base.height;
    return px > PREVIEW_MAX_PIXELS ? Math.sqrt(PREVIEW_MAX_PIXELS / px) : 1;
  }, [doc?.base]);

  const previewBase = useMemo(() => {
    if (!doc) return null;
    return previewScale < 1 ? scaleCanvas(doc.base, previewScale) : doc.base;
  }, [doc?.base, previewScale]);

  useEffect(() => {
    if (!doc || !previewBase) return;
    if (renderFrame.current) cancelAnimationFrame(renderFrame.current);
    renderFrame.current = requestAnimationFrame(() => {
      const target = canvasRef.current;
      if (!target) return;
      const rendered = renderImage(doc.base, regions, previewScale, previewBase);
      if (target.width !== rendered.width) target.width = rendered.width;
      if (target.height !== rendered.height) target.height = rendered.height;
      const ctx = target.getContext('2d')!;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(rendered, 0, 0);
    });
  }, [doc, previewBase, previewScale, regions]);

  // Verfügbaren Platz messen
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setFitBox({ w: Math.max(200, el.clientWidth - 48), h: Math.max(200, el.clientHeight - 48) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc !== null]);

  const fitScale = Math.min(fitBox.w / imgW, fitBox.h / imgH, 1);
  const displayScale = fitScale * zoom;
  const displayW = Math.max(1, Math.round(imgW * displayScale));
  const displayH = Math.max(1, Math.round(imgH * displayScale));
  const handleSize = 10 / displayScale;

  /* ---------------- Bereiche ändern ---------------- */
  const updateSelected = useCallback(
    (patch: Partial<ImageRegion>) => {
      if (!doc || !selectedId) return;
      commit({ ...doc, regions: doc.regions.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)) });
    },
    [doc, selectedId, commit],
  );

  const deleteRegion = useCallback(
    (id: string) => {
      if (!doc) return;
      commit({ ...doc, regions: doc.regions.filter((r) => r.id !== id) });
      if (selectedId === id) setSelectedId(null);
    },
    [doc, selectedId, commit],
  );

  // Einstellungen im Panel gelten für den gewählten Bereich, sonst für neue Bereiche
  const activeMethod = selected?.method ?? method;
  const activeStrength = selected?.strength ?? strength;
  const activeColor = selected?.color ?? fillColor;

  const chooseMethod = (m: RedactMethod) => {
    setMethod(m);
    if (selected) updateSelected({ method: m });
  };
  const chooseStrength = (v: number) => {
    setStrength(v);
    if (selected) updateSelected({ strength: v });
  };
  const chooseColor = (c: string) => {
    setFillColor(c);
    if (selected) updateSelected({ color: c });
  };

  /* ---------------- Zeiger ---------------- */
  const toImagePoint = (e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(imgW, Math.max(0, ((e.clientX - rect.left) / rect.width) * imgW)),
      y: Math.min(imgH, Math.max(0, ((e.clientY - rect.top) / rect.height) * imgH)),
    };
  };

  const hitRegion = (p: Point): ImageRegion | null => {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (regionContains(r, p)) return r;
    }
    return null;
  };

  const rotateHandleDistance = 26 / displayScale;

  /** Lokale y-Position des Drehgriffs: über dem Bereich, am oberen Bildrand darunter. */
  const rotateHandleLocalY = (r: ImageRegion): number => {
    const above = rotatePoint({ x: r.x + r.w / 2, y: r.y - rotateHandleDistance }, regionCenter(r), r.rotation || 0);
    const inside = above.x >= 0 && above.x <= imgW && above.y >= 0 && above.y <= imgH;
    return inside ? r.y - rotateHandleDistance : r.y + r.h + rotateHandleDistance;
  };

  const rotateHandlePos = (r: ImageRegion): Point =>
    rotatePoint({ x: r.x + r.w / 2, y: rotateHandleLocalY(r) }, regionCenter(r), r.rotation || 0);

  const hitHandle = (p: Point): { kind: 'corner'; anchor: Point } | { kind: 'rotate' } | null => {
    if (!selected || selected.shape === 'brush') return null;
    const rh = rotateHandlePos(selected);
    if (Math.hypot(p.x - rh.x, p.y - rh.y) <= handleSize) return { kind: 'rotate' };
    const corners = regionCorners(selected);
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      if (Math.abs(p.x - c.x) <= handleSize && Math.abs(p.y - c.y) <= handleSize) return { kind: 'corner', anchor: corners[(i + 2) % 4] };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!doc || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toImagePoint(e);

    if (tool === 'crop') {
      setDrag({ kind: 'crop', start: p, current: p });
      setCropRect(null);
      return;
    }
    if (tool === 'brush') {
      setSelectedId(null);
      setDrag({ kind: 'brush', points: [p] });
      return;
    }
    const handle = hitHandle(p);
    if (handle && selected) {
      if (handle.kind === 'rotate') setDrag({ kind: 'rotate', id: selected.id, center: regionCenter(selected), orig: selected });
      else setDrag({ kind: 'resize', id: selected.id, anchor: handle.anchor, orig: selected });
      return;
    }
    const hit = tool === 'select' ? hitRegion(p) : selected && hitRegion(p)?.id === selected.id ? selected : null;
    if (hit) {
      setSelectedId(hit.id);
      setDrag({ kind: 'move', id: hit.id, start: p, orig: hit, moved: false });
      return;
    }
    if (tool === 'select') {
      setSelectedId(null);
      return;
    }
    setSelectedId(null);
    setDrag({ kind: 'draw', start: p, current: p });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !doc) return;
    const p = toImagePoint(e);
    if (drag.kind === 'draw' || drag.kind === 'crop') {
      setDrag({ ...drag, current: p });
    } else if (drag.kind === 'brush') {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= Math.max(1, brushSize / 6)) {
        setDrag({ kind: 'brush', points: [...drag.points, p] });
      }
    } else if (drag.kind === 'move') {
      const moved = moveRegion(drag.orig, p.x - drag.start.x, p.y - drag.start.y);
      setLiveRegions(doc.regions.map((r) => (r.id === drag.id ? moved : r)));
      if (!drag.moved) setDrag({ ...drag, moved: true });
    } else if (drag.kind === 'resize') {
      // Größe im gedrehten Koordinatensystem des Bereichs ändern; die gegenüberliegende Ecke bleibt fest
      const deg = drag.orig.rotation || 0;
      const d = rotatePoint({ x: p.x - drag.anchor.x, y: p.y - drag.anchor.y }, { x: 0, y: 0 }, -deg);
      const w = Math.max(1, Math.abs(d.x));
      const h = Math.max(1, Math.abs(d.y));
      const cx = (drag.anchor.x + p.x) / 2;
      const cy = (drag.anchor.y + p.y) / 2;
      const resized = { ...drag.orig, x: cx - w / 2, y: cy - h / 2, w, h };
      setLiveRegions(doc.regions.map((r) => (r.id === drag.id ? resized : r)));
    } else if (drag.kind === 'rotate') {
      // Griff oben: 0° zeigt nach oben; Griff unten: 0° zeigt nach unten
      const handleBelow = rotateHandleLocalY(drag.orig) > drag.orig.y + drag.orig.h;
      let angle = (Math.atan2(p.y - drag.center.y, p.x - drag.center.x) * 180) / Math.PI + (handleBelow ? -90 : 90);
      // Mit Umschalttaste in 15°-Schritten, sonst nahe 0/90/180° einrasten
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      else {
        const nearest = Math.round(angle / 90) * 90;
        if (Math.abs(angle - nearest) < 2.5) angle = nearest;
      }
      const rotated = { ...drag.orig, rotation: normalizeAngle(angle) };
      setLiveRegions(doc.regions.map((r) => (r.id === drag.id ? rotated : r)));
    }
  };

  const onPointerUp = () => {
    if (!drag || !doc) return;
    const minSize = 4 / displayScale;
    if (drag.kind === 'draw') {
      const nr = normRect(drag.start.x, drag.start.y, drag.current.x, drag.current.y);
      if (nr.w >= minSize && nr.h >= minSize) {
        const region: ImageRegion = {
          id: newRegionId(),
          shape: tool === 'ellipse' ? 'ellipse' : 'rect',
          ...nr,
          method,
          strength,
          color: fillColor,
        };
        commit({ ...doc, regions: [...doc.regions, region] });
        setSelectedId(region.id);
      }
    } else if (drag.kind === 'brush') {
      const region: ImageRegion = {
        id: newRegionId(),
        shape: 'brush',
        points: drag.points,
        brushSize,
        ...brushBounds(drag.points, brushSize),
        method,
        strength,
        color: fillColor,
      };
      commit({ ...doc, regions: [...doc.regions, region] });
      setSelectedId(region.id);
    } else if (drag.kind === 'crop') {
      const nr = normRect(drag.start.x, drag.start.y, drag.current.x, drag.current.y);
      setCropRect(nr.w >= minSize * 2 && nr.h >= minSize * 2 ? nr : null);
    } else if ((drag.kind === 'move' && drag.moved) || drag.kind === 'resize' || drag.kind === 'rotate') {
      if (liveRegions) commit({ ...doc, regions: liveRegions });
    }
    setDrag(null);
    setLiveRegions(null);
  };

  /* ---------------- Bildoperationen ---------------- */
  const applyTransform = (fn: (base: HTMLCanvasElement, regions: ImageRegion[]) => DocState) => {
    if (!doc) return;
    const next = fn(doc.base, doc.regions);
    commit(next);
    setResizeWidth(String(next.base.width));
    setCropRect(null);
  };

  const applyCrop = () => {
    if (!cropRect) return;
    applyTransform((b, r) => cropImage(b, r, cropRect));
    setTool('rect');
    showToast('Bild zugeschnitten.');
  };

  const applyResize = () => {
    const w = parseInt(resizeWidth, 10);
    if (!doc || !w || w < 16 || w > 20000) {
      showToast('Bitte eine Breite zwischen 16 und 20000 Pixeln eingeben.', 'error');
      return;
    }
    if (w === doc.base.width) return;
    applyTransform((b, r) => resizeImage(b, r, w));
    showToast(`Größe geändert auf ${w} × ${Math.round((doc.base.height * w) / doc.base.width)} Pixel.`);
  };

  /* ---------------- Export ---------------- */
  const webpOk = useMemo(() => canExportWebp(), []);

  useEffect(() => {
    if (!info) return;
    setExportName((name) => {
      const base = name.replace(/\.[a-z0-9]+$/i, '') || suggestFileName(info.fileName, exportFormat).replace(/\.[a-z0-9]+$/i, '');
      return `${base}.${FORMAT_INFO[exportFormat].ext}`;
    });
  }, [exportFormat, info]);

  const renderFull = () => renderImage(doc!.base, doc!.regions, 1);

  const withBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    await new Promise((r) => setTimeout(r, 30)); // Hinweis zuerst anzeigen
    try {
      await fn();
    } catch (err: any) {
      showToast(err?.message || 'Das hat nicht geklappt.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveImage = () =>
    withBusy('Bild wird gespeichert …', async () => {
      const canvas = renderFull();
      let fmt = exportFormat;
      let blob = await canvasToBlob(canvas, fmt, quality / 100);
      if (blob.type && blob.type !== FORMAT_INFO[fmt].mime) {
        fmt = 'png';
        blob = await canvasToBlob(canvas, 'png');
        showToast('Dieser Browser kann dieses Format nicht erzeugen – gespeichert als PNG.', 'info');
      }
      let name = (exportName.trim() || suggestFileName(info!.fileName, fmt)).replace(/[\\/:*?"<>|]/g, '_');
      name = name.replace(/\.[a-z0-9]+$/i, '') + `.${FORMAT_INFO[fmt].ext}`;
      const hasPicker = typeof (window as any).showSaveFilePicker === 'function';
      const ok = await saveBlob(blob, name);
      if (ok) showToast(`Kopie gespeichert: ${name} (${formatBytes(blob.size)})${hasPicker ? '' : ' – im Ordner „Downloads“'}`);
    });

  const handleCopy = async () => {
    if (!doc) return;
    try {
      await copyCanvasToClipboard(renderFull());
      showToast('Bild in die Zwischenablage kopiert – jetzt mit Cmd/Strg+V einfügen.');
    } catch (err: any) {
      showToast(err?.message || 'Kopieren nicht möglich.', 'error');
    }
  };

  const makePdf = async () => {
    const blob = await canvasToBlob(renderFull(), 'jpeg', 0.92);
    return convertImageFileToA4PdfBytes(blob);
  };

  const pdfName = () => (exportName.trim() || suggestFileName(info!.fileName, 'png')).replace(/\.[a-z0-9]+$/i, '') + '.pdf';

  const handleSavePdf = () =>
    withBusy('PDF wird erstellt …', async () => {
      const bytes = await makePdf();
      const ok = await downloadPdf(new Uint8Array(bytes), pdfName(), true);
      if (ok) showToast(`PDF gespeichert: ${pdfName()}`);
    });

  const handleSendToEditor = () =>
    withBusy('PDF wird erstellt …', async () => {
      const bytes = await makePdf();
      onSendToEditor(bytes, pdfName());
    });

  const closeImage = () => {
    if (doc && doc.regions.length > 0 && !window.confirm('Bild schließen? Nicht gespeicherte Änderungen gehen verloren.')) return;
    setDoc(null);
    setInfo(null);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setCropRect(null);
  };

  /* ---------------- Tastatur & Einfügen ---------------- */
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!doc || mod) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteRegion(selectedId);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setCropRect(null);
      } else if (e.key === 'Enter' && tool === 'crop' && cropRect) {
        applyCrop();
      } else {
        const map: Record<string, Tool> = { v: 'select', r: 'rect', e: 'ellipse', b: 'brush', c: 'crop' };
        const next = map[e.key.toLowerCase()];
        if (next) {
          setTool(next);
          if (next !== 'select') setSelectedId(null);
        }
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            openFile(file, `Eingefuegt_${new Date().toISOString().slice(0, 10)}.${ext}`);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  });

  /* ---------------- Darstellung ---------------- */
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    },
    onDragLeave: () => setIsDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,.heic,.heif"
      className="hidden"
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const toastEl = toast && (
    <div
      role="status"
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-start gap-2 ${
        toast.tone === 'error' ? 'bg-red-600 text-white' : toast.tone === 'info' ? 'bg-[#1D1D1F] text-white' : 'bg-emerald-600 text-white'
      }`}
    >
      <span>{toast.text}</span>
      <button type="button" onClick={() => setToast(null)} className="opacity-80 hover:opacity-100" aria-label="Hinweis schließen">
        <X size={16} />
      </button>
    </div>
  );

  /* ---------- Startansicht ---------- */
  if (!doc || !info) {
    return (
      <div className="h-full overflow-y-auto" {...dropHandlers}>
        {fileInput}
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <button
            type="button"
            onClick={onGoHome}
            className="mb-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200"
          >
            <ArrowLeft size={14} /> Startseite
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Bilder bearbeiten & unkenntlich machen</h1>
          <p className="text-sm text-[#86868B] mb-8">
            Gesichter, Kennzeichen, Namen oder Kontodaten auf Fotos und Bildschirmfotos verpixeln, weichzeichnen oder schwärzen – komplett auf
            deinem Gerät. Gespeichert wird immer eine Kopie, das Original bleibt unverändert.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`p-10 bg-white rounded-3xl border-2 border-dashed transition flex flex-col items-center text-center shadow-lg cursor-pointer ${
              isDragOver ? 'border-[#0071E3] bg-blue-50' : 'border-[#D2D2D7] hover:border-[#0071E3]'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-4">
              <ImagePlus size={32} />
            </div>
            <h2 className="text-lg font-bold mb-1">Bild öffnen</h2>
            <p className="text-sm text-[#86868B] mb-5">
              Hierher ziehen, auswählen oder ein Bildschirmfoto mit <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border text-xs">Cmd</kbd> /{' '}
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border text-xs">Strg</kbd> +{' '}
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border text-xs">V</kbd> einfügen.
            </p>
            <span className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold rounded-xl shadow-md inline-flex items-center gap-2">
              <Upload size={16} /> Bild auswählen
            </span>
            <p className="text-[11px] text-gray-400 mt-4">JPG, PNG, WebP, GIF, BMP · HEIC auf dem Mac</p>
            {busy && <p className="text-sm text-[#0071E3] mt-3">{busy}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {(['fill', 'pixelate', 'blur', 'frosted'] as RedactMethod[]).map((m) => (
              <div key={m} className="p-4 bg-white rounded-2xl border border-[#E8E8ED]">
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                  {METHOD_ICONS[m]} {METHOD_LABELS[m]}
                </div>
                <p className="text-xs text-[#86868B]">
                  {m === 'fill' && 'Deckender Balken – am sichersten für Text, IBAN und Ausweisnummern.'}
                  {m === 'pixelate' && 'Grobe Kacheln – typisch für Gesichter und Autokennzeichen.'}
                  {m === 'blur' && 'Weich verwischt – ideal für Hintergründe und Personen.'}
                  {m === 'frosted' && 'Milchglas-Effekt – modern und gut lesbar für Bildschirmfotos.'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Beim Speichern entfernt die Toolbox alle versteckten Zusatzdaten wie GPS-Position, Kameramodell und die eingebettete Vorschau – sonst
              könnte dort der ungeschwärzte Inhalt weiterleben.
            </span>
          </div>
        </div>
        {toastEl}
      </div>
    );
  }

  /* ---------- Editor ---------- */
  const draftRect =
    drag && (drag.kind === 'draw' || drag.kind === 'crop') ? normRect(drag.start.x, drag.start.y, drag.current.x, drag.current.y) : null;
  const shownCrop = drag?.kind === 'crop' ? draftRect : cropRect;
  const secure = isMethodSecure(activeMethod, activeStrength);
  const cursor = tool === 'select' ? 'default' : 'crosshair';

  const toolButton = (t: (typeof TOOLS)[number]) => (
    <button
      key={t.id}
      type="button"
      title={t.hint}
      aria-pressed={tool === t.id}
      onClick={() => {
        setTool(t.id);
        if (t.id !== 'crop') setCropRect(null);
        // Neues Zeichenwerkzeug: Einstellungen gelten dann für den nächsten Bereich
        if (t.id !== 'select') setSelectedId(null);
      }}
      className={`flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl text-[10px] font-semibold transition ${
        tool === t.id ? 'bg-[#0071E3] text-white shadow' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {t.icon}
      {t.label}
    </button>
  );

  return (
    <div className="h-full flex flex-col" {...dropHandlers}>
      {fileInput}
      {/* Obere Leiste */}
      <div className="min-h-[52px] bg-white border-b border-[#E8E8ED] px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 bg-[#F5F5F7] hover:bg-gray-200 border border-gray-200"
        >
          <ArrowLeft size={14} /> Startseite
        </button>
        <div className="min-w-0 px-1">
          <div className="text-sm font-semibold truncate max-w-[260px]" title={info.fileName}>
            {info.fileName}
          </div>
          <div className="text-[11px] text-gray-500">
            {imgW} × {imgH} Pixel · {doc.regions.length} {doc.regions.length === 1 ? 'Bereich' : 'Bereiche'}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={undo} disabled={past.length === 0} title="Rückgängig (Cmd/Strg+Z)" className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} title="Wiederholen (Cmd/Strg+Umschalt+Z)" className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <Redo2 size={16} />
          </button>
          <span className="w-px h-6 bg-gray-200 mx-1" />
          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, +(z / 1.25).toFixed(2)))} title="Verkleinern" className="p-2 rounded-lg hover:bg-gray-100">
            <ZoomOut size={16} />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Ganzes Bild anzeigen" className="px-2 py-1 rounded-lg hover:bg-gray-100 text-xs font-mono w-14">
            {Math.round(displayScale * 100)} %
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(16, +(z * 1.25).toFixed(2)))} title="Vergrößern" className="p-2 rounded-lg hover:bg-gray-100">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Einpassen" className="p-2 rounded-lg hover:bg-gray-100">
            <Maximize size={16} />
          </button>
          <span className="w-px h-6 bg-gray-200 mx-1" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 bg-[#F5F5F7] hover:bg-gray-200 border border-gray-200"
          >
            <ImagePlus size={14} /> Anderes Bild
          </button>
          <button type="button" onClick={closeImage} title="Bild schließen" className="p-2 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Werkzeuge */}
        <div className="md:w-[76px] shrink-0 bg-white border-b md:border-b-0 md:border-r border-[#E8E8ED] p-1.5 flex md:flex-col items-center justify-center md:justify-start gap-1 overflow-x-auto md:overflow-y-auto">
          {TOOLS.map(toolButton)}
        </div>

        {/* Arbeitsfläche */}
        <div ref={stageRef} className="flex-1 min-w-0 overflow-auto bg-[#E8E8ED] relative">
          <div className="min-w-full min-h-full flex items-center justify-center p-6" style={{ width: displayW + 48, height: displayH + 48 }}>
            <div className="relative shadow-xl bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" style={{ width: displayW, height: displayH }}>
              <canvas ref={canvasRef} className="block w-full h-full" />
              <div
                ref={svgRef}
                className="absolute inset-0 touch-none"
                style={{ cursor }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${imgW} ${imgH}`} preserveAspectRatio="none">
                  {regions.map((r) => {
                    const isSel = r.id === selectedId;
                    const stroke = isSel ? '#0071E3' : 'rgba(255,255,255,0.9)';
                    const common = {
                      fill: 'none',
                      stroke,
                      strokeWidth: isSel ? 2 : 1.25,
                      strokeDasharray: isSel ? undefined : '5 4',
                      vectorEffect: 'non-scaling-stroke' as const,
                    };
                    const rot = r.shape === 'brush' ? 0 : r.rotation || 0;
                    const cx = r.x + r.w / 2;
                    const cy = r.y + r.h / 2;
                    return (
                      <g key={r.id} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
                        {r.shape === 'ellipse' ? (
                          <ellipse cx={cx} cy={cy} rx={r.w / 2} ry={r.h / 2} {...common} />
                        ) : r.shape === 'brush' ? (
                          <rect x={r.x} y={r.y} width={r.w} height={r.h} {...common} strokeDasharray="2 4" />
                        ) : (
                          <rect x={r.x} y={r.y} width={r.w} height={r.h} {...common} />
                        )}
                        {!isSel && (
                          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="5 4" strokeDashoffset={5} />
                        )}
                        {isSel && r.shape !== 'brush' && (
                          <>
                            <line x1={cx} y1={rotateHandleLocalY(r) < r.y ? r.y : r.y + r.h} x2={cx} y2={rotateHandleLocalY(r)} stroke="#0071E3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                            <circle cx={cx} cy={rotateHandleLocalY(r)} r={handleSize * 0.6} fill="#0071E3" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }}>
                              <title>Ziehen zum Drehen (Umschalttaste: 15°-Schritte)</title>
                            </circle>
                            {[
                              [r.x, r.y],
                              [r.x + r.w, r.y],
                              [r.x, r.y + r.h],
                              [r.x + r.w, r.y + r.h],
                            ].map(([hx, hy], i) => (
                              <rect
                                key={i}
                                x={hx - handleSize / 2}
                                y={hy - handleSize / 2}
                                width={handleSize}
                                height={handleSize}
                                fill="#fff"
                                stroke="#0071E3"
                                strokeWidth={1.5}
                                vectorEffect="non-scaling-stroke"
                              />
                            ))}
                          </>
                        )}
                      </g>
                    );
                  })}
                  {/* Entwurf beim Aufziehen */}
                  {drag?.kind === 'draw' && draftRect &&
                    (tool === 'ellipse' ? (
                      <ellipse cx={draftRect.x + draftRect.w / 2} cy={draftRect.y + draftRect.h / 2} rx={draftRect.w / 2} ry={draftRect.h / 2} fill="rgba(0,113,227,0.15)" stroke="#0071E3" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    ) : (
                      <rect x={draftRect.x} y={draftRect.y} width={draftRect.w} height={draftRect.h} fill="rgba(0,113,227,0.15)" stroke="#0071E3" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    ))}
                  {drag?.kind === 'brush' && (
                    <polyline
                      points={drag.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="rgba(0,113,227,0.45)"
                      strokeWidth={brushSize}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {/* Zuschnitt */}
                  {tool === 'crop' && shownCrop && (
                    <g>
                      <path
                        d={`M0 0H${imgW}V${imgH}H0Z M${shownCrop.x} ${shownCrop.y}V${shownCrop.y + shownCrop.h}H${shownCrop.x + shownCrop.w}V${shownCrop.y}Z`}
                        fill="rgba(0,0,0,0.5)"
                        fillRule="evenodd"
                      />
                      <rect x={shownCrop.x} y={shownCrop.y} width={shownCrop.w} height={shownCrop.h} fill="none" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>

          {tool === 'crop' && (
            <div className="sticky bottom-4 left-0 flex justify-center pointer-events-none">
              <div className="pointer-events-auto bg-white rounded-2xl shadow-lg border border-[#E8E8ED] px-4 py-2.5 flex items-center gap-3 text-xs">
                {cropRect ? (
                  <>
                    <span className="text-gray-600">
                      Ausschnitt {Math.round(cropRect.w)} × {Math.round(cropRect.h)} Pixel
                    </span>
                    <button type="button" onClick={applyCrop} className="px-3 py-1.5 bg-[#0071E3] text-white rounded-lg font-semibold">
                      Zuschneiden
                    </button>
                    <button type="button" onClick={() => setCropRect(null)} className="px-3 py-1.5 bg-gray-100 rounded-lg font-semibold">
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <span className="text-gray-600">Ziehe den Ausschnitt auf, der erhalten bleiben soll.</span>
                )}
              </div>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-sm font-semibold text-[#0071E3]">{busy}</div>
          )}
        </div>

        {/* Seitenleiste */}
        <aside className="w-full md:w-[300px] max-h-[45vh] md:max-h-none shrink-0 bg-white border-t md:border-t-0 md:border-l border-[#E8E8ED] overflow-y-auto p-4 space-y-5 text-sm">
          {/* Methode */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {selected ? 'Gewählter Bereich' : 'Methode für neue Bereiche'}
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(['fill', 'pixelate', 'blur', 'frosted'] as RedactMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activeMethod === m}
                  onClick={() => chooseMethod(m)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition ${
                    activeMethod === m ? 'border-[#0071E3] bg-blue-50 text-[#0071E3]' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {METHOD_ICONS[m]}
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            {activeMethod === 'fill' ? (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-1.5">Farbe</div>
                <div className="flex items-center gap-1.5">
                  {FILL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => chooseColor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${activeColor.toLowerCase() === c.toLowerCase() ? 'border-[#0071E3] scale-110' : 'border-gray-300'}`}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => chooseColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                    title="Eigene Farbe"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Stärke</span>
                  <span className="font-mono">{activeStrength}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={activeStrength}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStrength(v);
                    if (selected && doc) {
                      // Live-Vorschau ohne Verlaufseintrag pro Schritt
                      setLiveRegions(doc.regions.map((r) => (r.id === selected.id ? { ...r, strength: v } : r)));
                    }
                  }}
                  onPointerUp={(e) => {
                    if (selected) {
                      setLiveRegions(null);
                      chooseStrength(Number((e.target as HTMLInputElement).value));
                    }
                  }}
                  onKeyUp={(e) => {
                    if (selected) {
                      setLiveRegions(null);
                      chooseStrength(Number((e.target as HTMLInputElement).value));
                    }
                  }}
                  className="w-full accent-[#0071E3]"
                />
              </div>
            )}

            <div
              className={`mt-3 flex items-start gap-2 p-2.5 rounded-xl text-[11px] ${
                secure ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
              }`}
            >
              {secure ? <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600" /> : <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />}
              <span>
                {secure
                  ? 'Sicher: Der Inhalt lässt sich nicht wiederherstellen.'
                  : 'Nur optisch: Für Text, Nummern oder Gesichter die Stärke erhöhen oder „Farbbalken“ wählen.'}
              </span>
            </div>

            {(tool === 'brush' || selected?.shape === 'brush') && (
              <div className="mt-3">
                <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Pinselgröße</span>
                  <span className="font-mono">{Math.round(selected?.shape === 'brush' ? selected.brushSize || brushSize : brushSize)} px</span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={Math.max(60, Math.round(Math.min(imgW, imgH) / 4))}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-[#0071E3]"
                />
              </div>
            )}

            {selected && selected.shape !== 'brush' && (
              <div className="mt-3">
                <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Drehung</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono">{Math.round(selected.rotation || 0)}°</span>
                    {!!selected.rotation && (
                      <button type="button" title="Drehung zurücksetzen" onClick={() => updateSelected({ rotation: 0 })} className="p-0.5 rounded hover:bg-gray-100">
                        <RotateCcwSquare size={13} />
                      </button>
                    )}
                  </span>
                </label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={Math.round(selected.rotation || 0)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (doc) setLiveRegions(doc.regions.map((r) => (r.id === selected.id ? { ...r, rotation: v } : r)));
                  }}
                  onPointerUp={(e) => {
                    setLiveRegions(null);
                    updateSelected({ rotation: Number((e.target as HTMLInputElement).value) });
                  }}
                  onKeyUp={(e) => {
                    setLiveRegions(null);
                    updateSelected({ rotation: Number((e.target as HTMLInputElement).value) });
                  }}
                  className="w-full accent-[#0071E3]"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Oder am runden Griff über dem Bereich ziehen.</p>
              </div>
            )}

            {selected && selected.shape !== 'brush' && (
              <label className="mt-3 flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selected.inverted}
                  onChange={(e) => updateSelected({ inverted: e.target.checked })}
                  className="mt-0.5 accent-[#0071E3]"
                />
                <span>
                  <strong>Umkehren:</strong> alles <em>außerhalb</em> des Bereichs unkenntlich machen (z. B. Hintergrund weichzeichnen)
                </span>
              </label>
            )}

            {selected && (
              <button
                type="button"
                onClick={() => deleteRegion(selected.id)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100"
              >
                <Trash2 size={14} /> Bereich entfernen
              </button>
            )}
          </section>

          {/* Bereichsliste */}
          {doc.regions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Bereiche ({doc.regions.length})</h3>
                <button
                  type="button"
                  onClick={() => {
                    commit({ ...doc, regions: [] });
                    setSelectedId(null);
                  }}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  Alle entfernen
                </button>
              </div>
              <ul className="space-y-1">
                {doc.regions.map((r, i) => (
                  <li key={r.id}>
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                        r.id === selectedId ? 'bg-blue-50 text-[#0071E3]' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedId(r.id);
                        setTool('select');
                      }}
                    >
                      {METHOD_ICONS[r.method]}
                      <span className="flex-1">
                        {i + 1}. {METHOD_LABELS[r.method]}
                        <span className="text-gray-400">
                          {' '}
                          · {r.shape === 'rect' ? 'Rechteck' : r.shape === 'ellipse' ? 'Ellipse' : 'Pinsel'}
                          {r.inverted ? ' · umgekehrt' : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        title="Entfernen"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRegion(r.id);
                        }}
                        className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Bild */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Bild</h3>
            <div className="grid grid-cols-4 gap-1.5">
              <button type="button" title="Nach links drehen" onClick={() => applyTransform((b, r) => rotateImage(b, r, 'left'))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-center">
                <RotateCcw size={16} />
              </button>
              <button type="button" title="Nach rechts drehen" onClick={() => applyTransform((b, r) => rotateImage(b, r, 'right'))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-center">
                <RotateCw size={16} />
              </button>
              <button type="button" title="Horizontal spiegeln" onClick={() => applyTransform((b, r) => flipImage(b, r, 'horizontal'))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-center">
                <FlipHorizontal2 size={16} />
              </button>
              <button type="button" title="Vertikal spiegeln" onClick={() => applyTransform((b, r) => flipImage(b, r, 'vertical'))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-center">
                <FlipVertical2 size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Scaling size={14} className="text-gray-500 shrink-0" />
              <span className="text-xs text-gray-600">Breite</span>
              <input
                type="number"
                min={16}
                value={resizeWidth}
                onChange={(e) => setResizeWidth(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyResize()}
                className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs"
              />
              <span className="text-xs text-gray-400">px</span>
              <button type="button" onClick={applyResize} className="ml-auto px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold">
                Ändern
              </button>
            </div>
          </section>

          {/* Speichern */}
          <section className="pt-1 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 mt-3">Als Kopie speichern</h3>
            <label className="block text-xs text-gray-600 mb-1">Dateiname</label>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs mb-2"
            />
            <div className="flex gap-1.5 mb-2">
              {(['png', 'jpeg', 'webp'] as ExportFormat[])
                .filter((f) => f !== 'webp' || webpOk)
                .map((f) => (
                  <button
                    key={f}
                    type="button"
                    title={FORMAT_INFO[f].label}
                    aria-pressed={exportFormat === f}
                    onClick={() => setExportFormat(f)}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-semibold ${
                      exportFormat === f ? 'border-[#0071E3] bg-blue-50 text-[#0071E3]' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-2">{FORMAT_INFO[exportFormat].label}</p>
            {exportFormat !== 'png' && (
              <div className="mb-3">
                <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Qualität</span>
                  <span className="font-mono">{quality} %</span>
                </label>
                <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[#0071E3]" />
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold rounded-xl shadow-md disabled:opacity-50"
            >
              <Download size={16} /> Bild speichern
            </button>
            <div className="grid grid-cols-1 gap-1.5 mt-2">
              <button type="button" onClick={handleCopy} className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold">
                <Copy size={14} /> In die Zwischenablage kopieren
              </button>
              <button type="button" onClick={handleSavePdf} disabled={!!busy} className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold disabled:opacity-50">
                <FileText size={14} /> Als PDF speichern
              </button>
              <button type="button" onClick={handleSendToEditor} disabled={!!busy} className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold disabled:opacity-50">
                <FileText size={14} /> Im PDF-Editor weiterbearbeiten
              </button>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600 flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5 text-gray-500" />
              <span>
                Das Original bleibt unverändert. Die Kopie enthält keine versteckten Zusatzdaten
                {info.meta.hasExif ? (
                  <>
                    {' '}
                    – entfernt werden u. a.:{' '}
                    {[
                      info.meta.hasGps && 'GPS-Position',
                      info.meta.camera && `Kamera (${info.meta.camera})`,
                      info.meta.dateTime && 'Aufnahmezeit',
                      info.meta.hasThumbnail && 'eingebettete Vorschau',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Kameradaten'}
                    .
                  </>
                ) : (
                  '.'
                )}
              </span>
            </div>
            {info.meta.hasGps && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span>Das Originalfoto enthält den Aufnahmeort (GPS). Teile besser nur die gespeicherte Kopie.</span>
              </div>
            )}
          </section>
        </aside>
      </div>
      {toastEl}
    </div>
  );
};

export default ImageEditorView;
