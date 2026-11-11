import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ArrowDown, ArrowUp, Bold, GripVertical, Italic } from 'lucide-react';
import { signatureBlocks, signatureFonts, signatureTextStyle } from '../lib/mailSignatures';
import type {
  renderSignature, SignatureBlock, SignatureFont, SignatureProject, SignatureTextStyle, SignatureTextTarget,
} from '../lib/mailSignatures';

type RenderedBlock = ReturnType<typeof renderSignature>['blocks'][number];
type DropTarget = { key: SignatureBlock; after: boolean };
type EditableText = 'name' | 'greeting' | 'note' | 'legal';
const fontSizes = Array.from({ length: 28 }, (_, index) => index + 9);

interface SignatureLayoutEditorProps {
  project: SignatureProject;
  blocks: RenderedBlock[];
  narrow: boolean;
  onMove: (source: SignatureBlock, target: SignatureBlock, after: boolean) => void;
  onChangeStyle: (target: SignatureTextTarget, style: Partial<SignatureTextStyle> | null) => void;
  onChangeArtworkWidth: (width: number) => void;
  onChangeText: (field: EditableText, value: string) => void;
}

const controlClass = 'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm';
const iconButtonClass = 'rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-400 hover:text-blue-700 disabled:opacity-30';
const toggleClass = iconButtonClass + ' aria-pressed:border-blue-400 aria-pressed:bg-blue-50 aria-pressed:text-blue-700';

export function SignatureLayoutEditor({
  project, blocks, narrow, onMove, onChangeStyle, onChangeArtworkWidth, onChangeText,
}: SignatureLayoutEditorProps) {
  const [selection, setSelection] = useState<SignatureBlock>('identity');
  const [identityTarget, setIdentityTarget] = useState<'identity' | 'name'>('name');
  const [dropTarget, setDropTarget] = useState<DropTarget>();
  const dragged = useRef<SignatureBlock>();
  const selected = blocks.find(block => block.key === selection)?.key ?? blocks[0]?.key;
  const selectedIndex = blocks.findIndex(block => block.key === selected);
  const target = selected === 'identity' ? identityTarget : selected;
  const style = target && target !== 'textArt' ? signatureTextStyle(project, target) : undefined;
  const editableText = target === 'identity' || target === 'textArt' ? undefined : target;

  function dragOver(event: DragEvent<HTMLLIElement>, key: SignatureBlock) {
    if (!dragged.current || dragged.current === key) {
      if (dropTarget) setDropTarget(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > bounds.top + bounds.height / 2;
    if (dropTarget?.key !== key || dropTarget.after !== after) setDropTarget({ key, after });
  }

  function endDrag() {
    dragged.current = undefined;
    setDropTarget(undefined);
  }

  function drop(event: DragEvent<HTMLLIElement>, key: SignatureBlock) {
    const source = dragged.current;
    if (source && source !== key) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      onMove(source, key, event.clientY > bounds.top + bounds.height / 2);
    }
    endDrag();
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-600">Ziehe einen Block am Griff oder verschiebe ihn mit den Pfeilen.</p>
      <ol className={`space-y-1 ${narrow ? 'max-w-[320px]' : ''}`} aria-label="Signaturblöcke">
        {blocks.map(block => {
          const highlighted = selected === block.key;
          const insertion = dropTarget?.key === block.key ? dropTarget : undefined;
          return (
            <li key={block.key} data-signature-block={block.key}
              className={`flex min-w-0 gap-2 rounded-lg border bg-white p-2 ${highlighted ? 'border-blue-400' : 'border-slate-200'} ${insertion ? (insertion.after ? 'border-b-2 border-b-blue-600' : 'border-t-2 border-t-blue-600') : ''}`}
              onDragOver={event => dragOver(event, block.key)}
              onDrop={event => drop(event, block.key)}>
              <button type="button" draggable className={`self-start cursor-grab active:cursor-grabbing ${iconButtonClass}`}
                aria-label={`${signatureBlocks[block.key]} auswählen oder ziehen`} aria-pressed={highlighted}
                onClick={() => setSelection(block.key)}
                onDragStart={event => {
                  dragged.current = block.key;
                  setSelection(block.key);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', block.key);
                }}
                onDragEnd={endDrag}>
                <GripVertical size={16} aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1" onClick={event => {
                if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
                setSelection(block.key);
              }}>
                <div className="text-xs font-medium text-slate-500">{signatureBlocks[block.key]}</div>
                {block.html && <div className="overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: `<div style="${block.style}">${block.html}</div>` }} />}
              </div>
            </li>
          );
        })}
      </ol>
      {selected && (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{signatureBlocks[selected]}</span>
            <div className="flex gap-1">
              <button type="button" className={iconButtonClass} disabled={selectedIndex <= 0}
                aria-label={`${signatureBlocks[selected]} nach oben`}
                onClick={() => onMove(selected, blocks[selectedIndex - 1].key, false)}><ArrowUp size={16} /></button>
              <button type="button" className={iconButtonClass} disabled={selectedIndex >= blocks.length - 1}
                aria-label={`${signatureBlocks[selected]} nach unten`}
                onClick={() => onMove(selected, blocks[selectedIndex + 1].key, true)}><ArrowDown size={16} /></button>
            </div>
          </div>
          {selected === 'textArt' && project.textArt && (
            <label className="block text-sm">
              TextArt-Breite ({project.textArt.width} px)
              <input className="block w-full" type="range" min="32" max="240" value={project.textArt.width}
                onChange={event => onChangeArtworkWidth(Number(event.currentTarget.value))} />
            </label>
          )}
          {style && target && target !== 'textArt' && (
            <div className="flex flex-wrap items-end gap-2">
              {selected === 'identity' && (
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Textbereich
                  <select className={controlClass} value={identityTarget}
                    onChange={event => setIdentityTarget(event.currentTarget.value as 'identity' | 'name')}>
                    <option value="name">Name</option>
                    <option value="identity">Kontaktdaten</option>
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium">
                Schriftart
                <select className={controlClass} value={style.font}
                  onChange={event => onChangeStyle(target, { font: event.currentTarget.value as SignatureFont })}>
                  {Object.keys(signatureFonts).map(font => <option key={font}>{font}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Größe (px)
                <select className={controlClass} value={style.size}
                  onChange={event => onChangeStyle(target, { size: Number(event.currentTarget.value) })}>
                  {fontSizes.map(size => <option key={size}>{size}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Schriftfarbe
                <input type="color" className="h-8 w-12 rounded-md border border-slate-300 bg-white p-0.5" value={style.color}
                  onChange={event => onChangeStyle(target, { color: event.currentTarget.value })} />
              </label>
              <button type="button" className={toggleClass} aria-label="Fett" aria-pressed={style.bold}
                onClick={() => onChangeStyle(target, { bold: !style.bold })}><Bold size={17} /></button>
              <button type="button" className={toggleClass} aria-label="Kursiv" aria-pressed={style.italic}
                onClick={() => onChangeStyle(target, { italic: !style.italic })}><Italic size={17} /></button>
              {project.textStyles?.[target] && (
                <button type="button" className="text-xs text-blue-700 underline" onClick={() => onChangeStyle(target, null)}>
                  Formatierung zurücksetzen
                </button>
              )}
            </div>
          )}
          {editableText && (
            <label className="flex flex-col gap-1 text-xs font-medium">
              Blocktext
              <textarea className={controlClass} rows={2} maxLength={12_000} value={project[editableText]}
                onChange={event => onChangeText(editableText, event.currentTarget.value)} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
