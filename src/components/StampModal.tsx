import React, { useState, useEffect, useRef } from 'react';
import { X, Stamp, Check, Plus, Trash2, Calendar, User } from 'lucide-react';

interface StampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStamp: (dataUrl: string, aspectRatio: number, label: string) => void;
}

interface StampPreset {
  text: string;
  subtext?: string;
  color: string;
}

const PRESET_STAMPS: StampPreset[] = [
  { text: 'FREIGEGEBEN', color: '#059669' },
  { text: 'BEZAHLT', color: '#059669' },
  { text: 'GEPRÜFT', color: '#0071E3' },
  { text: 'EINGEGANGEN', color: '#0071E3' },
  { text: 'VERTRAULICH', color: '#DC2626' },
  { text: 'ABGELEHNT', color: '#DC2626' },
  { text: 'ENTWURF', color: '#D97706' },
  { text: 'KOPIE', color: '#475569' },
];

const STAMP_COLORS = [
  { label: 'Grün', hex: '#059669' },
  { label: 'Blau', hex: '#0071E3' },
  { label: 'Rot', hex: '#DC2626' },
  { label: 'Orange', hex: '#D97706' },
  { label: 'Anthrazit', hex: '#334155' },
];

export const StampModal: React.FC<StampModalProps> = ({
  isOpen,
  onClose,
  onConfirmStamp,
}) => {
  const [mainText, setMainText] = useState('FREIGEGEBEN');
  const [color, setColor] = useState('#059669');
  const [includeDate, setIncludeDate] = useState(true);
  const [customDate, setCustomDate] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });
  const [authorText, setAuthorText] = useState(() => {
    return localStorage.getItem('pdf_tool_stamp_author') || '';
  });
  const [borderStyle, setBorderStyle] = useState<'double' | 'rounded' | 'solid'>('double');
  const [savedCustomStamps, setSavedCustomStamps] = useState<StampPreset[]>(() => {
    try {
      const raw = localStorage.getItem('pdf_tool_custom_stamps');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('pdf_tool_stamp_author', authorText);
    } catch (_) {}
  }, [authorText]);

  const renderStampToCanvas = (canvas: HTMLCanvasElement): { aspectRatio: number } => {
    const ctx = canvas.getContext('2d')!;
    const title = (mainText || 'STEMPEL').toUpperCase().trim();
    const subParts: string[] = [];
    if (includeDate && customDate.trim()) subParts.push(customDate.trim());
    if (authorText.trim()) subParts.push(authorText.trim());
    const subLine = subParts.join(' • ');

    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const titleMetrics = ctx.measureText(title);

    ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const subMetrics = subLine ? ctx.measureText(subLine) : { width: 0 };

    const contentW = Math.max(titleMetrics.width, subMetrics.width, 180);
    const padX = 44;
    const padY = subLine ? 28 : 24;
    const width = Math.ceil(contentW + padX * 2);
    const height = subLine ? 132 : 96;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Subtle light tint inside the stamp
    ctx.save();
    ctx.globalAlpha = 0.08;
    roundRect(ctx, 8, 8, width - 16, height - 16, 16);
    ctx.fill();
    ctx.restore();

    // Outer frame
    ctx.lineWidth = 6;
    roundRect(ctx, 6, 6, width - 12, height - 12, 16);
    ctx.stroke();

    if (borderStyle === 'double') {
      ctx.lineWidth = 2.5;
      roundRect(ctx, 14, 14, width - 28, height - 28, 10);
      ctx.stroke();
    }

    // Main stamp title
    ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const titleY = subLine ? height * 0.41 : height * 0.52;
    ctx.fillText(title, width / 2, titleY);

    // Optional divider + subline (date & author/company)
    if (subLine) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, height * 0.64);
      ctx.lineTo(width - 28, height * 0.64);
      ctx.stroke();

      ctx.font = '700 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      ctx.fillText(subLine, width / 2, height * 0.8);
    }

    return { aspectRatio: width / height };
  };

  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;
    renderStampToCanvas(previewCanvasRef.current);
  }, [isOpen, mainText, color, includeDate, customDate, authorText, borderStyle]);

  if (!isOpen) return null;

  const handleSaveCustomPreset = () => {
    if (!mainText.trim()) return;
    const next: StampPreset = {
      text: mainText.trim().toUpperCase(),
      subtext: authorText.trim() || undefined,
      color,
    };
    const updated = [next, ...savedCustomStamps.filter((s) => s.text !== next.text)].slice(0, 8);
    setSavedCustomStamps(updated);
    try {
      localStorage.setItem('pdf_tool_custom_stamps', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleDeleteCustomPreset = (idx: number) => {
    const updated = savedCustomStamps.filter((_, i) => i !== idx);
    setSavedCustomStamps(updated);
    try {
      localStorage.setItem('pdf_tool_custom_stamps', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleApply = () => {
    const canvas = document.createElement('canvas');
    const { aspectRatio } = renderStampToCanvas(canvas);
    const dataUrl = canvas.toDataURL('image/png');
    onConfirmStamp(dataUrl, aspectRatio, mainText.trim() || 'Stempel');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
              <Stamp size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">Firmen- & Büro-Stempel</h2>
              <p className="text-xs text-[#86868B]">Stempel mit Datum & Namenskürzel auf Seite platzieren</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Standard-Vorlagen
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_STAMPS.map((preset) => (
                <button
                  key={preset.text}
                  onClick={() => {
                    setMainText(preset.text);
                    setColor(preset.color);
                  }}
                  style={{
                    borderColor: mainText === preset.text ? preset.color : '#E5E7EB',
                    color: preset.color,
                  }}
                  className={`px-2.5 py-2 rounded-xl border-2 text-xs font-extrabold tracking-wide transition hover:scale-[1.02] ${
                    mainText === preset.text ? 'bg-gray-50 shadow-sm' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Custom Company Stamps */}
          {savedCustomStamps.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Gespeicherte Firmen-Stempel
              </label>
              <div className="flex flex-wrap gap-2">
                {savedCustomStamps.map((st, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold"
                    style={{ color: st.color }}
                  >
                    <button
                      onClick={() => {
                        setMainText(st.text);
                        setColor(st.color);
                        if (st.subtext) setAuthorText(st.subtext);
                      }}
                    >
                      {st.text}
                    </button>
                    <button
                      onClick={() => handleDeleteCustomPreset(idx)}
                      className="text-gray-400 hover:text-red-600 ml-1"
                      title="Vorlage löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Text & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Stempel-Haupttext
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={mainText}
                  onChange={(e) => setMainText(e.target.value)}
                  placeholder="z.B. FREIGEGEBEN"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm font-bold uppercase focus:outline-none focus:border-[#0071E3]"
                />
                <button
                  onClick={handleSaveCustomPreset}
                  className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
                  title="Als eigene Vorlage merken"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Stempelfarbe & Rahmen
              </label>
              <div className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2">
                  {STAMP_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                      className={`w-6 h-6 rounded-full transition ${
                        color === c.hex ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="double">Doppelrahmen</option>
                  <option value="rounded">Einfach</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date & Author / Company Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F5F5F7] p-3.5 rounded-2xl border border-gray-200/80">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDate}
                  onChange={(e) => setIncludeDate(e.target.checked)}
                  className="rounded text-[#0071E3]"
                />
                <Calendar size={13} className="text-gray-500" />
                <span>Datum einblenden</span>
              </label>
              <input
                type="text"
                value={customDate}
                disabled={!includeDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white disabled:opacity-50 text-xs font-medium"
                placeholder="TT.MM.JJJJ"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                <User size={13} className="text-gray-500" />
                <span>Firma / Name / Kürzel (optional)</span>
              </label>
              <input
                type="text"
                value={authorText}
                onChange={(e) => setAuthorText(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                placeholder="z.B. Buchhaltung • PB"
              />
            </div>
          </div>

          {/* Live Canvas Preview */}
          <div className="flex flex-col items-center justify-center p-5 bg-gray-50 border border-dashed border-gray-300 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Live-Vorschau
            </span>
            <canvas
              ref={previewCanvasRef}
              className="max-w-full h-20 object-contain drop-shadow-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F5F7] border-t border-[#E8E8ED] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
          >
            Abbrechen
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            <Check size={15} />
            <span>Stempel auf Seite einfügen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
