import { useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { signatureBlocks, signatureFonts, signatureTextStyle } from '../lib/mailSignatures';
import type { renderSignature, SignatureBlock, SignatureImageSlot, SignatureProject } from '../lib/mailSignatures';

export type RenderedBlock = ReturnType<typeof renderSignature>['blocks'][number];
export type CanvasSelection = SignatureBlock | 'logo';
export type PreviewMode = 'edit' | 'light' | 'dark' | 'blocked' | 'plain';
export type PaletteItem = SignatureBlock | 'logo';
export type InlineText = 'greeting' | 'note' | 'legal';

export const BLOCK_MIME = 'application/x-signature-block';
export const PALETTE_MIME = 'application/x-signature-palette';

const inlineTexts: readonly SignatureBlock[] = ['greeting', 'note', 'legal'];
const paperWidth = { desktop: 680, mobile: 380 };

type ImageBox = { slot: SignatureImageSlot; left: number; top: number; width: number; height: number };

interface SignatureCanvasProps {
  project: SignatureProject;
  blocks: RenderedBlock[];
  selection?: CanvasSelection;
  mode: PreviewMode;
  device: keyof typeof paperWidth;
  zoom: number;
  previewHtml: string;
  plain: string;
  previewRef: RefObject<HTMLDivElement>;
  onSelect: (selection?: CanvasSelection) => void;
  onPlace: (block: SignatureBlock, before: SignatureBlock | null) => void;
  onPaletteDrop: (item: PaletteItem, before: SignatureBlock | null) => void;
  onFileDrop: (file: File) => void;
  onClear: (selection: CanvasSelection) => void;
  onReplaceImage: () => void;
  onChangeText: (field: InlineText, value: string) => void;
  onEditIdentity: () => void;
  onImageWidth: (slot: SignatureImageSlot, width: number) => void;
}

function hasType(event: DragEvent, type: string) {
  return Array.from(event.dataTransfer.types).includes(type);
}

export function SignatureCanvas({
  project, blocks, selection, mode, device, zoom, previewHtml, plain, previewRef,
  onSelect, onPlace, onPaletteDrop, onFileDrop, onClear, onReplaceImage, onChangeText, onEditIdentity, onImageWidth,
}: SignatureCanvasProps) {
  const [dropIndex, setDropIndex] = useState<number>();
  const [fileOver, setFileOver] = useState(false);
  const [editing, setEditing] = useState<InlineText>();
  const [imageBoxes, setImageBoxes] = useState<ImageBox[]>([]);
  const [paperHeight, setPaperHeight] = useState(0);
  const dragged = useRef<SignatureBlock>();
  const paper = useRef<HTMLDivElement>(null);
  const blockRefs = useRef(new Map<SignatureBlock, HTMLDivElement>());
  const resize = useRef<{ slot: SignatureImageSlot; startX: number; startWidth: number }>();
  const editMode = mode === 'edit';
  const selectedBlock = selection === 'logo' ? 'identity' : selection;
  const selectedIndex = blocks.findIndex(block => block.key === selectedBlock);

  // Measure images (for resize handles) and the paper height (so zooming keeps the scroll area correct).
  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      setPaperHeight(element.offsetHeight);
      if (!editMode) return setImageBoxes(boxes => (boxes.length ? [] : boxes));
      const origin = element.getBoundingClientRect();
      const boxes = Array.from(element.querySelectorAll<HTMLImageElement>('img[data-signature-image]')).map(image => {
        const rect = image.getBoundingClientRect();
        return {
          slot: image.dataset.signatureImage as SignatureImageSlot,
          left: (rect.left - origin.left) / zoom,
          top: (rect.top - origin.top) / zoom,
          width: rect.width / zoom,
          height: rect.height / zoom,
        };
      });
      setImageBoxes(previous => JSON.stringify(previous) === JSON.stringify(boxes) ? previous : boxes);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('img').forEach(image => image.addEventListener('load', measure));
    return () => {
      observer.disconnect();
      element.querySelectorAll('img').forEach(image => image.removeEventListener('load', measure));
    };
  });

  function indexAt(clientY: number) {
    for (let index = 0; index < blocks.length; index += 1) {
      const element = blockRefs.current.get(blocks[index].key);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return blocks.length;
  }

  function beforeKey(index: number) {
    return index < blocks.length ? blocks[index].key : null;
  }

  function dragOver(event: DragEvent<HTMLDivElement>) {
    const isFile = hasType(event, 'Files');
    if (!editMode && !isFile) return;
    if (!isFile && !hasType(event, BLOCK_MIME) && !hasType(event, PALETTE_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isFile ? 'copy' : hasType(event, PALETTE_MIME) ? 'copy' : 'move';
    if (isFile) {
      if (!fileOver) setFileOver(true);
      return;
    }
    const index = indexAt(event.clientY);
    if (index !== dropIndex) setDropIndex(index);
  }

  function clearDrag() {
    dragged.current = undefined;
    setDropIndex(undefined);
    setFileOver(false);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    const index = indexAt(event.clientY);
    const block = event.dataTransfer.getData(BLOCK_MIME) as SignatureBlock;
    const palette = event.dataTransfer.getData(PALETTE_MIME) as PaletteItem;
    clearDrag();
    if (file) return onFileDrop(file);
    if (!editMode) return;
    if (block) {
      if (beforeKey(index) !== block) onPlace(block, beforeKey(index));
      onSelect(block);
    } else if (palette) {
      onPaletteDrop(palette, beforeKey(index));
    }
  }

  function move(offset: -1 | 1) {
    if (!selectedBlock || selectedIndex < 0) return;
    const target = selectedIndex + offset;
    if (target < 0 || target >= blocks.length) return;
    onPlace(selectedBlock, beforeKey(offset < 0 ? target : target + 1));
  }

  function startEdit(key: SignatureBlock) {
    if (key === 'identity') return onEditIdentity();
    if (inlineTexts.includes(key)) setEditing(key as InlineText);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editMode || editing || !selection || event.target instanceof HTMLTextAreaElement) return;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      move(event.key === 'ArrowUp' ? -1 : 1);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection !== 'identity') {
      event.preventDefault();
      onClear(selection);
    } else if (event.key === 'Enter' && selectedBlock) {
      event.preventDefault();
      startEdit(selectedBlock);
    } else if (event.key === 'Escape') {
      onSelect(undefined);
    }
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, box: ImageBox) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = { slot: box.slot, startX: event.clientX, startWidth: box.width };
    onSelect(box.slot === 'logo' ? 'logo' : 'textArt');
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const state = resize.current;
    if (!state) return;
    const width = Math.round(Math.max(32, Math.min(240, state.startWidth + (event.clientX - state.startX) / zoom)));
    onImageWidth(state.slot, width);
  }

  const width = paperWidth[device];
  const dark = mode === 'dark';

  return (
    <div
      className="flex-1 overflow-auto p-6 sm:p-10 outline-none"
      tabIndex={-1}
      onKeyDown={keyDown}
      onClick={() => { onSelect(undefined); setEditing(undefined); }}
      onDragOver={dragOver}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDrag();
      }}
      onDrop={drop}
    >
      <div className="mx-auto" style={{ width: width * zoom, height: paperHeight * zoom || undefined }}>
        <div
          ref={paper}
          className={`relative origin-top-left overflow-hidden rounded-2xl shadow-2xl ring-1 transition-colors ${dark ? 'bg-[#1C1C1E] ring-black/40' : 'bg-white ring-black/5'} ${fileOver ? 'ring-4 ring-[#0071E3]' : ''}`}
          style={{ width, transform: `scale(${zoom})` }}
        >
          {/* Simulated mail window so the signature is judged in context */}
          <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${dark ? 'border-white/10 bg-[#2C2C2E]' : 'border-gray-100 bg-[#F5F5F7]'}`}>
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            <span className={`ml-2 text-xs font-semibold ${dark ? 'text-gray-300' : 'text-gray-500'}`}>Neue E-Mail</span>
          </div>
          <div className={`space-y-1 border-b px-6 py-3 text-xs ${dark ? 'border-white/10 text-gray-400' : 'border-gray-100 text-gray-400'}`}>
            <div><span className="inline-block w-14 font-medium">An:</span>kontakt@beispiel.de</div>
            <div><span className="inline-block w-14 font-medium">Betreff:</span>Ihre Anfrage</div>
          </div>
          <div className="space-y-2 px-6 pt-5" aria-hidden="true">
            <div className={`h-2.5 w-11/12 rounded-full ${dark ? 'bg-white/10' : 'bg-gray-100'}`} />
            <div className={`h-2.5 w-4/5 rounded-full ${dark ? 'bg-white/10' : 'bg-gray-100'}`} />
            <div className={`h-2.5 w-2/3 rounded-full ${dark ? 'bg-white/10' : 'bg-gray-100'}`} />
          </div>

          <div className="px-6 pb-8 pt-6">
            {editMode ? (
              <div className="relative" aria-label="Signatur bearbeiten" role="list">
                {blocks.map((block, index) => {
                  const active = selectedBlock === block.key;
                  const style = inlineTexts.includes(block.key)
                    ? signatureTextStyle(project, block.key as InlineText) : undefined;
                  const isEditing = editing === block.key;
                  return (
                    <div
                      key={block.key}
                      role="listitem"
                      ref={element => {
                        if (element) blockRefs.current.set(block.key, element);
                        else blockRefs.current.delete(block.key);
                      }}
                      draggable={!isEditing}
                      onDragStart={event => {
                        if (resize.current) return event.preventDefault();
                        dragged.current = block.key;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(BLOCK_MIME, block.key);
                        event.dataTransfer.setData('text/plain', signatureBlocks[block.key]);
                      }}
                      onDragEnd={clearDrag}
                      onClick={event => {
                        event.stopPropagation();
                        event.preventDefault();
                        const image = event.target instanceof Element ? event.target.closest('img[data-signature-image]') : null;
                        onSelect(image?.getAttribute('data-signature-image') === 'logo' ? 'logo' : block.key);
                      }}
                      onDoubleClick={event => {
                        event.stopPropagation();
                        startEdit(block.key);
                      }}
                      className={`group relative -mx-3 cursor-grab rounded-lg px-3 py-1 transition active:cursor-grabbing ${active ? 'bg-[#0071E3]/[0.04] ring-2 ring-[#0071E3]' : 'hover:ring-1 hover:ring-[#0071E3]/40'} ${dragged.current === block.key ? 'opacity-40' : ''}`}
                    >
                      {dropIndex === index && <span className="pointer-events-none absolute -top-1 left-0 right-0 h-1 rounded-full bg-[#0071E3]" />}
                      {index === blocks.length - 1 && dropIndex === blocks.length && (
                        <span className="pointer-events-none absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-[#0071E3]" />
                      )}
                      <span className={`pointer-events-none absolute -top-2.5 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${active ? 'bg-[#0071E3] text-white' : 'bg-white text-[#0071E3] opacity-0 shadow-sm ring-1 ring-[#0071E3]/30 group-hover:opacity-100'}`}>
                        {selection === 'logo' && active ? 'Logo / Foto' : signatureBlocks[block.key]}
                      </span>
                      {isEditing && style ? (
                        <textarea
                          autoFocus
                          className="block w-full resize-y rounded-md border border-[#0071E3] bg-white px-2 py-1 outline-none"
                          style={{
                            fontFamily: signatureFonts[style.font], fontSize: style.size, color: style.color,
                            fontWeight: style.bold ? 'bold' : 'normal', fontStyle: style.italic ? 'italic' : 'normal', lineHeight: 1.45,
                          }}
                          rows={Math.max(2, project[block.key as InlineText].split('\n').length)}
                          maxLength={12_000}
                          value={project[block.key as InlineText]}
                          onClick={event => event.stopPropagation()}
                          onChange={event => onChangeText(block.key as InlineText, event.currentTarget.value)}
                          onBlur={() => setEditing(undefined)}
                          onKeyDown={event => {
                            if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
                              event.preventDefault();
                              setEditing(undefined);
                            }
                          }}
                        />
                      ) : block.html ? (
                        <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: `<div style="${block.style}">${block.html}</div>` }} />
                      ) : (
                        <div className="py-3 text-sm italic text-gray-400">
                          {block.key === 'identity' ? 'Name und Kontaktdaten links unter „Angaben“ eintragen' : 'Leerer Baustein'}
                        </div>
                      )}

                      {active && !isEditing && (
                        <div
                          className="absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-0.5 shadow-lg"
                          onClick={event => event.stopPropagation()}
                        >
                          <span className="cursor-grab p-1 text-gray-400" title="Ziehen zum Verschieben"><GripVertical size={14} /></span>
                          <button type="button" className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30" disabled={index === 0}
                            title="Nach oben (Alt + ↑)" aria-label="Nach oben" onClick={() => move(-1)}><ArrowUp size={14} /></button>
                          <button type="button" className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30" disabled={index === blocks.length - 1}
                            title="Nach unten (Alt + ↓)" aria-label="Nach unten" onClick={() => move(1)}><ArrowDown size={14} /></button>
                          {selection === 'logo' ? (
                            <button type="button" className="rounded-lg p-1 text-gray-600 hover:bg-gray-100" title="Grafik ersetzen"
                              aria-label="Grafik ersetzen" onClick={onReplaceImage}><ImagePlus size={14} /></button>
                          ) : block.key !== 'textArt' && (
                            <button type="button" className="rounded-lg p-1 text-gray-600 hover:bg-gray-100" title="Text bearbeiten (Doppelklick)"
                              aria-label="Text bearbeiten" onClick={() => startEdit(block.key)}><Pencil size={14} /></button>
                          )}
                          {selection !== 'identity' && (
                            <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
                              title={selection === 'logo' ? 'Grafik entfernen' : 'Baustein entfernen (Entf)'} aria-label="Entfernen"
                              onClick={() => onClear(selection ?? block.key)}><Trash2 size={14} /></button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                ref={previewRef}
                className={`break-words ${dark ? '[&_td]:!text-slate-100 [&_strong]:!text-blue-300 [&_a]:!text-blue-300' : ''}`}
                onClick={event => {
                  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
                }}
              >
                {mode === 'plain'
                  ? <div className={`whitespace-pre-wrap font-mono text-sm ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{plain}</div>
                  : <div dangerouslySetInnerHTML={{ __html: previewHtml }} />}
              </div>
            )}
          </div>

          {/* Resize handles for logo and TextArt */}
          {editMode && imageBoxes.map(box => {
            const active = box.slot === 'logo' ? selection === 'logo' : selection === 'textArt';
            return (
              <div key={box.slot} className="pointer-events-none absolute"
                style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
                {active && <div className="absolute inset-0 rounded-sm outline outline-2 outline-offset-2 outline-[#0071E3]" />}
                <button
                  type="button"
                  className={`pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-[#0071E3] shadow-md transition ${active ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus:opacity-100'}`}
                  title="Ziehen, um die Breite zu ändern"
                  aria-label={box.slot === 'logo' ? 'Breite der Grafik ändern' : 'Breite der TextArt ändern'}
                  onClick={event => event.stopPropagation()}
                  onPointerDown={event => startResize(event, box)}
                  onPointerMove={moveResize}
                  onPointerUp={() => { resize.current = undefined; }}
                  onPointerCancel={() => { resize.current = undefined; }}
                  onKeyDown={event => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    event.stopPropagation();
                    const step = event.shiftKey ? 10 : 2;
                    onImageWidth(box.slot, Math.round(Math.max(32, Math.min(240, box.width + (event.key === 'ArrowRight' ? step : -step)))));
                  }}
                />
                {active && (
                  <span className="pointer-events-none absolute -bottom-7 right-0 whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {Math.round(box.width)} px
                  </span>
                )}
              </div>
            );
          })}

          {fileOver && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0071E3]/10 text-sm font-semibold text-[#0071E3]">
              Bild als Logo/Foto ablegen – oder Signaturprojekt öffnen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
