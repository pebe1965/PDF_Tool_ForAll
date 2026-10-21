import React, { useState, useEffect } from 'react';
import { X, Palette, Check, RotateCcw } from 'lucide-react';

export interface PageBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  numPages: number;
  currentColor: string;
  onApplyBackground: (color: string, scope: 'currentPage' | 'allPages') => void;
  onResetBackground: (scope: 'currentPage' | 'allPages') => void;
}

const PRESET_COLORS = [
  { name: 'Nachtschwarz (Titelblatt)', hex: '#10191B', textColor: '#FFFFFF', accentColor: '#2BB3A3' },
  { name: 'Anthrazit (Kopfband)', hex: '#18262A', textColor: '#FFFFFF', accentColor: '#F0A33A' },
  { name: 'Papiercreme (Innenseiten)', hex: '#F4F3EF', textColor: '#1C2326', accentColor: '#F0A33A' },
  { name: 'Klassisch Weiß', hex: '#FFFFFF', textColor: '#1D1D1F', accentColor: '#0071E3' },
  { name: 'Sanftes Hellblau', hex: '#F0F4F8', textColor: '#1E293B', accentColor: '#0284C7' },
  { name: 'Pastell-Mint', hex: '#F0FDF4', textColor: '#14532D', accentColor: '#16A34A' },
  { name: 'Warmes Sandgelb', hex: '#FEF9C3', textColor: '#713F12', accentColor: '#CA8A04' },
  { name: 'Dunkles Schieferblau', hex: '#1E293B', textColor: '#F8FAFC', accentColor: '#38BDF8' },
];

export const PageBackgroundModal: React.FC<PageBackgroundModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  numPages,
  currentColor,
  onApplyBackground,
  onResetBackground,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>(currentColor || '#FFFFFF');
  const [scope, setScope] = useState<'currentPage' | 'allPages'>('currentPage');

  useEffect(() => {
    if (isOpen) {
      setSelectedColor(currentColor || '#FFFFFF');
    }
  }, [isOpen, currentColor]);

  if (!isOpen) return null;

  const currentPreset = PRESET_COLORS.find(
    (p) => p.hex.toLowerCase() === selectedColor.toLowerCase()
  );
  const previewTextColor = currentPreset ? currentPreset.textColor : '#1D1D1F';
  const previewAccentColor = currentPreset ? currentPreset.accentColor : '#0071E3';

  const handleApply = () => {
    onApplyBackground(selectedColor, scope);
    onClose();
  };

  const handleReset = () => {
    onResetBackground(scope);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-700 flex items-center justify-center shadow-sm">
              <Palette size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">Seitenhintergrund</h2>
              <p className="text-xs text-[#86868B]">
                Farbe für Deckblatt oder gesamtes Dokument wählen
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
          {/* Live Preview Box */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Vorschau:</label>
            <div
              className="w-full h-32 rounded-2xl border border-gray-300 shadow-inner flex flex-col justify-between p-4 transition-colors relative overflow-hidden"
              style={{ backgroundColor: selectedColor }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow"
                    style={{ backgroundColor: previewAccentColor }}
                  >
                    PDF
                  </div>
                  <span
                    className="text-xs font-bold tracking-tight"
                    style={{ color: previewTextColor }}
                  >
                    Muster-Dokument
                  </span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold"
                  style={{
                    backgroundColor: previewAccentColor + '25',
                    color: previewAccentColor,
                  }}
                >
                  {selectedColor.toUpperCase()}
                </span>
              </div>

              <div>
                <div
                  className="w-8 h-1 rounded mb-2"
                  style={{ backgroundColor: previewAccentColor }}
                />
                <p
                  className="text-xs font-semibold leading-tight line-clamp-2"
                  style={{ color: previewTextColor }}
                >
                  Professionelle Seiten mit dunklem oder hellem Hintergrund
                </p>
                <p
                  className="text-[10px] opacity-70 mt-1"
                  style={{ color: previewTextColor }}
                >
                  Alle Texte, Logos und Bilder werden über diesem Hintergrund platziert.
                </p>
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Empfohlene Vorlagenfarben:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_COLORS.map((preset) => {
                const isSelected = selectedColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setSelectedColor(preset.hex)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#0071E3] bg-blue-50/60 ring-2 ring-[#0071E3]/20 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-lg border border-black/15 shadow-sm shrink-0 flex items-center justify-center text-white"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check size={12} className={preset.hex === '#FFFFFF' ? 'text-black' : 'text-white'} />}
                    </span>
                    <span className="text-xs font-medium text-gray-800 truncate">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Input */}
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-gray-700">Freie Farbe wählen:</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white"
              />
              <input
                type="text"
                value={selectedColor.toUpperCase()}
                onChange={(e) => {
                  let val = e.target.value;
                  if (!val.startsWith('#')) val = '#' + val;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setSelectedColor(val);
                  }
                }}
                maxLength={7}
                className="w-20 font-mono text-xs font-semibold px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-center uppercase focus:outline-none focus:border-[#0071E3]"
              />
            </div>
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
                <span>Nur Seite {currentPage} (Deckblatt)</span>
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
                <span>Alle {numPages} Seiten</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E8ED] bg-[#F5F5F7] flex items-center justify-between gap-3">
          <button
            type="button"
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
