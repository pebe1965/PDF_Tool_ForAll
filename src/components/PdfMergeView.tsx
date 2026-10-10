import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  RotateCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  FileStack,
  Plus,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { MergePageItem } from '../types/pdf';
import { mergeAndExportPages, downloadPdf } from '../lib/pdfEngine';

interface PdfMergeViewProps {
  sharedPdfBytes: ArrayBuffer | null;
  sharedFileName: string;
  onSyncToEditor: (bytes: ArrayBuffer, fileName: string) => void;
}

export const PdfMergeView: React.FC<PdfMergeViewProps> = ({
  sharedPdfBytes,
  sharedFileName,
  onSyncToEditor,
}) => {
  const [pages, setPages] = useState<MergePageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputFileName, setOutputFileName] = useState<string>('Zusammengefuehrtes_Dokument');
  const lastLoadedSharedBufferRef = useRef<ArrayBuffer | null>(null);

  // Generate thumbnail data URL for a specific page of a PDF
  const generatePageThumbnail = async (
    doc: any,
    pageNumber: number,
    rotation: number
  ): Promise<string> => {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.35, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Load pages from an existing buffer (e.g. from the Editor)
  const loadPagesFromBuffer = async (buffer: ArrayBuffer, name: string) => {
    setLoading(true);
    try {
      const fileId = `shared_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await loadingTask.promise;
      const loadedPages: MergePageItem[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const thumb = await generatePageThumbnail(doc, p, 0);
        loadedPages.push({
          id: `page_${fileId}_${p}`,
          fileId: fileId,
          fileName: name || 'Dokument.pdf',
          pageIndex: p - 1,
          pageNumber: p,
          rotation: 0,
          thumbnailUrl: thumb,
          fileBytes: buffer,
        });
      }
      setPages(loadedPages);
      if (name && outputFileName === 'Zusammengefuehrtes_Dokument') {
        setOutputFileName(name.replace(/\.pdf$/i, '') + '_zusammengefuehrt');
      }
      lastLoadedSharedBufferRef.current = buffer;
    } catch (err) {
      console.error('Fehler beim Laden der Seiten aus dem Editor:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync automatically when editor has a document and merge view is empty or updated
  useEffect(() => {
    if (sharedPdfBytes && sharedPdfBytes !== lastLoadedSharedBufferRef.current) {
      loadPagesFromBuffer(sharedPdfBytes, sharedFileName);
    }
  }, [sharedPdfBytes, sharedFileName]);

  // Process uploaded PDF files
  const handleAddFiles = async (files: FileList | File[]) => {
    setLoading(true);
    const newItems: MergePageItem[] = [];

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      if (file.type !== 'application/pdf') continue;

      try {
        const buffer = await file.arrayBuffer();
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const doc = await loadingTask.promise;

        for (let p = 1; p <= doc.numPages; p++) {
          const thumb = await generatePageThumbnail(doc, p, 0);
          newItems.push({
            id: `page_${fileId}_${p}`,
            fileId: fileId,
            fileName: file.name,
            pageIndex: p - 1,
            pageNumber: p,
            rotation: 0,
            thumbnailUrl: thumb,
            fileBytes: buffer,
          });
        }
      } catch (err) {
        console.error(`Fehler beim Verarbeiten von ${file.name}:`, err);
      }
    }

    setPages((prev) => {
      const updated = [...prev, ...newItems];
      if (updated.length > 0 && outputFileName === 'Zusammengefuehrtes_Dokument') {
        const first = updated[0].fileName.replace(/\.pdf$/i, '');
        setOutputFileName(`${first}_zusammengefuehrt`);
      }
      return updated;
    });
    setLoading(false);
  };

  // Move page position in list
  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const copy = [...pages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setPages(copy);
  };

  // Rotate page 90 degrees clockwise
  const handleRotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const newRotation = (item.rotation + 90) % 360;
        return {
          ...item,
          rotation: newRotation,
        };
      })
    );
  };

  // Delete page
  const handleDeletePage = (index: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Open the arranged pages directly in the Editor
  const handleOpenInEditor = async () => {
    if (pages.length === 0) return;
    setExporting(true);
    try {
      const mergedBytes = await mergeAndExportPages(pages);
      const cleanName = outputFileName.trim().replace(/\.pdf$/i, '') || 'Zusammengefuehrtes_Dokument';
      onSyncToEditor(mergedBytes.buffer as ArrayBuffer, `${cleanName}.pdf`);
    } catch (err) {
      console.error('Fehler beim Übertragen in den Editor:', err);
      alert('Konnte nicht in den Editor übertragen werden.');
    } finally {
      setExporting(false);
    }
  };

  // Export merged PDF as direct download
  const handleExportMerge = async () => {
    if (pages.length === 0) return;
    setExporting(true);

    try {
      const mergedBytes = await mergeAndExportPages(pages);
      const cleanName = outputFileName.trim().replace(/\.pdf$/i, '') || 'Zusammengefuehrtes_Dokument';
      downloadPdf(mergedBytes, `${cleanName}.pdf`);
    } catch (err) {
      console.error('Merge error:', err);
      alert('Fehler beim Zusammenführen der PDFs.');
    } finally {
      setExporting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] overflow-hidden bg-[#F5F5F7]">
      {/* Top Action Bar */}
      <div className="h-14 bg-white border-b border-[#E8E8ED] px-6 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-sm font-semibold cursor-pointer shadow-sm transition">
            <Plus size={16} />
            <span>PDFs hinzufügen</span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleAddFiles(e.target.files);
              }}
            />
          </label>

          {sharedPdfBytes && pages.length > 0 && (
            <button
              onClick={() => loadPagesFromBuffer(sharedPdfBytes, sharedFileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              title="Aktuellen Stand aus dem Editor neu laden"
            >
              <RefreshCw size={13} />
              <span>Aus Editor aktualisieren</span>
            </button>
          )}

          {pages.length > 0 && (
            <button
              onClick={() => setPages([])}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition"
            >
              Alle entfernen
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 hidden sm:inline">
            {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'}
          </span>

          {/* Editable Filename input */}
          {pages.length > 0 && (
            <div className="flex items-center bg-[#F5F5F7] border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-[#0071E3] focus-within:bg-white focus-within:shadow-sm transition">
              <span className="text-[11px] text-gray-400 font-medium mr-1.5 hidden md:inline">Dateiname:</span>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                placeholder="Dateiname..."
                className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none w-36 sm:w-48"
              />
              <span className="text-[11px] font-mono text-gray-400 select-none">.pdf</span>
            </div>
          )}

          {/* Button to sync back into Editor */}
          <button
            onClick={handleOpenInEditor}
            disabled={pages.length === 0 || exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Übernimmt die sortierten Seiten direkt in den Editor zum Schreiben & Signieren"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
            <span className="hidden sm:inline">Im Editor öffnen</span>
            <span className="sm:hidden">Editor</span>
          </button>

          {/* Button to Download directly */}
          <button
            onClick={handleExportMerge}
            disabled={pages.length === 0 || exporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Herunterladen</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {pages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="w-full max-w-xl p-12 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] transition-all flex flex-col items-center justify-center text-center shadow-lg group cursor-pointer"
            onClick={() => document.getElementById('file-upload-merge')?.click()}
          >
            <div className="w-20 h-20 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-6 group-hover:scale-105 transition">
              <FileStack size={38} />
            </div>
            <h2 className="text-2xl font-bold text-[#1D1D1F] mb-2">Mehrere PDFs zusammenführen</h2>
            <p className="text-sm text-[#86868B] max-w-md mb-6">
              Ziehe beliebige PDF-Dokumente hierhin. Sortiere, drehe oder entferne Seiten nach Wunsch und fasse alles in einer einzigen Datei zusammen.
            </p>
            <span className="px-6 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium rounded-xl shadow-md transition">
              PDF-Dateien auswählen
            </span>
            <input
              id="file-upload-merge"
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleAddFiles(e.target.files);
              }}
            />
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-8"
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 mb-6 text-sm text-[#0071E3] font-medium bg-blue-50 py-3 rounded-xl border border-blue-200">
              <Loader2 size={18} className="animate-spin" />
              <span>Seiten werden gerendert...</span>
            </div>
          )}

          {/* Grid of Pages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {pages.map((item, index) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden group"
              >
                {/* Page Number & File Header */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
                  <span className="font-bold text-[#0071E3]">#{index + 1}</span>
                  <span className="text-gray-500 truncate max-w-[100px]" title={item.fileName}>
                    {item.fileName}
                  </span>
                </div>

                {/* Thumbnail Preview with Rotation */}
                <div className="h-56 bg-gray-100 flex items-center justify-center p-3 overflow-hidden">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={`Seite ${index + 1}`}
                      style={{ transform: `rotate(${item.rotation}deg)` }}
                      className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-gray-400 text-xs">Vorschau lädt...</div>
                  )}
                </div>

                {/* Action Buttons Toolbar */}
                <div className="p-2 bg-white border-t border-gray-100 flex items-center justify-between gap-1">
                  {/* Move Left */}
                  <button
                    onClick={() => handleMovePage(index, 'left')}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-20 transition"
                    title="Nach links verschieben"
                  >
                    <ArrowLeft size={14} />
                  </button>

                  {/* Rotate 90 deg */}
                  <button
                    onClick={() => handleRotatePage(index)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-600 hover:text-[#0071E3] transition"
                    title="Um 90° drehen"
                  >
                    <RotateCw size={14} />
                  </button>

                  {/* Delete Page */}
                  <button
                    onClick={() => handleDeletePage(index)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600 transition"
                    title="Seite entfernen"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Move Right */}
                  <button
                    onClick={() => handleMovePage(index, 'right')}
                    disabled={index === pages.length - 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-20 transition"
                    title="Nach rechts verschieben"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
