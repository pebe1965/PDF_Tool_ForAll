import React, { useState, useEffect, useRef } from 'react';
import {
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
  CheckSquare,
  GripVertical,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { MergePageItem } from '../types/pdf';
import {
  mergeAndExportPages,
  downloadPdf,
  convertImageFileToA4PdfBytes,
} from '../lib/pdfEngine';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputFileName, setOutputFileName] = useState<string>('Zusammengefuehrtes_Dokument');
  const lastLoadedSharedBufferRef = useRef<ArrayBuffer | null>(null);

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
      setSelectedIds(new Set());
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

  useEffect(() => {
    if (sharedPdfBytes && sharedPdfBytes !== lastLoadedSharedBufferRef.current) {
      loadPagesFromBuffer(sharedPdfBytes, sharedFileName);
    }
  }, [sharedPdfBytes, sharedFileName]);

  // Process uploaded PDF AND Image files (.pdf, .png, .jpg, .webp)
  const handleAddFiles = async (files: FileList | File[]) => {
    setLoading(true);
    const newItems: MergePageItem[] = [];

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');

      if (!isPdf && !isImg) continue;

      try {
        const buffer = isImg
          ? await convertImageFileToA4PdfBytes(file)
          : await file.arrayBuffer();
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
        const first = updated[0].fileName.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '');
        setOutputFileName(`${first}_zusammengefuehrt`);
      }
      return updated;
    });
    setLoading(false);
  };

  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const copy = [...pages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setPages(copy);
  };

  // Drag & Drop Card Reordering
  const handleCardDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleCardDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIdx !== null && draggedIdx !== targetIndex) {
      const copy = [...pages];
      const [moved] = copy.splice(draggedIdx, 1);
      copy.splice(targetIndex, 0, moved);
      setPages(copy);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleRotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          rotation: (item.rotation + 90) % 360,
        };
      })
    );
  };

  const handleDeletePage = (index: number) => {
    const targetId = pages[index]?.id;
    setPages((prev) => prev.filter((_, idx) => idx !== index));
    if (targetId && selectedIds.has(targetId)) {
      const next = new Set(selectedIds);
      next.delete(targetId);
      setSelectedIds(next);
    }
  };

  // Batch selection actions
  const toggleSelectPage = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchRotate = () => {
    if (selectedIds.size === 0) return;
    setPages((prev) =>
      prev.map((item) =>
        selectedIds.has(item.id)
          ? { ...item, rotation: (item.rotation + 90) % 360 }
          : item
      )
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setPages((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

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
    if (draggedIdx !== null) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] overflow-hidden bg-[#F5F5F7]">
      {/* Top Action Bar */}
      <div className="min-h-[56px] bg-white border-b border-[#E8E8ED] px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-sm z-20">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition">
            <Plus size={15} />
            <span>PDFs & Bilder hinzufügen</span>
            <input
              type="file"
              accept="application/pdf,image/*"
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
              <span>Aus Editor neu laden</span>
            </button>
          )}

          {pages.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (selectedIds.size === pages.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(pages.map((p) => p.id)));
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <CheckSquare size={13} />
                <span>
                  {selectedIds.size === pages.length ? 'Auswahl aufheben' : 'Alle auswählen'}
                </span>
              </button>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                  <span className="text-xs font-bold text-[#0071E3]">
                    {selectedIds.size} markiert:
                  </span>
                  <button
                    onClick={handleBatchRotate}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-blue-100 text-xs font-semibold text-[#0071E3] rounded-lg border border-blue-200 transition"
                  >
                    <RotateCw size={12} />
                    <span>Drehen</span>
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-red-50 text-xs font-semibold text-red-600 rounded-lg border border-red-200 transition"
                  >
                    <Trash2 size={12} />
                    <span>Löschen</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setPages([]);
                  setSelectedIds(new Set());
                }}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition"
              >
                Alle leeren
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 hidden sm:inline">
            {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'}
          </span>

          {pages.length > 0 && (
            <div className="flex items-center bg-[#F5F5F7] border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-[#0071E3] focus-within:bg-white transition">
              <span className="text-[11px] text-gray-400 font-medium mr-1.5 hidden md:inline">
                Dateiname:
              </span>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                placeholder="Dateiname..."
                className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none w-32 sm:w-44"
              />
              <span className="text-[11px] font-mono text-gray-400 select-none">.pdf</span>
            </div>
          )}

          <button
            onClick={handleOpenInEditor}
            disabled={pages.length === 0 || exporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Edit3 size={15} />}
            <span className="hidden sm:inline">Im Editor öffnen</span>
            <span className="sm:hidden">Editor</span>
          </button>

          <button
            onClick={handleExportMerge}
            disabled={pages.length === 0 || exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
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
            <h2 className="text-2xl font-bold text-[#1D1D1F] mb-2">
              PDFs & Bilder zusammenführen
            </h2>
            <p className="text-sm text-[#86868B] max-w-md mb-6">
              Ziehe beliebige PDF-Dokumente oder Bilder (PNG, JPG, Belegfotos) hierhin. Sortiere Seiten per Drag & Drop, drehe oder lösche sie im Stapel.
            </p>
            <span className="px-6 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium rounded-xl shadow-md transition">
              PDFs oder Bilder auswählen
            </span>
            <input
              id="file-upload-merge"
              type="file"
              accept="application/pdf,image/*"
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
          className="flex-1 overflow-y-auto p-6"
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 mb-6 text-sm text-[#0071E3] font-medium bg-blue-50 py-3 rounded-xl border border-blue-200">
              <Loader2 size={18} className="animate-spin" />
              <span>Seiten werden aufbereitet...</span>
            </div>
          )}

          {/* Grid of Pages (with Drag & Drop Reordering) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {pages.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              const isDragTarget = dragOverIdx === index;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleCardDragStart(e, index)}
                  onDragOver={(e) => handleCardDragOver(e, index)}
                  onDrop={(e) => handleCardDrop(e, index)}
                  onDragEnd={() => {
                    setDraggedIdx(null);
                    setDragOverIdx(null);
                  }}
                  className={`bg-white rounded-2xl border-2 transition-all duration-150 flex flex-col overflow-hidden group cursor-grab active:cursor-grabbing ${
                    isDragTarget
                      ? 'border-emerald-500 scale-105 shadow-2xl'
                      : isSelected
                      ? 'border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-lg'
                      : 'border-gray-200/80 shadow-md hover:shadow-xl'
                  }`}
                >
                  {/* Page Number, Checkbox & File Header */}
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs bg-gray-50/70">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPage(item.id)}
                        className="rounded text-[#0071E3] cursor-pointer"
                      />
                      <span className="font-bold text-[#0071E3]">#{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-gray-500 truncate max-w-[90px]" title={item.fileName}>
                        {item.fileName}
                      </span>
                      <GripVertical size={13} className="text-gray-300 shrink-0" />
                    </div>
                  </div>

                  {/* Thumbnail Preview with Rotation */}
                  <div
                    onClick={() => toggleSelectPage(item.id)}
                    className="h-52 bg-gray-100 flex items-center justify-center p-3 overflow-hidden"
                  >
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={`Seite ${index + 1}`}
                        style={{ transform: `rotate(${item.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200 pointer-events-none"
                      />
                    ) : (
                      <div className="text-gray-400 text-xs">Vorschau lädt...</div>
                    )}
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="p-2 bg-white border-t border-gray-100 flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleMovePage(index, 'left')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-20 transition"
                      title="Nach links verschieben"
                    >
                      <ArrowLeft size={14} />
                    </button>

                    <button
                      onClick={() => handleRotatePage(index)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-600 hover:text-[#0071E3] transition"
                      title="Um 90° drehen"
                    >
                      <RotateCw size={14} />
                    </button>

                    <button
                      onClick={() => handleDeletePage(index)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600 transition"
                      title="Seite entfernen"
                    >
                      <Trash2 size={14} />
                    </button>

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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
