import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brush, Circle, Download, Hand, LoaderCircle, Share, ShieldCheck, Square } from 'lucide-react';
import {
  canvasToBlob,
  formatBytes,
  formatFromType,
  getLastPdfRedactionMethod,
  loadImageFile,
  newRegionId,
  renderImage,
  setLastPdfRedactionMethod,
  suggestFileName,
  type ExportFormat,
  type ImageRegion,
  type LoadedImage,
} from '../lib/imageEngine';
import RegionCanvas, { type MobileTool } from './RegionCanvas';
import MethodPanel, { type MethodSettings } from './MethodPanel';
import { BottomSheet, EditorHeader, PrimaryButton, SecondaryButton, Toast, ToolButton } from './MobileUi';
import { canShareFile, downloadFile, shareFile, useHistory } from './mobileShared';

export default function MobileImageEditor({ file, onClose }: { file: File; onClose: () => void }) {
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const history = useHistory<ImageRegion[]>([]);
  const regions = history.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<MobileTool>('rect');
  const [defaults, setDefaults] = useState<MethodSettings>(() => ({ method: getLastPdfRedactionMethod(), strength: 70, color: '#000000' }));
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImg(null);
    setError(null);
    loadImageFile(file, file.name)
      .then((loaded) => !cancelled && setImg(loaded))
      .catch((err) => !cancelled && setError(err?.message || 'Das Bild konnte nicht geöffnet werden.'));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2200);
  };

  const selected = regions.find((r) => r.id === selectedId) || null;
  const settings: MethodSettings = selected ? { method: selected.method, strength: selected.strength, color: selected.color } : defaults;
  const brushSize = img ? Math.max(8, Math.round(Math.min(img.canvas.width, img.canvas.height) * 0.045)) : 20;

  const changeSettings = (patch: Partial<MethodSettings>) => {
    setDefaults((d) => ({ ...d, ...patch }));
    if (patch.method) setLastPdfRedactionMethod(patch.method);
    if (selected) {
      history.commitCoalesced(
        regions.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)),
        `${selected.id}:${Object.keys(patch).join(',')}`,
      );
    }
  };

  const createRegion = useCallback(
    (shape: ImageRegion['shape'], geom: { x: number; y: number; w: number; h: number; points?: ImageRegion['points'] }): ImageRegion => ({
      id: newRegionId(),
      shape,
      ...geom,
      brushSize: shape === 'brush' ? brushSize : undefined,
      method: defaults.method,
      strength: defaults.strength,
      color: defaults.color,
    }),
    [defaults, brushSize],
  );

  const close = () => {
    if (history.dirty && !window.confirm('Änderungen verwerfen? Das Bild wurde noch nicht gesichert.')) return;
    onClose();
  };

  const chooseTool = (t: MobileTool) => {
    setTool(t);
    if (t !== 'select') setSelectedId(null);
  };

  if (error || !img) {
    return (
      <div className="flex h-full flex-col">
        <EditorHeader title={file.name} onClose={onClose} onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} action={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-[#6E6E73]">
          {error ? (
            <>
              <p className="font-semibold text-[#FF3B30]">{error}</p>
              <SecondaryButton onClick={onClose}>Anderes Bild wählen</SecondaryButton>
            </>
          ) : (
            <>
              <LoaderCircle className="h-6 w-6 animate-spin text-[#0071E3]" />
              Bild wird geöffnet …
            </>
          )}
        </div>
      </div>
    );
  }

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
              setExportOpen(true);
            }}
            className="ml-1 rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white active:bg-[#0062C4]"
          >
            Sichern
          </button>
        }
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <RegionCanvas
          base={img.canvas}
          regions={regions}
          selectedId={selectedId}
          tool={tool}
          allowRotate
          brushSize={brushSize}
          createRegion={createRegion}
          onSelect={setSelectedId}
          onCommit={history.commit}
          viewKey={file.name + file.size}
        />
        {regions.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
            <div className="rounded-full bg-black/60 px-3.5 py-1.5 text-center text-xs font-medium text-white backdrop-blur">
              {tool === 'brush' ? 'Mit dem Finger über die Stelle malen' : 'Mit dem Finger einen Bereich aufziehen'} · Zoomen mit zwei Fingern
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom safe-x shrink-0 border-t border-black/5 bg-white px-3 pt-2">
        <div className="mb-2 flex gap-1">
          <ToolButton active={tool === 'rect'} onClick={() => chooseTool('rect')} icon={<Square className="h-5 w-5" />} label="Rechteck" />
          <ToolButton active={tool === 'ellipse'} onClick={() => chooseTool('ellipse')} icon={<Circle className="h-5 w-5" />} label="Ellipse" />
          <ToolButton active={tool === 'brush'} onClick={() => chooseTool('brush')} icon={<Brush className="h-5 w-5" />} label="Pinsel" />
          <ToolButton active={tool === 'select'} onClick={() => chooseTool('select')} icon={<Hand className="h-5 w-5" />} label="Auswählen" />
        </div>
        <MethodPanel
          settings={settings}
          onChange={changeSettings}
          editing={!!selected}
          rotation={selected && selected.shape !== 'brush' ? selected.rotation || 0 : undefined}
          onRotation={(deg) =>
            selected && history.commitCoalesced(regions.map((r) => (r.id === selected.id ? { ...r, rotation: deg } : r)), `${selected.id}:rotation`)
          }
          onDelete={() => {
            if (!selected) return;
            history.commit(regions.filter((r) => r.id !== selected.id));
            setSelectedId(null);
          }}
        />
      </div>

      {exportOpen && <ImageExportSheet img={img} regions={regions} onClose={() => setExportOpen(false)} onDone={(t: string) => {
            history.markSaved();
            showToast(t);
          }} />}
      <Toast text={toast} />
    </div>
  );
}

