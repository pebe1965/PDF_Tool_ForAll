import React, { useRef, useState, useEffect } from 'react';
import {
  Trash2,
  Move,
  Plus,
  Minus,
  ArrowLeftRight,
  Copy,
  Lock,
  Unlock,
  Edit3,
  Check,
  ShieldAlert,
} from 'lucide-react';
import {
  TextAnnotation,
  SignatureAnnotation,
  ImageAnnotation,
  HighlightAnnotation,
  RedactionAnnotation,
  ShapeAnnotation,
  FreehandDrawingAnnotation,
  Annotation,
} from '../types/pdf';
import { classifyLine } from '../lib/a4Pagination';

interface AnnotationLayerProps {
  pageNumber: number;
  pageWidth: number; // rendered CSS pixel width of current page
  pageHeight: number; // rendered CSS pixel height of current page
  annotations: Annotation[];
  onUpdateAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onDuplicateAnnotation?: (ann: Annotation) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
}

const getFontFamilyCss = (family?: string) => {
  if (family === 'Times') return '"Times New Roman", Times, Georgia, serif';
  if (family === 'Courier') return '"Courier New", Courier, monospace';
  return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
};

// Sub-component for individual text annotation with auto-resizing textarea
const TextAnnotationItem: React.FC<{
  textAnn: TextAnnotation;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (ann: TextAnnotation) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onStartDrag: (e: React.PointerEvent) => void;
  onStartResize: (e: React.PointerEvent) => void;
}> = ({
  textAnn,
  pageWidth,
  pageHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartDrag,
  onStartResize,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!textAnn.text || textAnn.text.trim().length === 0);

  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const effectiveWidthNorm = textAnn.width || 0.3;
  const leftPx = textAnn.x * pageWidth;
  const topPx = textAnn.y * pageHeight;
  const widthPx = effectiveWidthNorm * pageWidth;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(28, textareaRef.current.scrollHeight)}px`;
    }
  }, [textAnn.text, textAnn.fontSize, effectiveWidthNorm, pageWidth, textAnn.fontFamily, textAnn.isBold, isEditing]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...textAnn, text: e.target.value });
  };

  const adjustWidthDelta = (deltaNorm: number) => {
    const newWidth = Math.max(0.08, Math.min(0.98 - textAnn.x, effectiveWidthNorm + deltaNorm));
    onUpdate({ ...textAnn, width: newWidth });
  };

  const hasBackground = textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        backgroundColor: hasBackground ? textAnn.backgroundColor : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`pointer-events-auto group transition-shadow ${
        hasBackground ? 'rounded-lg shadow-sm border border-gray-300/60 p-1' : ''
      } ${
        isSelected
          ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl bg-white/70 shadow-xl z-20'
          : 'hover:ring-1 hover:ring-blue-300 rounded-xl hover:bg-white/40 z-10'
      }`}
    >
      {/* Floating Toolbar when Selected */}
      {isSelected && (
        <div
          className="absolute -top-11 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1.5 rounded-xl shadow-2xl text-xs z-30 select-none whitespace-nowrap"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
              isEditing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-[#0071E3] hover:bg-blue-600 text-white'
            }`}
            title={isEditing ? 'Bearbeitung abschließen' : 'Text bearbeiten'}
          >
            {isEditing ? (
              <>
                <Check size={12} />
                <span>Fertig</span>
              </>
            ) : (
              <>
                <Edit3 size={12} />
                <span>Bearbeiten</span>
              </>
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <select
            value={textAnn.fontFamily || 'Helvetica'}
            onChange={(e) => onUpdate({ ...textAnn, fontFamily: e.target.value as any })}
            className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium rounded-lg px-2 py-1 outline-none border border-white/10 cursor-pointer"
          >
            <option value="Helvetica" className="bg-[#1D1D1F] text-white">Sans (Standard)</option>
            <option value="Times" className="bg-[#1D1D1F] text-white">Serif (Times)</option>
            <option value="Courier" className="bg-[#1D1D1F] text-white">Mono (Courier)</option>
          </select>

          <div className="flex items-center bg-white/10 p-0.5 rounded-lg">
            <button
              onClick={() => onUpdate({ ...textAnn, isBold: !textAnn.isBold })}
              className={`w-5 h-5 flex items-center justify-center font-bold text-xs rounded transition ${
                textAnn.isBold ? 'bg-[#0071E3] text-white' : 'text-gray-300 hover:text-white'
              }`}
              title="Fett"
            >
              B
            </button>
            <button
              onClick={() => onUpdate({ ...textAnn, isItalic: !textAnn.isItalic })}
              className={`w-5 h-5 flex items-center justify-center italic text-xs rounded transition ${
                textAnn.isItalic ? 'bg-[#0071E3] text-white' : 'text-gray-300 hover:text-white'
              }`}
              title="Kursiv"
            >
              I
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg">
            <button
              onClick={() => onUpdate({ ...textAnn, fontSize: Math.max(8, textAnn.fontSize - 2) })}
              className="p-0.5 hover:bg-white/20 rounded text-gray-300 hover:text-white"
              title="Schrift kleiner"
            >
              <Minus size={12} />
            </button>
            <span className="text-[11px] font-mono px-1 font-semibold">{textAnn.fontSize}px</span>
            <button
              onClick={() => onUpdate({ ...textAnn, fontSize: Math.min(64, textAnn.fontSize + 2) })}
              className="p-0.5 hover:bg-white/20 rounded text-gray-300 hover:text-white"
              title="Schrift größer"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg">
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 mr-0.5">
              <ArrowLeftRight size={10} />
            </span>
            <button
              onClick={() => adjustWidthDelta(-0.05)}
              className="px-1 hover:bg-white/20 rounded text-gray-300 hover:text-white font-mono text-[11px]"
              title="Box schmaler"
            >
              -
            </button>
            <span className="text-[10px] text-gray-300">Breite</span>
            <button
              onClick={() => adjustWidthDelta(0.05)}
              className="px-1 hover:bg-white/20 rounded text-gray-300 hover:text-white font-mono text-[11px]"
              title="Box breiter"
            >
              +
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <div className="flex items-center gap-1" title="Textfarbe">
            {['#000000', '#0071E3', '#E02020', '#107C41'].map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ ...textAnn, color: c })}
                style={{ backgroundColor: c }}
                className={`w-3.5 h-3.5 rounded-full border border-white/50 transition ${
                  textAnn.color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg" title="Hintergrund / Text abdecken">
            <button
              onClick={() => onUpdate({ ...textAnn, backgroundColor: 'transparent' })}
              className={`text-[10px] px-1 py-0.5 rounded ${
                !textAnn.backgroundColor || textAnn.backgroundColor === 'transparent' ? 'bg-white/30 text-white' : 'text-gray-400'
              }`}
              title="Ohne Hintergrund"
            >
              Klar
            </button>
            <button
              onClick={() => onUpdate({ ...textAnn, backgroundColor: '#FFFFFF' })}
              className={`text-[10px] px-1 py-0.5 rounded ${
                textAnn.backgroundColor === '#FFFFFF' ? 'bg-white text-black font-bold' : 'text-gray-300 hover:text-white'
              }`}
              title="Weiß (alten Text überdecken)"
            >
              Weiß
            </button>
            <button
              onClick={() => onUpdate({ ...textAnn, backgroundColor: '#FEF08A' })}
              className={`text-[10px] px-1 py-0.5 rounded ${
                textAnn.backgroundColor === '#FEF08A' ? 'bg-yellow-200 text-yellow-900 font-bold' : 'text-gray-300 hover:text-white'
              }`}
              title="Post-it Gelb"
            >
              Gelb
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
              title="Feld duplizieren"
            >
              <Copy size={13} />
            </button>
          )}

          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white transition"
            title="Löschen"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Box Inner Layout */}
      <div className="relative p-1.5 flex items-start gap-1">
        <div
          onPointerDown={onStartDrag}
          className="p-1 text-gray-400 hover:text-[#0071E3] hover:bg-blue-50 rounded cursor-grab active:cursor-grabbing transition shrink-0 select-none"
          title="Gedrückt halten zum Verschieben"
        >
          <Move size={14} />
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={textAnn.text}
            onChange={handleTextChange}
            style={{
              fontSize: `${textAnn.fontSize}px`,
              color: textAnn.color,
              lineHeight: '1.4',
              fontFamily: getFontFamilyCss(textAnn.fontFamily),
              fontWeight: textAnn.isBold ? 'bold' : 'normal',
              fontStyle: textAnn.isItalic ? 'italic' : 'normal',
              backgroundColor: 'transparent',
            }}
            className="w-full bg-transparent border-0 focus:outline-none resize-none p-0 m-0 overflow-hidden break-words"
            placeholder="Text eingeben..."
            rows={1}
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            style={{
              fontFamily: getFontFamilyCss(textAnn.fontFamily),
              color: textAnn.color,
            }}
            className="w-full select-text cursor-text py-0.5 leading-relaxed"
            title="Doppelklick zum Bearbeiten"
          >
            {textAnn.text ? (
              textAnn.text.split('\n').map((line, idx) => {
                const classified = classifyLine(line, textAnn.fontSize);
                if (classified.type === 'empty') {
                  return <div key={idx} style={{ height: `${textAnn.fontSize * 0.7}px` }} />;
                }
                if (classified.type === 'h1') {
                  return (
                    <h1
                      key={idx}
                      style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginTop: idx === 0 ? '0px' : '14px',
                        marginBottom: '4px',
                        lineHeight: '1.25',
                        color: textAnn.color,
                      }}
                    >
                      {classified.text}
                    </h1>
                  );
                }
                if (classified.type === 'h2') {
                  return (
                    <h2
                      key={idx}
                      style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        marginTop: idx === 0 ? '0px' : '10px',
                        marginBottom: '3px',
                        lineHeight: '1.3',
                        color: textAnn.color,
                      }}
                    >
                      {classified.text}
                    </h2>
                  );
                }
                if (classified.type === 'bullet') {
                  return (
                    <div
                      key={idx}
                      style={{
                        fontSize: `${textAnn.fontSize}px`,
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px',
                        marginTop: '2px',
                      }}
                    >
                      <span style={{ fontSize: `${textAnn.fontSize}px`, fontWeight: 'bold' }}>•</span>
                      <span>{classified.text}</span>
                    </div>
                  );
                }
                return (
                  <p
                    key={idx}
                    style={{
                      fontSize: `${textAnn.fontSize}px`,
                      lineHeight: '1.4',
                      marginTop: '2px',
                      fontWeight: textAnn.isBold ? 'bold' : 'normal',
                      fontStyle: textAnn.isItalic ? 'italic' : 'normal',
                    }}
                  >
                    {classified.text}
                  </p>
                );
              })
            ) : (
              <span className="text-gray-400 italic text-xs">Text eingeben (Doppelklick)...</span>
            )}
          </div>
        )}
      </div>

      {isSelected && (
        <>
          <div
            onPointerDown={onStartResize}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ew-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Breite durch Ziehen anpassen"
          >
            <div className="w-0.5 h-3 bg-[#0071E3] rounded-full" />
          </div>

          <div
            onPointerDown={onStartResize}
            className="absolute -bottom-2 -right-2 w-5 h-5 bg-[#0071E3] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Größe anpassen"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </>
      )}
    </div>
  );
};

// Sub-component for inserted Image or Screenshot or Stamp
const ImageAnnotationItem: React.FC<{
  imgAnn: ImageAnnotation;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (ann: ImageAnnotation) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onStartDrag: (e: React.PointerEvent) => void;
  onStartCornerResize: (e: React.PointerEvent) => void;
  onStartRightResize: (e: React.PointerEvent) => void;
  onStartBottomResize: (e: React.PointerEvent) => void;
}> = ({
  imgAnn,
  pageWidth,
  pageHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartDrag,
  onStartCornerResize,
  onStartRightResize,
  onStartBottomResize,
}) => {
  const leftPx = imgAnn.x * pageWidth;
  const topPx = imgAnn.y * pageHeight;
  const widthPx = imgAnn.width * pageWidth;
  const heightPx = imgAnn.height * pageHeight;
  const isLocked = imgAnn.lockAspectRatio !== false;

  const adjustScale = (factor: number) => {
    let newW = Math.max(0.04, Math.min(0.96 - imgAnn.x, imgAnn.width * factor));
    let newH = isLocked
      ? (newW * (pageWidth / pageHeight)) / imgAnn.aspectRatio
      : Math.max(0.02, Math.min(0.96 - imgAnn.y, imgAnn.height * factor));

    if (newH > 0.96 - imgAnn.y) {
      newH = 0.96 - imgAnn.y;
      if (isLocked) {
        newW = newH * (pageHeight / pageWidth) * imgAnn.aspectRatio;
      }
    }

    onUpdate({
      ...imgAnn,
      width: newW,
      height: newH,
    });
  };

  const toggleAspectLock = () => {
    onUpdate({
      ...imgAnn,
      lockAspectRatio: !isLocked,
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={onStartDrag}
      className={`pointer-events-auto group cursor-move select-none ${
        isSelected
          ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl shadow-2xl bg-blue-50/20 z-20'
          : 'hover:ring-1 hover:ring-blue-300 rounded-xl hover:bg-black/5 z-10'
      }`}
    >
      <img
        src={imgAnn.dataUrl}
        alt={imgAnn.name || 'Bild'}
        className="w-full h-full object-contain pointer-events-none rounded-lg"
        draggable={false}
      />

      {isSelected && (
        <div
          className="absolute -top-11 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1.5 rounded-xl shadow-2xl text-xs z-30 select-none whitespace-nowrap"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={toggleAspectLock}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition ${
              isLocked
                ? 'bg-[#0071E3] text-white'
                : 'bg-white/10 text-gray-300 hover:text-white'
            }`}
            title={isLocked ? 'Seitenverhältnis gesperrt (proportional)' : 'Freie Skalierung'}
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            <span>{isLocked ? 'Proportional' : 'Frei'}</span>
          </button>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg">
            <button
              onClick={() => adjustScale(0.85)}
              className="p-0.5 hover:bg-white/20 rounded text-gray-300 hover:text-white"
              title="Kleiner"
            >
              <Minus size={12} />
            </button>
            <span className="text-[10px] text-gray-300 px-1">Größe</span>
            <button
              onClick={() => adjustScale(1.15)}
              className="p-0.5 hover:bg-white/20 rounded text-gray-300 hover:text-white"
              title="Größer"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
              title="Duplizieren"
            >
              <Copy size={13} />
            </button>
          )}

          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white transition"
            title="Löschen"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {isSelected && (
        <>
          <div
            onPointerDown={onStartRightResize}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ew-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Breite anpassen"
          >
            <div className="w-0.5 h-3 bg-[#0071E3] rounded-full" />
          </div>

          <div
            onPointerDown={onStartBottomResize}
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-8 h-4 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ns-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Höhe anpassen"
          >
            <div className="h-0.5 w-3 bg-[#0071E3] rounded-full" />
          </div>

          <div
            onPointerDown={onStartCornerResize}
            className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#0071E3] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-lg hover:scale-125 active:scale-125 transition z-30 ring-2 ring-white"
            title="Größe durch Ziehen anpassen"
          >
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </>
      )}
    </div>
  );
};

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNumber,
  pageWidth,
  pageHeight,
  annotations,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onDuplicateAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
    initialAnnX: number;
    initialAnnY: number;
  } | null>(null);

  // Resizing state for Signatures / Boxes (Highlight, Redaction, Shape)
  const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);
  const [resizeBoxStartPos, setResizeBoxStartPos] = useState<{
    x: number;
    y: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  // Resizing state for Text
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [resizeTextStartPos, setResizeTextStartPos] = useState<{
    x: number;
    initialW: number;
  } | null>(null);

  // Resizing state for Images
  const [resizingImage, setResizingImage] = useState<{
    id: string;
    type: 'corner' | 'right' | 'bottom';
    startX: number;
    startY: number;
    initialW: number;
    initialH: number;
    aspectRatio: number;
    lockAspectRatio: boolean;
  } | null>(null);

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Start dragging annotation
  const handlePointerDownDrag = (
    e: React.PointerEvent,
    ann:
      | TextAnnotation
      | SignatureAnnotation
      | ImageAnnotation
      | HighlightAnnotation
      | RedactionAnnotation
      | ShapeAnnotation
  ) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setDraggingId(ann.id);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
      initialAnnX: ann.x,
      initialAnnY: ann.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Start resizing text box
  const handlePointerDownTextResize = (e: React.PointerEvent, ann: TextAnnotation) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setResizingTextId(ann.id);
    setResizeTextStartPos({
      x: e.clientX,
      initialW: ann.width || 0.3,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Start resizing generic 2D box (Signature, Highlight, Redaction, Shape)
  const handlePointerDownBoxResize = (
    e: React.PointerEvent,
    ann: SignatureAnnotation | HighlightAnnotation | RedactionAnnotation | ShapeAnnotation
  ) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setResizingBoxId(ann.id);
    setResizeBoxStartPos({
      x: e.clientX,
      y: e.clientY,
      initialW: ann.width,
      initialH: ann.height,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Start resizing image
  const handlePointerDownImageResize = (
    e: React.PointerEvent,
    ann: ImageAnnotation,
    resizeType: 'corner' | 'right' | 'bottom'
  ) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setResizingImage({
      id: ann.id,
      type: resizeType,
      startX: e.clientX,
      startY: e.clientY,
      initialW: ann.width,
      initialH: ann.height,
      aspectRatio: ann.aspectRatio || ann.width / ann.height,
      lockAspectRatio: ann.lockAspectRatio !== false,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Move handler for drag and all types of resize
  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId && dragStartPos) {
      e.preventDefault();
      const deltaX = (e.clientX - dragStartPos.x) / pageWidth;
      const deltaY = (e.clientY - dragStartPos.y) / pageHeight;

      const ann = annotations.find((a) => a.id === draggingId);
      if (!ann || ann.type === 'drawing') return;

      const annWidth = (ann as any).width || 0.2;
      const annHeight = (ann as any).height || 0.04;

      const newX = Math.max(0.005, Math.min(0.995 - annWidth, dragStartPos.initialAnnX + deltaX));
      const newY = Math.max(0.005, Math.min(0.995 - annHeight, dragStartPos.initialAnnY + deltaY));

      onUpdateAnnotation({
        ...ann,
        x: newX,
        y: newY,
      } as any);
    } else if (resizingTextId && resizeTextStartPos) {
      e.preventDefault();
      const deltaX = (e.clientX - resizeTextStartPos.x) / pageWidth;

      const ann = annotations.find((a) => a.id === resizingTextId) as TextAnnotation | undefined;
      if (!ann || ann.type !== 'text') return;

      const newW = Math.max(0.08, Math.min(0.98 - ann.x, resizeTextStartPos.initialW + deltaX));
      onUpdateAnnotation({
        ...ann,
        width: newW,
      });
    } else if (resizingBoxId && resizeBoxStartPos) {
      e.preventDefault();
      const deltaX = (e.clientX - resizeBoxStartPos.x) / pageWidth;
      const deltaY = (e.clientY - resizeBoxStartPos.y) / pageHeight;

      const ann = annotations.find((a) => a.id === resizingBoxId) as
        | SignatureAnnotation
        | HighlightAnnotation
        | RedactionAnnotation
        | ShapeAnnotation
        | undefined;
      if (!ann) return;

      const minW = ann.type === 'shape' ? 0.025 : 0.04;
      const minH = ann.type === 'highlight' || ann.type === 'redaction' ? 0.015 : 0.025;

      const newW = Math.max(minW, Math.min(0.98 - ann.x, resizeBoxStartPos.initialW + deltaX));
      const newH = Math.max(minH, Math.min(0.98 - ann.y, resizeBoxStartPos.initialH + deltaY));

      onUpdateAnnotation({
        ...ann,
        width: newW,
        height: newH,
      } as any);
    } else if (resizingImage) {
      e.preventDefault();
      const deltaX = (e.clientX - resizingImage.startX) / pageWidth;
      const deltaY = (e.clientY - resizingImage.startY) / pageHeight;

      const ann = annotations.find((a) => a.id === resizingImage.id) as ImageAnnotation | undefined;
      if (!ann || ann.type !== 'image') return;

      let newW = ann.width;
      let newH = ann.height;

      if (resizingImage.type === 'corner') {
        newW = Math.max(0.04, Math.min(0.96 - ann.x, resizingImage.initialW + deltaX));
        if (resizingImage.lockAspectRatio) {
          newH = (newW * (pageWidth / pageHeight)) / resizingImage.aspectRatio;
          if (newH > 0.96 - ann.y) {
            newH = 0.96 - ann.y;
            newW = newH * (pageHeight / pageWidth) * resizingImage.aspectRatio;
          }
        } else {
          newH = Math.max(0.02, Math.min(0.96 - ann.y, resizingImage.initialH + deltaY));
        }
      } else if (resizingImage.type === 'right') {
        newW = Math.max(0.04, Math.min(0.96 - ann.x, resizingImage.initialW + deltaX));
        if (resizingImage.lockAspectRatio) {
          newH = (newW * (pageWidth / pageHeight)) / resizingImage.aspectRatio;
        }
      } else if (resizingImage.type === 'bottom') {
        newH = Math.max(0.02, Math.min(0.96 - ann.y, resizingImage.initialH + deltaY));
        if (resizingImage.lockAspectRatio) {
          newW = newH * (pageHeight / pageWidth) * resizingImage.aspectRatio;
        }
      }

      onUpdateAnnotation({
        ...ann,
        width: newW,
        height: newH,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setDraggingId(null);
      setDragStartPos(null);
    }
    if (resizingTextId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setResizingTextId(null);
      setResizeTextStartPos(null);
    }
    if (resizingBoxId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setResizingBoxId(null);
      setResizeBoxStartPos(null);
    }
    if (resizingImage) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setResizingImage(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pageAnnotations.map((ann) => {
        const isSelected = selectedAnnotationId === ann.id;

        if (ann.type === 'text') {
          return (
            <TextAnnotationItem
              key={ann.id}
              textAnn={ann as TextAnnotation}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(ann.id)}
              onUpdate={(updated) => onUpdateAnnotation(updated)}
              onDelete={() => onDeleteAnnotation(ann.id)}
              onDuplicate={() => onDuplicateAnnotation && onDuplicateAnnotation(ann)}
              onStartDrag={(e) => handlePointerDownDrag(e, ann as TextAnnotation)}
              onStartResize={(e) => handlePointerDownTextResize(e, ann as TextAnnotation)}
            />
          );
        }

        if (ann.type === 'image') {
          return (
            <ImageAnnotationItem
              key={ann.id}
              imgAnn={ann as ImageAnnotation}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(ann.id)}
              onUpdate={(updated) => onUpdateAnnotation(updated)}
              onDelete={() => onDeleteAnnotation(ann.id)}
              onDuplicate={() => onDuplicateAnnotation && onDuplicateAnnotation(ann)}
              onStartDrag={(e) => handlePointerDownDrag(e, ann as ImageAnnotation)}
              onStartCornerResize={(e) => handlePointerDownImageResize(e, ann as ImageAnnotation, 'corner')}
              onStartRightResize={(e) => handlePointerDownImageResize(e, ann as ImageAnnotation, 'right')}
              onStartBottomResize={(e) => handlePointerDownImageResize(e, ann as ImageAnnotation, 'bottom')}
            />
          );
        }

        if (ann.type === 'highlight') {
          const hl = ann as HighlightAnnotation;
          const leftPx = hl.x * pageWidth;
          const topPx = hl.y * pageHeight;
          const widthPx = hl.width * pageWidth;
          const heightPx = hl.height * pageHeight;

          return (
            <div
              key={hl.id}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                top: `${topPx}px`,
                width: `${widthPx}px`,
                height: `${heightPx}px`,
                backgroundColor: hl.color || '#FACC15',
                opacity: 0.42,
                mixBlendMode: 'multiply',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(hl.id);
              }}
              onPointerDown={(e) => handlePointerDownDrag(e, hl)}
              className={`pointer-events-auto cursor-move rounded-sm ${
                isSelected ? 'ring-2 ring-[#0071E3] ring-offset-1 z-20' : 'hover:ring-1 hover:ring-amber-500'
              }`}
            >
              {isSelected && (
                <>
                  <div
                    style={{ opacity: 2.4 }}
                    className="absolute -top-10 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2 py-1 rounded-xl shadow-xl text-xs z-30 whitespace-nowrap"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {['#FACC15', '#4ADE80', '#F472B6', '#60A5FA'].map((c) => (
                      <button
                        key={c}
                        onClick={() => onUpdateAnnotation({ ...hl, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border border-white/60 ${
                          hl.color === c ? 'scale-125 ring-2 ring-white' : ''
                        }`}
                      />
                    ))}
                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    {onDuplicateAnnotation && (
                      <button
                        onClick={() => onDuplicateAnnotation(hl)}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Duplizieren"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAnnotation(hl.id)}
                      className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white"
                      title="Löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, hl)}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#0071E3] rounded-full cursor-se-resize ring-2 ring-white shadow z-30"
                  />
                </>
              )}
            </div>
          );
        }

        if (ann.type === 'redaction') {
          const red = ann as RedactionAnnotation;
          const leftPx = red.x * pageWidth;
          const topPx = red.y * pageHeight;
          const widthPx = red.width * pageWidth;
          const heightPx = red.height * pageHeight;

          return (
            <div
              key={red.id}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                top: `${topPx}px`,
                width: `${widthPx}px`,
                height: `${heightPx}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(red.id);
              }}
              onPointerDown={(e) => handlePointerDownDrag(e, red)}
              className={`pointer-events-auto cursor-move bg-black flex items-center justify-center ${
                isSelected
                  ? 'ring-2 ring-red-500 ring-offset-1 z-20'
                  : 'border border-red-500/60 hover:ring-1 hover:ring-red-400 z-10'
              }`}
              title="DSGVO-Schwärzung: Darunterliegender Text wird beim Export unwiderruflich entfernt"
            >
              <span className="text-[9px] font-mono font-bold text-red-400/80 uppercase tracking-wider truncate px-1 pointer-events-none">
                {heightPx > 14 && widthPx > 55 ? 'DSGVO-SCHWÄRZUNG' : ''}
              </span>

              {isSelected && (
                <>
                  <div
                    className="absolute -top-10 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1 rounded-xl shadow-xl text-[11px] z-30 whitespace-nowrap"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ShieldAlert size={12} className="text-red-400" />
                    <span className="font-semibold text-red-200">Echte DSGVO-Schwärzung</span>
                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    {onDuplicateAnnotation && (
                      <button
                        onClick={() => onDuplicateAnnotation(red)}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Duplizieren"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAnnotation(red.id)}
                      className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white"
                      title="Löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, red)}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-red-600 rounded-full cursor-se-resize ring-2 ring-white shadow z-30"
                  />
                </>
              )}
            </div>
          );
        }

        if (ann.type === 'shape') {
          const sh = ann as ShapeAnnotation;
          const leftPx = sh.x * pageWidth;
          const topPx = sh.y * pageHeight;
          const widthPx = sh.width * pageWidth;
          const heightPx = sh.height * pageHeight;
          const strokeC = sh.color || '#0071E3';
          const sw = sh.strokeWidth || 3;

          return (
            <div
              key={sh.id}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                top: `${topPx}px`,
                width: `${widthPx}px`,
                height: `${heightPx}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(sh.id);
              }}
              onPointerDown={(e) => handlePointerDownDrag(e, sh)}
              className={`pointer-events-auto cursor-move ${
                isSelected ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-lg z-20' : 'hover:ring-1 hover:ring-blue-300 rounded z-10'
              }`}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible pointer-events-none"
              >
                {sh.shapeType === 'check' && (
                  <path
                    d="M 16 54 L 42 80 L 85 20"
                    fill="none"
                    stroke={strokeC}
                    strokeWidth={sw * 3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {sh.shapeType === 'cross' && (
                  <path
                    d="M 20 20 L 80 80 M 80 20 L 20 80"
                    fill="none"
                    stroke={strokeC}
                    strokeWidth={sw * 3.2}
                    strokeLinecap="round"
                  />
                )}
                {sh.shapeType === 'rect' && (
                  <rect
                    x="4"
                    y="4"
                    width="92"
                    height="92"
                    fill="none"
                    stroke={strokeC}
                    strokeWidth={sw * 2}
                    rx="4"
                  />
                )}
                {sh.shapeType === 'circle' && (
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="46"
                    ry="46"
                    fill="none"
                    stroke={strokeC}
                    strokeWidth={sw * 2}
                  />
                )}
                {sh.shapeType === 'arrow' && (
                  <path
                    d="M 6 50 L 92 50 M 68 25 L 92 50 L 68 75"
                    fill="none"
                    stroke={strokeC}
                    strokeWidth={sw * 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {isSelected && (
                <>
                  <div
                    className="absolute -top-10 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2 py-1 rounded-xl shadow-xl text-xs z-30 whitespace-nowrap"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {['#107C41', '#E02020', '#0071E3', '#000000', '#D97706'].map((c) => (
                      <button
                        key={c}
                        onClick={() => onUpdateAnnotation({ ...sh, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-3.5 h-3.5 rounded-full border border-white/60 ${
                          sh.color === c ? 'scale-125 ring-2 ring-white' : ''
                        }`}
                      />
                    ))}
                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    {onDuplicateAnnotation && (
                      <button
                        onClick={() => onDuplicateAnnotation(sh)}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Duplizieren"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAnnotation(sh.id)}
                      className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white"
                      title="Löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, sh)}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#0071E3] rounded-full cursor-se-resize ring-2 ring-white shadow z-30"
                  />
                </>
              )}
            </div>
          );
        }

        if (ann.type === 'drawing') {
          const draw = ann as FreehandDrawingAnnotation;
          if (!draw.points || draw.points.length < 2) return null;
          const pointsStr = draw.points
            .map((p) => `${p.x * pageWidth},${p.y * pageHeight}`)
            .join(' ');

          return (
            <svg
              key={draw.id}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            >
              <polyline
                points={pointsStr}
                fill="none"
                stroke={draw.color || '#0071E3'}
                strokeWidth={draw.strokeWidth || 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAnnotation(draw.id);
                }}
                className={`pointer-events-auto cursor-pointer ${
                  isSelected ? 'filter drop-shadow-[0_0_4px_rgba(0,113,227,0.8)]' : ''
                }`}
              />
            </svg>
          );
        }

        if (ann.type === 'signature') {
          const sigAnn = ann as SignatureAnnotation;
          const leftPx = sigAnn.x * pageWidth;
          const topPx = sigAnn.y * pageHeight;
          const widthPx = sigAnn.width * pageWidth;
          const heightPx = sigAnn.height * pageHeight;

          return (
            <div
              key={sigAnn.id}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                top: `${topPx}px`,
                width: `${widthPx}px`,
                height: `${heightPx}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(sigAnn.id);
              }}
              onPointerDown={(e) => handlePointerDownDrag(e, sigAnn)}
              className={`pointer-events-auto group cursor-move select-none p-1 ${
                isSelected
                  ? 'border-2 border-[#0071E3] rounded-lg shadow-lg bg-blue-50/10 z-20'
                  : 'hover:border hover:border-blue-300 z-10'
              }`}
            >
              <img
                src={sigAnn.dataUrl}
                alt="Unterschrift"
                className="w-full h-full object-contain pointer-events-none"
              />

              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAnnotation(sigAnn.id);
                  }}
                  className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md hover:bg-red-700 transition z-30"
                  title="Unterschrift entfernen"
                >
                  <Trash2 size={12} />
                </button>
              )}

              {isSelected && (
                <div
                  onPointerDown={(e) => handlePointerDownBoxResize(e, sigAnn)}
                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-[#0071E3] text-white rounded-full flex items-center justify-center cursor-nwse-resize shadow-md hover:scale-110 transition z-30"
                  title="Größe anpassen"
                >
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
