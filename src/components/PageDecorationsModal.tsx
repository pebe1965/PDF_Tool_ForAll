import React, { useState } from 'react';
import { X, Hash, ShieldAlert, Check, Loader2, AlignLeft } from 'lucide-react';
import { PageDecorationsConfig } from '../types/pdf';
import { applyPageDecorationsToPdf } from '../lib/pdfEngine';

interface PageDecorationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: ArrayBuffer | null;
  numPages: number;
  onApplyDecorations: (updatedBytes: Uint8Array) => void;
}

export const PageDecorationsModal: React.FC<PageDecorationsModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  numPages,
  onApplyDecorations,
}) => {
  const [config, setConfig] = useState<PageDecorationsConfig>({
    enablePageNumbers: true,
    pageNumberFormat: 'page_x_of_y',
    batesPrefix: 'DOK-',
    batesStartNumber: 1,
    pageNumberPosition: 'bottom-right',
    headerLeft: '',
    headerCenter: '',
    headerRight: '',
    footerLeft: '',
    enableWatermark: false,
    watermarkText: 'VERTRAULICH',
    watermarkColor: '#DC2626',
    watermarkOpacity: 0.14,
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (!pdfBytes) return;
    setSaving(true);
    try {
      const updated = await applyPageDecorationsToPdf(pdfBytes, config);
      onApplyDecorations(updated);
      onClose();
    } catch (err) {
      console.error('Fehler beim Anwenden der Seiten-Dekorationen:', err);
      alert('Konnte Seitenzahlen / Wasserzeichen nicht anwenden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
              <Hash size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">
                Seitenzahlen, Kopf-/Fußzeile & Wasserzeichen
              </h2>
              <p className="text-xs text-[#86868B]">
                Automatisch auf allen {numPages} Seiten des Dokuments einfügen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. Page Numbers & Bates */}
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enablePageNumbers}
                onChange={(e) => setConfig({ ...config, enablePageNumbers: e.target.checked })}
                className="rounded text-[#0071E3] w-4 h-4"
              />
              <Hash size={14} className="text-[#0071E3]" />
              <span>Seitennummerierung / Bates-Nummerierung aktivieren</span>
            </label>

            {config.enablePageNumbers && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Format
                  </label>
                  <select
                    value={config.pageNumberFormat}
                    onChange={(e) =>
                      setConfig({ ...config, pageNumberFormat: e.target.value as any })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                  >
                    <option value="page_x_of_y">Seite 1 von {numPages}</option>
                    <option value="x_slash_y">1 / {numPages}</option>
                    <option value="only_x">Nur Seitenzahl (1, 2, 3...)</option>
                    <option value="bates">Bates-Nummerierung (DOK-000001)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Position
                  </label>
                  <select
                    value={config.pageNumberPosition}
                    onChange={(e) =>
                      setConfig({ ...config, pageNumberPosition: e.target.value as any })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-medium"
                  >
                    <option value="bottom-right">Unten rechts</option>
                    <option value="bottom-center">Unten zentriert</option>
                    <option value="bottom-left">Unten links</option>
                    <option value="top-right">Oben rechts</option>
                  </select>
                </div>

                {config.pageNumberFormat === 'bates' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Bates-Präfix
                      </label>
                      <input
                        type="text"
                        value={config.batesPrefix || ''}
                        onChange={(e) => setConfig({ ...config, batesPrefix: e.target.value })}
                        placeholder="z.B. AKTE-2026-"
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Startnummer
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={config.batesStartNumber || 1}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            batesStartNumber: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. Header & Footer */}
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <AlignLeft size={14} className="text-indigo-600" />
              <span>Kopf- & Fußzeile (optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Kopfzeile links</label>
                <input
                  type="text"
                  value={config.headerLeft || ''}
                  onChange={(e) => setConfig({ ...config, headerLeft: e.target.value })}
                  placeholder="z.B. Firmenname"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Kopfzeile Mitte</label>
                <input
                  type="text"
                  value={config.headerCenter || ''}
                  onChange={(e) => setConfig({ ...config, headerCenter: e.target.value })}
                  placeholder="z.B. Aktenzeichen"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Kopfzeile rechts</label>
                <input
                  type="text"
                  value={config.headerRight || ''}
                  onChange={(e) => setConfig({ ...config, headerRight: e.target.value })}
                  placeholder="z.B. Datum"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Fußzeile links</label>
              <input
                type="text"
                value={config.footerLeft || ''}
                onChange={(e) => setConfig({ ...config, footerLeft: e.target.value })}
                placeholder="z.B. Vertrauliche Unterlage – Nur für den internen Gebrauch"
                className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
              />
            </div>
          </div>

          {/* 3. Diagonal Watermark */}
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableWatermark}
                onChange={(e) => setConfig({ ...config, enableWatermark: e.target.checked })}
                className="rounded text-[#0071E3] w-4 h-4"
              />
              <ShieldAlert size={14} className="text-red-600" />
              <span>Diagonales Wasserzeichen über alle Seiten legen</span>
            </label>

            {config.enableWatermark && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {['VERTRAULICH', 'ENTWURF', 'KOPIE', 'MUSTER', 'INTERN', 'ORIGINAL'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setConfig({ ...config, watermarkText: preset })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        config.watermarkText === preset
                          ? 'bg-red-50 border-red-400 text-red-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Wasserzeichen-Text
                    </label>
                    <input
                      type="text"
                      value={config.watermarkText}
                      onChange={(e) => setConfig({ ...config, watermarkText: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Farbe & Deckkraft ({Math.round(config.watermarkOpacity * 100)}%)
                    </label>
                    <div className="flex items-center gap-2">
                      {['#DC2626', '#0071E3', '#475569', '#D97706'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setConfig({ ...config, watermarkColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full ${
                            config.watermarkColor === c ? 'ring-2 ring-offset-1 ring-gray-800' : ''
                          }`}
                        />
                      ))}
                      <input
                        type="range"
                        min={0.06}
                        max={0.4}
                        step={0.02}
                        value={config.watermarkOpacity}
                        onChange={(e) =>
                          setConfig({ ...config, watermarkOpacity: parseFloat(e.target.value) })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>Auf alle Seiten anwenden</span>
          </button>
        </div>
      </div>
    </div>
  );
};
