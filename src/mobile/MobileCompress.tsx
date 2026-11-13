import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Minimize2 } from 'lucide-react';
import { compressPdfBuffer } from '../lib/pdfEngine';
import { formatBytes } from '../lib/imageEngine';
import ShareSheet from './ShareSheet';
import { EditorHeader, PrimaryButton, SecondaryButton, Toast } from './MobileUi';
import { baseName } from './mobileShared';
import { openPdfJs, pdfFile } from './pdfMobileOps';

type Level = 'compact' | 'balanced' | 'high';

const LEVELS: { id: Level; title: string; text: string }[] = [
  { id: 'compact', title: 'Klein', text: 'Für E-Mail und Upload-Formulare – gut lesbar am Bildschirm' },
  { id: 'balanced', title: 'Mittel', text: 'Ausgewogen – auch zum Ausdrucken meist gut' },
  { id: 'high', title: 'Hohe Qualität', text: 'Nur wenig kleiner, dafür sehr scharf' },
];

/** PDF verkleinern (Seiten werden neu als Bild aufgebaut). */
export default function MobileCompress({ file, onClose }: { file: File; onClose: () => void }) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>('compact');
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ level: Level; file: File } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await openPdfJs(buf);
        if (cancelled) return doc.destroy();
        setPageCount(doc.numPages);
        doc.destroy();
        setBytes(buf);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Das PDF konnte nicht geöffnet werden.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const run = async () => {
    if (!bytes) return;
    setResult(null);
    setProgress('Wird verkleinert …');
    try {
      const out = await compressPdfBuffer(bytes, level, (p, total) => setProgress(`Seite ${p} von ${total} …`));
      setResult({ level, file: pdfFile(out, `${baseName(file.name)}_klein.pdf`) });
    } catch (err: any) {
      console.error(err);
      setError('Das PDF konnte nicht verkleinert werden.');
    } finally {
      setProgress(null);
    }
  };

  const original = file.size;
  const saved = result ? 1 - result.file.size / original : 0;
  const notSmaller = !!result && result.file.size >= original * 0.97;

  return (
    <div className="flex h-full flex-col">
      <EditorHeader title={file.name} onClose={onClose} onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} action={null} />
      <div className="safe-x min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7]">
        <div className="mx-auto max-w-md space-y-4 px-5 py-6">
          {error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm font-semibold text-[#FF3B30]">{error}</p>
              <SecondaryButton onClick={onClose}>Anderes PDF wählen</SecondaryButton>
            </div>
          ) : !bytes ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#6E6E73]">
              <LoaderCircle className="h-5 w-5 animate-spin text-[#0071E3]" />
              PDF wird geöffnet …
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Jetzt</div>
                <div className="mt-0.5 text-2xl font-bold">{formatBytes(original)}</div>
                <div className="text-sm text-[#6E6E73]">
                  {pageCount} {pageCount === 1 ? 'Seite' : 'Seiten'}
                </div>
              </div>

              <div className="space-y-2">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLevel(l.id);
                      setResult(null);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl bg-white p-3.5 text-left shadow-sm ${level === l.id ? 'ring-2 ring-[#0071E3]' : ''}`}
                  >
                    <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${level === l.id ? 'border-[6px] border-[#0071E3]' : 'border-[#C7C7CC]'}`} />
                    <span>
                      <span className="block text-[15px] font-semibold">{l.title}</span>
                      <span className="block text-xs leading-snug text-[#6E6E73]">{l.text}</span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="flex gap-2 text-xs leading-snug text-[#6E6E73]">
                <CircleAlert className="mt-px h-4 w-4 shrink-0 text-[#FF9500]" />
                Beim Verkleinern werden die Seiten als Bild neu aufgebaut. Text lässt sich danach nicht mehr markieren oder durchsuchen, Formularfelder und Links
                fallen weg.
              </p>

              {!result && (
                <PrimaryButton onClick={run} busy={!!progress}>
                  {progress || (
                    <>
                      <Minimize2 className="h-4 w-4" />
                      Verkleinern
                    </>
                  )}
                </PrimaryButton>
              )}

              {result && (
                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  {notSmaller ? (
                    <p className="text-sm leading-snug text-[#8A5300]">
                      Dieses PDF ist schon sehr kompakt – verkleinert wäre es {formatBytes(result.file.size)} groß. Behalte am besten das Original oder probiere
                      „Klein“.
                    </p>
                  ) : (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Verkleinert</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#1F6B3A]">{formatBytes(result.file.size)}</span>
                        <span className="text-sm font-semibold text-[#34C759]">−{Math.round(saved * 100)} %</span>
                      </div>
                    </>
                  )}
                  <PrimaryButton onClick={() => setSharing(true)}>Sichern oder teilen</PrimaryButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {sharing && result && (
        <ShareSheet title="Verkleinertes PDF" build={async () => [result.file]} onClose={() => setSharing(false)} onDone={setToastTimed(setToast)} />
      )}
      <Toast text={toast} />
    </div>
  );
}

function setToastTimed(set: (t: string | null) => void) {
  return (t: string) => {
    set(t);
    window.setTimeout(() => set(null), 2600);
  };
}
