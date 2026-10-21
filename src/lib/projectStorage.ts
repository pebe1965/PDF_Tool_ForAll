import { Annotation } from '../types/pdf';

const DB_NAME = 'PdfToolForAll_WorkspaceDB';
const DB_VERSION = 1;
const STORE_NAME = 'active_workspace';
const DRAFT_KEY = 'current_draft';

export interface SavedWorkspaceDraft {
  fileName: string;
  documentTitle: string;
  pdfBytes: ArrayBuffer;
  annotations: Annotation[];
  pageBackgrounds?: Record<number, string>;
  currentPage: number;
  updatedAt: number;
}

export interface ProjectFilePayload {
  format: 'PDF_TOOL_FORALL_PROJECT_V1';
  version: string;
  fileName: string;
  documentTitle: string;
  currentPage: number;
  savedAt: string;
  pdfBase64: string;
  annotations: Annotation[];
  pageBackgrounds?: Record<number, string>;
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorkspaceDraft(draft: SavedWorkspaceDraft): Promise<void> {
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(draft, DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Entwurf konnte nicht in IndexedDB gespeichert werden:', err);
  }
}

export async function loadWorkspaceDraft(): Promise<SavedWorkspaceDraft | null> {
  try {
    const db = await openWorkspaceDb();
    const result = await new Promise<SavedWorkspaceDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.warn('Entwurf konnte nicht geladen werden:', err);
    return null;
  }
}

export async function clearWorkspaceDraft(): Promise<void> {
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (_) {}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportProjectFile(
  pdfBytes: ArrayBuffer,
  annotations: Annotation[],
  fileName: string,
  documentTitle: string,
  currentPage: number,
  useFilePicker: boolean = false,
  pageBackgrounds?: Record<number, string>
): Promise<boolean> {
  const payload: ProjectFilePayload = {
    format: 'PDF_TOOL_FORALL_PROJECT_V1',
    version: '1.3.0',
    fileName,
    documentTitle,
    currentPage,
    savedAt: new Date().toISOString(),
    pdfBase64: arrayBufferToBase64(pdfBytes),
    annotations,
    pageBackgrounds,
  };

  const jsonStr = JSON.stringify(payload);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const cleanTitle = documentTitle.trim().replace(/\.(pdf|pdftool)$/i, '') || 'Projekt';
  const finalName = `${cleanTitle}.pdftool`;

  if (useFilePicker && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: finalName,
        types: [
          {
            description: 'PDF Tool Projektdatei (.pdftool)',
            accept: { 'application/json': ['.pdftool'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return false;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function importProjectFile(file: File): Promise<{
  pdfBytes: ArrayBuffer;
  annotations: Annotation[];
  pageBackgrounds?: Record<number, string>;
  fileName: string;
  documentTitle: string;
  currentPage: number;
}> {
  const text = await file.text();
  const payload = JSON.parse(text) as ProjectFilePayload;
  if (!payload || payload.format !== 'PDF_TOOL_FORALL_PROJECT_V1' || !payload.pdfBase64) {
    throw new Error('Ungültige .pdftool Projektdatei.');
  }
  return {
    pdfBytes: base64ToArrayBuffer(payload.pdfBase64),
    annotations: Array.isArray(payload.annotations) ? payload.annotations : [],
    pageBackgrounds: payload.pageBackgrounds || {},
    fileName: payload.fileName || 'Dokument.pdf',
    documentTitle: payload.documentTitle || 'Dokument_bearbeitet',
    currentPage: payload.currentPage || 1,
  };
}
