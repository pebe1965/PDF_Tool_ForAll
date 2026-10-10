import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Type,
  PenTool,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Loader2,
  FilePlus,
  Plus,
  Trash2,
  FileStack,
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { AnnotationLayer } from './AnnotationLayer';
import { SignatureModal } from './SignatureModal';
import { GeminiAiModal } from './GeminiAiModal';
import { Annotation, TextAnnotation, SignatureAnnotation, ImageAnnotation } from '../types/pdf';
import {
  applyAnnotationsToPdf,
  downloadPdf,
  createBlankPdfDocument,
  addBlankPageToPdf,
  appendPdfToPdf,
  deletePageFromPdf,
  processImageFile,
} from '../lib/pdfEngine';

interface PdfEditorViewProps {
  sharedPdfBytes: ArrayBuffer | null;
  sharedFileName: string;
  onPdfUpdate: (bytes: ArrayBuffer, fileName: string) => void;
  onOpenMergeTab?: () => void;
  isAiModalOpen?: boolean;
  onToggleAiModal?: (open: boolean) => void;
}

export const PdfEditorView: React.FC<PdfEditorViewProps> = ({
  sharedPdfBytes,
  sharedFileName,
  onPdfUpdate,
  onOpenMergeTab,
  isAiModalOpen: externalIsAiModalOpen,
  onToggleAiModal,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [documentTitle, setDocumentTitle] = useState<string>('Dokument_bearbeitet');
  const lastSyncRef = useRef<ArrayBuffer | null>(null);

  // Tools: 'select' | 'add-text'
  const [activeTool, setActiveTool] = useState<'select' | 'add-text'>('select');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [internalIsAiModalOpen, setInternalIsAiModalOpen] = useState(false);

  const isAiOpen = externalIsAiModalOpen !== undefined ? externalIsAiModalOpen : internalIsAiModalOpen;
  const setAiOpen = (val: boolean) => {
    if (onToggleAiModal) onToggleAiModal(val);
    setInternalIsAiModalOpen(val);
  };

  // Annotations list
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Reload an updated PDF buffer into pdfjs viewer
  const reloadPdfFromBuffer = async (buffer: ArrayBuffer | Uint8Array, targetPage: number = 1, notify: boolean = true) => {
    setLoading(true);
    try {
      const arrayBuf = buffer instanceof Uint8Array ? (buffer.buffer as ArrayBuffer) : buffer;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuf.slice(0) });
      const loadedDoc = await loadingTask.promise;
      setPdfBytes(arrayBuf);
      setPdfDoc(loadedDoc);
      setNumPages(loadedDoc.numPages);
      setCurrentPage(Math.min(targetPage, loadedDoc.numPages));

      if (notify) {
        lastSyncRef.current = arrayBuf;
        onPdfUpdate(arrayBuf, file?.name || sharedFileName || 'Dokument.pdf');
      }
    } catch (err) {
      console.error('Fehler beim Neuladen der PDF:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync when shared document from outside (e.g. merge view) changes
  useEffect(() => {
    if (sharedPdfBytes && sharedPdfBytes !== lastSyncRef.current && sharedPdfBytes !== pdfBytes) {
      lastSyncRef.current = sharedPdfBytes;
      const syncFile = new File([sharedPdfBytes as any], sharedFileName || 'Dokument.pdf', { type: 'application/pdf' });
      setFile(syncFile);
      if (sharedFileName) {
        setDocumentTitle(sharedFileName.replace(/\.pdf$/i, ''));
      }
      reloadPdfFromBuffer(sharedPdfBytes, currentPage, false);
    }
  }, [sharedPdfBytes, sharedFileName]);

  // Handle PDF file selection from file input
  const handleFileChange = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      alert('Bitte wähle eine gültige PDF-Datei aus.');
      return;
    }

    setLoading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      setFile(selectedFile);
      const cleanName = selectedFile.name.replace(/\.pdf$/i, '');
      setDocumentTitle(cleanName.endsWith('_bearbeitet') ? cleanName : `${cleanName}_bearbeitet`);
      setAnnotations([]);
      await reloadPdfFromBuffer(buffer, 1);
    } catch (err) {
      console.error('Fehler beim Laden der PDF:', err);
      alert('Die PDF konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  // Create a brand new blank PDF from scratch
  const handleCreateNewBlankPdf = async () => {
    setLoading(true);
    try {
      const blankBytes = await createBlankPdfDocument();
      const mockFile = new File([blankBytes as any], 'Neues_Dokument.pdf', { type: 'application/pdf' });
      setFile(mockFile);
      setDocumentTitle('Neues_Dokument');
      setAnnotations([]);
      await reloadPdfFromBuffer(blankBytes, 1);
    } catch (err) {
      console.error('Fehler beim Erstellen eines neuen PDFs:', err);
      alert('Neues Dokument konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  };

  // Add a blank page to the current PDF
  const handleAddBlankPage = async () => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      const updatedBytes = await addBlankPageToPdf(pdfBytes);
      const newPageNumber = numPages + 1;
      await reloadPdfFromBuffer(updatedBytes, newPageNumber);
    } catch (err) {
      console.error('Fehler beim Hinzufügen einer leeren Seite:', err);
      alert('Leere Seite konnte nicht hinzugefügt werden.');
    } finally {
      setLoading(false);
    }
  };

  // Append a second PDF file into current document
  const handleAppendSecondPdf = async (secondFile: File) => {
    if (!pdfBytes || secondFile.type !== 'application/pdf') return;
    setLoading(true);
    try {
      const secondBuffer = await secondFile.arrayBuffer();
      const mergedBytes = await appendPdfToPdf(pdfBytes, secondBuffer);
      const previousPageCount = numPages;
      await reloadPdfFromBuffer(mergedBytes, previousPageCount + 1);
    } catch (err) {
      console.error('Fehler beim Anhängen des zweiten PDFs:', err);
      alert('Zweites PDF konnte nicht angehängt werden.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a page from current PDF
  const handleDeletePage = async (pageToDelete: number) => {
    if (!pdfBytes || numPages <= 1) {
      alert('Das Dokument muss mindestens eine Seite enthalten.');
      return;
    }

    if (!confirm(`Möchtest du Seite ${pageToDelete} wirklich löschen?`)) return;

    setLoading(true);
    try {
      const updatedBytes = await deletePageFromPdf(pdfBytes, pageToDelete - 1);

      // Adjust annotations
      setAnnotations((prev) =>
        prev
          .filter((a) => a.pageNumber !== pageToDelete)
          .map((a) => (a.pageNumber > pageToDelete ? { ...a, pageNumber: a.pageNumber - 1 } : a))
      );

      const targetPage = Math.max(1, Math.min(currentPage, numPages - 1));
      await reloadPdfFromBuffer(updatedBytes, targetPage);
    } catch (err) {
      console.error('Fehler beim Löschen der Seite:', err);
      alert('Seite konnte nicht gelöscht werden.');
    } finally {
      setLoading(false);
    }
  };

  // Render current page on canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setCanvasDimensions({ width: viewport.width, height: viewport.height });

      ctx.save();
      ctx.scale(dpr, dpr);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      ctx.restore();
    } catch (err) {
      console.error('Render error:', err);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Handle click on PDF to add text
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'add-text' || !pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0.02, Math.min(0.68, clickX / canvasDimensions.width));
    const normY = Math.max(0.02, Math.min(0.9, clickY / canvasDimensions.height));

    const newTextAnn: TextAnnotation = {
      id: `text_${Date.now()}`,
      type: 'text',
      pageNumber: currentPage,
      x: normX,
      y: normY,
      width: 0.32,
      text: 'Hier tippen...',
      fontSize: 16,
      color: '#000000',
      backgroundColor: 'transparent',
    };

    setAnnotations((prev) => [...prev, newTextAnn]);
    setSelectedAnnId(newTextAnn.id);
    setActiveTool('select');
  };

  // Duplicate an existing annotation (text or image)
  const handleDuplicateAnnotation = (ann: TextAnnotation | ImageAnnotation) => {
    const copy = {
      ...ann,
      id: `${ann.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: Math.min(0.92, ann.x + 0.03),
      y: Math.min(0.92, ann.y + 0.03),
    };
    setAnnotations((prev) => [...prev, copy as any]);
    setSelectedAnnId(copy.id);
  };

  // Insert image or screenshot
  const handleInsertImageFile = async (
    fileOrBlob: Blob,
    fileName: string = 'Bild',
    coords?: { x: number; y: number }
  ) => {
    try {
      const { dataUrl, aspectRatio } = await processImageFile(fileOrBlob);

      // Target initial width ~28% of page so it is easy to place and resize
      let initialWidth = 0.28;
      const pageAspect =
        canvasDimensions.width > 0 && canvasDimensions.height > 0
          ? canvasDimensions.width / canvasDimensions.height
          : 0.707;

      let initialHeight = (initialWidth * pageAspect) / aspectRatio;

      // If image is very tall (e.g. vertical screenshot), cap height to 30%
      if (initialHeight > 0.3) {
        initialHeight = 0.3;
        initialWidth = (initialHeight / pageAspect) * aspectRatio;
      }

      // If image is very wide, cap width to 45%
      if (initialWidth > 0.45) {
        initialWidth = 0.45;
        initialHeight = (initialWidth * pageAspect) / aspectRatio;
      }

      // Position
      let initialX = coords ? coords.x - initialWidth / 2 : (1 - initialWidth) / 2;
      let initialY = coords ? coords.y - initialHeight / 2 : 0.25;

      initialX = Math.max(0.02, Math.min(0.96 - initialWidth, initialX));
      initialY = Math.max(0.02, Math.min(0.96 - initialHeight, initialY));

      const newImgAnn: ImageAnnotation = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'image',
        pageNumber: currentPage,
        x: initialX,
        y: initialY,
        width: initialWidth,
        height: initialHeight,
        dataUrl,
        aspectRatio,
        lockAspectRatio: true,
        name: fileName,
      };

      setAnnotations((prev) => [...prev, newImgAnn]);
      setSelectedAnnId(newImgAnn.id);
    } catch (err) {
      console.error('Fehler beim Einfügen des Bildes:', err);
      alert('Das Bild konnte nicht geladen werden.');
    }
  };

  // Clipboard paste listener (Cmd+V / Ctrl+V for screenshots)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept when user is typing in a textarea or input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (!pdfBytes || !e.clipboardData) return;

      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            handleInsertImageFile(blob, 'Screenshot');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pdfBytes, currentPage, canvasDimensions]);

  // Add signature
  const handleAddSignature = (dataUrl: string) => {
    const newSigAnn: SignatureAnnotation = {
      id: `sig_${Date.now()}`,
      type: 'signature',
      pageNumber: currentPage,
      x: 0.35,
      y: 0.7,
      width: 0.3,
      height: 0.12,
      dataUrl: dataUrl,
    };

    setAnnotations((prev) => [...prev, newSigAnn]);
    setSelectedAnnId(newSigAnn.id);
  };

  // Insert AI generated text into current page
  const handleInsertTextFromAi = (text: string) => {
    const newTextAnn: TextAnnotation = {
      id: `text_${Date.now()}`,
      type: 'text',
      pageNumber: currentPage,
      x: 0.1,
      y: 0.15,
      width: 0.78,
      text: text,
      fontSize: 13,
      color: '#000000',
      backgroundColor: '#FFFFFF',
    };

    setAnnotations((prev) => [...prev, newTextAnn]);
    setSelectedAnnId(newTextAnn.id);
    setAiOpen(false);
  };

  // Insert AI generated text as a brand new page
  const handleInsertAsNewPageFromAi = async (text: string) => {
    if (!pdfBytes) return;
    try {
      const updatedBytes = await addBlankPageToPdf(pdfBytes);
      const newPageNum = numPages + 1;
      await reloadPdfFromBuffer(updatedBytes, newPageNum);

      const newTextAnn: TextAnnotation = {
        id: `text_${Date.now()}`,
        type: 'text',
        pageNumber: newPageNum,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: text,
        fontSize: 13,
        color: '#000000',
        backgroundColor: 'transparent',
      };

      setAnnotations((prev) => [...prev, newTextAnn]);
      setSelectedAnnId(newTextAnn.id);
      setAiOpen(false);
    } catch (err) {
      console.error('Fehler beim Einfügen als neue Seite:', err);
      alert('Konnte keine neue Seite für den KI-Text anlegen.');
    }
  };

  // Update annotation
  const handleUpdateAnnotation = (updated: Annotation) => {
    setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  // Delete annotation
  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnId === id) setSelectedAnnId(null);
  };

  // Export & Download
  const handleExport = async () => {
    if (!pdfBytes) return;
    setExporting(true);

    try {
      const modifiedBytes = await applyAnnotationsToPdf(pdfBytes, annotations);
      const cleanName = documentTitle.trim().replace(/\.pdf$/i, '') || 'Dokument_bearbeitet';
      downloadPdf(modifiedBytes, `${cleanName}.pdf`);
    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Fehler beim Exportieren der PDF: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  // Dropzone drag events for initial screen
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  // Viewport drag/drop handler (supports dropping image files onto the PDF page)
  const handleViewportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (droppedFile.type.startsWith('image/')) {
      if (pageContainerRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0) {
        const rect = pageContainerRef.current.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / canvasDimensions.width;
        const dropY = (e.clientY - rect.top) / canvasDimensions.height;
        handleInsertImageFile(droppedFile, droppedFile.name, { x: dropX, y: dropY });
      } else {
        handleInsertImageFile(droppedFile, droppedFile.name);
      }
    } else if (droppedFile.type === 'application/pdf') {
      handleFileChange(droppedFile);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] overflow-hidden bg-[#F5F5F7]">
      {/* If no file is loaded, show welcoming choices */}
      {!file ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Open existing PDF */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload-editor')?.click()}
              className="p-8 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <Upload size={32} />
              </div>
              <h2 className="text-xl font-bold text-[#1D1D1F] mb-2">Vorhandene PDF öffnen</h2>
              <p className="text-xs text-[#86868B] mb-6 flex-1">
                Wähle eine PDF aus oder ziehe sie hierhin, um Text zu ergänzen, zu unterschreiben oder Seiten anzupassen.
              </p>
              <span className="w-full py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold rounded-xl shadow-md transition text-center">
                PDF-Datei auswählen
              </span>
              <input
                id="file-upload-editor"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />
            </div>

            {/* Card 2: Create new blank PDF */}
            <div
              onClick={handleCreateNewBlankPdf}
              className="p-8 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-emerald-500 transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <FilePlus size={32} />
              </div>
              <h2 className="text-xl font-bold text-[#1D1D1F] mb-2">Neues leeres PDF erstellen</h2>
              <p className="text-xs text-[#86868B] mb-6 flex-1">
                Erstelle ein leeres A4-Dokument von Grund auf. Ideal für Notizen, Briefe, Protokolle oder eigene Formulare.
              </p>
              <span className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition text-center">
                Leeres Dokument anlegen
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Action & Tool Bar */}
          <div className="h-14 bg-white border-b border-[#E8E8ED] px-4 flex items-center justify-between shadow-sm z-20">
            {/* Left: Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTool(activeTool === 'add-text' ? 'select' : 'add-text')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                  activeTool === 'add-text'
                    ? 'bg-[#0071E3] text-white shadow-sm'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200'
                }`}
                title="Klicke auf die PDF-Seite, um Text zu platzieren"
              >
                <Type size={16} />
                <span>Text hinzufügen</span>
              </button>

              <button
                onClick={() => setIsSignatureModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F7] hover:bg-gray-200 text-[#1D1D1F] rounded-xl text-sm font-medium transition"
              >
                <PenTool size={16} />
                <span>Unterschreiben</span>
              </button>

              <button
                onClick={() => document.getElementById('image-upload-editor')?.click()}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F7] hover:bg-gray-200 text-[#1D1D1F] rounded-xl text-sm font-medium transition"
                title="Bild oder Screenshot einfügen (oder direkt Strg+V / Cmd+V drücken)"
              >
                <ImageIcon size={16} />
                <span>Bild / Screenshot</span>
              </button>
              <input
                id="image-upload-editor"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleInsertImageFile(e.target.files[0], e.target.files[0].name);
                    e.target.value = '';
                  }
                }}
              />

              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

              <button
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition hover:scale-105 active:scale-95"
                title="Mit Gemini KI analysieren, zusammenfassen, übersetzen oder Text erstellen"
              >
                <Sparkles size={15} className="animate-pulse" />
                <span>Gemini KI</span>
              </button>
            </div>

            {/* Middle: Page & Zoom Controls */}
            <div className="flex items-center gap-4 bg-[#F5F5F7] px-3 py-1 rounded-xl">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-white disabled:opacity-30 transition"
                  title="Vorherige Seite"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-semibold px-2">
                  Seite {currentPage} von {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded hover:bg-white disabled:opacity-30 transition"
                  title="Nächste Seite"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="w-[1px] h-4 bg-gray-300" />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                  className="p-1 rounded hover:bg-white transition"
                  title="Verkleinern"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
                <button
                  onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                  className="p-1 rounded hover:bg-white transition"
                  title="Vergrößern"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* Right: Export & File Info */}
            <div className="flex items-center gap-2.5">
              {/* Editable Filename input */}
              <div className="flex items-center bg-[#F5F5F7] border border-gray-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-[#0071E3] focus-within:bg-white focus-within:shadow-sm transition">
                <span className="text-[11px] text-gray-400 font-medium mr-1.5 hidden lg:inline">Dateiname:</span>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Dateiname..."
                  className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none w-28 sm:w-44"
                />
                <span className="text-[11px] font-mono text-gray-400 select-none">.pdf</span>
              </div>

              <button
                onClick={() => {
                  if (confirm('Anderes Dokument öffnen? Ungespeicherte Änderungen gehen verloren.')) {
                    setFile(null);
                    setPdfBytes(null);
                    setPdfDoc(null);
                  }
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Anderes PDF laden oder neues Dokument beginnen"
              >
                <FolderOpen size={14} />
                <span className="hidden xl:inline">Wechseln</span>
              </button>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-60"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>Speichern</span>
              </button>
            </div>
          </div>

          {/* Active Tool Banner */}
          {activeTool === 'add-text' && (
            <div className="bg-[#0071E3] text-white text-xs font-medium py-1.5 px-4 text-center shadow-inner flex items-center justify-center gap-2">
              <Type size={14} />
              <span>Tippe oder klicke an eine beliebige Stelle auf der PDF-Seite, um das Textfeld zu platzieren.</span>
              <button
                onClick={() => setActiveTool('select')}
                className="ml-3 underline hover:opacity-80"
              >
                Abbrechen
              </button>
            </div>
          )}

          {/* Main Workspace (Sidebar Thumbnails + Canvas Area) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar with page management */}
            <div className="w-52 bg-white border-r border-[#E8E8ED] overflow-y-auto p-3 hidden sm:flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Seiten ({numPages})
                </span>
              </div>

              {/* Action buttons to Add Blank Page or Append PDF */}
              <div className="flex flex-col gap-1.5 pb-2 border-b border-gray-100">
                <button
                  onClick={handleAddBlankPage}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-[#0071E3] rounded-xl text-xs font-semibold transition"
                  title="Fügt eine leere A4-Seite am Ende des Dokuments ein"
                >
                  <Plus size={14} />
                  <span>Leere Seite</span>
                </button>

                <label className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition border border-gray-200/60">
                  <FileStack size={14} />
                  <span>PDF anhängen</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleAppendSecondPdf(e.target.files[0]);
                    }}
                  />
                </label>

                {onOpenMergeTab && (
                  <button
                    onClick={onOpenMergeTab}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold transition border border-purple-200/60"
                    title="Seiten visuell im Raster sortieren, drehen oder löschen"
                  >
                    <FileStack size={14} />
                    <span>Seiten organisieren ({numPages})</span>
                  </button>
                )}
              </div>

              {/* Thumbnails List */}
              <div className="flex flex-col gap-3">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
                  <div
                    key={pNum}
                    className={`relative p-2 rounded-xl flex flex-col items-center border transition group ${
                      currentPage === pNum
                        ? 'border-[#0071E3] bg-[#0071E3]/5 shadow-sm'
                        : 'border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <button
                      onClick={() => setCurrentPage(pNum)}
                      className="w-full flex flex-col items-center"
                    >
                      <div className="w-24 h-32 bg-gray-50 border border-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-400 shadow-inner">
                        <FileText
                          size={24}
                          className={currentPage === pNum ? 'text-[#0071E3]' : 'text-gray-300'}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 mt-1.5">Seite {pNum}</span>
                    </button>

                    {/* Delete Page Button (if document has more than 1 page) */}
                    {numPages > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage(pNum);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-md bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 shadow-sm border border-gray-200 transition"
                        title={`Seite ${pNum} löschen`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    {annotations.some((a) => a.pageNumber === pNum) && (
                      <span
                        className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-[#0071E3]"
                        title="Enthält Anmerkungen"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* PDF Viewport Scroll Area */}
            <div
              className="flex-1 overflow-auto flex items-start justify-center p-8 bg-[#E5E5EA]"
              onClick={() => setSelectedAnnId(null)}
              onDragOver={handleDragOver}
              onDrop={handleViewportDrop}
            >
              <div
                ref={pageContainerRef}
                onClick={handlePageClick}
                onDragOver={handleDragOver}
                onDrop={handleViewportDrop}
                className={`relative bg-white shadow-2xl rounded-sm transition-all ${
                  activeTool === 'add-text' ? 'cursor-crosshair' : 'cursor-default'
                }`}
                style={{
                  width: canvasDimensions.width || 'auto',
                  height: canvasDimensions.height || 'auto',
                }}
              >
                {/* Mozilla PDF.js Canvas */}
                <canvas ref={canvasRef} className="block" />

                {/* Overlaid Interactive Annotations Layer */}
                {canvasDimensions.width > 0 && (
                  <AnnotationLayer
                    pageNumber={currentPage}
                    pageWidth={canvasDimensions.width}
                    pageHeight={canvasDimensions.height}
                    annotations={annotations}
                    onUpdateAnnotation={handleUpdateAnnotation}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onDuplicateAnnotation={handleDuplicateAnnotation}
                    selectedAnnotationId={selectedAnnId}
                    onSelectAnnotation={setSelectedAnnId}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onConfirmSignature={handleAddSignature}
      />

      {/* Gemini AI Assistant Modal / Slide-Over */}
      <GeminiAiModal
        isOpen={isAiOpen}
        onClose={() => setAiOpen(false)}
        pdfBytes={pdfBytes}
        currentPage={currentPage}
        numPages={numPages}
        onInsertTextIntoPage={handleInsertTextFromAi}
        onInsertAsNewPage={handleInsertAsNewPageFromAi}
      />
    </div>
  );
};
