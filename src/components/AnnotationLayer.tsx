import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Move, Plus, Minus, ArrowLeftRight, Copy } from 'lucide-react';
import { TextAnnotation, SignatureAnnotation, Annotation } from '../types/pdf';

interface AnnotationLayerProps {
  pageNumber: number;
  pageWidth: number; // rendered CSS pixel width of current page
  pageHeight: number; // rendered CSS pixel height of current page
  annotations: Annotation[];
  onUpdateAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onDuplicateAnnotation?: (ann: TextAnnotation) => void;
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

  // Default width to 30% of page if undefined
  const effectiveWidthNorm = textAnn.width || 0.3;
  const leftPx = textAnn.x * pageWidth;
  const topPx = textAnn.y * pageHeight;
  const widthPx = effectiveWidthNorm * pageWidth;

  // Auto-resize textarea height so text never clips and never shows a scrollbar
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(28, textareaRef.current.scrollHeight)}px`;
    }
  }, [textAnn.text, textAnn.fontSize, effectiveWidthNorm, pageWidth, textAnn.fontFamily, textAnn.isBold]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...textAnn, text: e.target.value });
  };

  // Quick adjust width via toolbar
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
          ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl bg-white/70 shadow-xl'
          : 'hover:ring-1 hover:ring-blue-300 rounded-xl hover:bg-white/40'
      }`}
    >
      {/* Floating Toolbar when Selected */}
      {isSelected && (
        <div
          className="absolute -top-11 left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1.5 rounded-xl shadow-2xl text-xs z-30 select-none whitespace-nowrap"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Font Family Selector */}
          <select
            value={textAnn.fontFamily || 'Helvetica'}
            onChange={(e) => onUpdate({ ...textAnn, fontFamily: e.target.value as any })}
            className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium rounded-lg px-2 py-1 outline-none border border-white/10 cursor-pointer"
          >
            <option value="Helvetica" className="bg-[#1D1D1F] text-white">Sans (Standard)</option>
            <option value="Times" className="bg-[#1D1D1F] text-white">Serif (Times)</option>
            <option value="Courier" className="bg-[#1D1D1F] text-white">Mono (Courier)</option>
          </select>

          {/* Bold and Italic Toggles */}
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

          {/* Font Size */}
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

          {/* Quick Width Buttons */}
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

          {/* Text Color Dots */}
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

          {/* Background / Whiteout Selector */}
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
              title="Weiß (alten Text überdecken / schwärzen)"
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

          {/* Duplicate button */}
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
              title="Feld duplizieren"
            >
              <Copy size={13} />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white transition"
            title="Löschen"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Box Inner Layout: Drag Grip + Auto-expanding Textarea */}
      <div className="relative p-1.5 flex items-start gap-1">
        {/* Dedicated Drag Handle */}
        <div
          onPointerDown={onStartDrag}
          className="p-1 text-gray-400 hover:text-[#0071E3] hover:bg-blue-50 rounded cursor-grab active:cursor-grabbing transition shrink-0 select-none"
          title="Gedrückt halten zum Verschieben"
        >
          <Move size={14} />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={textAnn.text}
          onChange={handleTextChange}
          style={{
            fontSize: `${textAnn.fontSize}px`,
            color: textAnn.color,
            lineHeight: '1.3',
            fontFamily: getFontFamilyCss(textAnn.fontFamily),
            fontWeight: textAnn.isBold ? 'bold' : 'normal',
            fontStyle: textAnn.isItalic ? 'italic' : 'normal',
            backgroundColor: 'transparent',
          }}
          className="w-full bg-transparent border-0 focus:outline-none resize-none p-0 m-0 overflow-hidden break-words"
          placeholder="Text eingeben..."
          rows={1}
        />
      </div>

      {/* Resize Handles (Visible when selected) */}
      {isSelected && (
        <>
          {/* Right Border Handle (Horizontal width resizing) */}
          <div
            onPointerDown={onStartResize}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ew-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Breite durch Ziehen anpassen"
          >
            <div className="w-0.5 h-3 bg-[#0071E3] rounded-full" />
          </div>

          {/* Bottom-Right Corner Handle */}
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

  // Resizing state for Signatures
  const [resizingSigId, setResizingSigId] = useState<string | null>(null);
  const [resizeSigStartPos, setResizeSigStartPos] = useState<{
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

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Start dragging annotation
  const handlePointerDownDrag = (e: React.PointerEvent, ann: TextAnnotation | SignatureAnnotation) => {
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

  // Start resizing signature
  const handlePointerDownSigResize = (e: React.PointerEvent, ann: SignatureAnnotation) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setResizingSigId(ann.id);
    setResizeSigStartPos({
      x: e.clientX,
      y: e.clientY,
      initialW: ann.width,
      initialH: ann.height,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Move handler for drag and both types of resize
  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId && dragStartPos) {
      e.preventDefault();
      const deltaX = (e.clientX - dragStartPos.x) / pageWidth;
      const deltaY = (e.clientY - dragStartPos.y) / pageHeight;

      const ann = annotations.find((a) => a.id === draggingId);
      if (!ann || ann.type === 'drawing') return;

      const newX = Math.max(0.01, Math.min(0.95, dragStartPos.initialAnnX + deltaX));
      const newY = Math.max(0.01, Math.min(0.95, dragStartPos.initialAnnY + deltaY));

      onUpdateAnnotation({
        ...ann,
        x: newX,
        y: newY,
      } as TextAnnotation | SignatureAnnotation);
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
    } else if (resizingSigId && resizeSigStartPos) {
      e.preventDefault();
      const deltaX = (e.clientX - resizeSigStartPos.x) / pageWidth;
      const deltaY = (e.clientY - resizeSigStartPos.y) / pageHeight;

      const ann = annotations.find((a) => a.id === resizingSigId) as SignatureAnnotation | undefined;
      if (!ann || ann.type !== 'signature') return;

      const newW = Math.max(0.05, Math.min(0.9, resizeSigStartPos.initialW + deltaX));
      const newH = Math.max(0.02, Math.min(0.5, resizeSigStartPos.initialH + deltaY));

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
    if (resizingSigId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setResizingSigId(null);
      setResizeSigStartPos(null);
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
              onDuplicate={() => onDuplicateAnnotation && onDuplicateAnnotation(ann as TextAnnotation)}
              onStartDrag={(e) => handlePointerDownDrag(e, ann as TextAnnotation)}
              onStartResize={(e) => handlePointerDownTextResize(e, ann as TextAnnotation)}
            />
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
                  ? 'border-2 border-[#0071E3] rounded-lg shadow-lg bg-blue-50/10'
                  : 'hover:border hover:border-blue-300'
              }`}
            >
              <img
                src={sigAnn.dataUrl}
                alt="Unterschrift"
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* Delete button when selected */}
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

              {/* Resize Handle at bottom right */}
              {isSelected && (
                <div
                  onPointerDown={(e) => handlePointerDownSigResize(e, sigAnn)}
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
