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
  ClipboardPaste,
  List,
  ListOrdered,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Calendar,
  Heading1,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  TextAnnotation,
  SignatureAnnotation,
  ImageAnnotation,
  HighlightAnnotation,
  RedactionAnnotation,
  ShapeAnnotation,
  FreehandDrawingAnnotation,
  TextArtAnnotation,
  Annotation,
} from '../types/pdf';
import { classifyLine } from '../lib/a4Pagination';
import { formatMarkdownToCleanText } from '../lib/geminiService';
import { buildTextArtSvgMarkup, getFontFamilyCss } from '../lib/textArtHelper';

interface AnnotationLayerProps {
  pageNumber: number;
  pageWidth: number; // rendered CSS pixel width of current page
  pageHeight: number; // rendered CSS pixel height of current page
  scale?: number; // current zoom scale
  annotations: Annotation[];
  onUpdateAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onDuplicateAnnotation?: (ann: Annotation) => void;
  onReorderAnnotation?: (id: string, action: 'bringToFront' | 'sendToBack') => void;
  onEditTextArt?: (art: TextArtAnnotation) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
}

const stripLinePrefix = (line: string): string => {
  return line
    .replace(/^\s*(?:\[\s*\]|\[[xX✓✔]\]|☐|☑)\s*/, '')
    .replace(/^\s*[*•\-]\s+/, '')
    .replace(/^\s*[0-9]+[.)]\s+/, '')
    .replace(/^\s*#{1,4}\s+/, '');
};

