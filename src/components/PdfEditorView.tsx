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
  Undo2,
  Redo2,
  Highlighter,
  Stamp,
  ShieldAlert,
  CheckSquare,
  Hash,
  Search,
  RotateCw,
  Save,
  X,
  Check,
  Circle,
  Square,
  ArrowRight,
  Pencil,
  ClipboardList,
  ClipboardPaste,
  History,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Calendar,
  CheckCircle2,
  Home,
  ArrowLeft,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfWorker';
import { AnnotationLayer } from './AnnotationLayer';
import { SignatureModal } from './SignatureModal';
import { StampModal } from './StampModal';
import { FormFillerModal } from './FormFillerModal';
import { PageDecorationsModal } from './PageDecorationsModal';
import { SaveDocumentModal } from './SaveDocumentModal';
import { GeminiAiModal } from './GeminiAiModal';
import { formatMarkdownToCleanText, extractTextFromPdf } from '../lib/geminiService';
import { paginateDocumentForA4 } from '../lib/a4Pagination';
import {
  Annotation,
  TextAnnotation,
  SignatureAnnotation,
  ImageAnnotation,
  HighlightAnnotation,
  RedactionAnnotation,
  ShapeAnnotation,
  FreehandDrawingAnnotation,
  PdfFormFieldItem,
} from '../types/pdf';
import {
  applyAnnotationsToPdf,
  downloadPdf,
  createBlankPdfDocument,
  addBlankPageToPdf,
  addMultipleBlankPagesToPdf,
  appendPdfToPdf,
  deletePageFromPdf,
  processImageFile,
  replacePageWithBlank,
  rotatePageInPdf,
  inspectPdfFormFields,
} from '../lib/pdfEngine';
import {
  saveWorkspaceDraft,
  loadWorkspaceDraft,
  clearWorkspaceDraft,
  exportProjectFile,
  importProjectFile,
  SavedWorkspaceDraft,
} from '../lib/projectStorage';

interface PdfEditorViewProps {
  sharedPdfBytes: ArrayBuffer | null;
  sharedFileName: string;
  onPdfUpdate: (bytes: ArrayBuffer, fileName: string) => void;
  onOpenMergeTab?: () => void;
  onOpenToolsTab?: () => void;
  onGoHome?: () => void;
  isHomeView?: boolean;
  onGoToEditor?: () => void;
  isAiModalOpen?: boolean;
  onToggleAiModal?: (open: boolean) => void;
}

type EditorTool =
  | 'select'
  | 'add-text'
  | 'add-highlight'
  | 'add-redaction'
  | 'draw-freehand';

