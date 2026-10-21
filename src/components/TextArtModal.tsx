import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Type,
  Image as ImageIcon,
  Palette,
  Check,
  Upload,
  Layers,
  CircleDot,
  RotateCcw,
} from 'lucide-react';
import { TextArtAnnotation } from '../types/pdf';
import {
  TEXTART_PRESETS,
  GRADIENT_DEFS,
  getFontFamilyCss,
  buildTextArtSvgMarkup,
} from '../lib/textArtHelper';

interface TextArtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: Omit<TextArtAnnotation, 'id' | 'pageNumber' | 'x' | 'y'>) => void;
  initialData?: TextArtAnnotation | null;
}

export const TextArtModal: React.FC<TextArtModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  initialData,
}) => {
  const [text, setText] = useState<string>(initialData?.text || 'NOTIONARY ATLAS');
  const [fontFamily, setFontFamily] = useState<string>(initialData?.fontFamily || 'Impact');
  const [curveType, setCurveType] = useState<TextArtAnnotation['curveType']>(
    initialData?.curveType || 'arc-up'
  );
  const [bend, setBend] = useState<number>(initialData?.bend ?? 40);
  const [fillMode, setFillMode] = useState<TextArtAnnotation['fillMode']>(
    initialData?.fillMode || 'gradient'
  );
  const [color, setColor] = useState<string>(initialData?.color || '#0071E3');
  const [gradientPreset, setGradientPreset] = useState<
    'gold' | 'sunset' | 'neon' | 'rainbow' | 'silver' | 'ocean'
  >(initialData?.gradientPreset || 'gold');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(
    initialData?.imageDataUrl
  );
  const [strokeWidth, setStrokeWidth] = useState<number>(initialData?.strokeWidth ?? 1);
  const [strokeColor, setStrokeColor] = useState<string>(
    initialData?.strokeColor || '#000000'
  );
  const [has3dShadow, setHas3dShadow] = useState<boolean>(
    initialData?.has3dShadow ?? true
  );
  const [shadowColor, setShadowColor] = useState<string>(
    initialData?.shadowColor || '#1D1D1F'
  );
  const [previewBgDark, setPreviewBgDark] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Apply a preset
  const handleApplyPreset = (presetId: string) => {
    const preset = TEXTART_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const d = preset.data;
    if (d.fontFamily) setFontFamily(d.fontFamily);
    if (d.curveType) setCurveType(d.curveType);
    if (d.bend !== undefined) setBend(d.bend);
    if (d.fillMode) setFillMode(d.fillMode);
    if (d.color) setColor(d.color);
    if (d.gradientPreset) setGradientPreset(d.gradientPreset);
    if (d.strokeWidth !== undefined) setStrokeWidth(d.strokeWidth);
    if (d.strokeColor) setStrokeColor(d.strokeColor);
    if (d.has3dShadow !== undefined) setHas3dShadow(d.has3dShadow);
    if (d.shadowColor) setShadowColor(d.shadowColor);

    if (preset.id === 'photo-mask' && !imageDataUrl) {
      // Trigger file picker for photo mask
      fileInputRef.current?.click();
    }
  };

  // Image upload handler for photo mask
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setImageDataUrl(dataUrl);
        setFillMode('image');
      }
    };
    reader.readAsDataURL(file);
  };

  // Current preview dummy annotation
  const currentPreviewArt: TextArtAnnotation = {
    id: 'preview',
    type: 'textart',
    pageNumber: 1,
    x: 0,
    y: 0,
    width: 0.6,
    height: 0.22,
    text: text.trim() || 'TextArt',
    fontFamily,
    curveType,
    bend,
    fillMode,
    color,
    gradientPreset,
    imageDataUrl,
    strokeWidth,
    strokeColor,
    has3dShadow,
    shadowColor,
  };

  const previewSvg = buildTextArtSvgMarkup(currentPreviewArt, 600, 240, 'modal_preview');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInsert({
      type: 'textart',
      width: curveType === 'circle' ? 0.45 : 0.65,
      height: curveType === 'circle' ? 0.35 : 0.22,
      text: text.trim() || 'TextArt',
      fontFamily,
      curveType,
      bend,
      fillMode,
      color,
      gradientPreset,
      imageDataUrl,
      strokeWidth,
      strokeColor,
      has3dShadow,
      shadowColor,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles size={22} className="text-yellow-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">TextArt & WordArt Studio</h2>
              <p className="text-xs text-white/80">
                Gebogene Schriftzüge, 3D-WordArt, Farbverläufe & Foto-im-Text
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Live Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>Live-Vorschau</span>
              <button
                type="button"
                onClick={() => setPreviewBgDark(!previewBgDark)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Hintergrund: {previewBgDark ? 'Dunkel (Schwarz)' : 'Hell (Weiß)'}
              </button>
            </div>
            <div
              className={`w-full h-48 rounded-2xl flex items-center justify-center border transition p-4 ${
                previewBgDark
                  ? 'bg-[#1D1D1F] border-gray-800 shadow-inner'
                  : 'bg-white border-gray-200 shadow-inner'
              }`}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Dein Text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Text eingeben..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-semibold text-base"
              maxLength={60}
            />
          </div>

          {/* 1-Click Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">WordArt Vorlagen (1-Klick)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEXTART_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.id)}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition text-left group bg-gray-50/60 hover:bg-white"
                >
                  <div
                    className="w-full h-7 rounded-lg mb-1.5 shadow-sm flex items-center justify-center text-xs font-bold text-white tracking-wide"
                    style={{ background: p.previewGradient }}
                  >
                    ABC
                  </div>
                  <span className="text-xs font-bold text-gray-900 group-hover:text-[#0071E3] truncate w-full">
                    {p.name}
                  </span>
                  <span className="text-[10px] text-gray-500 line-clamp-1">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-gray-100">
            {/* Left Column: Form & Biegung */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Biegung & Form</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'arc-up', label: 'Bogen oben' },
                    { id: 'arc-down', label: 'Bogen unten' },
                    { id: 'wave', label: 'Welle' },
                    { id: 'circle', label: 'Kreis / Siegel' },
                    { id: 'flat', label: 'Flach (Gerade)' },
                  ].map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCurveType(ct.id as any)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition ${
                        curveType === ct.id
                          ? 'bg-[#0071E3] text-white border-[#0071E3] shadow'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {curveType !== 'flat' && (
                <div className="space-y-1.5 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700">Biegestärke</span>
                    <span className="font-bold text-[#0071E3]">{bend} %</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={bend}
                    onChange={(e) => setBend(Number(e.target.value))}
                    className="w-full accent-[#0071E3]"
                  />
                </div>
              )}

              {/* Schriftart */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Schriftart</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0071E3] bg-white text-xs font-medium"
                >
                  <optgroup label="Plakat & Fett (Ideal für Masken & 3D)">
                    <option value="Impact">Impact (Ultra Bold)</option>
                    <option value="Arial Black">Arial Black (Massiv)</option>
                    <option value="Montserrat">Montserrat (Modern Fett)</option>
                  </optgroup>
                  <optgroup label="Schreibschrift & Handschrift">
                    <option value="Dancing Script">Dancing Script (Schwungvoll)</option>
                    <option value="Caveat">Caveat (Handgeschrieben)</option>
                  </optgroup>
                  <optgroup label="Design & Luxus">
                    <option value="Playfair Display">Playfair Display (Klassische Serife)</option>
                    <option value="Cinzel">Cinzel (Römisch / Monumental)</option>
                  </optgroup>
                  <optgroup label="Standard">
                    <option value="Helvetica">Helvetica / Standard Sans</option>
                    <option value="Times">Times New Roman</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Right Column: Füllung & Effekte */}
            <div className="space-y-4">
              {/* Füllmodus Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Buchstaben-Füllung</label>
                <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setFillMode('gradient')}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      fillMode === 'gradient' ? 'bg-white shadow text-gray-900 font-bold' : 'text-gray-600'
                    }`}
                  >
                    Farbverlauf
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillMode('color')}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      fillMode === 'color' ? 'bg-white shadow text-gray-900 font-bold' : 'text-gray-600'
                    }`}
                  >
                    Farbe
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillMode('image')}
                    className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                      fillMode === 'image' ? 'bg-white shadow text-gray-900 font-bold' : 'text-gray-600'
                    }`}
                  >
                    <ImageIcon size={13} />
                    <span>Foto-Maske</span>
                  </button>
                </div>
              </div>

              {/* Füllmodus Details */}
              {fillMode === 'gradient' && (
                <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <span className="text-xs text-gray-600 font-medium">Verlauf wählen:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'gold', name: 'Gold' },
                      { id: 'sunset', name: 'Sunset' },
                      { id: 'neon', name: 'Cyber Neon' },
                      { id: 'rainbow', name: 'Regenbogen' },
                      { id: 'silver', name: 'Silber' },
                      { id: 'ocean', name: 'Ozean' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGradientPreset(g.id as any)}
                        className={`p-2 rounded-xl text-xs font-bold text-center border transition ${
                          gradientPreset === g.id
                            ? 'ring-2 ring-blue-500 border-transparent shadow'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${GRADIENT_DEFS[g.id].join(', ')})`,
                          color: g.id === 'silver' ? '#1D1D1F' : '#FFFFFF',
                          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        }}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {fillMode === 'color' && (
                <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <span className="text-xs text-gray-600 font-medium">Farbe wählen:</span>
                  <div className="flex items-center gap-2">
                    {['#000000', '#FFFFFF', '#0071E3', '#107C41', '#E02020', '#F59E0B', '#8B5CF6'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-full border border-gray-300 shadow-sm transition ${
                          color === c ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110'
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer border-0 p-0"
                      title="Eigene Farbe"
                    />
                  </div>
                </div>
              )}

              {fillMode === 'image' && (
                <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">Foto für Buchstaben-Maske</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#0071E3] font-semibold hover:underline flex items-center gap-1"
                    >
                      <Upload size={12} />
                      <span>{imageDataUrl ? 'Foto ändern' : 'Foto hochladen'}</span>
                    </button>
                  </div>

                  {imageDataUrl ? (
                    <div className="relative w-full h-16 rounded-xl overflow-hidden border border-gray-300 group">
                      <img src={imageDataUrl} alt="Maske" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-medium">
                        Klicken zum Ändern
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-[#0071E3] transition"
                    >
                      <Upload size={20} />
                      <span className="text-xs font-semibold">Foto auswählen (JPG / PNG)</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* Kontur & 3D Schatten */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Kontur / Umriss</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 4].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => setStrokeWidth(sw)}
                        className={`px-2 py-0.5 rounded text-xs transition ${
                          strokeWidth === sw
                            ? 'bg-[#0071E3] text-white font-bold'
                            : 'bg-white border text-gray-700'
                        }`}
                      >
                        {sw === 0 ? 'Ohne' : `${sw}px`}
                      </button>
                    ))}
                    {strokeWidth > 0 && (
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 ml-1"
                        title="Konturfarbe"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={has3dShadow}
                      onChange={(e) => setHas3dShadow(e.target.checked)}
                      className="rounded text-[#0071E3] focus:ring-[#0071E3]"
                    />
                    <span>3D-Extrusions-Schatten</span>
                  </label>
                  {has3dShadow && (
                    <input
                      type="color"
                      value={shadowColor}
                      onChange={(e) => setShadowColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0"
                      title="Schattenfarbe"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-semibold transition"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-[#0071E3] hover:bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition"
          >
            <Sparkles size={16} />
            <span>{initialData ? 'Änderungen übernehmen' : 'TextArt einfügen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