// Sub-component for individual text annotation with auto-resizing textarea & word processing tools
const TextAnnotationItem: React.FC<{
  textAnn: TextAnnotation;
  pageWidth: number;
  pageHeight: number;
  scale?: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (ann: TextAnnotation) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onSendToBack?: () => void;
  onBringToFront?: () => void;
  onStartDrag: (e: React.PointerEvent) => void;
  onStartResize: (e: React.PointerEvent) => void;
}> = ({
  textAnn,
  pageWidth,
  pageHeight,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onSendToBack,
  onBringToFront,
  onStartDrag,
  onStartResize,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!textAnn.text || textAnn.text.trim().length === 0);

  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    } else if (!textAnn.text || textAnn.text.trim().length === 0) {
      setIsEditing(true);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      requestAnimationFrame(() => {
        el.focus();
      });
    }
  }, [isEditing]);

  const zoom = scale && scale > 0 ? scale : pageWidth / 595.28;
  const displayFontSize = Math.max(8, Math.round(textAnn.fontSize * zoom));
  const effectiveWidthNorm = textAnn.width || 0.3;
  const leftPx = textAnn.x * pageWidth;
  const topPx = textAnn.y * pageHeight;
  const widthPx = effectiveWidthNorm * pageWidth;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(28, textareaRef.current.scrollHeight)}px`;
    }
  }, [textAnn.text, textAnn.fontSize, effectiveWidthNorm, pageWidth, textAnn.fontFamily, textAnn.isBold, isEditing, zoom]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...textAnn, text: e.target.value });
  };

  // Smart Enter key: auto-continue bullet lists (•), numbered lists (1., 2.), and checklists ([ ])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = e.currentTarget;
      const cursor = el.selectionStart ?? textAnn.text.length;
      const val = textAnn.text;
      const before = val.slice(0, cursor);
      const after = val.slice(el.selectionEnd ?? cursor);

      const lastNewlineIdx = before.lastIndexOf('\n');
      const currentLine = before.slice(lastNewlineIdx + 1);

      // 1. Check if current line is an EMPTY list item -> pressing Enter exits the list
      if (/^\s*(?:•|-|\*|[0-9]+[.)]|\[\s*\]|\[[xX✓✔]\]|☐|☑)\s*$/.test(currentLine)) {
        e.preventDefault();
        const cleanedBefore = before.slice(0, lastNewlineIdx + 1);
        const nextVal = cleanedBefore + after;
        onUpdate({ ...textAnn, text: nextVal });
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cleanedBefore.length;
          }
        });
        return;
      }

      // 2. Checklist continuation: [ ] or [x] -> next line starts with [ ]
      const checkMatch = currentLine.match(/^(\s*)(?:\[\s*\]|\[[xX✓✔]\]|☐|☑)\s+.+/);
      if (checkMatch) {
        e.preventDefault();
        const insert = `\n${checkMatch[1]}[ ] `;
        const nextVal = before + insert + after;
        onUpdate({ ...textAnn, text: nextVal });
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newPos = before.length + insert.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
          }
        });
        return;
      }

      // 3. Bullet list continuation: • or - -> next line starts with •
      const bulletMatch = currentLine.match(/^(\s*)[•\-*]\s+.+/);
      if (bulletMatch) {
        e.preventDefault();
        const insert = `\n${bulletMatch[1]}• `;
        const nextVal = before + insert + after;
        onUpdate({ ...textAnn, text: nextVal });
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newPos = before.length + insert.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
          }
        });
        return;
      }

      // 4. Numbered list continuation: 1. -> next line starts with 2.
      const numMatch = currentLine.match(/^(\s*)([0-9]+)([.)])\s+.+/);
      if (numMatch) {
        e.preventDefault();
        const nextNum = parseInt(numMatch[2], 10) + 1;
        const insert = `\n${numMatch[1]}${nextNum}${numMatch[3]} `;
        const nextVal = before + insert + after;
        onUpdate({ ...textAnn, text: nextVal });
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newPos = before.length + insert.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
          }
        });
        return;
      }
    }
  };

  // Word-processing list & heading formatter for current line or selected lines
  const applyLineFormatting = (mode: 'bullet' | 'numbered' | 'checklist' | 'toggle-check' | 'h1') => {
    const raw = textAnn.text || '';
    if (!raw.trim()) {
      const initialPrefix =
        mode === 'bullet'
          ? '• '
          : mode === 'numbered'
          ? '1. '
          : mode === 'checklist'
          ? '[ ] '
          : mode === 'toggle-check'
          ? '[x] '
          : '# ';
      onUpdate({ ...textAnn, text: initialPrefix });
      setIsEditing(true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = initialPrefix.length;
        }
      });
      return;
    }

    const lines = raw.split('\n');
    let startLine = 0;
    let endLine = lines.length - 1;

    if (isEditing && textareaRef.current) {
      const selStart = textareaRef.current.selectionStart ?? 0;
      const selEnd = textareaRef.current.selectionEnd ?? selStart;
      startLine = raw.slice(0, selStart).split('\n').length - 1;
      endLine = raw.slice(0, selEnd).split('\n').length - 1;
    }

    const targetLines = lines.slice(startLine, endLine + 1);

    if (mode === 'toggle-check') {
      const updated = lines.map((line, idx) => {
        if (idx < startLine || idx > endLine) return line;
        if (/^\s*(?:\[\s*\]|☐)/.test(line)) {
          return line.replace(/^(\s*)(?:\[\s*\]|☐)\s*/, '$1[x] ');
        }
        if (/^\s*(?:\[[xX✓✔]\]|☑)/.test(line)) {
          return line.replace(/^(\s*)(?:\[[xX✓✔]\]|☑)\s*/, '$1[ ] ');
        }
        return `[x] ${stripLinePrefix(line)}`;
      });
      onUpdate({ ...textAnn, text: updated.join('\n') });
      return;
    }

    const allAlreadyMatch = targetLines.every((l) => {
      if (!l.trim()) return true;
      if (mode === 'bullet') return /^\s*[•\-*]\s+/.test(l) && !/^\s*\[/.test(l);
      if (mode === 'numbered') return /^\s*[0-9]+[.)]\s+/.test(l);
      if (mode === 'checklist') return /^\s*(?:\[\s*\]|\[[xX✓✔]\]|☐|☑)/.test(l);
      if (mode === 'h1') return /^\s*#\s+/.test(l);
      return false;
    });

    let counter = 1;
    const updated = lines.map((line, idx) => {
      if (idx < startLine || idx > endLine) return line;
      if (!line.trim() && startLine !== endLine) return line;
      const clean = stripLinePrefix(line);
      if (allAlreadyMatch) {
        return clean;
      }
      if (mode === 'bullet') return `• ${clean}`;
      if (mode === 'numbered') return `${counter++}. ${clean}`;
      if (mode === 'checklist') return `[ ] ${clean}`;
      if (mode === 'h1') return `# ${clean}`;
      return line;
    });

    onUpdate({ ...textAnn, text: updated.join('\n') });
    setIsEditing(true);
  };

  // Toggle a specific checklist line directly by clicking its checkbox in preview mode
  const toggleSpecificChecklistLine = (lineIdx: number) => {
    const lines = (textAnn.text || '').split('\n');
    if (lineIdx < 0 || lineIdx >= lines.length) return;
    const line = lines[lineIdx];
    if (/^\s*(?:\[\s*\]|☐)/.test(line)) {
      lines[lineIdx] = line.replace(/^(\s*)(?:\[\s*\]|☐)\s*/, '$1[x] ');
    } else if (/^\s*(?:\[[xX✓✔]\]|☑)/.test(line)) {
      lines[lineIdx] = line.replace(/^(\s*)(?:\[[xX✓✔]\]|☑)\s*/, '$1[ ] ');
    }
    onUpdate({ ...textAnn, text: lines.join('\n') });
  };

  const insertSnippet = (snippet: string) => {
    const raw = textAnn.text || '';
    if (isEditing && textareaRef.current) {
      const start = textareaRef.current.selectionStart ?? raw.length;
      const end = textareaRef.current.selectionEnd ?? start;
      const next = raw.slice(0, start) + snippet + raw.slice(end);
      onUpdate({ ...textAnn, text: next });
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + snippet.length;
        }
      });
    } else {
      const next = raw ? `${raw}\n${snippet}` : snippet;
      onUpdate({ ...textAnn, text: next });
      setIsEditing(true);
    }
  };

  const handlePasteFromClipboardButton = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText) return;
      const cleaned = formatMarkdownToCleanText(clipText);
      const nextText = textAnn.text ? `${textAnn.text}\n${cleaned}` : cleaned;
      onUpdate({ ...textAnn, text: nextText });
      setIsEditing(true);
    } catch {
      alert('Bitte nutze direkt die Tastenkombination Cmd+V (Mac) bzw. Strg+V (Windows), um Text einzufügen.');
    }
  };

  const adjustWidthDelta = (deltaNorm: number) => {
    const newWidth = Math.max(0.08, Math.min(0.98 - textAnn.x, effectiveWidthNorm + deltaNorm));
    onUpdate({ ...textAnn, width: newWidth });
  };

  const hasBackground = textAnn.backgroundColor && textAnn.backgroundColor !== 'transparent';
  const align = textAnn.textAlign || 'left';

  // Smart toolbar placement: flip below if near top of page (needs ~84px for 2-row word processor bar), and shift left if near right edge
  const showToolbarBelow = topPx < 88;
  const estimatedToolbarWidth = 660;
  const toolbarOffsetLeft = Math.min(0, Math.max(-leftPx + 8, pageWidth - leftPx - estimatedToolbarWidth));

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
          ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl bg-white/85 shadow-xl z-30'
          : 'hover:ring-1 hover:ring-blue-300 rounded-xl hover:bg-white/40 z-10'
      }`}
    >
      {/* Floating 2-Row Word-Processing Toolbar when Selected */}
      {isSelected && (
        <div
          style={{ left: `${toolbarOffsetLeft}px` }}
          className={`absolute ${
            showToolbarBelow ? 'top-full mt-2.5' : '-top-[82px]'
          } flex flex-col gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-2 rounded-2xl shadow-2xl text-xs z-50 select-none whitespace-nowrap border border-white/10`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Row 1: Font, Size, Style, Alignment, Color, Background, Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                isEditing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-[#0071E3] hover:bg-blue-600 text-white'
              }`}
              title={isEditing ? 'Bearbeitung abschließen (Ansichtsmodus)' : 'Text bearbeiten'}
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

            <button
              onClick={handlePasteFromClipboardButton}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition"
              title="Text aus Zwischenablage (z. B. aus KI-Recherche) hier einfügen (oder Cmd+V / Strg+V drücken)"
            >
              <ClipboardPaste size={12} />
              <span>Einfügen</span>
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
              <option value="Impact" className="bg-[#1D1D1F] text-white">Impact (Plakat)</option>
              <option value="Arial Black" className="bg-[#1D1D1F] text-white">Arial Black (Massiv)</option>
              <option value="Montserrat" className="bg-[#1D1D1F] text-white">Montserrat (Modern)</option>
              <option value="Playfair Display" className="bg-[#1D1D1F] text-white">Playfair Display (Design)</option>
              <option value="Dancing Script" className="bg-[#1D1D1F] text-white">Dancing Script (Schreibschrift)</option>
              <option value="Caveat" className="bg-[#1D1D1F] text-white">Caveat (Handschrift)</option>
              <option value="Cinzel" className="bg-[#1D1D1F] text-white">Cinzel (Klassisch)</option>
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

            {/* Text Alignment (Left / Center / Right) */}
            <div className="flex items-center bg-white/10 p-0.5 rounded-lg" title="Textausrichtung">
              <button
                onClick={() => onUpdate({ ...textAnn, textAlign: 'left' })}
                className={`p-1 rounded transition ${
                  align === 'left' ? 'bg-[#0071E3] text-white' : 'text-gray-300 hover:text-white'
                }`}
                title="Linksbündig"
              >
                <AlignLeft size={12} />
              </button>
              <button
                onClick={() => onUpdate({ ...textAnn, textAlign: 'center' })}
                className={`p-1 rounded transition ${
                  align === 'center' ? 'bg-[#0071E3] text-white' : 'text-gray-300 hover:text-white'
                }`}
                title="Zentriert"
              >
                <AlignCenter size={12} />
              </button>
              <button
                onClick={() => onUpdate({ ...textAnn, textAlign: 'right' })}
                className={`p-1 rounded transition ${
                  align === 'right' ? 'bg-[#0071E3] text-white' : 'text-gray-300 hover:text-white'
                }`}
                title="Rechtsbündig"
              >
                <AlignRight size={12} />
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

            <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg">
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <ArrowLeftRight size={10} />
              </span>
              <button
                onClick={() => adjustWidthDelta(-0.05)}
                className="px-1 hover:bg-white/20 rounded text-gray-300 hover:text-white font-mono text-[11px]"
                title="Box schmaler"
              >
                -
              </button>
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
              {['#000000', '#FFFFFF', '#0071E3', '#2BB3A3', '#F0A33A', '#E02020', '#107C41'].map((c) => (
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

            {onSendToBack && (
              <button
                onClick={onSendToBack}
                className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
                title="Ebene: Ganz nach hinten (hinter andere Elemente legen)"
              >
                <ArrowDown size={13} />
              </button>
            )}

            {onBringToFront && (
              <button
                onClick={onBringToFront}
                className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
                title="Ebene: Ganz nach vorne (vor alle anderen Elemente legen)"
              >
                <ArrowUp size={13} />
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

          {/* Row 2: Word-Processing Tools (Lists, Checklists, Headings, Divider, Date) */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-0.5">
              Format:
            </span>

            <button
              onClick={() => applyLineFormatting('bullet')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-[#0071E3] text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Aufzählung mit Punkten (•) einfügen / umschalten (Enter führt Liste automatisch fort)"
            >
              <List size={12} />
              <span>• Punkte</span>
            </button>

            <button
              onClick={() => applyLineFormatting('numbered')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-[#0071E3] text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Nummerierte Liste (1. 2. 3.) einfügen / umschalten (Enter zählt automatisch weiter)"
            >
              <ListOrdered size={12} />
              <span>1. Zahlen</span>
            </button>

            <button
              onClick={() => applyLineFormatting('checklist')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-emerald-600 text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Checkliste (☐ Aufgaben zum Abhaken) einfügen / umschalten"
            >
              <ListChecks size={12} />
              <span>☐ Checkliste</span>
            </button>

            <button
              onClick={() => applyLineFormatting('toggle-check')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-[11px] font-medium transition border border-emerald-500/30"
              title="Aktuellen Checklisten-Punkt abhaken (☑) oder wieder öffnen (☐)"
            >
              <CheckSquare size={12} />
              <span>Abhaken ☑</span>
            </button>

            <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

            <button
              onClick={() => applyLineFormatting('h1')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Als Überschrift formatieren (#)"
            >
              <Heading1 size={12} />
              <span>Überschrift</span>
            </button>

            <button
              onClick={() => insertSnippet('---')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Horizontale Trennlinie einfügen"
            >
              <Minus size={12} />
              <span>Trennlinie</span>
            </button>

            <button
              onClick={() => insertSnippet(new Date().toLocaleDateString('de-DE'))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-[11px] font-medium transition"
              title="Heutiges Datum an der Cursorposition einfügen"
            >
              <Calendar size={12} />
              <span>Datum</span>
            </button>
          </div>
        </div>
      )}

      {/* External Drag Handle Tab (does not push or displace text inside box) */}
      {(isSelected || !isEditing) && (
        <div
          onPointerDown={onStartDrag}
          className={`absolute -top-6 left-0 flex items-center gap-1 px-2 py-0.5 rounded-t-md cursor-grab active:cursor-grabbing transition select-none z-30 text-[11px] font-semibold ${
            isSelected
              ? 'bg-[#0071E3] text-white shadow'
              : 'opacity-0 group-hover:opacity-100 bg-gray-700 text-white shadow-sm'
          }`}
          title="Gedrückt halten zum Verschieben"
        >
          <Move size={12} />
          <span>Verschieben</span>
        </div>
      )}

      {/* Box Inner Layout */}
      <div className={`relative w-full ${hasBackground ? 'p-1.5' : 'p-0'}`}>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={textAnn.text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: `${displayFontSize}px`,
              color: textAnn.color,
              lineHeight: '1.45',
              fontFamily: getFontFamilyCss(textAnn.fontFamily),
              fontWeight: textAnn.isBold ? 'bold' : 'normal',
              fontStyle: textAnn.isItalic ? 'italic' : 'normal',
              textAlign: align,
              backgroundColor: 'transparent',
            }}
            className="w-full bg-transparent border-0 focus:outline-none resize-none p-0 m-0 overflow-hidden break-words"
            placeholder="Direkt losschreiben, Liste wählen oder mit Cmd+V / Strg+V einfügen..."
            rows={1}
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              setIsEditing(true);
            }}
            style={{
              fontFamily: getFontFamilyCss(textAnn.fontFamily),
              color: textAnn.color,
              textAlign: align,
            }}
            className="w-full select-text cursor-text leading-relaxed"
            title="Klicken zum direkten Bearbeiten (Checkboxen können direkt abgehakt werden)"
          >
            {textAnn.text ? (
              textAnn.text.split('\n').map((line, idx) => {
                const classified = classifyLine(line, textAnn.fontSize);
                if (classified.type === 'empty') {
                  return <div key={idx} style={{ height: `${displayFontSize * 0.7}px` }} />;
                }
                if (classified.type === 'divider') {
                  return <hr key={idx} className="my-2 border-t border-gray-300" />;
                }
                if (classified.type === 'h1') {
                  return (
                    <h1
                      key={idx}
                      style={{
                        fontSize: `${Math.round(classified.fontSize * zoom)}px`,
                        fontWeight: 'bold',
                        marginTop: idx === 0 ? '0px' : `${Math.round(10 * zoom)}px`,
                        marginBottom: `${Math.round(3 * zoom)}px`,
                        lineHeight: '1.25',
                        color: textAnn.color,
                        textAlign: align,
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
                        fontSize: `${Math.round(classified.fontSize * zoom)}px`,
                        fontWeight: 'bold',
                        marginTop: idx === 0 ? '0px' : `${Math.round(8 * zoom)}px`,
                        marginBottom: `${Math.round(2 * zoom)}px`,
                        lineHeight: '1.3',
                        color: textAnn.color,
                        textAlign: align,
                      }}
                    >
                      {classified.text}
                    </h2>
                  );
                }
                if (classified.type === 'checklist') {
                  const checkSize = Math.max(9, Math.round(displayFontSize * 0.70));
                  return (
                    <div
                      key={idx}
                      style={{
                        fontSize: `${displayFontSize}px`,
                        lineHeight: '1.45',
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${Math.max(3, Math.round(5 * zoom))}px`,
                        marginTop: `${Math.round(2 * zoom)}px`,
                        textAlign: 'left',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect();
                          toggleSpecificChecklistLine(idx);
                        }}
                        style={{
                          width: `${checkSize}px`,
                          height: `${checkSize}px`,
                        }}
                        className="shrink-0 flex items-center justify-center transition"
                        title={classified.checked ? 'Als offen markieren' : 'Abhaken'}
                      >
                        {classified.checked ? (
                          <div
                            style={{
                              width: `${checkSize}px`,
                              height: `${checkSize}px`,
                            }}
                            className="bg-emerald-600 rounded-[2.5px] flex items-center justify-center text-white"
                          >
                            <svg
                              viewBox="0 0 12 12"
                              style={{ width: `${checkSize * 0.75}px`, height: `${checkSize * 0.75}px` }}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="2.5 6.5 4.5 9 9.5 3" />
                            </svg>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: `${checkSize}px`,
                              height: `${checkSize}px`,
                              borderWidth: `${Math.max(1.2, 1.2 * zoom)}px`,
                            }}
                            className="rounded-[2.5px] border-gray-600 hover:border-[#0071E3] transition bg-white"
                          />
                        )}
                      </button>
                      <span
                        style={{
                          fontWeight: textAnn.isBold ? 'bold' : 'normal',
                          fontStyle: textAnn.isItalic ? 'italic' : 'normal',
                        }}
                      >
                        {classified.text}
                      </span>
                    </div>
                  );
                }
                if (classified.type === 'numbered') {
                  return (
                    <div
                      key={idx}
                      style={{
                        fontSize: `${displayFontSize}px`,
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: `${Math.max(4, Math.round(6 * zoom))}px`,
                        marginTop: `${Math.round(2 * zoom)}px`,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 'bold', minWidth: `${Math.round(18 * zoom)}px` }}>
                        {classified.marker}
                      </span>
                      <span
                        style={{
                          fontWeight: textAnn.isBold ? 'bold' : 'normal',
                          fontStyle: textAnn.isItalic ? 'italic' : 'normal',
                        }}
                      >
                        {classified.text}
                      </span>
                    </div>
                  );
                }
                if (classified.type === 'bullet') {
                  return (
                    <div
                      key={idx}
                      style={{
                        fontSize: `${displayFontSize}px`,
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: `${Math.max(4, Math.round(7 * zoom))}px`,
                        marginTop: `${Math.round(2 * zoom)}px`,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: `${displayFontSize}px`, fontWeight: 'bold' }}>•</span>
                      <span
                        style={{
                          fontWeight: textAnn.isBold ? 'bold' : 'normal',
                          fontStyle: textAnn.isItalic ? 'italic' : 'normal',
                        }}
                      >
                        {classified.text}
                      </span>
                    </div>
                  );
                }
                return (
                  <p
                    key={idx}
                    style={{
                      fontSize: `${displayFontSize}px`,
                      lineHeight: '1.4',
                      marginTop: `${Math.round(2 * zoom)}px`,
                      fontWeight: textAnn.isBold ? 'bold' : 'normal',
                      fontStyle: textAnn.isItalic ? 'italic' : 'normal',
                      textAlign: align,
                    }}
                  >
                    {classified.text}
                  </p>
                );
              })
            ) : (
              <span className="text-gray-400 italic text-xs">Hier klicken und losschreiben...</span>
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
  onSendToBack?: () => void;
  onBringToFront?: () => void;
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
  onSendToBack,
  onBringToFront,
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

  const setPresetWidth = (targetWidthNorm: number) => {
    let newW = Math.max(0.05, Math.min(0.92, targetWidthNorm));
    let newH = isLocked
      ? (newW * (pageWidth / pageHeight)) / imgAnn.aspectRatio
      : imgAnn.height;

    if (newH > 0.92) {
      newH = 0.92;
      if (isLocked) {
        newW = newH * (pageHeight / pageWidth) * imgAnn.aspectRatio;
      }
    }

    const newX = Math.max(0.02, Math.min(0.98 - newW, imgAnn.x));
    const newY = Math.max(0.02, Math.min(0.98 - newH, imgAnn.y));

    onUpdate({
      ...imgAnn,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    });
  };

  const centerHorizontally = () => {
    const newX = Math.max(0.02, (1 - imgAnn.width) / 2);
    onUpdate({
      ...imgAnn,
      x: newX,
    });
  };

  const toggleAspectLock = () => {
    onUpdate({
      ...imgAnn,
      lockAspectRatio: !isLocked,
    });
  };

  const showToolbarBelow = topPx < 56;
  const toolbarOffsetLeft = Math.min(0, Math.max(-leftPx + 8, pageWidth - leftPx - 480));

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
          ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl shadow-2xl bg-blue-50/20 z-30'
          : 'hover:ring-1 hover:ring-blue-300 rounded-xl hover:bg-black/5 z-10'
      }`}
      title="Gedrückt halten zum freien Verschieben – an den Ecken/Rändern ziehen für Größe"
    >
      <img
        src={imgAnn.dataUrl}
        alt={imgAnn.name || 'Bild'}
        className="w-full h-full object-contain pointer-events-none rounded-lg"
        draggable={false}
      />

      {isSelected && (
        <div
          style={{ left: `${toolbarOffsetLeft}px` }}
          className={`absolute ${
            showToolbarBelow ? 'top-full mt-2.5' : '-top-12'
          } flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1.5 rounded-xl shadow-2xl text-xs z-50 select-none whitespace-nowrap border border-white/10`}
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
            <span className="text-[10px] text-gray-300 px-1 font-mono">
              {Math.round(imgAnn.width * 100)}%
            </span>
            <button
              onClick={() => adjustScale(1.15)}
              className="p-0.5 hover:bg-white/20 rounded text-gray-300 hover:text-white"
              title="Größer"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Quick Size Presets */}
          <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg" title="Schnell-Größe">
            {[
              { label: 'Klein', w: 0.2 },
              { label: 'Mittel', w: 0.38 },
              { label: 'Groß', w: 0.6 },
              { label: 'Breit', w: 0.84 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setPresetWidth(p.w)}
                className="px-1.5 py-0.5 rounded text-[10px] text-gray-300 hover:bg-white/20 hover:text-white transition"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={centerHorizontally}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-gray-200 hover:text-white transition"
            title="Bild horizontal auf der Seite zentrieren"
          >
            Zentrieren
          </button>

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

          {onSendToBack && (
            <button
              onClick={onSendToBack}
              className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
              title="Ebene: Ganz nach hinten (hinter andere Elemente legen)"
            >
              <ArrowDown size={13} />
            </button>
          )}

          {onBringToFront && (
            <button
              onClick={onBringToFront}
              className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition"
              title="Ebene: Ganz nach vorne (vor alle anderen Elemente legen)"
            >
              <ArrowUp size={13} />
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
          {/* Right edge handle */}
          <div
            onPointerDown={onStartRightResize}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ew-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Breite ziehen"
          >
            <div className="w-0.5 h-3 bg-[#0071E3] rounded-full" />
          </div>

          {/* Bottom edge handle */}
          <div
            onPointerDown={onStartBottomResize}
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-8 h-4 bg-white border-2 border-[#0071E3] rounded-full flex items-center justify-center cursor-ns-resize shadow-md hover:scale-110 active:scale-110 transition z-30"
            title="Höhe ziehen"
          >
            <div className="h-0.5 w-3 bg-[#0071E3] rounded-full" />
          </div>

          {/* Corner resize handles */}
          <div
            onPointerDown={onStartCornerResize}
            className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-[#0071E3] rounded-full shadow pointer-events-none z-30"
          />
          <div
            onPointerDown={onStartCornerResize}
            className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#0071E3] rounded-full shadow pointer-events-none z-30"
          />
          <div
            onPointerDown={onStartCornerResize}
            className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-[#0071E3] rounded-full shadow pointer-events-none z-30"
          />
          <div
            onPointerDown={onStartCornerResize}
            className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#0071E3] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-lg hover:scale-125 active:scale-125 transition z-30 ring-2 ring-white"
            title="Größe durch Ziehen stufenlos anpassen"
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
  scale,
  annotations,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onDuplicateAnnotation,
  onReorderAnnotation,
  onEditTextArt,
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

  // Resizing state for Signatures / Boxes (Highlight, Redaction, Shape, TextArt)
  const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);
  const [resizeBoxStartPos, setResizeBoxStartPos] = useState<{
    x: number;
    y: number;
    initialW: number;
    initialH: number;
    type?: 'corner' | 'right' | 'bottom';
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
      | TextArtAnnotation
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

  // Start resizing generic 2D box (Signature, Highlight, Redaction, Shape, TextArt)
  const handlePointerDownBoxResize = (
    e: React.PointerEvent,
    ann: SignatureAnnotation | HighlightAnnotation | RedactionAnnotation | ShapeAnnotation | TextArtAnnotation,
    resizeType: 'corner' | 'right' | 'bottom' = 'corner'
  ) => {
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    setResizingBoxId(ann.id);
    setResizeBoxStartPos({
      x: e.clientX,
      y: e.clientY,
      initialW: ann.width,
      initialH: ann.height,
      type: resizeType,
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

      // Shapes, images, redactions, highlights and textart can be placed flush to edges (0.0 .. 1.0)
      const isFullBleed =
        ann.type === 'shape' ||
        ann.type === 'redaction' ||
        ann.type === 'image' ||
        ann.type === 'highlight' ||
        ann.type === 'textart';
      const minX = isFullBleed ? 0 : 0.005;
      const maxX = isFullBleed ? Math.max(0, 1.0 - annWidth) : Math.max(0.005, 0.995 - annWidth);
      const minY = isFullBleed ? 0 : 0.005;
      const maxY = isFullBleed ? Math.max(0, 1.0 - annHeight) : Math.max(0.005, 0.995 - annHeight);

      const newX = Math.max(minX, Math.min(maxX, dragStartPos.initialAnnX + deltaX));
      const newY = Math.max(minY, Math.min(maxY, dragStartPos.initialAnnY + deltaY));

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
        | TextArtAnnotation
        | undefined;
      if (!ann) return;

      const isShape = ann.type === 'shape' || ann.type === 'textart';
      const minW = isShape ? 0.02 : 0.04;
      const minH = ann.type === 'highlight' || ann.type === 'redaction' ? 0.015 : 0.02;

      // Allow shapes & textart to stretch flush to page edges
      const maxW = isShape ? Math.max(minW, 1.0 - ann.x) : Math.max(minW, 0.98 - ann.x);
      const maxH = isShape ? Math.max(minH, 1.0 - ann.y) : Math.max(minH, 0.98 - ann.y);

      let newW = ann.width;
      let newH = ann.height;

      const resizeType = resizeBoxStartPos.type || 'corner';
      if (ann.type === 'textart' && resizeType === 'corner') {
        const initialAspect =
          (resizeBoxStartPos.initialW * pageWidth) /
          Math.max(1, resizeBoxStartPos.initialH * pageHeight);
        newW = Math.max(minW, Math.min(maxW, resizeBoxStartPos.initialW + deltaX));
        newH = (newW * (pageWidth / pageHeight)) / initialAspect;
        if (newH > maxH) {
          newH = maxH;
          newW = Math.max(minW, Math.min(maxW, newH * (pageHeight / pageWidth) * initialAspect));
        }
      } else {
        if (resizeType === 'right' || resizeType === 'corner') {
          newW = Math.max(minW, Math.min(maxW, resizeBoxStartPos.initialW + deltaX));
        }
        if (resizeType === 'bottom' || resizeType === 'corner') {
          newH = Math.max(minH, Math.min(maxH, resizeBoxStartPos.initialH + deltaY));
        }
      }

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
      className="absolute inset-0 pointer-events-none select-none overflow-visible"
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
              scale={scale}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(ann.id)}
              onUpdate={(updated) => onUpdateAnnotation(updated)}
              onDelete={() => onDeleteAnnotation(ann.id)}
              onDuplicate={() => onDuplicateAnnotation && onDuplicateAnnotation(ann)}
              onSendToBack={() => onReorderAnnotation && onReorderAnnotation(ann.id, 'sendToBack')}
              onBringToFront={() => onReorderAnnotation && onReorderAnnotation(ann.id, 'bringToFront')}
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
              onSendToBack={() => onReorderAnnotation && onReorderAnnotation(ann.id, 'sendToBack')}
              onBringToFront={() => onReorderAnnotation && onReorderAnnotation(ann.id, 'bringToFront')}
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
          const strokeW = sh.strokeWidth !== undefined ? sh.strokeWidth : 2;
          const isFilled = !!sh.isFilled;
          const fillC = sh.fillColor || sh.color || '#000000';
          const scaledStroke = Math.max(1, Math.round(strokeW * (scale || 1)));

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
                isSelected ? 'ring-2 ring-[#0071E3] ring-offset-2 z-20' : 'hover:ring-1 hover:ring-blue-300 z-10'
              }`}
            >
              {sh.shapeType === 'rect' ? (
                <div
                  className="w-full h-full pointer-events-none"
                  style={{
                    backgroundColor: isFilled ? fillC : 'transparent',
                    border: strokeW > 0 ? `${scaledStroke}px solid ${strokeC}` : 'none',
                    boxSizing: 'border-box',
                    borderRadius: strokeW === 0 || isFilled ? 0 : 2,
                  }}
                />
              ) : sh.shapeType === 'circle' ? (
                <div
                  className="w-full h-full pointer-events-none rounded-full"
                  style={{
                    backgroundColor: isFilled ? fillC : 'transparent',
                    border: strokeW > 0 ? `${scaledStroke}px solid ${strokeC}` : 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
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
                      strokeWidth={Math.max(2, (strokeW || 3) * 2.5)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {sh.shapeType === 'cross' && (
                    <path
                      d="M 20 20 L 80 80 M 80 20 L 20 80"
                      fill="none"
                      stroke={strokeC}
                      strokeWidth={Math.max(2, (strokeW || 3) * 2.5)}
                      strokeLinecap="round"
                    />
                  )}
                  {sh.shapeType === 'arrow' && (
                    <path
                      d="M 6 50 L 92 50 M 68 25 L 92 50 L 68 75"
                      fill="none"
                      stroke={strokeC}
                      strokeWidth={Math.max(2, (strokeW || 2.5) * 2)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              )}

              {isSelected && (
                <>
                  <div
                    className={`absolute ${sh.y < 0.08 ? 'top-full mt-2' : '-top-11'} left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2 py-1.5 rounded-xl shadow-xl text-xs z-30 whitespace-nowrap`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {/* Farbauswahl */}
                    {['#000000', '#FFFFFF', '#1D1D1F', '#0071E3', '#2BB3A3', '#F0A33A', '#E02020', '#107C41'].map((c) => (
                      <button
                        key={c}
                        onClick={() => onUpdateAnnotation({ ...sh, color: c })}
                        style={{ backgroundColor: c }}
                        title={`Farbe: ${c}`}
                        className={`w-3.5 h-3.5 rounded-full border border-white/60 transition ${
                          sh.color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                        }`}
                      />
                    ))}

                    {/* Füllung umschalten (für Rechteck & Kreis) */}
                    {(sh.shapeType === 'rect' || sh.shapeType === 'circle') && (
                      <>
                        <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                        <button
                          onClick={() => {
                            const nextFilled = !isFilled;
                            const nextStroke = !nextFilled && strokeW === 0 ? 2 : strokeW;
                            onUpdateAnnotation({ ...sh, isFilled: nextFilled, strokeWidth: nextStroke });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                            isFilled ? 'bg-[#0071E3] text-white font-semibold' : 'hover:bg-white/20 text-gray-300'
                          }`}
                          title={isFilled ? 'Fläche gefüllt (Klicken für nur Rahmen)' : 'Nur Rahmen (Klicken für gefüllte Fläche)'}
                        >
                          {isFilled ? 'Gefüllt' : 'Rahmen'}
                        </button>
                      </>
                    )}

                    {/* Rahmenstärke (0, 1, 2, 4, 8 px) */}
                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    <span className="text-[10px] text-gray-400 select-none">Rahmen:</span>
                    {[0, 1, 2, 4, 8].map((w) => (
                      <button
                        key={w}
                        onClick={() => {
                          const nextFilled = w === 0 && !isFilled ? true : isFilled;
                          onUpdateAnnotation({ ...sh, strokeWidth: w, isFilled: nextFilled });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[11px] transition ${
                          strokeW === w ? 'bg-white/30 text-white font-bold' : 'hover:bg-white/10 text-gray-300'
                        }`}
                        title={w === 0 ? 'Ohne Rahmen (0 px)' : `Rahmenstärke ${w} px`}
                      >
                        {w === 0 ? 'Ohne' : `${w}px`}
                      </button>
                    ))}

                    {/* Schnell-Aktionen für Rechteck */}
                    {sh.shapeType === 'rect' && (
                      <>
                        <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                        <button
                          onClick={() => onUpdateAnnotation({ ...sh, x: 0, width: 1.0 })}
                          className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-white/20 text-gray-200 hover:text-white transition"
                          title="Über die gesamte Seitenbreite spannen (100 %)"
                        >
                          100 % Breite
                        </button>
                        <button
                          onClick={() => onUpdateAnnotation({ ...sh, y: 0 })}
                          className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-white/20 text-gray-200 hover:text-white transition"
                          title="Ganz nach oben an den Seitenrand anheften"
                        >
                          Ganz oben
                        </button>
                      </>
                    )}

                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    {onDuplicateAnnotation && (
                      <button
                        onClick={() => onDuplicateAnnotation(sh)}
                        className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                        title="Duplizieren"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    {onReorderAnnotation && (
                      <>
                        <button
                          onClick={() => onReorderAnnotation(sh.id, 'sendToBack')}
                          className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                          title="Ebene: Ganz nach hinten (hinter andere Elemente legen)"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => onReorderAnnotation(sh.id, 'bringToFront')}
                          className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                          title="Ebene: Ganz nach vorne (vor alle anderen Elemente legen)"
                        >
                          <ArrowUp size={12} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDeleteAnnotation(sh.id)}
                      className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white"
                      title="Löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Corner resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, sh, 'corner')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#0071E3] rounded-full cursor-se-resize ring-2 ring-white shadow z-30"
                    title="Größe anpassen (Ecke)"
                  />
                  {/* Right edge resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, sh, 'right')}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-5 bg-[#0071E3] rounded-sm cursor-e-resize ring-2 ring-white shadow z-30"
                    title="Breite anpassen"
                  />
                  {/* Bottom edge resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, sh, 'bottom')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-[#0071E3] rounded-sm cursor-s-resize ring-2 ring-white shadow z-30"
                    title="Höhe anpassen"
                  />
                </>
              )}
            </div>
          );
        }

        if (ann.type === 'textart') {
          const art = ann as TextArtAnnotation;
          const leftPx = art.x * pageWidth;
          const topPx = art.y * pageHeight;
          const widthPx = art.width * pageWidth;
          const heightPx = art.height * pageHeight;
          const svgMarkup = buildTextArtSvgMarkup(art, 800, 320, `layer_${art.id}`);

          return (
            <div
              key={art.id}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                top: `${topPx}px`,
                width: `${widthPx}px`,
                height: `${heightPx}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(art.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (onEditTextArt) onEditTextArt(art);
              }}
              onPointerDown={(e) => handlePointerDownDrag(e, art)}
              className={`pointer-events-auto cursor-move ${
                isSelected ? 'ring-2 ring-[#0071E3] ring-offset-2 rounded-xl z-20' : 'hover:ring-1 hover:ring-blue-300 rounded z-10'
              }`}
            >
              <div
                className="w-full h-full pointer-events-none select-none flex items-center justify-center overflow-visible"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />

              {isSelected && (
                <>
                  <div
                    className={`absolute ${art.y < 0.08 ? 'top-full mt-2' : '-top-11'} left-0 flex items-center gap-1.5 bg-[#1D1D1F] text-white px-2.5 py-1.5 rounded-xl shadow-xl text-xs z-30 whitespace-nowrap`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {onEditTextArt && (
                      <button
                        onClick={() => onEditTextArt(art)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0071E3] hover:bg-blue-600 text-white flex items-center gap-1.5 transition"
                        title="TextArt & Biegung bearbeiten"
                      >
                        <Edit3 size={13} />
                        <span>Bearbeiten</span>
                      </button>
                    )}

                    <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

                    {onDuplicateAnnotation && (
                      <button
                        onClick={() => onDuplicateAnnotation(art)}
                        className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                        title="Duplizieren"
                      >
                        <Copy size={13} />
                      </button>
                    )}

                    {onReorderAnnotation && (
                      <>
                        <button
                          onClick={() => onReorderAnnotation(art.id, 'sendToBack')}
                          className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                          title="Ebene: Ganz nach hinten"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          onClick={() => onReorderAnnotation(art.id, 'bringToFront')}
                          className="p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white"
                          title="Ebene: Ganz nach vorne"
                        >
                          <ArrowUp size={13} />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => onDeleteAnnotation(art.id)}
                      className="p-1 hover:bg-red-500 rounded text-red-300 hover:text-white"
                      title="Löschen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Corner resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, art, 'corner')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#0071E3] rounded-full cursor-se-resize ring-2 ring-white shadow z-30"
                    title="Größe anpassen (Ecke)"
                  />
                  {/* Right edge resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, art, 'right')}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-5 bg-[#0071E3] rounded-sm cursor-e-resize ring-2 ring-white shadow z-30"
                    title="Breite anpassen"
                  />
                  {/* Bottom edge resize handle */}
                  <div
                    onPointerDown={(e) => handlePointerDownBoxResize(e, art, 'bottom')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-[#0071E3] rounded-sm cursor-s-resize ring-2 ring-white shadow z-30"
                    title="Höhe anpassen"
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