export const PdfEditorView: React.FC<PdfEditorViewProps> = ({
  sharedPdfBytes,
  sharedFileName,
  onPdfUpdate,
  onOpenMergeTab,
  onOpenToolsTab,
  onGoHome,
  isHomeView = false,
  onGoToEditor,
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

  // Active Tool & Modals
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDecorationsModalOpen, setIsDecorationsModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isDocSwitcherOpen, setIsDocSwitcherOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [internalIsAiModalOpen, setInternalIsAiModalOpen] = useState(false);

  // Detected interactive AcroForm fields
  const [formFields, setFormFields] = useState<PdfFormFieldItem[]>([]);

  // Fulltext Search State
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ page: number; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Saved draft from IndexedDB
  const [savedDraft, setSavedDraft] = useState<SavedWorkspaceDraft | null>(null);

  // Freehand drawing state
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<{ x: number; y: number }[]>([]);
  const [freehandColor, setFreehandColor] = useState('#0071E3');

  // Page Scroll & Wheel Navigation
  const viewportScrollRef = useRef<HTMLDivElement>(null);
  const lastWheelTurnRef = useRef<number>(0);
  const accumulatedWheelDeltaRef = useRef<number>(0);
  const [pageInputVal, setPageInputVal] = useState<string>('1');

  useEffect(() => {
    setPageInputVal(String(currentPage));
  }, [currentPage]);

  const isAiOpen = externalIsAiModalOpen !== undefined ? externalIsAiModalOpen : internalIsAiModalOpen;
  const setAiOpen = (val: boolean) => {
    if (onToggleAiModal) onToggleAiModal(val);
    setInternalIsAiModalOpen(val);
  };

  // Annotations list + Undo/Redo History
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // Helper to update annotations with undo history
  const pushAnnotationsChange = useCallback(
    (updater: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
      setAnnotations((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        setUndoStack((u) => [...u.slice(-29), prev]);
        setRedoStack([]);
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previousState = prevUndo[prevUndo.length - 1];
      setRedoStack((prevRedo) => [...prevRedo, annotations]);
      setAnnotations(previousState);
      return prevUndo.slice(0, -1);
    });
  }, [annotations]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextState = prevRedo[prevRedo.length - 1];
      setUndoStack((prevUndo) => [...prevUndo, annotations]);
      setAnnotations(nextState);
      return prevRedo.slice(0, -1);
    });
  }, [annotations]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Check for saved workspace draft on startup
  useEffect(() => {
    loadWorkspaceDraft().then((draft) => {
      if (draft && draft.pdfBytes && draft.pdfBytes.byteLength > 0) {
        setSavedDraft(draft);
      }
    });
  }, []);

  // Auto-save current workspace to IndexedDB when annotations or pdfBytes change
  useEffect(() => {
    if (!pdfBytes || !file) return;
    const timer = setTimeout(() => {
      saveWorkspaceDraft({
        fileName: file.name,
        documentTitle,
        pdfBytes,
        annotations,
        currentPage,
        updatedAt: Date.now(),
      }).then(() => {
        setLastAutoSavedAt(new Date());
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [pdfBytes, annotations, documentTitle, currentPage, file]);

  // Central Page Change Handler (with scroll positioning)
  const handlePageChange = useCallback(
    (newPage: number, targetScroll: 'top' | 'bottom' | 'preserve' = 'top') => {
      if (numPages <= 0) return;
      const page = Math.max(1, Math.min(numPages, newPage));
      if (page === currentPage) return;
      setCurrentPage(page);
      setPageInputVal(String(page));
      setSelectedAnnId(null);
      requestAnimationFrame(() => {
        if (viewportScrollRef.current) {
          if (targetScroll === 'top') {
            viewportScrollRef.current.scrollTop = 0;
          } else if (targetScroll === 'bottom') {
            viewportScrollRef.current.scrollTop = viewportScrollRef.current.scrollHeight;
          }
        }
      });
    },
    [numPages, currentPage]
  );

  // Mouse wheel / Trackpad page flipping at boundary
  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (numPages <= 1) return;
    if (e.metaKey || e.ctrlKey) return; // Allow pinch/Cmd zoom without page turn

    const container = viewportScrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isScrollable = scrollHeight > clientHeight + 10;
    const isAtBottom = !isScrollable || scrollTop + clientHeight >= scrollHeight - 6;
    const isAtTop = !isScrollable || scrollTop <= 6;

    const now = Date.now();
    const timeSinceLast = now - lastWheelTurnRef.current;
    if (timeSinceLast > 350) {
      accumulatedWheelDeltaRef.current = 0;
    }

    // Scroll Down past bottom -> Next Page
    if (e.deltaY > 0 && isAtBottom && currentPage < numPages) {
      accumulatedWheelDeltaRef.current += e.deltaY;
      if (accumulatedWheelDeltaRef.current > 45 && timeSinceLast > 350) {
        lastWheelTurnRef.current = now;
        accumulatedWheelDeltaRef.current = 0;
        handlePageChange(currentPage + 1, 'top');
      }
    }
    // Scroll Up past top -> Previous Page
    else if (e.deltaY < 0 && isAtTop && currentPage > 1) {
      accumulatedWheelDeltaRef.current += e.deltaY;
      if (accumulatedWheelDeltaRef.current < -45 && timeSinceLast > 350) {
        lastWheelTurnRef.current = now;
        accumulatedWheelDeltaRef.current = 0;
        handlePageChange(currentPage - 1, 'bottom');
      }
    } else {
      accumulatedWheelDeltaRef.current = 0;
    }
  };

  // Keyboard shortcuts: Cmd+S (Save), Cmd+Z (Undo), Cmd+Shift+Z / Cmd+Y (Redo), Cmd+F (Search), Delete, Arrow/Page Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && pdfBytes) {
        e.preventDefault();
        setIsSaveModalOpen(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && pdfBytes) {
        e.preventDefault();
        setShowSearchBar((s) => !s);
        return;
      }

      if (isInput) return;

      // Page Navigation with Left/Right or PageUp/PageDown (when not editing an annotation)
      if (numPages > 1 && !selectedAnnId) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          if (currentPage < numPages) {
            e.preventDefault();
            handlePageChange(currentPage + 1, 'top');
            return;
          }
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          if (currentPage > 1) {
            e.preventDefault();
            handlePageChange(currentPage - 1, 'top');
            return;
          }
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnId) {
        e.preventDefault();
        pushAnnotationsChange((prev) => prev.filter((a) => a.id !== selectedAnnId));
        setSelectedAnnId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedAnnId, pdfBytes, pushAnnotationsChange, numPages, currentPage, handlePageChange]);

  // Reload an updated PDF buffer into pdfjs viewer & inspect AcroForm fields
  const reloadPdfFromBuffer = async (
    buffer: ArrayBuffer | Uint8Array,
    targetPage: number = 1,
    notify: boolean = true
  ) => {
    setLoading(true);
    try {
      const arrayBuf = buffer instanceof Uint8Array ? (buffer.buffer as ArrayBuffer) : buffer;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuf.slice(0) });
      const loadedDoc = await loadingTask.promise;
      setPdfBytes(arrayBuf);
      setPdfDoc(loadedDoc);
      setNumPages(loadedDoc.numPages);
      setCurrentPage(Math.min(Math.max(1, targetPage), loadedDoc.numPages));

      // Check for interactive AcroForm fields
      inspectPdfFormFields(arrayBuf).then((detected) => {
        setFormFields(detected);
      });

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

  // Sync when shared document from outside (e.g. merge or tools view) changes
  useEffect(() => {
    if (sharedPdfBytes && sharedPdfBytes !== lastSyncRef.current && sharedPdfBytes !== pdfBytes) {
      lastSyncRef.current = sharedPdfBytes;
      const syncFile = new File([sharedPdfBytes as any], sharedFileName || 'Dokument.pdf', {
        type: 'application/pdf',
      });
      setFile(syncFile);
      if (sharedFileName) {
        setDocumentTitle(sharedFileName.replace(/\.pdf$/i, ''));
      }
      reloadPdfFromBuffer(sharedPdfBytes, currentPage, false);
    }
  }, [sharedPdfBytes, sharedFileName]);

  // Handle PDF or .pdftool file selection
  const handleFileChange = async (selectedFile: File) => {
    if (selectedFile.name.endsWith('.pdftool')) {
      setLoading(true);
      try {
        const imported = await importProjectFile(selectedFile);
        const mockFile = new File([imported.pdfBytes as any], imported.fileName, {
          type: 'application/pdf',
        });
        setFile(mockFile);
        setDocumentTitle(imported.documentTitle);
        setAnnotations(imported.annotations);
        setUndoStack([]);
        setRedoStack([]);
        await reloadPdfFromBuffer(imported.pdfBytes, imported.currentPage);
      } catch (err: any) {
        alert(err?.message || 'Projektdatei konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Bitte wähle eine gültige PDF-Datei oder .pdftool-Projektdatei aus.');
      return;
    }

    setLoading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      setFile(selectedFile);
      const cleanName = selectedFile.name.replace(/\.pdf$/i, '');
      setDocumentTitle(cleanName.endsWith('_bearbeitet') ? cleanName : `${cleanName}_bearbeitet`);
      setAnnotations([]);
      setUndoStack([]);
      setRedoStack([]);
      await reloadPdfFromBuffer(buffer, 1);
    } catch (err) {
      console.error('Fehler beim Laden der PDF:', err);
      alert('Die PDF konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  // Restore saved IndexedDB draft
  const handleRestoreDraft = async () => {
    if (!savedDraft) return;
    const mockFile = new File([savedDraft.pdfBytes as any], savedDraft.fileName || 'Dokument.pdf', {
      type: 'application/pdf',
    });
    setFile(mockFile);
    setDocumentTitle(savedDraft.documentTitle || 'Dokument_bearbeitet');
    setAnnotations(savedDraft.annotations || []);
    setUndoStack([]);
    setRedoStack([]);
    await reloadPdfFromBuffer(savedDraft.pdfBytes, savedDraft.currentPage || 1);
  };

  // Create a brand new blank PDF from scratch
  const handleCreateNewBlankPdf = async () => {
    setLoading(true);
    try {
      const blankBytes = await createBlankPdfDocument();
      const mockFile = new File([blankBytes as any], 'Neues_Dokument.pdf', {
        type: 'application/pdf',
      });
      setFile(mockFile);
      setDocumentTitle('Neues_Dokument');
      setAnnotations([]);
      setUndoStack([]);
      setRedoStack([]);
      await reloadPdfFromBuffer(blankBytes, 1);
    } catch (err) {
      console.error('Fehler beim Erstellen eines neuen PDFs:', err);
      alert('Neues Dokument konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  };

  // Close active document safely (state remains saved in workspace draft)
  const handleCloseDocument = () => {
    setFile(null);
    setPdfBytes(null);
    setPdfDoc(null);
    setAnnotations([]);
    setUndoStack([]);
    setRedoStack([]);
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

  // Rotate current or specific page 90 degrees
  const handleRotatePage = async (pageToRotate: number) => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      const updatedBytes = await rotatePageInPdf(pdfBytes, pageToRotate - 1, 90);
      await reloadPdfFromBuffer(updatedBytes, pageToRotate);
    } catch (err) {
      console.error('Fehler beim Drehen der Seite:', err);
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

      pushAnnotationsChange((prev) =>
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

  // Fulltext Search across all pages
  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pdfBytes || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { pageTexts } = await extractTextFromPdf(pdfBytes, undefined, annotations);
      const q = searchQuery.trim().toLowerCase();
      const matches: { page: number; snippet: string }[] = [];

      for (const pt of pageTexts) {
        const idx = pt.text.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 35);
          const end = Math.min(pt.text.length, idx + q.length + 55);
          const snippet =
            (start > 0 ? '…' : '') + pt.text.slice(start, end) + (end < pt.text.length ? '…' : '');
          matches.push({ page: pt.page, snippet });
        }
      }
      setSearchResults(matches);
      if (matches.length > 0) {
        setCurrentPage(matches[0].page);
      }
    } catch (err) {
      console.error('Suche fehlgeschlagen:', err);
    } finally {
      setSearching(false);
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

  // Handle click on PDF to place Text, Highlight, or Redaction
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      activeTool === 'select' ||
      activeTool === 'draw-freehand' ||
      !pageContainerRef.current ||
      canvasDimensions.width <= 0
    ) {
      return;
    }

    const rect = pageContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0.02, Math.min(0.75, clickX / canvasDimensions.width));
    const normY = Math.max(0.02, Math.min(0.92, clickY / canvasDimensions.height));

    if (activeTool === 'add-text') {
      const newTextAnn: TextAnnotation = {
        id: `text_${Date.now()}`,
        type: 'text',
        pageNumber: currentPage,
        x: normX,
        y: normY,
        width: 0.36,
        text: '',
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      };
      pushAnnotationsChange((prev) => [...prev, newTextAnn]);
      setSelectedAnnId(newTextAnn.id);
      setActiveTool('select');
    } else if (activeTool === 'add-highlight') {
      const newHl: HighlightAnnotation = {
        id: `hl_${Date.now()}`,
        type: 'highlight',
        pageNumber: currentPage,
        x: normX,
        y: Math.max(0.01, normY - 0.012),
        width: 0.28,
        height: 0.028,
        color: '#FACC15',
      };
      pushAnnotationsChange((prev) => [...prev, newHl]);
      setSelectedAnnId(newHl.id);
      setActiveTool('select');
    } else if (activeTool === 'add-redaction') {
      const newRed: RedactionAnnotation = {
        id: `red_${Date.now()}`,
        type: 'redaction',
        pageNumber: currentPage,
        x: normX,
        y: Math.max(0.01, normY - 0.015),
        width: 0.25,
        height: 0.032,
        label: 'DSGVO',
      };
      pushAnnotationsChange((prev) => [...prev, newRed]);
      setSelectedAnnId(newRed.id);
      setActiveTool('select');
    }
  };

  // Freehand drawing pointer handlers on page container
  const handlePagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'draw-freehand' || !pageContainerRef.current || canvasDimensions.width <= 0) {
      return;
    }
    e.preventDefault();
    const rect = pageContainerRef.current.getBoundingClientRect();
    const pt = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / canvasDimensions.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / canvasDimensions.height)),
    };
    setIsDrawingStroke(true);
    setCurrentStrokePoints([pt]);
  };

  const handlePagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingStroke || activeTool !== 'draw-freehand' || !pageContainerRef.current) return;
    e.preventDefault();
    const rect = pageContainerRef.current.getBoundingClientRect();
    const pt = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / canvasDimensions.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / canvasDimensions.height)),
    };
    setCurrentStrokePoints((prev) => [...prev, pt]);
  };

  const handlePagePointerUp = () => {
    if (!isDrawingStroke || activeTool !== 'draw-freehand') return;
    setIsDrawingStroke(false);
    if (currentStrokePoints.length > 1) {
      const newDrawing: FreehandDrawingAnnotation = {
        id: `draw_${Date.now()}`,
        type: 'drawing',
        pageNumber: currentPage,
        points: currentStrokePoints,
        color: freehandColor,
        strokeWidth: 2.5,
      };
      pushAnnotationsChange((prev) => [...prev, newDrawing]);
      setSelectedAnnId(newDrawing.id);
    }
    setCurrentStrokePoints([]);
  };

  // Insert quick shape or symbol (Checkmark, Cross, Rect, Circle, Arrow)
  const handleInsertShape = (
    shapeType: 'check' | 'cross' | 'rect' | 'circle' | 'arrow',
    defaultColor: string
  ) => {
    const isSymbol = shapeType === 'check' || shapeType === 'cross';
    const newShape: ShapeAnnotation = {
      id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: 'shape',
      pageNumber: currentPage,
      shapeType,
      x: 0.42,
      y: 0.42,
      width: isSymbol ? 0.045 : 0.18,
      height: isSymbol ? 0.032 : shapeType === 'arrow' ? 0.04 : 0.08,
      color: defaultColor,
      strokeWidth: 3,
    };
    pushAnnotationsChange((prev) => [...prev, newShape]);
    setSelectedAnnId(newShape.id);
    setShowShapesMenu(false);
  };

  // Insert pre-formatted text block (Checklist, Bullet list, Numbered list, Heading, Date)
  const handleInsertListTemplate = (
    templateType: 'checklist' | 'bullet' | 'numbered' | 'heading' | 'date'
  ) => {
    const today = new Date().toLocaleDateString('de-DE');
    let initialText = '';
    if (templateType === 'checklist') {
      initialText = '[ ] Punkt 1\n[ ] Punkt 2\n[ ] Punkt 3';
    } else if (templateType === 'bullet') {
      initialText = '• Erster Punkt\n• Zweiter Punkt\n• Dritter Punkt';
    } else if (templateType === 'numbered') {
      initialText = '1. Erster Schritt\n2. Zweiter Schritt\n3. Dritter Schritt';
    } else if (templateType === 'heading') {
      initialText = '# Überschrift\nHier Text eingeben...';
    } else if (templateType === 'date') {
      initialText = `Datum: ${today}`;
    }

    const newTextAnn: TextAnnotation = {
      id: `text_${Date.now()}`,
      type: 'text',
      pageNumber: currentPage,
      x: 0.12,
      y: 0.2,
      width: 0.45,
      text: initialText,
      fontSize: 14,
      color: '#000000',
      backgroundColor: 'transparent',
    };
    pushAnnotationsChange((prev) => [...prev, newTextAnn]);
    setSelectedAnnId(newTextAnn.id);
    setActiveTool('select');
    setShowListMenu(false);
  };

  // Duplicate an existing annotation
  const handleDuplicateAnnotation = (ann: Annotation) => {
    if (ann.type === 'drawing') return;
    const copy = {
      ...ann,
      id: `${ann.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: Math.min(0.92, ann.x + 0.03),
      y: Math.min(0.92, ann.y + 0.03),
    };
    pushAnnotationsChange((prev) => [...prev, copy as Annotation]);
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

      let initialWidth = 0.28;
      const pageAspect =
        canvasDimensions.width > 0 && canvasDimensions.height > 0
          ? canvasDimensions.width / canvasDimensions.height
          : 0.707;

      let initialHeight = (initialWidth * pageAspect) / aspectRatio;

      if (initialHeight > 0.3) {
        initialHeight = 0.3;
        initialWidth = (initialHeight / pageAspect) * aspectRatio;
      }

      if (initialWidth > 0.45) {
        initialWidth = 0.45;
        initialHeight = (initialWidth * pageAspect) / aspectRatio;
      }

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

      pushAnnotationsChange((prev) => [...prev, newImgAnn]);
      setSelectedAnnId(newImgAnn.id);
    } catch (err) {
      console.error('Fehler beim Einfügen des Bildes:', err);
      alert('Das Bild konnte nicht geladen werden.');
    }
  };

  // Insert Stamp from StampModal
  const handleAddStamp = (dataUrl: string, aspectRatio: number, label: string) => {
    const pageAspect =
      canvasDimensions.width > 0 && canvasDimensions.height > 0
        ? canvasDimensions.width / canvasDimensions.height
        : 0.707;
    const width = 0.26;
    const height = (width * pageAspect) / aspectRatio;

    const stampAnn: ImageAnnotation = {
      id: `stamp_${Date.now()}`,
      type: 'image',
      pageNumber: currentPage,
      x: 0.62,
      y: 0.12,
      width,
      height,
      dataUrl,
      aspectRatio,
      lockAspectRatio: true,
      name: `Stempel: ${label}`,
    };

    pushAnnotationsChange((prev) => [...prev, stampAnn]);
    setSelectedAnnId(stampAnn.id);
  };

  // Insert pasted text (e.g. from external AI research) onto current page or selected text box
  const insertPastedTextContent = useCallback(
    (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;
      const cleanText = formatMarkdownToCleanText(trimmed);

      // If a text annotation on the current page is currently selected, append/insert into it
      if (selectedAnnId) {
        const selectedAnn = annotations.find((a) => a.id === selectedAnnId);
        if (selectedAnn && selectedAnn.type === 'text' && selectedAnn.pageNumber === currentPage) {
          const textAnn = selectedAnn as TextAnnotation;
          const updatedText = textAnn.text ? `${textAnn.text}\n${cleanText}` : cleanText;
          pushAnnotationsChange((prev) =>
            prev.map((a) => (a.id === textAnn.id ? { ...textAnn, text: updatedText } : a))
          );
          return;
        }
      }

      // Check if it's a long multi-page AI research text
      const pages = paginateDocumentForA4(cleanText, 14);
      if (pages.length > 1) {
        handleInsertTextFromAi(cleanText);
        return;
      }

      // Otherwise create a new text box right on the current page
      const isLongBlock = cleanText.length > 160 || cleanText.includes('\n');
      const newTextAnn: TextAnnotation = {
        id: `text_${Date.now()}`,
        type: 'text',
        pageNumber: currentPage,
        x: isLongBlock ? 0.08 : 0.15,
        y: isLongBlock ? 0.12 : 0.2,
        width: isLongBlock ? 0.84 : 0.45,
        text: cleanText,
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      };
      pushAnnotationsChange((prev) => [...prev, newTextAnn]);
      setSelectedAnnId(newTextAnn.id);
      setActiveTool('select');
    },
    [selectedAnnId, annotations, currentPage, pdfBytes]
  );

  const handlePasteFromToolbar = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        insertPastedTextContent(clipText);
      } else {
        alert('Die Zwischenablage enthält aktuell keinen Text.');
      }
    } catch {
      alert(
        'Tipp: Drücke einfach direkt Cmd+V (Mac) bzw. Strg+V (Windows) auf der PDF-Seite, um Text oder Screenshots aus der Zwischenablage einzufügen.'
      );
    }
  };

  // Clipboard paste listener (Cmd+V / Ctrl+V for screenshots AND text / AI research)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
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
            return;
          }
        }
      }

      const pastedText = e.clipboardData.getData('text/plain');
      if (pastedText && pastedText.trim()) {
        e.preventDefault();
        insertPastedTextContent(pastedText);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pdfBytes, currentPage, canvasDimensions, insertPastedTextContent]);

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

    pushAnnotationsChange((prev) => [...prev, newSigAnn]);
    setSelectedAnnId(newSigAnn.id);
  };

  // Insert AI generated text into current page
  const handleInsertTextFromAi = async (text: string) => {
    const cleanText = formatMarkdownToCleanText(text);
    const pages = paginateDocumentForA4(cleanText, 14);

    if (pages.length <= 1 || !pdfBytes) {
      const newTextAnn: TextAnnotation = {
        id: `text_${Date.now()}`,
        type: 'text',
        pageNumber: currentPage,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pages[0] || cleanText,
        fontSize: 14,
        color: '#000000',
        backgroundColor: '#FFFFFF',
      };

      pushAnnotationsChange((prev) => [...prev, newTextAnn]);
      setSelectedAnnId(newTextAnn.id);
      setAiOpen(false);
      return;
    }

    setLoading(true);
    try {
      const additionalCount = pages.length - 1;
      const updatedBytes = await addMultipleBlankPagesToPdf(
        pdfBytes,
        additionalCount,
        currentPage - 1
      );
      await reloadPdfFromBuffer(updatedBytes, currentPage);

      const page1Ann: TextAnnotation = {
        id: `text_${Date.now()}_0`,
        type: 'text',
        pageNumber: currentPage,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pages[0],
        fontSize: 14,
        color: '#000000',
        backgroundColor: '#FFFFFF',
      };

      const remainingAnns: TextAnnotation[] = pages.slice(1).map((pageSlice, idx) => ({
        id: `text_${Date.now()}_${idx + 1}`,
        type: 'text',
        pageNumber: currentPage + 1 + idx,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pageSlice,
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      }));

      pushAnnotationsChange((prev) => [
        ...prev.map((a) =>
          a.pageNumber > currentPage ? { ...a, pageNumber: a.pageNumber + additionalCount } : a
        ),
        page1Ann,
        ...remainingAnns,
      ]);
      setSelectedAnnId(page1Ann.id);
      setAiOpen(false);
    } catch (err) {
      console.error('Fehler beim Einfügen in Seite:', err);
      alert('Konnte Text nicht vollständig aufteilen.');
    } finally {
      setLoading(false);
    }
  };

  // Replace current page with clean AI generated text
  const handleReplaceCurrentPageWithAiText = async (text: string) => {
    if (!pdfBytes) return;
    const cleanText = formatMarkdownToCleanText(text);
    const pages = paginateDocumentForA4(cleanText, 14);
    const additionalCount = Math.max(0, pages.length - 1);

    setLoading(true);
    try {
      const updatedBytes = await replacePageWithBlank(
        pdfBytes,
        currentPage - 1,
        additionalCount
      );

      await reloadPdfFromBuffer(updatedBytes, currentPage);

      const page1Ann: TextAnnotation = {
        id: `text_${Date.now()}_0`,
        type: 'text',
        pageNumber: currentPage,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pages[0] || cleanText,
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      };

      const remainingAnns: TextAnnotation[] = pages.slice(1).map((pageSlice, idx) => ({
        id: `text_${Date.now()}_${idx + 1}`,
        type: 'text',
        pageNumber: currentPage + 1 + idx,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pageSlice,
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      }));

      pushAnnotationsChange((prev) => [
        ...prev
          .filter((a) => a.pageNumber !== currentPage)
          .map((a) =>
            a.pageNumber > currentPage ? { ...a, pageNumber: a.pageNumber + additionalCount } : a
          ),
        page1Ann,
        ...remainingAnns,
      ]);

      setSelectedAnnId(page1Ann.id);
      setAiOpen(false);
    } catch (err) {
      console.error('Fehler beim Ersetzen der Seite durch KI-Text:', err);
      alert('Konnte Seite nicht durch KI-Text ersetzen.');
    } finally {
      setLoading(false);
    }
  };

  // Insert AI generated text as new dedicated A4 page(s)
  const handleInsertAsNewPageFromAi = async (text: string) => {
    if (!pdfBytes) return;
    setLoading(true);
    try {
      const cleanText = formatMarkdownToCleanText(text);
      const pages = paginateDocumentForA4(cleanText, 14);
      const pageCount = pages.length;

      const updatedBytes = await addMultipleBlankPagesToPdf(pdfBytes, pageCount);
      const startPageNum = numPages + 1;
      await reloadPdfFromBuffer(updatedBytes, startPageNum);

      const newAnnotations: TextAnnotation[] = pages.map((pageSlice, idx) => ({
        id: `text_${Date.now()}_${idx}`,
        type: 'text',
        pageNumber: startPageNum + idx,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        text: pageSlice,
        fontSize: 14,
        color: '#000000',
        backgroundColor: 'transparent',
      }));

      pushAnnotationsChange((prev) => [...prev, ...newAnnotations]);
      if (newAnnotations.length > 0) {
        setSelectedAnnId(newAnnotations[0].id);
      }
      setAiOpen(false);
    } catch (err) {
      console.error('Fehler beim Einfügen als neue Seite(n):', err);
      alert('Konnte keine neuen A4-Seiten für den KI-Text anlegen.');
    } finally {
      setLoading(false);
    }
  };

  // Update annotation
  const handleUpdateAnnotation = (updated: Annotation) => {
    setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  // Delete annotation
  const handleDeleteAnnotation = (id: string) => {
    pushAnnotationsChange((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnId === id) setSelectedAnnId(null);
  };

  // Export & Save final PDF (with custom name & optional native Save-As file picker)
  const handleExport = async (customTitle?: string, useFilePicker: boolean = false) => {
    if (!pdfBytes) return;
    const effectiveTitle = (customTitle ?? documentTitle).trim().replace(/\.pdf$/i, '') || 'Dokument_bearbeitet';
    setDocumentTitle(effectiveTitle);
    setExporting(true);

    try {
      const modifiedBytes = await applyAnnotationsToPdf(pdfBytes, annotations);
      const saved = await downloadPdf(modifiedBytes, `${effectiveTitle}.pdf`, useFilePicker);
      if (saved) {
        setIsSaveModalOpen(false);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Fehler beim Exportieren der PDF: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  // Save editable .pdftool project file
  const handleExportProject = async (customTitle?: string, useFilePicker: boolean = false) => {
    if (!pdfBytes) return;
    const effectiveTitle = (customTitle ?? documentTitle).trim().replace(/\.(pdf|pdftool)$/i, '') || 'Projekt';
    setDocumentTitle(effectiveTitle);
    const saved = await exportProjectFile(
      pdfBytes,
      annotations,
      file?.name || 'Dokument.pdf',
      effectiveTitle,
      currentPage,
      useFilePicker
    );
    if (saved) {
      setIsSaveModalOpen(false);
    }
  };

  // Save to internal IndexedDB draft workspace only
  const handleSaveDraftOnly = async (customTitle: string) => {
    if (!pdfBytes || !file) return;
    const effectiveTitle = customTitle.trim().replace(/\.pdf$/i, '') || 'Dokument_bearbeitet';
    setDocumentTitle(effectiveTitle);
    await saveWorkspaceDraft({
      fileName: file.name,
      documentTitle: effectiveTitle,
      pdfBytes,
      annotations,
      currentPage,
      updatedAt: Date.now(),
    });
    setLastAutoSavedAt(new Date());
  };

  // Dropzone drag events
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
    } else if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdftool')) {
      handleFileChange(droppedFile);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] overflow-hidden bg-[#F5F5F7]">
      {isHomeView || !file ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          {/* Active Workspace Document Banner */}
          {file && (
            <div className="w-full max-w-5xl mb-6 p-4 bg-white border border-[#0071E3]/40 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Aktives Arbeitsdokument im Editor: „{documentTitle}.pdf“
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {numPages} {numPages === 1 ? 'Seite' : 'Seiten'} • {annotations.length} bearbeitbare Elemente
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseDocument}
                  className="px-3 py-1.5 rounded-xl text-xs text-gray-600 hover:text-red-600 hover:bg-gray-100 transition cursor-pointer"
                  title="Dokument schließen (Stand bleibt im Verlauf gesichert)"
                >
                  Dokument schließen
                </button>
                <button
                  onClick={onGoToEditor}
                  className="px-4 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Jetzt weiterbearbeiten
                </button>
              </div>
            </div>
          )}

          {/* Resume Saved Draft Banner */}
          {!file && savedDraft && (
            <div className="w-full max-w-5xl mb-6 p-4 bg-white border border-blue-200 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0">
                  <History size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Letztes Arbeitsdokument fortsetzen: „{savedDraft.documentTitle}.pdf“
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Automatisch gespeichert ({savedDraft.annotations?.length || 0} bearbeitbare Elemente, Seite {savedDraft.currentPage})
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearWorkspaceDraft();
                    setSavedDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition cursor-pointer"
                >
                  Verwerfen
                </button>
                <button
                  onClick={async () => {
                    await handleRestoreDraft();
                    onGoToEditor?.();
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Jetzt weiterbearbeiten
                </button>
              </div>
            </div>
          )}

          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Open existing PDF or .pdftool Project */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="p-6 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Upload size={28} />
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F] mb-2">PDF oder Projekt öffnen</h2>
              <p className="text-xs text-[#86868B] mb-5 flex-1">
                PDF-Datei oder gespeicherte <code className="font-mono">.pdftool</code>-Projektdatei reinziehen, um zu bearbeiten, zu stempeln, zu schwärzen oder zu signieren.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="w-full py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-md transition text-center cursor-pointer"
              >
                PDF / Projekt auswählen
              </button>
            </div>

            {/* Card 2: Create new blank PDF */}
            <div
              onClick={async () => {
                await handleCreateNewBlankPdf();
                onGoToEditor?.();
              }}
              className="p-6 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-emerald-500 transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <FilePlus size={28} />
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F] mb-2">Leeres A4-Dokument</h2>
              <p className="text-xs text-[#86868B] mb-5 flex-1">
                Erstelle ein leeres DIN-A4-PDF von Grund auf – ideal für Briefe, Angebote, Protokolle oder Vorlagen.
              </p>
              <button
                type="button"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition text-center cursor-pointer"
              >
                Leeres PDF anlegen
              </button>
            </div>

            {/* Card 3: Merge & Organize */}
            <div
              onClick={onOpenMergeTab}
              className="p-6 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-indigo-500 transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <FileStack size={28} />
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F] mb-2">Zusammenführen & Sortieren</h2>
              <p className="text-xs text-[#86868B] mb-5 flex-1">
                Mehrere PDFs und Bilder kombinieren, Seiten per Drag-and-Drop neu anordnen, drehen oder löschen.
              </p>
              <button
                type="button"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition text-center cursor-pointer"
              >
                Zu den Seiten-Tools
              </button>
            </div>

            {/* Card 4: Business Tools Shortcut */}
            <div
              onClick={onOpenToolsTab}
              className="p-6 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-purple-500 transition-all flex flex-col items-center text-center shadow-lg group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Sparkles size={28} />
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F] mb-2">Firmen-Werkzeuge</h2>
              <p className="text-xs text-[#86868B] mb-5 flex-1">
                PDFs teilen, Dateigröße komprimieren, ZUGFeRD/XRechnung prüfen, Verträge vergleichen (Diff) oder Bilder konvertieren.
              </p>
              <button
                type="button"
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md transition text-center cursor-pointer"
              >
                Zu den Werkzeugen
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf,.pdftool"
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={async (e) => {
              if (e.target.files?.[0]) {
                await handleFileChange(e.target.files[0]);
                onGoToEditor?.();
              }
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <>
          {/* Top Action & Tool Bar */}
          <div className="min-h-[56px] bg-white border-b border-[#E8E8ED] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-sm z-20">
            {/* Left: Annotation & Office Tools */}
            <div className="flex flex-wrap items-center gap-1.5">
              {onGoHome && (
                <button
                  onClick={onGoHome}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:text-black bg-[#F5F5F7] hover:bg-gray-200 border border-gray-200 transition cursor-pointer mr-1 shadow-xs"
                  title="Zur Startseite / Hauptmenü (Aktuelles Dokument bleibt erhalten)"
                >
                  <ArrowLeft size={14} />
                  <span>Startseite</span>
                </button>
              )}

              {/* Undo / Redo */}
              <div className="flex items-center bg-[#F5F5F7] rounded-xl p-0.5 mr-0.5">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 text-gray-700 transition"
                  title="Rückgängig (Cmd+Z / Strg+Z)"
                >
                  <Undo2 size={15} />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 text-gray-700 transition"
                  title="Wiederholen (Cmd+Shift+Z)"
                >
                  <Redo2 size={15} />
                </button>
              </div>

              {/* Add Text */}
              <button
                onClick={() => setActiveTool(activeTool === 'add-text' ? 'select' : 'add-text')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTool === 'add-text'
                    ? 'bg-[#0071E3] text-white shadow-sm'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200'
                }`}
                title="Klicke auf die PDF-Seite, um ein Textfeld zu platzieren und sofort loszuschreiben"
              >
                <Type size={14} />
                <span>Text</span>
              </button>

              {/* Quick Lists & Checklists Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowListMenu((s) => !s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    showListMenu
                      ? 'bg-[#0071E3] text-white shadow-sm'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200'
                  }`}
                  title="Checkliste, Aufzählung (•) oder nummerierte Liste (1. 2. 3.) direkt einfügen"
                >
                  <ListChecks size={14} />
                  <span>Listen & Checkliste</span>
                </button>

                {showListMenu && (
                  <div
                    className="absolute left-0 top-10 w-60 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 z-40 space-y-1 text-xs"
                    onMouseLeave={() => setShowListMenu(false)}
                  >
                    <button
                      onClick={() => handleInsertListTemplate('checklist')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 font-semibold transition"
                    >
                      <ListChecks size={15} className="text-emerald-600" />
                      <span>Checkliste (☐ zum Abhaken)</span>
                    </button>
                    <button
                      onClick={() => handleInsertListTemplate('bullet')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 text-gray-800 font-semibold transition"
                    >
                      <List size={15} className="text-[#0071E3]" />
                      <span>Aufzählung (• Punkte)</span>
                    </button>
                    <button
                      onClick={() => handleInsertListTemplate('numbered')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 text-gray-800 font-semibold transition"
                    >
                      <ListOrdered size={15} className="text-[#0071E3]" />
                      <span>Nummerierte Liste (1. 2. 3.)</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => handleInsertListTemplate('heading')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-800 font-medium transition"
                    >
                      <Heading1 size={14} className="text-gray-700" />
                      <span>Überschrift + Textblock</span>
                    </button>
                    <button
                      onClick={() => handleInsertListTemplate('date')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-800 font-medium transition"
                    >
                      <Calendar size={14} className="text-gray-700" />
                      <span>Tagesdatum einfügen</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Paste Text from Clipboard (e.g. from AI research) */}
              <button
                onClick={handlePasteFromToolbar}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] hover:bg-blue-50 hover:text-[#0071E3] text-[#1D1D1F] rounded-xl text-xs font-semibold transition"
                title="Kopierten Text aus der Zwischenablage (z. B. aus einer KI-Recherche) direkt auf die Seite einfügen (oder Cmd+V / Strg+V drücken)"
              >
                <ClipboardPaste size={14} />
                <span>Einfügen</span>
              </button>

              {/* Image / Photo / Logo (always visible label, freely movable & resizable) */}
              <button
                onClick={() => document.getElementById('image-upload-editor')?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] hover:bg-blue-50 hover:text-[#0071E3] text-[#1D1D1F] rounded-xl text-xs font-semibold transition"
                title="Bild, Foto, Logo oder Screenshot einfügen (frei platzierbar & stufenlos skalierbar – oder per Drag & Drop / Cmd+V)"
              >
                <ImageIcon size={14} />
                <span>Bild / Foto</span>
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

              {/* Highlighter */}
              <button
                onClick={() =>
                  setActiveTool(activeTool === 'add-highlight' ? 'select' : 'add-highlight')
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTool === 'add-highlight'
                    ? 'bg-amber-400 text-amber-950 shadow-sm'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-amber-100'
                }`}
                title="Textmarker auf der Seite platzieren"
              >
                <Highlighter size={14} />
                <span>Marker</span>
              </button>

              {/* Shapes & Symbols Dropdown (Check, Cross, Rect, Circle, Arrow, Freehand) */}
              <div className="relative">
                <button
                  onClick={() => setShowShapesMenu((s) => !s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeTool === 'draw-freehand' || showShapesMenu
                      ? 'bg-[#0071E3] text-white shadow-sm'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200'
                  }`}
                  title="Häkchen, Kreuz, Rahmen, Pfeil oder Freihand-Stift"
                >
                  <CheckSquare size={14} />
                  <span>Symbole & Formen</span>
                </button>

                {showShapesMenu && (
                  <div
                    className="absolute left-0 top-10 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 z-40 space-y-1 text-xs"
                    onMouseLeave={() => setShowShapesMenu(false)}
                  >
                    <button
                      onClick={() => handleInsertShape('check', '#107C41')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 font-semibold transition"
                    >
                      <Check size={15} className="text-emerald-600 stroke-[3]" />
                      <span>Häkchen (✓ Grün)</span>
                    </button>
                    <button
                      onClick={() => handleInsertShape('cross', '#E02020')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-gray-800 font-semibold transition"
                    >
                      <X size={15} className="text-red-600 stroke-[3]" />
                      <span>Kreuzchen (✗ Rot)</span>
                    </button>
                    <button
                      onClick={() => handleInsertShape('rect', '#E02020')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-800 font-medium transition"
                    >
                      <Square size={14} className="text-red-600" />
                      <span>Rahmen / Kasten</span>
                    </button>
                    <button
                      onClick={() => handleInsertShape('circle', '#E02020')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-800 font-medium transition"
                    >
                      <Circle size={14} className="text-red-600" />
                      <span>Kreis / Markierung</span>
                    </button>
                    <button
                      onClick={() => handleInsertShape('arrow', '#0071E3')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-800 font-medium transition"
                    >
                      <ArrowRight size={14} className="text-[#0071E3]" />
                      <span>Pfeil</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        setActiveTool(
                          activeTool === 'draw-freehand' ? 'select' : 'draw-freehand'
                        );
                        setShowShapesMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 text-[#0071E3] font-semibold transition"
                    >
                      <Pencil size={14} />
                      <span>Freihand-Stift zeichnen</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Company & Status Stamp */}
              <button
                onClick={() => setIsStampModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] hover:bg-emerald-50 hover:text-emerald-700 text-[#1D1D1F] rounded-xl text-xs font-semibold transition"
                title="Firmenstempel (FREIGEGEBEN, BEZAHLT, GEPRÜFT, VERTRAULICH) mit Datum einfügen"
              >
                <Stamp size={14} />
                <span>Stempel</span>
              </button>

              {/* DSGVO Redaction (Blackout) */}
              <button
                onClick={() =>
                  setActiveTool(activeTool === 'add-redaction' ? 'select' : 'add-redaction')
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTool === 'add-redaction'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-red-50 hover:text-red-700'
                }`}
                title="DSGVO-Schwärzung: Sensible Daten unwiderruflich schwärzen"
              >
                <ShieldAlert size={14} />
                <span>Schwärzen</span>
              </button>

              {/* Signature */}
              <button
                onClick={() => setIsSignatureModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] hover:bg-gray-200 text-[#1D1D1F] rounded-xl text-xs font-semibold transition"
              >
                <PenTool size={14} />
                <span>Signatur</span>
              </button>

              {/* Page Numbers & Watermark */}
              <button
                onClick={() => setIsDecorationsModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] hover:bg-indigo-50 hover:text-indigo-700 text-[#1D1D1F] rounded-xl text-xs font-semibold transition"
                title="Seitenzahlen, Kopf-/Fußzeile oder Wasserzeichen auf alle Seiten anwenden"
              >
                <Hash size={14} />
                <span className="hidden 2xl:inline">Seitenzahlen</span>
              </button>

              {/* Interactive Form Fields button (highlighted when PDF has AcroForms) */}
              {formFields.length > 0 && (
                <button
                  onClick={() => setIsFormModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition shadow-sm"
                  title="Erkannte PDF-Formularfelder ausfüllen & schreibschützen"
                >
                  <ClipboardList size={14} />
                  <span>Formular ({formFields.length})</span>
                </button>
              )}

              {/* Search Toggle */}
              <button
                onClick={() => setShowSearchBar((s) => !s)}
                className={`p-1.5 rounded-xl text-xs transition ${
                  showSearchBar
                    ? 'bg-[#0071E3] text-white'
                    : 'bg-[#F5F5F7] text-gray-700 hover:bg-gray-200'
                }`}
                title="Volltextsuche im Dokument (Cmd+F / Strg+F)"
              >
                <Search size={15} />
              </button>

              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

              {/* Gemini AI */}
              <button
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition"
                title="Mit Gemini KI analysieren, Rechnungen nach Excel exportieren, übersetzen oder korrigieren"
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>KI</span>
              </button>
            </div>

            {/* Middle: Page & Zoom Controls */}
            <div className="flex items-center gap-2.5 bg-[#F5F5F7] px-2.5 py-1 rounded-xl">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1, 'top')}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-white disabled:opacity-30 transition cursor-pointer"
                  title="Vorherige Seite (←)"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold px-1.5 whitespace-nowrap">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1, 'top')}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded hover:bg-white disabled:opacity-30 transition cursor-pointer"
                  title="Nächste Seite (→)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="w-[1px] h-3.5 bg-gray-300" />

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                  className="p-1 rounded hover:bg-white transition"
                  title="Verkleinern"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="text-[11px] font-mono w-9 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                  className="p-1 rounded hover:bg-white transition"
                  title="Vergrößern"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            </div>

            {/* Right: Auto-Save Indicator, File Name & Save Dialog Button */}
            <div className="flex items-center gap-1.5">
              {/* Live Auto-Save Status Badge */}
              <button
                onClick={() => setIsSaveModalOpen(true)}
                className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium transition border border-emerald-200/70"
                title={
                  lastAutoSavedAt
                    ? `Automatisch im Programm zwischengespeichert um ${lastAutoSavedAt.toLocaleTimeString('de-DE')}. Klicken für Speicher-Optionen.`
                    : 'Automatische Zwischenspeicherung aktiv'
                }
              >
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <span>Zwischengespeichert</span>
              </button>

              <div className="flex items-center bg-[#F5F5F7] border border-gray-200/80 rounded-xl px-2 py-1 focus-within:border-[#0071E3] focus-within:bg-white transition">
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Dateiname..."
                  title="Dateiname hier direkt ändern oder im Speichern-Dialog festlegen"
                  className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none w-24 sm:w-32"
                />
                <span className="text-[11px] font-mono text-gray-400 select-none">.pdf</span>
              </div>

              <button
                onClick={() => setIsDocSwitcherOpen(true)}
                className="p-1.5 rounded-xl text-gray-600 hover:text-black hover:bg-gray-100 transition cursor-pointer"
                title="Anderes PDF laden, leeres Dokument anlegen oder zur Startseite"
              >
                <FolderOpen size={16} />
              </button>

              <button
                onClick={() => setIsSaveModalOpen(true)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-60"
                title="Dokument benennen, Speicherort wählen oder als Projekt speichern (Cmd+S / Strg+S)"
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Speichern…</span>
              </button>
            </div>
          </div>

          {/* Collapsible Fulltext Search Bar */}
          {showSearchBar && (
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 shadow-sm z-20">
              <form onSubmit={handleRunSearch} className="flex items-center gap-2 flex-1 max-w-md">
                <Search size={15} className="text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Begriff im gesamten PDF suchen..."
                  autoFocus
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#0071E3]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-3 py-1.5 bg-[#0071E3] text-white rounded-xl text-xs font-semibold"
                >
                  {searching ? 'Suche...' : 'Suchen'}
                </button>
              </form>

              <div className="flex items-center gap-2 overflow-x-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((hit, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(hit.page)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition shrink-0 ${
                        currentPage === hit.page
                          ? 'bg-blue-50 border-[#0071E3] text-[#0071E3]'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                      title={hit.snippet}
                    >
                      Seite {hit.page}
                    </button>
                  ))
                ) : searchQuery.trim() && !searching ? (
                  <span className="text-xs text-gray-400">Keine Treffer</span>
                ) : null}

                <button
                  onClick={() => setShowSearchBar(false)}
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Active Tool Banner */}
          {activeTool !== 'select' && (
            <div className="bg-[#0071E3] text-white text-xs font-medium py-1.5 px-4 text-center shadow-inner flex items-center justify-center gap-3">
              <span>
                {activeTool === 'add-text' &&
                  'Klicke auf die PDF-Seite, um das Textfeld zu platzieren.'}
                {activeTool === 'add-highlight' &&
                  'Klicke auf die Stelle im PDF, die du mit dem Textmarker hervorheben möchtest.'}
                {activeTool === 'add-redaction' &&
                  'Klicke auf den sensiblen Bereich, um eine echte DSGVO-Schwärzung zu platzieren (wird beim Speichern unlesbar eingebrannt).'}
                {activeTool === 'draw-freehand' &&
                  'Halte die Maustaste (oder den Apple Pencil) gedrückt, um frei auf der Seite zu zeichnen.'}
              </span>
              {activeTool === 'draw-freehand' && (
                <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-lg">
                  {['#0071E3', '#E02020', '#107C41', '#000000'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setFreehandColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-3.5 h-3.5 rounded-full border border-white ${
                        freehandColor === c ? 'scale-125 ring-2 ring-white' : ''
                      }`}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => setActiveTool('select')}
                className="underline font-bold hover:opacity-80"
              >
                Fertig / Abbrechen
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
                <button
                  onClick={() => handleRotatePage(currentPage)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-[#0071E3] px-1.5 py-0.5 rounded hover:bg-gray-100 transition"
                  title="Aktuelle Seite um 90° drehen"
                >
                  <RotateCw size={12} />
                  <span>90°</span>
                </button>
              </div>

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
                  >
                    <FileStack size={14} />
                    <span>Seiten sortieren ({numPages})</span>
                  </button>
                )}
              </div>

              {/* Pages List */}
              <div className="flex flex-col gap-2.5">
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
                      onClick={() => handlePageChange(pNum, 'top')}
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

                    {/* Rotate & Delete Page Buttons */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRotatePage(pNum);
                        }}
                        className="p-1 rounded-md bg-white/90 hover:bg-blue-50 text-gray-500 hover:text-[#0071E3] shadow-sm border border-gray-200"
                        title={`Seite ${pNum} drehen`}
                      >
                        <RotateCw size={12} />
                      </button>

                      {numPages > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePage(pNum);
                          }}
                          className="p-1 rounded-md bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-600 shadow-sm border border-gray-200"
                          title={`Seite ${pNum} löschen`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {annotations.some((a) => a.pageNumber === pNum) && (
                      <span
                        className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-[#0071E3]"
                        title="Enthält Bearbeitungen"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* PDF Viewport Wrapper (Contains scroll area + floating page navigation controls) */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#E5E5EA]">
              {/* PDF Viewport Scroll Area with Mousewheel / Trackpad Boundary Paging */}
              <div
                ref={viewportScrollRef}
                onWheel={handleViewportWheel}
                className="flex-1 overflow-auto flex items-start justify-center p-8 select-none"
                onClick={() => setSelectedAnnId(null)}
                onDragOver={handleDragOver}
                onDrop={handleViewportDrop}
              >
                <div
                  ref={pageContainerRef}
                  onClick={handlePageClick}
                  onPointerDown={handlePagePointerDown}
                  onPointerMove={handlePagePointerMove}
                  onPointerUp={handlePagePointerUp}
                  onDragOver={handleDragOver}
                  onDrop={handleViewportDrop}
                  className={`relative bg-white shadow-2xl rounded-sm transition-all ${
                    activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                  style={{
                    width: canvasDimensions.width || 'auto',
                    height: canvasDimensions.height || 'auto',
                  }}
                >
                  {/* Mozilla PDF.js Canvas */}
                  <canvas ref={canvasRef} className="block" />

                  {/* Live Freehand Stroke Preview */}
                  {isDrawingStroke && currentStrokePoints.length > 1 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                      <polyline
                        points={currentStrokePoints
                          .map((p) => `${p.x * canvasDimensions.width},${p.y * canvasDimensions.height}`)
                          .join(' ')}
                        fill="none"
                        stroke={freehandColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}

                  {/* Overlaid Interactive Annotations Layer */}
                  {canvasDimensions.width > 0 && (
                    <AnnotationLayer
                      pageNumber={currentPage}
                      pageWidth={canvasDimensions.width}
                      pageHeight={canvasDimensions.height}
                      scale={scale}
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

              {/* Floating Left Arrow: Previous Page */}
              {numPages > 1 && currentPage > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageChange(currentPage - 1, 'top');
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-gray-700 hover:text-[#0071E3] shadow-xl border border-gray-200/80 flex items-center justify-center transition backdrop-blur-md hover:scale-110 active:scale-95 cursor-pointer group"
                  title="Vorherige Seite (← oder Bild ↑)"
                >
                  <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition" />
                </button>
              )}

              {/* Floating Right Arrow: Next Page */}
              {numPages > 1 && currentPage < numPages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageChange(currentPage + 1, 'top');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-gray-700 hover:text-[#0071E3] shadow-xl border border-gray-200/80 flex items-center justify-center transition backdrop-blur-md hover:scale-110 active:scale-95 cursor-pointer group"
                  title="Nächste Seite (→ oder Bild ↓)"
                >
                  <ChevronRight size={22} className="group-hover:translate-x-0.5 transition" />
                </button>
              )}

              {/* Floating Bottom Pager Bar */}
              {numPages > 1 && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl select-none transition hover:bg-white">
                  <button
                    onClick={() => handlePageChange(currentPage - 1, 'top')}
                    disabled={currentPage <= 1}
                    className="p-1 rounded-xl hover:bg-gray-100 disabled:opacity-30 text-gray-700 disabled:hover:bg-transparent transition cursor-pointer"
                    title="Vorherige Seite (←)"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 px-1">
                    <span>Seite</span>
                    <input
                      type="number"
                      min={1}
                      max={numPages}
                      value={pageInputVal}
                      onChange={(e) => setPageInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const p = parseInt(pageInputVal, 10);
                          if (!isNaN(p)) handlePageChange(p, 'top');
                        }
                      }}
                      onBlur={() => {
                        const p = parseInt(pageInputVal, 10);
                        if (!isNaN(p)) handlePageChange(p, 'top');
                        else setPageInputVal(String(currentPage));
                      }}
                      className="w-11 text-center bg-gray-100 focus:bg-white border border-gray-300 focus:border-[#0071E3] rounded-lg py-0.5 text-xs font-bold text-gray-900 focus:outline-none"
                    />
                    <span className="text-gray-400">von {numPages}</span>
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1, 'top')}
                    disabled={currentPage >= numPages}
                    className="p-1 rounded-xl hover:bg-gray-100 disabled:opacity-30 text-gray-700 disabled:hover:bg-transparent transition cursor-pointer"
                    title="Nächste Seite (→)"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
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

      {/* Company & Status Stamp Modal */}
      <StampModal
        isOpen={isStampModalOpen}
        onClose={() => setIsStampModalOpen(false)}
        onConfirmStamp={handleAddStamp}
      />

      {/* Interactive AcroForm Filler Modal */}
      <FormFillerModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        pdfBytes={pdfBytes}
        initialFields={formFields}
        onApplyFormChanges={(updatedBytes) => reloadPdfFromBuffer(updatedBytes, currentPage)}
      />

      {/* Page Numbers, Bates, Header/Footer & Watermarks Modal */}
      <PageDecorationsModal
        isOpen={isDecorationsModalOpen}
        onClose={() => setIsDecorationsModalOpen(false)}
        pdfBytes={pdfBytes}
        numPages={numPages}
        onApplyDecorations={(updatedBytes) => reloadPdfFromBuffer(updatedBytes, currentPage)}
      />

      {/* Save & Rename Document Modal (PDF Export, Editable .pdftool Project, or Internal Draft) */}
      <SaveDocumentModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        documentTitle={documentTitle}
        originalFileName={file?.name || 'Dokument.pdf'}
        annotationsCount={annotations.length}
        lastAutoSavedAt={lastAutoSavedAt}
        exporting={exporting}
        onSaveFinalPdf={handleExport}
        onSaveEditableProject={handleExportProject}
        onSaveDraftOnly={handleSaveDraftOnly}
      />

      {/* Gemini AI Assistant Modal / Slide-Over */}
      <GeminiAiModal
        isOpen={isAiOpen}
        onClose={() => setAiOpen(false)}
        pdfBytes={pdfBytes}
        currentPage={currentPage}
        numPages={numPages}
        annotations={annotations}
        onInsertTextIntoPage={handleInsertTextFromAi}
        onInsertAsNewPage={handleInsertAsNewPageFromAi}
        onReplaceCurrentPage={handleReplaceCurrentPageWithAiText}
      />

      {/* Document Switcher Modal */}
      {isDocSwitcherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0">
                <FolderOpen size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Dokument wechseln</h3>
                <p className="text-xs text-gray-500">Dein aktueller Stand bleibt im Zwischenspeicher gesichert.</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setIsDocSwitcherOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100/70 text-[#0071E3] font-semibold text-xs transition text-left cursor-pointer"
              >
                <Upload size={18} className="shrink-0" />
                <div>
                  <div className="text-xs font-bold">Anderes PDF oder Projekt öffnen…</div>
                  <div className="text-[11px] text-blue-600/70 font-normal">Wähle eine neue Datei von deinem Computer</div>
                </div>
              </button>

              <button
                onClick={async () => {
                  setIsDocSwitcherOpen(false);
                  await handleCreateNewBlankPdf();
                  onGoToEditor?.();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/70 text-emerald-700 font-semibold text-xs transition text-left cursor-pointer"
              >
                <FilePlus size={18} className="shrink-0" />
                <div>
                  <div className="text-xs font-bold">Neues leeres A4-Dokument</div>
                  <div className="text-[11px] text-emerald-600 font-normal">Startet ein frisches leeres Blatt</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsDocSwitcherOpen(false);
                  handleCloseDocument();
                  onGoHome?.();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-semibold text-xs transition text-left cursor-pointer"
              >
                <Home size={18} className="shrink-0" />
                <div>
                  <div className="text-xs font-bold">Zur Startseite zurückkehren</div>
                  <div className="text-[11px] text-gray-500 font-normal">Dokument schließen und Hauptmenü anzeigen</div>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsDocSwitcherOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
