import { alignAxis, alignmentTargets } from '../lib/alignment';
import { AlignmentGuides, type GuidePosition } from './AlignmentGuides';
import { asDesign, drawDesign, gradients, occasions, type Motif, type PageDesign, type PageBackground } from '../lib/pageDesign';
import React, { useState, useEffect, useRef } from 'react';
import { X, Palette, Check, RotateCcw } from 'lucide-react';

const motifNames = new Map(Object.values(occasions).flat());

export interface PageBackgroundModalProps {
  guidesEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  numPages: number;
  aspect: number;
  currentColor: PageBackground;
  onApplyBackground: (color: PageBackground, scope: 'currentPage' | 'allPages') => void;
  onResetBackground: (scope: 'currentPage' | 'allPages') => void;
}

const PRESET_COLORS = [
  { name: 'Nachtschwarz (Titelblatt)', hex: '#10191B' },
  { name: 'Anthrazit (Kopfband)', hex: '#18262A' },
  { name: 'Papiercreme (Innenseiten)', hex: '#F4F3EF' },
  { name: 'Klassisch Weiß', hex: '#FFFFFF' },
  { name: 'Sanftes Hellblau', hex: '#F0F4F8' },
  { name: 'Pastell-Mint', hex: '#F0FDF4' },
  { name: 'Warmes Sandgelb', hex: '#FEF9C3' },
  { name: 'Dunkles Schieferblau', hex: '#1E293B' },
];

