import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, LoaderCircle, Share } from 'lucide-react';
import { formatBytes } from '../lib/imageEngine';
import { BottomSheet, PrimaryButton, SecondaryButton } from './MobileUi';
import { downloadFile, shareFile } from './mobileShared';

function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files });
  } catch {
    return false;
  }
}

async function shareFiles(files: File[]): Promise<boolean> {
  if (files.length === 1) return shareFile(files[0]);
  try {
    await navigator.share({ files });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    throw err;
  }
}

/**
 * Erzeugt eine oder mehrere Dateien sofort beim Öffnen und bietet Teilen/Herunterladen an.
 * (Das Teilen-Menü muss direkt beim Antippen öffnen – deshalb wird vorher erzeugt.)
 */
export default function ShareSheet({
  title,
  build,
  info,
  extra,
  onClose,
  onDone,
}: {
  title: string;
  build: () => Promise<File[]>;
  info?: ReactNode | ((files: File[] | null) => ReactNode);
  extra?: (files: File[]) => ReactNode;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    build().then(
      (f) => !cancelled && setFiles(f),
      (err: any) => {
        console.error(err);
        if (!cancelled) setError(err?.message || 'Die Datei konnte nicht erzeugt werden.');
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareable = useMemo(() => (files ? canShareFiles(files) : false), [files]);
  const total = files?.reduce((s, f) => s + f.size, 0) ?? 0;
  const many = (files?.length ?? 0) > 1;

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="space-y-3">
        {typeof info === 'function' ? info(files) : info}
        {!files && !error && (
          <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0071E3]" />
            Wird erzeugt …
          </div>
        )}
        {error && <p className="text-sm font-semibold text-[#FF3B30]">{error}</p>}
        {files && many && (
          <ul className="max-h-40 overflow-y-auto rounded-xl bg-[#F5F5F7] px-3 py-2 text-xs text-[#3A3A3C]">
            {files.map((f) => (
              <li key={f.name} className="flex justify-between gap-2 py-0.5">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-[#86868B]">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
        {shareable && files && (
          <PrimaryButton
            onClick={async () => {
              try {
                if (await shareFiles(files)) {
                  onClose();
                  onDone(many ? `${files.length} Dateien weitergegeben` : 'Weitergegeben');
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
          disabled={!files}
          onClick={() => {
            if (!files) return;
            files.forEach((f, i) => setTimeout(() => downloadFile(f), i * 400));
            onClose();
            onDone(many ? `${files.length} Dateien werden heruntergeladen` : 'Wird heruntergeladen');
          }}
        >
          <Download className="h-4 w-4" />
          Herunterladen{files ? ` (${formatBytes(total)})` : ''}
        </SecondaryButton>
        {files && extra?.(files)}
      </div>
    </BottomSheet>
  );
}
