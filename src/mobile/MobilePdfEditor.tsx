import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, Hand, LoaderCircle, Search, Share, ShieldCheck, SquareDashed } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../lib/pdfWorker';
import {
  formatBytes,
  getLastPdfRedactionMethod,
  newRegionId,
  pdfRedactionRegion,
  setLastPdfRedactionMethod,
  type ImageRegion,
} from '../lib/imageEngine';
import { burnRedactionsIntoPdf, type PdfRedaction } from '../lib/pdfRedact';
import { pdfHasText, searchPdfText, SEARCH_PRESETS, type SearchPreset, type TextMatch } from '../lib/pdfTextSearch';
import RegionCanvas, { type MobileTool } from './RegionCanvas';
import MethodPanel, { type MethodSettings } from './MethodPanel';
import { BottomSheet, EditorHeader, PrimaryButton, SecondaryButton, Toast, ToolButton } from './MobileUi';
import { baseName, canShareFile, downloadFile, shareFile, useHistory } from './mobileShared';

type PdfDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

/** Breite der gerasterten Seite in Pixeln – scharf genug zum Zoomen, sparsam im Speicher */
const PAGE_RENDER_WIDTH = 1600;

export default function MobilePdfEditor({ file, onClose }: { file: File; onClose: () => void }) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [page, setPage] = useState<{ num: number; canvas: HTMLCanvasElement } | null>(null);
  const history = useHistory<PdfRedaction[]>([]);
  const redactions = history.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<MobileTool>('rect');
  const [defaults, setDefaults] = useState<MethodSettings>(() => ({ method: getLastPdfRedactionMethod(), strength: 70, color: '#000000' }));
  const [sheet, setSheet] = useState<'search' | 'export' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  };

  // PDF öffnen
  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
        loaded = pdf;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        setBytes(buf);
        setDoc(pdf);
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.name === 'PasswordException'
            ? 'Dieses PDF ist mit einem Passwort geschützt und kann hier nicht bearbeitet werden.'
            : 'Das PDF konnte nicht geöffnet werden. Ist die Datei beschädigt?',
        );
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [file]);

  // Aktuelle Seite rastern
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const p = await doc.getPage(pageNum);
        const vp1 = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({ scale: PAGE_RENDER_WIDTH / vp1.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const rt = p.render({ canvasContext: ctx, viewport });
        task = rt;
        await rt.promise;
        if (!cancelled) setPage({ num: pageNum, canvas });
      } catch (err: any) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') setError('Die Seite konnte nicht angezeigt werden.');
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNum]);

  const W = page?.canvas.width || 1;
  const H = page?.canvas.height || 1;

  // Schwärzungen der aktuellen Seite als Bereiche in Pixeln
  const pageRegions = useMemo<ImageRegion[]>(
    () => (page ? redactions.filter((r) => r.pageNumber === page.num).map((r) => pdfRedactionRegion(r, W, H)) : []),
    [redactions, page, W, H],
  );

  const toRedactions = useCallback(
    (regions: ImageRegion[], num: number): PdfRedaction[] =>
      regions.map((r) => ({
        id: r.id,
        pageNumber: num,
        x: Math.max(0, r.x / W),
        y: Math.max(0, r.y / H),
        width: Math.min(1, r.w / W),
        height: Math.min(1, r.h / H),
        method: r.method,
        strength: r.strength,
        color: r.color,
      })),
    [W, H],
  );

  const commitPage = (regions: ImageRegion[]) => {
    if (!page) return;
    history.commit([...redactions.filter((r) => r.pageNumber !== page.num), ...toRedactions(regions, page.num)]);
  };

  const selected = redactions.find((r) => r.id === selectedId) || null;
  const settings: MethodSettings = selected
    ? { method: selected.method || 'fill', strength: selected.strength ?? 70, color: selected.color || '#000000' }
    : defaults;

  const changeSettings = (patch: Partial<MethodSettings>) => {
    setDefaults((d) => ({ ...d, ...patch }));
    if (patch.method) setLastPdfRedactionMethod(patch.method);
    if (selected) {
      history.commitCoalesced(
        redactions.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)),
        `${selected.id}:${Object.keys(patch).join(',')}`,
      );
    }
  };

  const createRegion = useCallback(
    (_shape: ImageRegion['shape'], geom: { x: number; y: number; w: number; h: number }): ImageRegion => ({
      id: newRegionId(),
      shape: 'rect',
      x: geom.x,
      y: geom.y,
      w: geom.w,
      h: geom.h,
      method: defaults.method,
      strength: defaults.strength,
      color: defaults.color,
    }),
    [defaults],
  );

  const goTo = (n: number) => {
    if (!doc) return;
    const next = Math.min(doc.numPages, Math.max(1, n));
    if (next !== pageNum) {
      setSelectedId(null);
      setPageNum(next);
    }
  };

  const close = () => {
    if (history.dirty && !window.confirm('Änderungen verwerfen? Das PDF wurde noch nicht gesichert.')) return;
    onClose();
  };

  const addMatches = (matches: TextMatch[]) => {
    const existing = new Set(redactions.map((r) => `${r.pageNumber}:${r.x.toFixed(4)}:${r.y.toFixed(4)}`));
    const added: PdfRedaction[] = [];
    for (const m of matches) {
      for (const b of m.boxes) {
        const key = `${m.pageNumber}:${b.x.toFixed(4)}:${b.y.toFixed(4)}`;
        if (existing.has(key)) continue;
        existing.add(key);
        added.push({ id: newRegionId(), pageNumber: m.pageNumber, ...b, method: defaults.method, strength: defaults.strength, color: defaults.color });
      }
    }
    if (added.length === 0) {
      showToast('Diese Stellen sind schon markiert');
      return;
    }
    history.commit([...redactions, ...added]);
    setSelectedId(null);
    goTo(Math.min(...added.map((a) => a.pageNumber)));
    showToast(`${added.length} ${added.length === 1 ? 'Stelle' : 'Stellen'} markiert – bitte kurz prüfen`);
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

  const otherPagesCount = new Set(redactions.filter((r) => r.pageNumber !== pageNum).map((r) => r.pageNumber)).size;

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

      {/* Seitenleiste */}
      <div className="safe-x flex shrink-0 items-center gap-2 border-b border-black/5 bg-white px-2 py-1.5">
        <button type="button" onClick={() => goTo(pageNum - 1)} disabled={pageNum <= 1} aria-label="Vorherige Seite" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 whitespace-nowrap text-center text-sm font-medium tabular-nums">
          Seite {pageNum} von {doc.numPages}
          {otherPagesCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#0071E3]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#0071E3]" title="Weitere Seiten mit Markierungen">
              +{otherPagesCount}
            </span>
          )}
        </div>
        <button type="button" onClick={() => goTo(pageNum + 1)} disabled={pageNum >= doc.numPages} aria-label="Nächste Seite" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setSheet('search')} className="flex items-center gap-1.5 rounded-full bg-[#F5F5F7] px-3 py-2 text-sm font-semibold text-[#0071E3] active:bg-[#E8E8ED]">
          <Search className="h-4 w-4" />
          Suchen
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {page && page.num === pageNum ? (
          <RegionCanvas
            base={page.canvas}
            regions={pageRegions}
            selectedId={selectedId}
            tool={tool}
            allowRotate={false}
            brushSize={20}
            createRegion={createRegion}
            onSelect={setSelectedId}
            onCommit={commitPage}
            viewKey={`p${page.num}`}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#E8E8ED]">
            <LoaderCircle className="h-6 w-6 animate-spin text-[#0071E3]" />
          </div>
        )}
        {redactions.length === 0 && page && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
            <div className="rounded-full bg-black/60 px-3.5 py-1.5 text-center text-xs font-medium text-white backdrop-blur">
              Über die Textstelle ziehen – oder oben „Suchen“
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom safe-x shrink-0 border-t border-black/5 bg-white px-3 pt-2">
        <div className="mb-2 flex gap-1">
          <ToolButton
            active={tool === 'rect'}
            onClick={() => {
              setTool('rect');
              setSelectedId(null);
            }}
            icon={<SquareDashed className="h-5 w-5" />}
            label="Markieren"
          />
          <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={<Hand className="h-5 w-5" />} label="Auswählen & Verschieben" />
        </div>
        <MethodPanel
          settings={settings}
          onChange={changeSettings}
          editing={!!selected}
          onDelete={() => {
            if (!selected) return;
            history.commit(redactions.filter((r) => r.id !== selected.id));
            setSelectedId(null);
          }}
        />
      </div>

      {sheet === 'search' && <SearchSheet doc={doc} onClose={() => setSheet(null)} onApply={(m) => { setSheet(null); addMatches(m); }} />}
      {sheet === 'export' && bytes && (
        <PdfExportSheet bytes={bytes} fileName={file.name} redactions={redactions} onClose={() => setSheet(null)} onDone={(t: string) => {
            history.markSaved();
            showToast(t);
          }} />
      )}
      <Toast text={toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text suchen und schwärzen                                           */
/* ------------------------------------------------------------------ */

function SearchSheet({ doc, onClose, onApply }: { doc: PdfDoc; onClose: () => void; onApply: (matches: TextMatch[]) => void }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<TextMatch[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hasText, setHasText] = useState<boolean | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    pdfHasText(doc).then(setHasText).catch(() => setHasText(true));
  }, [doc]);

  const run = async (q: string | SearchPreset) => {
    const id = ++runId.current;
    setBusy('Suche …');
    setResults(null);
    try {
      const found = await searchPdfText(doc, q, (p, total) => id === runId.current && total > 3 && setBusy(`Suche … Seite ${p} von ${total}`));
      if (id !== runId.current) return;
      setResults(found);
      setChecked(new Set(found.map((m) => m.id)));
    } finally {
      if (id === runId.current) setBusy(null);
    }
  };

  const chosen = results?.filter((m) => checked.has(m.id)) || [];

  return (
    <BottomSheet title="Text suchen und unkenntlich machen" onClose={onClose}>
      <div className="space-y-3">
        {hasText === false && (
          <p className="rounded-xl bg-[#FFF4E5] px-3 py-2.5 text-xs leading-snug text-[#8A5300]">
            Dieses PDF enthält keinen auswählbaren Text (z. B. ein eingescanntes Dokument). Die Suche findet hier nichts – bitte die Stellen mit dem Finger markieren.
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) run(query);
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Nummer, Begriff …"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-xl bg-[#F5F5F7] px-3.5 py-3 text-[16px] outline-none focus:ring-2 focus:ring-[#0071E3]"
          />
          <button type="submit" disabled={!query.trim()} className="rounded-xl bg-[#0071E3] px-4 text-sm font-semibold text-white disabled:opacity-40">
            Suchen
          </button>
        </form>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">Oder automatisch finden</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SEARCH_PRESETS) as SearchPreset[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setQuery('');
                  run(k);
                }}
                className="rounded-full bg-[#F5F5F7] px-3.5 py-2 text-sm font-semibold text-[#1D1D1F] active:bg-[#E8E8ED]"
              >
                {SEARCH_PRESETS[k].label}
              </button>
            ))}
          </div>
        </div>

        {busy && (
          <div className="flex items-center gap-2 py-2 text-sm text-[#6E6E73]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0071E3]" />
            {busy}
          </div>
        )}

        {results && results.length === 0 && <p className="py-2 text-sm text-[#6E6E73]">Nichts gefunden.</p>}

        {results && results.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold">
                {results.length} {results.length === 1 ? 'Fundstelle' : 'Fundstellen'}
              </span>
              <button
                type="button"
                onClick={() => setChecked(chosen.length === results.length ? new Set() : new Set(results.map((m) => m.id)))}
                className="text-sm font-semibold text-[#0071E3]"
              >
                {chosen.length === results.length ? 'Keine' : 'Alle'} auswählen
              </button>
            </div>
            <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5">
              {results.map((m) => {
                const on = checked.has(m.id);
                const [pre, rest] = m.context.split('[[');
                const [hit, post] = (rest || '').split(']]');
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(checked);
                        if (on) next.delete(m.id);
                        else next.add(m.id);
                        setChecked(next);
                      }}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left active:bg-black/5"
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-[#0071E3] bg-[#0071E3]' : 'border-[#C7C7CC]'}`}>
                        {on && <Check className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-[#86868B]">Seite {m.pageNumber}</span>
                        <span className="block break-words text-[13px] leading-snug text-[#3A3A3C]">
                          {pre}
                          <mark className="rounded bg-[#FFE58F] px-0.5 font-semibold text-[#1D1D1F]">{hit}</mark>
                          {post}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="sticky bottom-0 -mx-4 bg-white px-4 pb-1 pt-2">
              <PrimaryButton disabled={chosen.length === 0} onClick={() => onApply(chosen)}>
                {chosen.length} {chosen.length === 1 ? 'Stelle' : 'Stellen'} unkenntlich machen
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Sichern                                                             */
/* ------------------------------------------------------------------ */

function PdfExportSheet({
  bytes,
  fileName,
  redactions,
  onClose,
  onDone,
}: {
  bytes: ArrayBuffer;
  fileName: string;
  redactions: PdfRedaction[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pages = new Set(redactions.map((r) => r.pageNumber)).size;

  // PDF sofort erzeugen – das Teilen-Menü muss später direkt beim Antippen öffnen
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfDoc = await PDFDocument.load(bytes.slice(0));
        await burnRedactionsIntoPdf(pdfDoc, bytes, redactions);
        const out = await pdfDoc.save();
        if (!cancelled) setResult(new File([out as Uint8Array<ArrayBuffer>], `${baseName(fileName)}_geschwaerzt.pdf`, { type: 'application/pdf' }));
      } catch (err: any) {
        console.error(err);
        if (!cancelled)
          setError(
            /encrypt/i.test(String(err?.message))
              ? 'Dieses PDF ist verschlüsselt und kann nicht verändert werden.'
              : 'Das PDF konnte nicht erzeugt werden. Es wurde nichts gespeichert.',
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, fileName, redactions]);

  const shareable = useMemo(() => (result ? canShareFile(result) : false), [result]);

  return (
    <BottomSheet title="PDF sichern" onClose={onClose}>
      <div className="space-y-3">
        {redactions.length > 0 ? (
          <div className="flex items-start gap-2 rounded-xl bg-[#E9F7EE] px-3 py-2.5 text-xs leading-snug text-[#1F6B3A]">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0" />
            <span>
              {redactions.length} {redactions.length === 1 ? 'Bereich' : 'Bereiche'} auf {pages} {pages === 1 ? 'Seite' : 'Seiten'} werden fest eingebrannt. Der
              Text darunter wird aus dem PDF entfernt und lässt sich weder kopieren noch durchsuchen. Gespeichert wird eine Kopie.
            </span>
          </div>
        ) : (
          <p className="rounded-xl bg-[#FFF4E5] px-3 py-2 text-xs text-[#8A5300]">Es ist noch nichts markiert – das PDF wird unverändert gespeichert.</p>
        )}
        {!result && !error && (
          <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0071E3]" />
            PDF wird erzeugt …
          </div>
        )}
        {error && <p className="text-sm font-semibold text-[#FF3B30]">{error}</p>}
        {shareable && (
          <PrimaryButton
            onClick={async () => {
              if (!result) return;
              try {
                if (await shareFile(result)) {
                  onClose();
                  onDone('PDF weitergegeben');
                }
              } catch (err: any) {
                setError(err?.message || 'Teilen ist fehlgeschlagen.');
              }
            }}
          >
            <Share className="h-4 w-4" />
            Teilen oder in Dateien sichern
          </PrimaryButton>
        )}
        <SecondaryButton
          disabled={!result}
          onClick={() => {
            if (!result) return;
            downloadFile(result);
            onClose();
            onDone('PDF wird heruntergeladen');
          }}
        >
          <Download className="h-4 w-4" />
          Herunterladen{result ? ` (${formatBytes(result.size)})` : ''}
        </SecondaryButton>
      </div>
    </BottomSheet>
  );
}