function ImageExportSheet({
  img,
  regions,
  onClose,
  onDone,
}: {
  img: LoadedImage;
  regions: ImageRegion[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>(() => (formatFromType(img.originalType, img.fileName) === 'png' ? 'png' : 'jpeg'));
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datei sofort erzeugen – das Teilen-Menü muss später direkt beim Antippen öffnen
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    const t = window.setTimeout(async () => {
      try {
        const full = renderImage(img.canvas, regions, 1);
        const blob = await canvasToBlob(full, format, 0.92);
        full.width = 0;
        full.height = 0;
        if (!cancelled) setResult(new File([blob], suggestFileName(img.fileName, format, 'unkenntlich'), { type: blob.type }));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Das Bild konnte nicht erzeugt werden.');
      }
    }, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [img, regions, format]);

  const shareable = useMemo(() => (result ? canShareFile(result) : false), [result]);

  return (
    <BottomSheet title="Bild sichern" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F5F5F7] p-1">
          {(['jpeg', 'png'] as ExportFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-lg py-2 text-sm font-semibold ${format === f ? 'bg-white shadow-sm' : 'text-[#6E6E73]'}`}
            >
              {f === 'jpeg' ? 'JPEG · kleiner' : 'PNG · verlustfrei'}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-[#E9F7EE] px-3 py-2.5 text-xs leading-snug text-[#1F6B3A]">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0" />
          <span>
            Gespeichert wird eine Kopie – das Original bleibt unverändert.
            {img.meta.hasGps
              ? ' Der Aufnahmeort (GPS) und die Kameradaten aus dem Foto werden entfernt.'
              : img.meta.hasExif
                ? ' Versteckte Kameradaten werden entfernt.'
                : ''}
          </span>
        </div>

        {regions.length === 0 && (
          <p className="rounded-xl bg-[#FFF4E5] px-3 py-2 text-xs text-[#8A5300]">Es ist noch kein Bereich markiert – das Bild wird unverändert gespeichert.</p>
        )}
        {error && <p className="text-sm font-semibold text-[#FF3B30]">{error}</p>}

        {shareable ? (
          <PrimaryButton
            busy={!result}
            onClick={async () => {
              if (!result) return;
              try {
                if (await shareFile(result)) {
                  onClose();
                  onDone('Bild weitergegeben');
                }
              } catch (err: any) {
                setError(err?.message || 'Teilen ist fehlgeschlagen.');
              }
            }}
          >
            <Share className="h-4 w-4" />
            Teilen oder in Fotos sichern
          </PrimaryButton>
        ) : null}
        <SecondaryButton
          disabled={!result}
          onClick={() => {
            if (!result) return;
            downloadFile(result);
            onClose();
            onDone('Bild wird heruntergeladen');
          }}
        >
          <Download className="h-4 w-4" />
          Herunterladen{result ? ` (${formatBytes(result.size)})` : ''}
        </SecondaryButton>
      </div>
    </BottomSheet>
  );
}
