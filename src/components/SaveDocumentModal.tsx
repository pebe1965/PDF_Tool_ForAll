import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Save,
  CheckCircle2,
  FolderOpen,
  FileText,
  Layers,
  Loader2,
} from 'lucide-react';

interface SaveDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  originalFileName: string;
  annotationsCount: number;
  lastAutoSavedAt: Date | null;
  exporting: boolean;
  onSaveFinalPdf: (finalTitle: string, useFilePicker: boolean) => Promise<void>;
  onSaveEditableProject: (finalTitle: string, useFilePicker: boolean) => Promise<void>;
  onSaveDraftOnly: (finalTitle: string) => Promise<void>;
}

export const SaveDocumentModal: React.FC<SaveDocumentModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  originalFileName,
  annotationsCount,
  lastAutoSavedAt,
  exporting,
  onSaveFinalPdf,
  onSaveEditableProject,
  onSaveDraftOnly,
}) => {
  const [titleInput, setTitleInput] = useState(documentTitle);
  const [draftSavedSuccess, setDraftSavedSuccess] = useState(false);

  const supportsFilePicker = typeof (window as any).showSaveFilePicker === 'function';

  useEffect(() => {
    if (isOpen) {
      setTitleInput(documentTitle.replace(/\.pdf$/i, ''));
      setDraftSavedSuccess(false);
    }
  }, [isOpen, documentTitle]);

  if (!isOpen) return null;

  const cleanBaseOriginal = originalFileName.replace(/\.(pdf|pdftool)$/i, '') || 'Dokument';
  const todayIso = new Date().toISOString().slice(0, 10);

  const applyQuickSuffix = (suffix: string) => {
    const base = titleInput
      .trim()
      .replace(/\.(pdf|pdftool)$/i, '')
      .replace(/_(bearbeitet|freigegeben|unterschrieben|entwurf|\d{4}-\d{2}-\d{2})$/i, '');
    setTitleInput(`${base}${suffix}`);
  };

  const handleDraftSaveClick = async () => {
    const finalName = titleInput.trim() || cleanBaseOriginal;
    await onSaveDraftOnly(finalName);
    setDraftSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#F5F5F7] border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shadow-sm">
              <Save size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Dokument benennen & speichern</h3>
              <p className="text-[11px] text-[#86868B]">
                Dateiname festlegen und Speicherformat wählen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Auto-Save Status Info Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950">
              <div className="font-bold">
                Automatische Zwischenspeicherung ist aktiv
                {lastAutoSavedAt
                  ? ` (zuletzt ${lastAutoSavedAt.toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })} Uhr)`
                  : ''}
              </div>
              <div className="text-[11px] text-emerald-800 mt-0.5">
                Deine aktuelle Arbeit ({annotationsCount} eingefügte Elemente) wird laufend im Programm-Zwischenspeicher gesichert. Selbst wenn du das Fenster schließt, kannst du beim nächsten Start direkt weiterarbeiten.
              </div>
            </div>
          </div>

          {/* Filename Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Dateiname für das Dokument:
            </label>
            <div className="flex items-center bg-[#F5F5F7] border-2 border-[#0071E3] rounded-2xl px-3.5 py-2.5 focus-within:bg-white transition shadow-sm">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSaveFinalPdf(titleInput.trim() || cleanBaseOriginal, supportsFilePicker);
                  }
                }}
                autoFocus
                placeholder="Dateiname eingeben..."
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
              />
              <span className="text-xs font-mono text-gray-400 select-none ml-2">.pdf</span>
            </div>

            {/* Quick Naming Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-gray-400 font-semibold mr-1">Schnell-Name:</span>
              <button
                type="button"
                onClick={() => setTitleInput(cleanBaseOriginal)}
                className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-700 font-medium transition"
              >
                Originalname
              </button>
              <button
                type="button"
                onClick={() => applyQuickSuffix(`_${todayIso}`)}
                className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-700 font-medium transition"
              >
                + _{todayIso}
              </button>
              <button
                type="button"
                onClick={() => applyQuickSuffix('_freigegeben')}
                className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-700 font-medium transition"
              >
                + _freigegeben
              </button>
              <button
                type="button"
                onClick={() => applyQuickSuffix('_unterschrieben')}
                className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-700 font-medium transition"
              >
                + _unterschrieben
              </button>
            </div>
          </div>

          {/* Save Options */}
          <div className="space-y-2.5 pt-1">
            {/* Option 1: Final PDF */}
            <button
              type="button"
              disabled={exporting}
              onClick={() =>
                onSaveFinalPdf(titleInput.trim() || cleanBaseOriginal, supportsFilePicker)
              }
              className="w-full p-3.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white flex items-center justify-between shadow-md transition disabled:opacity-60 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  {exporting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : supportsFilePicker ? (
                    <FolderOpen size={20} />
                  ) : (
                    <Download size={20} />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>
                      {supportsFilePicker
                        ? 'Als fertige PDF speichern unter… (.pdf)'
                        : 'Als fertige PDF-Datei speichern (.pdf)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-100 mt-0.5">
                    Alle Texte, Bilder, Checklisten & Stempel fest in die PDF einbetten (für Versand & Druck)
                  </div>
                </div>
              </div>
              <FileText size={18} className="opacity-80 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
            </button>

            {/* Option 2: Editable .pdftool Project File */}
            <button
              type="button"
              onClick={() =>
                onSaveEditableProject(titleInput.trim() || cleanBaseOriginal, supportsFilePicker)
              }
              className="w-full p-3.5 rounded-2xl bg-gray-50 hover:bg-blue-50/60 border border-gray-200 hover:border-blue-300 text-gray-900 flex items-center justify-between transition text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-[#0071E3] flex items-center justify-center shrink-0">
                  <Layers size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Als weiterbearbeitbare Projektdatei speichern (.pdftool)
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Speichert eine Projektdatei auf deinem Rechner, in der alle Textfelder & Bilder später weiter verschiebbar bleiben
                  </div>
                </div>
              </div>
            </button>

            {/* Option 3: Save in internal Workspace Draft only */}
            <button
              type="button"
              onClick={handleDraftSaveClick}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center justify-center gap-2 transition border border-emerald-200"
            >
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>
                {draftSavedSuccess
                  ? '✓ Im Programm-Zwischenspeicher gesichert!'
                  : 'Nur im Programm zwischenspeichern (ohne Datei-Download)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
