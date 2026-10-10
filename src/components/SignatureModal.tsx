import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check, Upload, Trash2, PenTool } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSignature: (dataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onConfirmSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [activeTab, setActiveTab] = useState<'draw' | 'upload' | 'saved'>('draw');
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [saveForLater, setSaveForLater] = useState(true);

  // Load saved signatures from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pdf_tool_saved_signatures');
    if (saved) {
      try {
        setSavedSignatures(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Setup canvas size when opened
  useEffect(() => {
    if (!isOpen || activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina / High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Pointer drawing handlers (supports Mouse, Touch, Apple Pencil)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Crop canvas to signature bounds with transparent background
  const getCroppedDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return null;

    const pad = 10;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad);
    maxY = Math.min(height, maxY + pad);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;

    cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return cropCanvas.toDataURL('image/png');
  };

  const handleApplySignature = (dataUrlToUse?: string) => {
    let finalUrl = dataUrlToUse;
    if (!finalUrl && activeTab === 'draw') {
      finalUrl = getCroppedDataUrl() || undefined;
    }

    if (!finalUrl) return;

    if (saveForLater && !savedSignatures.includes(finalUrl)) {
      const updated = [finalUrl, ...savedSignatures.slice(0, 4)];
      setSavedSignatures(updated);
      localStorage.setItem('pdf_tool_saved_signatures', JSON.stringify(updated));
    }

    onConfirmSignature(finalUrl);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        handleApplySignature(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSaved = (index: number) => {
    const updated = savedSignatures.filter((_, i) => i !== index);
    setSavedSignatures(updated);
    localStorage.setItem('pdf_tool_saved_signatures', JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <PenTool size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1D1D1F]">Unterschrift erstellen</h2>
              <p className="text-xs text-[#86868B]">Zeichne mit Maus, Trackpad oder Apple Pencil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#E8E8ED] bg-[#F5F5F7] px-4 pt-2">
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${
              activeTab === 'draw'
                ? 'bg-white text-[#0071E3] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Zeichnen
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${
              activeTab === 'upload'
                ? 'bg-white text-[#0071E3] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Bild hochladen
          </button>
          {savedSignatures.length > 0 && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${
                activeTab === 'saved'
                  ? 'bg-white text-[#0071E3] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Gespeichert ({savedSignatures.length})
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'draw' && (
            <div>
              {/* Color & Size Controls */}
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#86868B]">Farbe:</span>
                  <button
                    onClick={() => setStrokeColor('#000000')}
                    className={`w-6 h-6 rounded-full bg-black border-2 transition ${
                      strokeColor === '#000000' ? 'border-[#0071E3] scale-110' : 'border-transparent'
                    }`}
                    title="Schwarz"
                  />
                  <button
                    onClick={() => setStrokeColor('#0B2545')}
                    className={`w-6 h-6 rounded-full bg-[#0B2545] border-2 transition ${
                      strokeColor === '#0B2545' ? 'border-[#0071E3] scale-110' : 'border-transparent'
                    }`}
                    title="Dunkelblau"
                  />
                  <button
                    onClick={() => setStrokeColor('#0071E3')}
                    className={`w-6 h-6 rounded-full bg-[#0071E3] border-2 transition ${
                      strokeColor === '#0071E3' ? 'border-[#0071E3] scale-110' : 'border-transparent'
                    }`}
                    title="Königsblau"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#86868B]">Strichstärke:</span>
                  <input
                    type="range"
                    min="1.5"
                    max="6"
                    step="0.5"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(parseFloat(e.target.value))}
                    className="w-20 accent-[#0071E3]"
                  />
                </div>
              </div>

              {/* Drawing Surface */}
              <div className="relative border-2 border-dashed border-[#D2D2D7] rounded-xl bg-white overflow-hidden shadow-inner h-48 touch-none">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm select-none">
                    Hier mit Stift, Finger oder Maus unterschreiben...
                  </div>
                )}
                {/* Horizontal Baseline Guideline */}
                <div className="absolute bottom-10 left-6 right-6 border-b border-gray-200 pointer-events-none" />
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={handleClear}
                  disabled={!hasDrawn}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-600 transition disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                  Zurücksetzen
                </button>

                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveForLater}
                    onChange={(e) => setSaveForLater(e.target.checked)}
                    className="rounded text-[#0071E3] focus:ring-[#0071E3]"
                  />
                  Für nächste Nutzung merken
                </label>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm font-medium text-gray-700">Bild deiner Unterschrift hochladen</p>
              <p className="text-xs text-gray-500 mb-4">PNG oder JPG (transparentes PNG empfohlen)</p>
              <label className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm transition">
                Datei auswählen
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">Klicke auf eine Unterschrift, um sie zu verwenden:</p>
              <div className="grid grid-cols-2 gap-3">
                {savedSignatures.map((sig, idx) => (
                  <div
                    key={idx}
                    className="relative group border border-gray-200 rounded-xl p-3 bg-white hover:border-[#0071E3] hover:shadow-md transition cursor-pointer flex flex-col items-center justify-center min-h-[90px]"
                    onClick={() => handleApplySignature(sig)}
                  >
                    <img src={sig} alt={`Signatur ${idx + 1}`} className="max-h-14 object-contain" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSaved(idx);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      title="Löschen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F5F5F7] border-t border-[#E8E8ED]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            Abbrechen
          </button>
          {activeTab === 'draw' && (
            <button
              onClick={() => handleApplySignature()}
              disabled={!hasDrawn}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              Unterschrift einfügen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
