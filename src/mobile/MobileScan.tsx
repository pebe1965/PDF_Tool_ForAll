import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Crop, EyeOff, ImagePlus, LoaderCircle, Maximize, RotateCw, ScanLine, Trash2, X } from 'lucide-react';
import CornerEditor from './CornerEditor';
import ShareSheet from './ShareSheet';
import { BottomSheet, SecondaryButton, Toast } from './MobileUi';
import { dateStamp, imagesToPdf, loadPhoto, pdfFile } from './pdfMobileOps';
import { detectDocument, fullQuad, processScan, SCAN_FILTERS, type Quad, type ScanFilter } from './scanEngine';

interface ScanPage {
  id: string;
  src: HTMLCanvasElement;
  quad: Quad;
  rotation: number;
}

let nextId = 1;
const newId = () => `s${Date.now().toString(36)}_${nextId++}`;
const quadKey = (q: Quad) => q.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(';');

/**
 * Dokument scannen: Seiten fotografieren, gerade ziehen, wie ein Scan aufbereiten und als PDF sichern.
 * onEditing meldet, ob gerade gescannt wird (dann blendet die App die Reiter aus).
 */
export default function MobileScan({ onEditing, onRedact }: { onEditing: (on: boolean) => void; onRedact: (file: File) => void }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [filter, setFilter] = useState<ScanFilter>('color');
  const [crop, setCrop] = useState<{ id: string; isNew: boolean; quad: Quad } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, { key: string; url: string }>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => onEditing(pages.length > 0 || !!crop || loading), [pages.length, crop, loading, onEditing]);

  // Vorschaubilder nacheinander berechnen
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const p of pages) {
        const key = `${quadKey(p.quad)}|${p.rotation}|${filter}`;
        if (thumbs[p.id]?.key === key) continue;
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled) return;
        const c = processScan(p.src, p.quad, p.rotation, filter, 640);
        const url = c.toDataURL('image/jpeg', 0.75);
        if (cancelled) return;
        setThumbs((t) => ({ ...t, [p.id]: { key, url } }));
        return; // nächster Durchlauf über das geänderte thumbs
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pages, filter, thumbs]);

  const addFiles = async (files: File[], fromCamera: boolean) => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const added: ScanPage[] = [];
      for (const f of files) {
        try {
          const src = await loadPhoto(f);
          const quad = detectDocument(src) || (fromCamera ? fullQuad(src.width, src.height, 0.05) : fullQuad(src.width, src.height));
          added.push({ id: newId(), src, quad, rotation: 0 });
        } catch (err: any) {
          showToast(err?.message || 'Ein Foto konnte nicht geöffnet werden.');
        }
      }
      if (added.length === 0) return;
      setPages((ps) => [...ps, ...added]);
      // Ein einzelnes Foto gleich zum Zuschneiden öffnen
      if (added.length === 1) setCrop({ id: added[0].id, isNew: true, quad: added[0].quad });
      else showToast(`${added.length} Seiten hinzugefügt – zum Anpassen antippen`);
    } finally {
      setLoading(false);
    }
  };

  const take = (fromCamera: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    addFiles(list, fromCamera);
  };

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={take(true)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={take(false)} />
    </>
  );

  const update = (id: string, patch: Partial<ScanPage>) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => setPages((ps) => ps.filter((p) => p.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setPages((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const closeAll = () => {
    if (pages.length > 0 && !window.confirm('Scan verwerfen? Die Seiten wurden noch nicht gesichert.')) return;
    setPages([]);
    setThumbs({});
    setCrop(null);
  };

  /* ---------- Startseite ---------- */
  if (pages.length === 0 && !loading) {
    return (
      <div className="safe-top safe-x h-full overflow-y-auto">
        <div className="mx-auto max-w-md px-5 pb-8 pt-8">
          <div className="mb-1 text-[13px] font-semibold text-[#0071E3]">Toolbox</div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Dokument scannen</h1>
          <p className="mt-2 text-[15px] leading-snug text-[#6E6E73]">
            Briefe, Rechnungen oder Formulare abfotografieren – die Seite wird gerade gezogen, aufgehellt und als PDF gesichert.
          </p>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-2xl bg-[#0071E3] p-4 text-left text-white shadow-sm active:bg-[#0062C4]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Camera className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-[16px] font-semibold">Seite fotografieren</span>
                <span className="block text-[13px] leading-snug text-white/80">Blatt auf einen dunklen Untergrund legen</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm active:bg-[#F0F0F2]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0071E3]/10 text-[#0071E3]">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-[16px] font-semibold">Aus Fotos wählen</span>
                <span className="block text-[13px] leading-snug text-[#6E6E73]">Auch mehrere Seiten auf einmal</span>
              </span>
            </button>
          </div>
          <div className="mt-6 space-y-2.5 text-[13px] leading-snug text-[#6E6E73]">
            <p className="flex gap-2.5">
              <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
              Die Ecken des Blatts werden automatisch gesucht. Du kannst sie mit dem Finger genau anpassen.
            </p>
            <p className="flex gap-2.5">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
              Danach kannst du den Scan direkt unkenntlich machen, bevor du ihn weitergibst.
            </p>
          </div>
          {inputs}
        </div>
      </div>
    );
  }

  /* ---------- Ecken anpassen ---------- */
  const cropPage = crop && pages.find((p) => p.id === crop.id);
  if (crop && cropPage) {
    const finish = () => {
      update(cropPage.id, { quad: crop.quad });
      setCrop(null);
    };
    const cancel = () => {
      if (crop.isNew) remove(cropPage.id);
      setCrop(null);
    };
    return (
      <div className="flex h-full flex-col bg-[#1C1C1E] text-white">
        <header className="safe-top safe-x shrink-0">
          <div className="flex h-12 items-center gap-1 px-2">
            <button type="button" onClick={cancel} className="rounded-full px-3 py-2 text-sm font-semibold active:bg-white/10">
              {crop.isNew ? 'Verwerfen' : 'Abbrechen'}
            </button>
            <div className="flex-1 text-center text-sm font-semibold">Ecken anpassen</div>
            <button type="button" onClick={finish} className="rounded-full bg-[#0A84FF] px-4 py-2 text-sm font-semibold active:bg-[#0071E3]">
              Übernehmen
            </button>
          </div>
        </header>
        <CornerEditor image={cropPage.src} quad={crop.quad} onChange={(q) => setCrop({ ...crop, quad: q })} />
        <div className="safe-bottom safe-x flex shrink-0 justify-center gap-3 px-4 pt-3">
          <button
            type="button"
            onClick={() => setCrop({ ...crop, quad: fullQuad(cropPage.src.width, cropPage.src.height) })}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold active:bg-white/20"
          >
            <Maximize className="h-4 w-4" />
            Ganzes Foto
          </button>
          <button
            type="button"
            onClick={() => {
              const q = detectDocument(cropPage.src);
              if (q) setCrop({ ...crop, quad: q });
              else showToast('Kein Blatt erkannt – bitte die Ecken selbst ziehen');
            }}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold active:bg-white/20"
          >
            <ScanLine className="h-4 w-4" />
            Automatisch
          </button>
        </div>
        <Toast text={toast} />
      </div>
    );
  }

  /* ---------- Seitenübersicht ---------- */
  const menuPage = menu ? pages.find((p) => p.id === menu) : null;
  const menuIndex = menuPage ? pages.indexOf(menuPage) : -1;

  return (
    <div className="flex h-full flex-col">
      <header className="safe-top safe-x shrink-0 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="flex h-12 items-center gap-1 px-2">
          <button type="button" onClick={closeAll} aria-label="Schließen" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
            Scan · {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'}
          </div>
          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => setExporting(true)}
            className="ml-1 rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white active:bg-[#0062C4] disabled:opacity-40"
          >
            PDF erstellen
          </button>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
          {SCAN_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f.id ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="safe-x min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7] px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {pages.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setMenu(p.id)} className="relative overflow-hidden rounded-xl bg-white p-1.5 shadow-sm active:scale-[0.98]">
              {thumbs[p.id] ? (
                <img src={thumbs[p.id].url} alt={`Seite ${i + 1}`} className="mx-auto max-h-56 w-auto object-contain" />
              ) : (
                <div className="flex h-40 items-center justify-center">
                  <LoaderCircle className="h-5 w-5 animate-spin text-[#0071E3]" />
                </div>
              )}
              <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{i + 1}</span>
            </button>
          ))}
          {loading && (
            <div className="flex h-40 items-center justify-center rounded-xl bg-white">
              <LoaderCircle className="h-5 w-5 animate-spin text-[#0071E3]" />
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-[#86868B]">Seite antippen zum Anpassen, Drehen, Verschieben oder Löschen.</p>
      </div>

      <div className="safe-bottom safe-x flex shrink-0 gap-2 border-t border-black/5 bg-white px-3 pt-2">
        <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0071E3]/10 py-3 text-sm font-semibold text-[#0071E3] active:bg-[#0071E3]/20">
          <Camera className="h-4 w-4" />
          Seite fotografieren
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F5F5F7] py-3 text-sm font-semibold text-[#1D1D1F] active:bg-[#E8E8ED]">
          <ImagePlus className="h-4 w-4" />
          Aus Fotos
        </button>
      </div>
      {inputs}

      {menuPage && (
        <BottomSheet title={`Seite ${menuIndex + 1}`} onClose={() => setMenu(null)}>
          <div className="grid grid-cols-2 gap-2">
            <MenuButton
              icon={<Crop className="h-5 w-5" />}
              label="Ecken anpassen"
              onClick={() => {
                setMenu(null);
                setCrop({ id: menuPage.id, isNew: false, quad: menuPage.quad });
              }}
            />
            <MenuButton icon={<RotateCw className="h-5 w-5" />} label="Drehen" onClick={() => update(menuPage.id, { rotation: (menuPage.rotation + 90) % 360 })} />
            <MenuButton icon={<ArrowLeft className="h-5 w-5" />} label="Nach vorn" disabled={menuIndex === 0} onClick={() => move(menuPage.id, -1)} />
            <MenuButton icon={<ArrowRight className="h-5 w-5" />} label="Nach hinten" disabled={menuIndex === pages.length - 1} onClick={() => move(menuPage.id, 1)} />
          </div>
          <div className="mt-3">
            <SecondaryButton
              onClick={() => {
                remove(menuPage.id);
                setMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4 text-[#FF3B30]" />
              <span className="text-[#FF3B30]">Seite löschen</span>
            </SecondaryButton>
          </div>
        </BottomSheet>
      )}

      {exporting && (
        <ShareSheet
          title="Scan als PDF"
          onClose={() => setExporting(false)}
          onDone={showToast}
          build={async () => {
            const canvases = [];
            for (const p of pages) {
              await new Promise((r) => setTimeout(r, 0));
              canvases.push(processScan(p.src, p.quad, p.rotation, filter, 2000));
            }
            const bytes = await imagesToPdf(canvases, 'page', filter === 'bw' ? 0.7 : 0.8);
            return [pdfFile(bytes, `Scan_${dateStamp()}.pdf`)];
          }}
          info={
            <p className="text-xs leading-snug text-[#6E6E73]">
              {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'} · Der Scan bleibt auf deinem Gerät, bis du ihn teilst.
            </p>
          }
          extra={(files) => (
            <SecondaryButton
              onClick={() => {
                setExporting(false);
                onRedact(files[0]);
              }}
            >
              <EyeOff className="h-4 w-4" />
              Vorher unkenntlich machen
            </SecondaryButton>
          )}
        />
      )}
      <Toast text={toast} />
    </div>
  );
}

function MenuButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl bg-[#F5F5F7] py-3 text-sm font-semibold text-[#1D1D1F] active:bg-[#E8E8ED] disabled:opacity-35"
    >
      <span className="text-[#0071E3]">{icon}</span>
      {label}
    </button>
  );
}
