import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Files, FileStack, LoaderCircle, Maximize2, Plus, RotateCw, Scissors, Trash2 } from 'lucide-react';
import PagePreview from './PagePreview';
import { rotateCanvas } from './scanEngine';
import ShareSheet from './ShareSheet';
import { BottomSheet, EditorHeader, Toast } from './MobileUi';
import { baseName, useHistory } from './mobileShared';
import { assemblePages, dateStamp, imagesToPdf, loadPhoto, openPdfJs, pageThumb, pdfFile, renderPage, type PageRef, type PdfJsDoc } from './pdfMobileOps';

interface PageItem extends PageRef {
  key: string;
}

interface Source {
  id: string;
  name: string;
  bytes: ArrayBuffer;
}

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}_${counter++}`;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

type SaveMode = 'all' | 'selection' | 'single';

/**
 * Seiten ordnen, PDFs und Fotos zusammenführen, Seiten herausziehen oder einzeln speichern.
 */
export default function MobilePages({ files, onClose }: { files: File[]; onClose: () => void }) {
  const sources = useRef(new Map<string, Source>());
  const history = useHistory<PageItem[]>([]);
  const pages = history.value;
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [saveMenu, setSaveMenu] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);
  // Geöffnete PDFs und scharfe Ansichten für die Vollbild-Vorschau
  const docs = useRef(new Map<string, Promise<PdfJsDoc>>());
  const sharp = useRef(new Map<string, string>());

  useEffect(
    () => () => {
      docs.current.forEach((d) => d.then((doc) => doc.destroy()).catch(() => {}));
    },
    [],
  );

  const renderSharp = async (i: number, width: number) => {
    const p = pages[i];
    const cacheKey = `${p.source}:${p.index}:${p.rotation}:${width}`;
    const hit = sharp.current.get(cacheKey);
    if (hit) return hit;
    let doc = docs.current.get(p.source);
    if (!doc) {
      doc = openPdfJs(sources.current.get(p.source)!.bytes);
      docs.current.set(p.source, doc);
    }
    const c = await renderPage(await doc, p.index + 1, width);
    const rotated = rotateCanvas(c, p.rotation);
    const url = rotated.toDataURL('image/jpeg', 0.88);
    c.width = c.height = 0;
    rotated.width = rotated.height = 0;
    // Nur die letzten Ansichten behalten (Speicher am Handy ist knapp)
    if (sharp.current.size >= 8) sharp.current.delete(sharp.current.keys().next().value!);
    sharp.current.set(cacheKey, url);
    return url;
  };

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2800);
  };

  const addFiles = async (list: File[], base: PageItem[]) => {
    let current = base;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setLoading(list.length > 1 ? `Lade ${i + 1} von ${list.length} …` : 'Wird geladen …');
      try {
        let bytes: ArrayBuffer;
        if (isPdf(f)) bytes = await f.arrayBuffer();
        else {
          const c = await loadPhoto(f, 2400);
          bytes = (await imagesToPdf([c], 'a4')).buffer as ArrayBuffer;
        }
        const doc = await openPdfJs(bytes);
        const src: Source = { id: uid('src'), name: f.name, bytes };
        sources.current.set(src.id, src);
        const added: PageItem[] = [];
        for (let p = 0; p < doc.numPages; p++) added.push({ key: uid('pg'), source: src.id, index: p, rotation: 0 });
        current = [...current, ...added];
        history.commit(current);
        // Vorschaubilder nach und nach
        for (let p = 0; p < added.length; p++) {
          try {
            const url = await pageThumb(doc, p + 1, 360);
            setThumbs((t) => ({ ...t, [added[p].key]: url }));
          } catch {
            /* Vorschau fehlt – Seite bleibt trotzdem nutzbar */
          }
        }
        doc.destroy();
      } catch (err: any) {
        showToast(`${f.name}: ${err?.message || 'konnte nicht geöffnet werden'}`);
      }
    }
    setLoading(null);
    return current;
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    addFiles(files, []).then((result) => {
      if (result.length > 0) history.reset(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const moveSelected = (dir: -1 | 1) => {
    const arr = [...pages];
    const idxs = arr.map((p, i) => (selected.has(p.key) ? i : -1)).filter((i) => i >= 0);
    if (dir === -1) {
      if (idxs[0] === 0) return;
      for (const i of idxs) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    } else {
      if (idxs[idxs.length - 1] === arr.length - 1) return;
      for (const i of [...idxs].reverse()) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    }
    history.commit(arr);
  };

  const rotateSelected = () => history.commit(pages.map((p) => (selected.has(p.key) ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));

  const deleteSelected = () => {
    if (selected.size === pages.length) {
      showToast('Mindestens eine Seite muss bleiben');
      return;
    }
    history.commit(pages.filter((p) => !selected.has(p.key)));
    setSelected(new Set());
  };

  const close = () => {
    if (history.dirty && !window.confirm('Änderungen verwerfen? Es wurde noch nichts gesichert.')) return;
    onClose();
  };

  const sourceMap = () => new Map([...sources.current.values()].map((s) => [s.id, s.bytes]));
  const firstName = baseName(sources.current.values().next().value?.name || 'Dokument');
  const multipleSources = new Set(pages.map((p) => p.source)).size > 1;
  const chosen = pages.filter((p) => selected.has(p.key));

  const build = async (mode: SaveMode): Promise<File[]> => {
    const map = sourceMap();
    if (mode === 'single') {
      const out: File[] = [];
      for (let i = 0; i < pages.length; i++) {
        out.push(pdfFile(await assemblePages(map, [pages[i]]), `${firstName}_Seite_${i + 1}.pdf`));
      }
      return out;
    }
    const list = mode === 'selection' ? chosen : pages;
    const name = mode === 'selection' ? `${firstName}_Auswahl.pdf` : multipleSources ? `Zusammengefuehrt_${dateStamp()}.pdf` : `${firstName}_neu.pdf`;
    return [pdfFile(await assemblePages(map, list), name)];
  };

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        title={`Seiten · ${pages.length}`}
        onClose={close}
        onUndo={() => {
          history.undo();
          setSelected(new Set());
        }}
        onRedo={() => {
          history.redo();
          setSelected(new Set());
        }}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        action={
          <button
            type="button"
            disabled={pages.length === 0 || !!loading}
            onClick={() => setSaveMenu(true)}
            className="ml-1 rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white active:bg-[#0062C4] disabled:opacity-40"
          >
            Sichern
          </button>
        }
      />

      <div className="safe-x min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7] px-3 py-3">
        <div className="grid grid-cols-3 gap-2.5">
          {pages.map((p, i) => {
            const on = selected.has(p.key);
            return (
              <div
                key={p.key}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                onClick={() => toggle(p.key)}
                className={`relative flex aspect-[3/4] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ${on ? 'ring-[3px] ring-[#0071E3]' : ''}`}
              >
                {thumbs[p.key] ? (
                  <img
                    src={thumbs[p.key]}
                    alt={`Seite ${i + 1}`}
                    className="max-h-full max-w-full object-contain transition-transform"
                    style={{ transform: `rotate(${p.rotation}deg)` }}
                  />
                ) : (
                  <LoaderCircle className="h-5 w-5 animate-spin text-[#0071E3]" />
                )}
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}</span>
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0071E3]">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Seite ${i + 1} groß ansehen`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreview(i);
                  }}
                  className="absolute bottom-0 right-0 flex h-11 w-11 items-end justify-end p-1.5"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#6E6E73]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0071E3]" />
            {loading}
          </div>
        )}
        {!loading && pages.length > 0 && selected.size === 0 && (
          <p className="mt-4 text-center text-xs text-[#86868B]">Seiten antippen, um sie zu verschieben, zu drehen, zu löschen oder einzeln zu speichern. Mit dem Knopf unten rechts eine Seite groß ansehen und zoomen.</p>
        )}
      </div>

      <div className="safe-bottom safe-x shrink-0 border-t border-black/5 bg-white px-3 pt-2">
        {selected.size > 0 ? (
          <>
            <div className="mb-1.5 flex items-center justify-between px-1 text-xs">
              <span className="font-semibold text-[#1D1D1F]">{selected.size} ausgewählt</span>
              <button type="button" onClick={() => setSelected(selected.size === pages.length ? new Set() : new Set(pages.map((p) => p.key)))} className="font-semibold text-[#0071E3]">
                {selected.size === pages.length ? 'Keine' : 'Alle'} auswählen
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <Bar icon={<ArrowLeft className="h-5 w-5" />} label="Nach vorn" onClick={() => moveSelected(-1)} />
              <Bar icon={<ArrowRight className="h-5 w-5" />} label="Nach hinten" onClick={() => moveSelected(1)} />
              <Bar icon={<RotateCw className="h-5 w-5" />} label="Drehen" onClick={rotateSelected} />
              <Bar icon={<Trash2 className="h-5 w-5" />} label="Löschen" onClick={deleteSelected} danger />
            </div>
          </>
        ) : (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => addRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0071E3]/10 py-3 text-sm font-semibold text-[#0071E3] active:bg-[#0071E3]/20 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            PDF oder Foto hinzufügen
          </button>
        )}
        <input
          ref={addRef}
          type="file"
          multiple
          accept="application/pdf,.pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files || []);
            e.target.value = '';
            if (list.length) addFiles(list, pages);
          }}
        />
      </div>

      {preview !== null && pages[preview] && (
        <PagePreview
          count={pages.length}
          index={preview}
          onIndex={setPreview}
          render={renderSharp}
          thumb={thumbs[pages[preview].key]}
          thumbRotation={pages[preview].rotation}
          selected={selected.has(pages[preview].key)}
          onToggleSelect={() => toggle(pages[preview].key)}
          onRotate={() => {
            const key = pages[preview].key;
            history.commit(pages.map((p) => (p.key === key ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
          }}
          onClose={() => setPreview(null)}
        />
      )}

      {saveMenu && (
        <BottomSheet title="Sichern" onClose={() => setSaveMenu(false)}>
          <div className="space-y-2">
            <SaveOption
              icon={<FileStack className="h-5 w-5" />}
              title={multipleSources ? 'Alles als ein PDF' : 'Als neues PDF'}
              text={`${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'} in dieser Reihenfolge`}
              onClick={() => {
                setSaveMenu(false);
                setSaveMode('all');
              }}
            />
            {chosen.length > 0 && chosen.length < pages.length && (
              <SaveOption
                icon={<Scissors className="h-5 w-5" />}
                title="Nur ausgewählte Seiten"
                text={`${chosen.length} ${chosen.length === 1 ? 'Seite' : 'Seiten'} als eigenes PDF`}
                onClick={() => {
                  setSaveMenu(false);
                  setSaveMode('selection');
                }}
              />
            )}
            {pages.length > 1 && (
              <SaveOption
                icon={<Files className="h-5 w-5" />}
                title="Jede Seite einzeln"
                text={`${pages.length} PDFs mit je einer Seite`}
                onClick={() => {
                  setSaveMenu(false);
                  setSaveMode('single');
                }}
              />
            )}
          </div>
        </BottomSheet>
      )}

      {saveMode && (
        <ShareSheet
          title={saveMode === 'single' ? 'Einzelne Seiten' : saveMode === 'selection' ? 'Ausgewählte Seiten' : 'Neues PDF'}
          build={() => build(saveMode)}
          onClose={() => setSaveMode(null)}
          onDone={(t: string) => {
            history.markSaved();
            showToast(t);
          }}
          info={<p className="text-xs leading-snug text-[#6E6E73]">Die Originaldateien bleiben unverändert. Gespeichert wird eine Kopie.</p>}
        />
      )}
      <Toast text={toast} />
    </div>
  );
}

function Bar({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold active:bg-black/5 ${danger ? 'text-[#FF3B30]' : 'text-[#0071E3]'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function SaveOption({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl bg-[#F5F5F7] p-3 text-left active:bg-[#E8E8ED]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#0071E3]">{icon}</span>
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-xs text-[#6E6E73]">{text}</span>
      </span>
    </button>
  );
}