export const PageBackgroundModal: React.FC<PageBackgroundModalProps> = ({
  guidesEnabled, isOpen,
  onClose,
  currentPage,
  numPages,
  aspect, currentColor,
  onApplyBackground,
  onResetBackground,
}) => {
  const [design, setDesign] = useState(() => asDesign(currentColor));
  const [scope, setScope] = useState<'currentPage' | 'allPages'>('currentPage');
  const [occasion, setOccasion] = useState('Weihnachten');
  const [selected, setSelected] = useState(-1);
  const preview = useRef<HTMLCanvasElement>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<GuidePosition>({});
  const change = (patch: Partial<PageDesign>) => setDesign(prev => ({ ...prev, ...patch }));

  const motif = design.motifs[selected];
  const updateMotif = (patch: Partial<Motif>) =>
    change({ motifs: design.motifs.map((item, index) => index === selected ? { ...item, ...patch } : item) });

  useEffect(() => {
    if (isOpen) {
      setDesign(asDesign(currentColor));
      setSelected(-1);
      setScope('currentPage');
    }
  }, [isOpen, currentColor]);
  useEffect(() => {
    const canvas = preview.current;
    if (!isOpen || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    drawDesign(ctx, design, canvas.width, canvas.height);
    if (motif && !design.locked) {
      const size = motif.size * Math.min(canvas.width, canvas.height);
      const x = motif.x * canvas.width - size / 2;
      const y = motif.y * canvas.height - size / 2;
      const pixel = canvas.width / (canvas.clientWidth || canvas.width);
      ctx.save();
      ctx.lineWidth = 2 * pixel;
      ctx.strokeStyle = '#1d4ed8';
      ctx.strokeRect(x, y, size, size);
      ctx.setLineDash([4 * pixel, 4 * pixel]);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x, y, size, size);
      ctx.restore();
    }
  }, [design, motif, isOpen, aspect]);

  if (!isOpen) return null;
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  const handleApply = () => {
    const simple = !design.locked && !design.gradient && !design.motifs.length && design.opacity === 100;
    onApplyBackground(simple ? design.start : design, scope);
    onClose();
  };

  const handleReset = () => {
    onResetBackground(scope);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-700 flex items-center justify-center shadow-sm">
              <Palette size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">Seitenhintergrund</h2>
              <p className="text-xs text-[#86868B]">
                Farben und Motive für eine oder mehrere Seiten gestalten
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid sm:grid-cols-[2fr_3fr] gap-5 items-start text-xs">
            <div className="sm:sticky sm:top-0 space-y-2">
              <h3 className="font-bold">Vorschau · Seite {currentPage}</h3>
              <div className="relative w-fit max-w-full mx-auto">
              <canvas ref={preview} width={Math.round(600 * Math.min(1, aspect))}
                height={Math.round(600 / Math.max(1, aspect))}
                className="block max-w-full max-h-64 sm:max-h-none mx-auto border rounded shadow-sm touch-none"
                aria-label="Hintergrundvorschau"
                onPointerDown={e => {
                  if (design.locked) return;
                  const pos = point(e);
                  const index = design.motifs.map(m =>
                    Math.abs(m.x-pos.x) < m.size * Math.min(1, 1/aspect) / 2 &&
                    Math.abs(m.y-pos.y) < m.size * Math.min(1, aspect) / 2).lastIndexOf(true);
                  setSelected(index);
                  const motif = design.motifs[index];
                  dragOffset.current = motif ? { x: pos.x - motif.x, y: pos.y - motif.y } : null;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={e => {
                  if (!dragOffset.current || design.locked || !design.motifs[selected]) return;
                  const pos = point(e);
                  const bounds = e.currentTarget.getBoundingClientRect();
                  const boxes = design.motifs.map(m => {
                    const width = m.size * Math.min(1, 1 / aspect);
                    const height = m.size * Math.min(1, aspect);
                    return { x: m.x - width/2, y: m.y - height/2, width, height };
                  });
                  const box = boxes[selected];
                  const targets = guidesEnabled && !e.altKey ? alignmentTargets(boxes.filter((_,i) => i !== selected)) : { x: [], y: [] };
                  const snap = (center: number, offset: number, size: number, anchors: number[], pixels: number) =>
                    alignAxis(center - offset - size/2, size, anchors, pixels, -size/2, 1-size/2);
                  const x = snap(pos.x, dragOffset.current.x, box.width, targets.x, bounds.width);
                  const y = snap(pos.y, dragOffset.current.y, box.height, targets.y, bounds.height);
                  setGuides({ x: x.guide, y: y.guide });
                  change({ motifs: design.motifs.map((m,i) => i === selected
                    ? { ...m, x: x.position + box.width/2, y: y.position + box.height/2 } : m) });
                }}
                onLostPointerCapture={() => { dragOffset.current = null; setGuides({}); }}
              />
              {guidesEnabled && <AlignmentGuides {...guides} />}
              </div>
              <label className="flex gap-2 items-center font-semibold"><input type="checkbox" checked={design.locked}
                onChange={e => change({ locked: e.target.checked })} />Hintergrund sperren</label>
            </div>
            <fieldset disabled={design.locked} className="space-y-4 disabled:opacity-50">
              <div><h3 className="font-bold mb-2">Einfarbig</h3>
                <div className="flex flex-wrap gap-1">{PRESET_COLORS.map(preset =>
                  <button key={preset.hex} title={preset.name} aria-label={preset.name}
                    style={{ backgroundColor: preset.hex }} className="h-7 w-7 rounded-full border"
                    onClick={() => change({ start: preset.hex, gradient: false })} />)}</div>
              </div>
              <div><h3 className="font-bold mb-2">Farbverläufe</h3>
                <div className="grid grid-cols-2 gap-1">{gradients.map(([name,start,end]) =>
                  <button key={name} className="border rounded p-1 text-left" onClick={() => change({ start, end, gradient: true })}>
                    <span className="block h-3 rounded mb-1" style={{ background: `linear-gradient(120deg,${start},${end})` }} />{name}
                  </button>)}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <label>Grundfarbe <input type="color" value={design.start} onChange={e => change({ start: e.target.value })}/></label>
                {design.gradient && <label>Endfarbe <input type="color" value={design.end} onChange={e => change({ end: e.target.value })}/></label>}
              </div>
              {(['opacity', 'intensity'] as const).filter(key => key === 'opacity' || design.gradient).map(key =>
                <label key={key} className="block">{key === 'opacity' ? 'Deckkraft' : 'Verlaufsintensität'} · {design[key]} %
                  <input className="block w-full" type="range" min="0" max="100" value={design[key]}
                    onChange={e => change({ [key]: Number(e.target.value) })} />
                </label>)}
              <label className="block font-bold">Motive für
                <select className="ml-2 border rounded p-1" value={occasion} onChange={e => setOccasion(e.target.value)}>
                  {Object.keys(occasions).map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-1">{occasions[occasion].map(([symbol, label]) =>
                <button key={symbol} className="rounded border px-2 py-1" onClick={() => {
                  const offset = (design.motifs.length % 5) * .14;
                  change({ motifs: [...design.motifs, { symbol, x: .18 + offset, y: .18, size: .18 }] });
                  setSelected(design.motifs.length);
                }}>{symbol === label ? '🔴' : symbol} {label}</button>)}</div>
              {design.motifs.length > 0 && <p>Motiv in der Vorschau auswählen und verschieben.</p>}
              {design.motifs.length > 0 && <label className="block">Motiv bearbeiten
                <select className="ml-2 border rounded p-1" value={selected} onChange={e => setSelected(Number(e.target.value))}>
                  <option value={-1}>Motiv wählen</option>
                  {design.motifs.map((item, i) => <option key={i} value={i}>
                    {i + 1}. {motifNames.get(item.symbol) ?? item.symbol}
                  </option>)}
                </select>
              </label>}
              {motif && <div className="space-y-3 rounded-lg border p-3">
                <label className="block">Darstellung
                  <select className="ml-2 border rounded p-1" value={motif.style ?? 'original'}
                    onChange={e => updateMotif({ style: e.target.value as Motif['style'] })}>
                    <option value="original">Originalfarben</option><option value="silhouette">Silhouette</option>
                  </select>
                </label>
                {motif.style === 'silhouette' && <label className="block">Motivfarbe <input type="color"
                  value={motif.color ?? design.start} onChange={e => updateMotif({ color: e.target.value })}/></label>}
                <label className="block">Motivdeckkraft · {motif.opacity ?? 100} %
                  <input className="block w-full" type="range" min="0" max="100" value={motif.opacity ?? 100}
                    onChange={e => updateMotif({ opacity: Number(e.target.value) })}/>
                </label>
                <label className="block">Motivgröße <input className="block w-full" type="range" min="4" max="65"
                  value={Math.round(motif.size * 100)} onChange={e => updateMotif({ size: Number(e.target.value)/100 })}/></label>
                <button className="block underline" onClick={() => {
                  change({ motifs: design.motifs.filter((_,i) => i !== selected) }); setSelected(-1);
                }}>Motiv entfernen</button>
              </div>}
            </fieldset>
          </div>

          {/* Scope Selection */}
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
            <label className="block text-xs font-bold text-gray-700">Anwenden auf:</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  scope === 'currentPage'
                    ? 'border-[#0071E3] bg-white text-[#0071E3] shadow-sm'
                    : 'border-transparent text-gray-600 hover:bg-white/80'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="currentPage"
                  checked={scope === 'currentPage'}
                  onChange={() => setScope('currentPage')}
                  className="hidden"
                />
                <span className="w-2 h-2 rounded-full border border-current flex items-center justify-center shrink-0">
                  {scope === 'currentPage' && <span className="w-1 h-1 rounded-full bg-current" />}
                </span>
                <span>Nur Seite {currentPage}</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  scope === 'allPages'
                    ? 'border-[#0071E3] bg-white text-[#0071E3] shadow-sm'
                    : 'border-transparent text-gray-600 hover:bg-white/80'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="allPages"
                  checked={scope === 'allPages'}
                  onChange={() => setScope('allPages')}
                  className="hidden"
                />
                <span className="w-2 h-2 rounded-full border border-current flex items-center justify-center shrink-0">
                  {scope === 'allPages' && <span className="w-1 h-1 rounded-full bg-current" />}
                </span>
                <span>Alle Seiten ({numPages}, gesperrte überspringen)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E8ED] bg-[#F5F5F7] flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={design.locked}
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
            title="Hintergrund entfernen und auf Standard-Weiß zurücksetzen"
          >
            <RotateCcw size={14} />
            <span>Zurücksetzen</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              <Check size={14} />
              <span>Hintergrund anwenden</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
