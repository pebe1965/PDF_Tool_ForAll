import { useCallback, useRef, useState } from 'react';

/** Rückgängig/Wiederholen für einen beliebigen Zustand. */
export function useHistory<T>(initial: T, limit = 50) {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] });

  const commit = useCallback(
    (next: T) =>
      setState((s) => (Object.is(next, s.present) ? s : { past: [...s.past, s.present].slice(-limit), present: next, future: [] })),
    [limit],
  );
  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length === 0 ? s : { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] },
      ),
    [],
  );
  const redo = useCallback(
    () => setState((s) => (s.future.length === 0 ? s : { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) })),
    [],
  );
  // Zuletzt gesicherter Stand – danach fragt Schließen nicht mehr nach
  const [saved, setSaved] = useState<T>(initial);
  const presentRef = useRef(state.present);
  presentRef.current = state.present;
  const markSaved = useCallback(() => setSaved(() => presentRef.current), []);
  const reset = useCallback((value: T) => {
    setState({ past: [], present: value, future: [] });
    setSaved(() => value);
  }, []);

  // Schieberegler: alle Änderungen kurz hintereinander am selben Ziel ergeben einen Rückgängig-Schritt
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const commitCoalesced = useCallback((next: T, key: string) => {
    const now = Date.now();
    const same = lastKey.current && lastKey.current.key === key && now - lastKey.current.at < 1200;
    lastKey.current = { key, at: now };
    setState((s) => (same && s.past.length > 0 ? { ...s, present: next, future: [] } : { past: [...s.past, s.present].slice(-limit), present: next, future: [] }));
  }, [limit]);

  return {
    value: state.present,
    commit,
    commitCoalesced,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dirty: !Object.is(state.present, saved),
    markSaved,
  };
}

/** Kann dieses Gerät Dateien über das Teilen-Menü weitergeben (iPhone, Android)? */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Öffnet das Teilen-Menü (In Fotos sichern, In Dateien sichern, WhatsApp, Mail, Drucken …).
 * Muss direkt aus einem Fingertipp heraus aufgerufen werden – die Datei also vorher erzeugen.
 * Gibt false zurück, wenn der Nutzer abbricht.
 */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    throw err;
  }
}

/** Herkömmlicher Download (Fallback, z. B. am Computer). */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, '') || 'Datei';
}
