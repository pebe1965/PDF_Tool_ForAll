import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Check, Lock, Loader2, CheckSquare, Type } from 'lucide-react';
import { PdfFormFieldItem } from '../types/pdf';
import { fillAndSavePdfForm } from '../lib/pdfEngine';

interface FormFillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: ArrayBuffer | null;
  initialFields: PdfFormFieldItem[];
  onApplyFormChanges: (updatedPdfBytes: Uint8Array) => void;
}

export const FormFillerModal: React.FC<FormFillerModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  initialFields,
  onApplyFormChanges,
}) => {
  const [fields, setFields] = useState<PdfFormFieldItem[]>([]);
  const [flatten, setFlatten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFields(initialFields.map((f) => ({ ...f })));
    }
  }, [isOpen, initialFields]);

  if (!isOpen) return null;

  const handleFieldChange = (name: string, newValue: string | boolean) => {
    setFields((prev) =>
      prev.map((f) => (f.name === name ? { ...f, value: newValue } : f))
    );
  };

  const handleSave = async () => {
    if (!pdfBytes) return;
    setSaving(true);
    try {
      const updated = await fillAndSavePdfForm(pdfBytes, fields, flatten);
      onApplyFormChanges(updated);
      onClose();
    } catch (err) {
      console.error('Fehler beim Speichern der Formularfelder:', err);
      alert('Formularfelder konnten nicht übernommen werden.');
    } finally {
      setSaving(false);
    }
  };

  const filteredFields = fields.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-[#0071E3] flex items-center justify-center">
              <ClipboardList size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">
                PDF-Formularfelder ausfüllen ({fields.length})
              </h2>
              <p className="text-xs text-[#86868B]">
                Erkannte interaktive AcroForm-Felder direkt bearbeiten & optional schreibschützen
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

        {/* Search & Info */}
        {fields.length > 6 && (
          <div className="px-6 pt-3 pb-2 border-b border-gray-100">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Formularfeld suchen..."
              className="w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:border-[#0071E3] focus:bg-white"
            />
          </div>
        )}

        {/* Fields List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {filteredFields.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              Keine passenden Formularfelder gefunden.
            </div>
          ) : (
            filteredFields.map((field) => (
              <div
                key={field.name}
                className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 sm:w-5/12">
                  {field.type === 'checkbox' ? (
                    <CheckSquare size={14} className="text-[#0071E3] shrink-0" />
                  ) : (
                    <Type size={14} className="text-gray-400 shrink-0" />
                  )}
                  <span
                    className="text-xs font-semibold text-gray-800 truncate"
                    title={field.name}
                  >
                    {field.name}
                  </span>
                </div>

                <div className="sm:w-7/12 flex items-center justify-end">
                  {field.type === 'checkbox' ? (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                        className="w-4 h-4 rounded text-[#0071E3]"
                      />
                      <span className="text-xs font-medium text-gray-700">
                        {field.value ? 'Angekreuzt (Ja)' : 'Nicht angekreuzt'}
                      </span>
                    </label>
                  ) : field.options && field.options.length > 0 ? (
                    <select
                      value={String(field.value || '')}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                    >
                      <option value="">-- Bitte wählen --</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(field.value || '')}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder="Wert eingeben..."
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Flatten Option & Actions */}
        <div className="px-6 py-4 bg-[#F5F5F7] border-t border-[#E8E8ED] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flatten}
              onChange={(e) => setFlatten(e.target.checked)}
              className="rounded text-[#0071E3]"
            />
            <Lock size={13} className="text-amber-600" />
            <span>
              <strong>Formular glätten (Flatten)</strong> – Eingaben schreibgeschützt ins PDF einbrennen
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>In PDF übernehmen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
