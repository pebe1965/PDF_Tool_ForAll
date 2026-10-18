import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Minimize2,
  FileSpreadsheet,
  GitCompare,
  Image as ImageIcon,
  ShieldCheck,
  Upload,
  Download,
  Edit3,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import {
  splitPdfByRanges,
  splitPdfEveryNPages,
  compressPdfBuffer,
  exportPdfPagesAsImages,
  getPdfMetadata,
  updatePdfMetadata,
  extractEInvoiceFromPdfBytes,
  parseEInvoiceXmlString,
  EInvoiceParsedData,
  downloadPdf,
} from '../lib/pdfEngine';
import {
  extractTextFromPdf,
  comparePdfDocumentsWithAi,
  downloadCsvForExcel,
} from '../lib/geminiService';
import { hasKiZugang } from '../config';
import { PdfDocumentMetadata } from '../types/pdf';

interface PdfToolsViewProps {
  sharedPdfBytes: ArrayBuffer | null;
  sharedFileName: string;
  onSyncToEditor: (bytes: ArrayBuffer, fileName: string) => void;
  onGoHome?: () => void;
}

type ToolSection = 'split' | 'compress' | 'einvoice' | 'compare' | 'images_meta';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const PdfToolsView: React.FC<PdfToolsViewProps> = ({
  sharedPdfBytes,
  sharedFileName,
  onSyncToEditor,
  onGoHome,
}) => {
  const [activeTool, setActiveTool] = useState<ToolSection>('split');
  const [localPdfBytes, setLocalPdfBytes] = useState<ArrayBuffer | null>(null);
  const [localFileName, setLocalFileName] = useState<string>('');

  // Effective working PDF (either uploaded here or shared from Editor)
  const workingBytes = localPdfBytes || sharedPdfBytes;
  const workingName = localFileName || sharedFileName || 'Dokument.pdf';

  // 1. Split states
  const [splitMode, setSplitMode] = useState<'ranges' | 'every_n'>('ranges');
  const [rangeInput, setRangeInput] = useState('1-2, 3-4');
  const [everyN, setEveryN] = useState(1);
  const [splitResults, setSplitResults] = useState<
    { fileName: string; pageSummary: string; bytes: Uint8Array }[]
  >([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  // 2. Compress states
  const [compressLevel, setCompressLevel] = useState<'compact' | 'balanced' | 'high'>('balanced');
  const [compressLoading, setCompressLoading] = useState(false);
  const [compressProgress, setCompressProgress] = useState<{ cur: number; total: number } | null>(
    null
  );
  const [compressedResult, setCompressedResult] = useState<{
    bytes: Uint8Array;
    originalSize: number;
    newSize: number;
  } | null>(null);

  // 3. E-Rechnung (ZUGFeRD / XRechnung) states
  const [eInvoiceData, setEInvoiceData] = useState<EInvoiceParsedData | null>(null);

  // 4. Document Compare (PDF Diff) states
  const [docABytes, setDocABytes] = useState<ArrayBuffer | null>(null);
  const [docAName, setDocAName] = useState<string>('');
  const [docBBytes, setDocBBytes] = useState<ArrayBuffer | null>(null);
  const [docBName, setDocBName] = useState<string>('');
  const [diffLines, setDiffLines] = useState<
    { type: 'same' | 'added' | 'removed'; text: string }[]
  >([]);
  const [aiCompareResult, setAiCompareResult] = useState<string>('');
  const [comparing, setComparing] = useState(false);
  const [aiComparing, setAiComparing] = useState(false);

  // 5. Images & Metadata states
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [exportedImages, setExportedImages] = useState<
    { pageNumber: number; fileName: string; dataUrl: string }[]
  >([]);
  const [imgExportLoading, setImgExportLoading] = useState(false);
  const [metadata, setMetadata] = useState<PdfDocumentMetadata>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
  });
  const [metaSavedMsg, setMetaSavedMsg] = useState<string | null>(null);

  // Automatically inspect E-Invoice and Metadata when workingBytes changes
  useEffect(() => {
    if (!workingBytes) {
      setEInvoiceData(null);
      return;
    }
    const parsed = extractEInvoiceFromPdfBytes(workingBytes);
    setEInvoiceData(parsed);

    getPdfMetadata(workingBytes)
      .then((m) => setMetadata(m))
      .catch(() => {});
  }, [workingBytes]);

  const handleUploadWorkingPdf = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.xml')) {
      const xmlText = await file.text();
      setEInvoiceData(parseEInvoiceXmlString(xmlText));
      setLocalFileName(file.name);
      setActiveTool('einvoice');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Bitte eine gültige PDF- oder XML-Datei auswählen.');
      return;
    }
    const buf = await file.arrayBuffer();
    setLocalPdfBytes(buf);
    setLocalFileName(file.name);
    setSplitResults([]);
    setCompressedResult(null);
    setExportedImages([]);
  };

  // Run Split
  const handleRunSplit = async () => {
    if (!workingBytes) return;
    setSplitLoading(true);
    setSplitError(null);
    setSplitResults([]);
    try {
      const res =
        splitMode === 'ranges'
          ? await splitPdfByRanges(workingBytes, rangeInput, workingName)
          : await splitPdfEveryNPages(workingBytes, everyN, workingName);
      setSplitResults(res);
    } catch (err: any) {
      setSplitError(err?.message || 'Fehler beim Teilen der PDF.');
    } finally {
      setSplitLoading(false);
    }
  };

  // Run Compress
  const handleRunCompress = async () => {
    if (!workingBytes) return;
    setCompressLoading(true);
    setCompressedResult(null);
    try {
      const compressed = await compressPdfBuffer(workingBytes, compressLevel, (cur, total) => {
        setCompressProgress({ cur, total });
      });
      setCompressedResult({
        bytes: compressed,
        originalSize: workingBytes.byteLength,
        newSize: compressed.byteLength,
      });
    } catch (err) {
      console.error('Fehler beim Komprimieren:', err);
      alert('PDF konnte nicht komprimiert werden.');
    } finally {
      setCompressLoading(false);
      setCompressProgress(null);
    }
  };

  // Run Local Text Diff between Document A and Document B
  const handleRunCompare = async () => {
    const effectiveA = docABytes || workingBytes;
    const effectiveNameA = docAName || workingName;
    if (!effectiveA || !docBBytes) {
      alert('Bitte sowohl Dokument A als auch Dokument B auswählen.');
      return;
    }
    setComparing(true);
    setDiffLines([]);
    setAiCompareResult('');
    try {
      const [resA, resB] = await Promise.all([
        extractTextFromPdf(effectiveA),
        extractTextFromPdf(docBBytes),
      ]);

      const linesA = resA.fullText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const linesB = resB.fullText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const setA = new Set(linesA);
      const setB = new Set(linesB);
      const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

      const maxLen = Math.max(linesA.length, linesB.length);
      const seenRemoved = new Set<string>();
      const seenAdded = new Set<string>();

      for (let i = 0; i < maxLen; i++) {
        const la = linesA[i];
        const lb = linesB[i];
        if (la && !setB.has(la) && !seenRemoved.has(la)) {
          seenRemoved.add(la);
          result.push({ type: 'removed', text: la });
        }
        if (lb && !setA.has(lb) && !seenAdded.has(lb)) {
          seenAdded.add(lb);
          result.push({ type: 'added', text: lb });
        } else if (lb && setA.has(lb) && result.length < 150) {
          result.push({ type: 'same', text: lb });
        }
      }

      if (result.length === 0) {
        result.push({
          type: 'same',
          text: `Beide Dokumente ("${effectiveNameA}" und "${docBName}") haben identischen Textinhalt.`,
        });
      }

      setDiffLines(result);
    } catch (err) {
      console.error('Fehler beim Dokumentenvergleich:', err);
    } finally {
      setComparing(false);
    }
  };

  // Run AI Contract / Offer Comparison
  const handleRunAiCompare = async () => {
    const effectiveA = docABytes || workingBytes;
    const effectiveNameA = docAName || workingName;
    if (!effectiveA || !docBBytes) return;
    setAiComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        extractTextFromPdf(effectiveA),
        extractTextFromPdf(docBBytes),
      ]);
      const summary = await comparePdfDocumentsWithAi(
        resA.fullText,
        effectiveNameA,
        resB.fullText,
        docBName || 'Dokument B'
      );
      setAiCompareResult(summary);
    } catch (err: any) {
      alert(err?.message || 'KI-Vergleich fehlgeschlagen.');
    } finally {
      setAiComparing(false);
    }
  };

  // Run PDF to Images export
  const handleExportImages = async () => {
    if (!workingBytes) return;
    setImgExportLoading(true);
    try {
      const imgs = await exportPdfPagesAsImages(workingBytes, imgFormat, 2.0, workingName);
      setExportedImages(imgs);
    } catch (err) {
      console.error('Fehler beim Bild-Export:', err);
    } finally {
      setImgExportLoading(false);
    }
  };

  // Save or Clear Metadata
  const handleSaveMetadata = async (clearAll: boolean = false) => {
    if (!workingBytes) return;
    const targetMeta: PdfDocumentMetadata = clearAll
      ? { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' }
      : metadata;
    try {
      const updated = await updatePdfMetadata(workingBytes, targetMeta);
      if (clearAll) setMetadata(targetMeta);
      const cleanName = workingName.replace(/\.pdf$/i, '');
      downloadPdf(updated, `${cleanName}_bereinigt.pdf`);
      setMetaSavedMsg(
        clearAll
          ? 'Alle Metadaten wurden gelöscht und das bereinigte PDF heruntergeladen!'
          : 'Aktualisierte Metadaten wurden gespeichert und heruntergeladen!'
      );
      setTimeout(() => setMetaSavedMsg(null), 4000);
    } catch (err) {
      alert('Metadaten konnten nicht aktualisiert werden.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] overflow-hidden bg-[#F5F5F7]">
      {/* Sub-Navigation Bar */}
      <div className="bg-white border-b border-[#E8E8ED] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm z-20">
        <div className="flex flex-wrap items-center gap-1.5">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:text-black bg-[#F5F5F7] hover:bg-gray-200 border border-gray-200 transition cursor-pointer mr-1 shadow-xs"
              title="Zurück zum Hauptmenü / Startseite"
            >
              <ArrowLeft size={14} />
              <span>Startseite</span>
            </button>
          )}
          {[
            { id: 'split', label: 'PDF Teilen & Extrahieren', icon: Scissors },
            { id: 'compress', label: 'Komprimieren (Größe)', icon: Minimize2 },
            { id: 'einvoice', label: 'E-Rechnung (ZUGFeRD/XML)', icon: FileSpreadsheet },
            { id: 'compare', label: 'Vertrags-Vergleich (Diff)', icon: GitCompare },
            { id: 'images_meta', label: 'PDF ➔ Bilder & Datenschutz', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTool(item.id as ToolSection)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-[#0071E3] text-white shadow-sm'
                    : 'bg-[#F5F5F7] text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active File Indicator + Upload Button */}
        <div className="flex items-center gap-2">
          {workingBytes && (
            <div className="text-xs bg-blue-50 text-[#0071E3] px-3 py-1.5 rounded-xl border border-blue-200 font-semibold flex items-center gap-1.5">
              <FileText size={13} />
              <span className="truncate max-w-[180px]">{workingName}</span>
              <span className="text-[10px] text-blue-600/80 font-mono">
                ({formatBytes(workingBytes.byteLength)})
              </span>
            </div>
          )}

          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm">
            <Upload size={13} />
            <span>{workingBytes ? 'Andere Datei wählen' : 'PDF auswählen'}</span>
            <input
              type="file"
              accept="application/pdf,.pdf,.xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleUploadWorkingPdf(e.target.files[0]);
              }}
            />
          </label>
        </div>
      </div>

      {/* Main Tool Workspace */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {!workingBytes && activeTool !== 'compare' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleUploadWorkingPdf(e.dataTransfer.files[0]);
              }}
              onClick={() => document.getElementById('tools-file-input')?.click()}
              className="p-12 bg-white rounded-3xl border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] transition-all flex flex-col items-center justify-center text-center shadow-lg cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-4">
                <Upload size={32} />
              </div>
              <h2 className="text-xl font-bold text-[#1D1D1F] mb-2">
                PDF-Dokument für dieses Werkzeug auswählen
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mb-6">
                Ziehe eine PDF-Datei (oder ZUGFeRD/XRechnung XML) hierhin, um direkt lokal auf deinem Gerät zu starten.
              </p>
              <span className="px-6 py-2.5 bg-[#0071E3] text-white text-xs font-semibold rounded-xl shadow">
                Datei auswählen
              </span>
              <input
                id="tools-file-input"
                type="file"
                accept="application/pdf,.pdf,.xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUploadWorkingPdf(e.target.files[0]);
                }}
              />
            </div>
          ) : (
            <>
              {/* 1. SPLIT & EXTRACT */}
              {activeTool === 'split' && workingBytes && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center">
                      <Scissors size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        PDF Teilen, Seitenbereiche & Stapel-Trennung
                      </h3>
                      <p className="text-xs text-gray-500">
                        Zerlege große Sammel-PDFs nach Seitenbereichen oder automatisch alle N Seiten in Einzel-PDFs
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setSplitMode('ranges')}
                      className={`p-4 rounded-2xl border text-left transition ${
                        splitMode === 'ranges'
                          ? 'border-[#0071E3] bg-blue-50/40'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-gray-900">
                        Nach Seitenbereichen aufteilen
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Z. B. „1-3, 4, 5-Ende“ erzeugt für jeden Bereich ein eigenes PDF
                      </div>
                    </button>

                    <button
                      onClick={() => setSplitMode('every_n')}
                      className={`p-4 rounded-2xl border text-left transition ${
                        splitMode === 'every_n'
                          ? 'border-[#0071E3] bg-blue-50/40'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-gray-900">
                        Stapel-Trennung (alle N Seiten)
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Ideal für Sammel-Scans, Lohnabrechnungen oder Einzelblätter
                      </div>
                    </button>
                  </div>

                  {splitMode === 'ranges' ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Seitenbereiche (kommagetrennt):
                      </label>
                      <input
                        type="text"
                        value={rangeInput}
                        onChange={(e) => setRangeInput(e.target.value)}
                        placeholder="z.B. 1-3, 4-5, 6-Ende"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-mono focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Nach wie vielen Seiten soll jeweils getrennt werden?
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={everyN}
                          onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-28 px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold"
                        />
                        <span className="text-xs text-gray-500">
                          Seite(n) pro Teildokument (1 = jede Seite einzeln)
                        </span>
                      </div>
                    </div>
                  )}

                  {splitError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                      {splitError}
                    </div>
                  )}

                  <button
                    onClick={handleRunSplit}
                    disabled={splitLoading}
                    className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-2"
                  >
                    {splitLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Scissors size={15} />
                    )}
                    <span>PDF jetzt aufteilen</span>
                  </button>

                  {splitResults.length > 0 && (
                    <div className="space-y-2.5 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">
                          Erzeugte Teil-PDFs ({splitResults.length})
                        </span>
                        <button
                          onClick={() => {
                            splitResults.forEach((r, idx) => {
                              setTimeout(() => downloadPdf(r.bytes, r.fileName), idx * 250);
                            });
                          }}
                          className="text-xs font-bold text-[#0071E3] hover:underline flex items-center gap-1"
                        >
                          <Download size={13} />
                          <span>Alle ({splitResults.length}) herunterladen</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {splitResults.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-800 truncate">
                                {item.fileName}
                              </div>
                              <div className="text-[11px] text-gray-500">{item.pageSummary}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() =>
                                  onSyncToEditor(item.bytes.buffer as ArrayBuffer, item.fileName)
                                }
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-[#0071E3] text-gray-700 hover:text-[#0071E3] text-xs"
                                title="Im Editor öffnen"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => downloadPdf(item.bytes, item.fileName)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#0071E3] text-white text-xs font-semibold flex items-center gap-1"
                              >
                                <Download size={12} />
                                <span>Laden</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. COMPRESS PDF */}
              {activeTool === 'compress' && workingBytes && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Minimize2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        PDF-Dateigröße verkleinern (Komprimierung)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Reduziert große Scans für den E-Mail-Versand oder für die NotionaryAtlas-KI-Analyse (unter 2,8 MB)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'compact',
                        title: 'Maximal Kompakt (~110 DPI)',
                        desc: 'Kleinste Dateigröße – ideal für E-Mail & KI-Analyse (< 2,8 MB)',
                      },
                      {
                        id: 'balanced',
                        title: 'Standard Büro (150 DPI)',
                        desc: 'Empfohlene Balance aus guter Lesbarkeit und kleiner Datei',
                      },
                      {
                        id: 'high',
                        title: 'Hohe Qualität (220 DPI)',
                        desc: 'Schärfere Darstellung für den Ausdruck bei moderater Einsparung',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setCompressLevel(opt.id as any)}
                        className={`p-4 rounded-2xl border text-left transition ${
                          compressLevel === opt.id
                            ? 'border-[#0071E3] bg-blue-50/40'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-900">{opt.title}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRunCompress}
                    disabled={compressLoading}
                    className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-2"
                  >
                    {compressLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Minimize2 size={15} />
                    )}
                    <span>
                      {compressLoading && compressProgress
                        ? `Komprimiere Seite ${compressProgress.cur} von ${compressProgress.total}...`
                        : 'PDF jetzt komprimieren'}
                    </span>
                  </button>

                  {compressedResult && (
                    <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                          <CheckCircle2 size={17} className="text-emerald-600" />
                          <span>
                            Größe: {formatBytes(compressedResult.originalSize)} ➔{' '}
                            <strong>{formatBytes(compressedResult.newSize)}</strong>
                          </span>
                        </div>
                        <div className="text-xs text-emerald-800 mt-1">
                          {compressedResult.newSize < compressedResult.originalSize
                            ? `Einsparung: -${Math.round(
                                (1 - compressedResult.newSize / compressedResult.originalSize) * 100
                              )}%`
                            : 'Dokument war bereits stark komprimiert.'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onSyncToEditor(
                              compressedResult.bytes.buffer as ArrayBuffer,
                              workingName.replace(/\.pdf$/i, '') + '_komprimiert.pdf'
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5"
                        >
                          <Edit3 size={14} />
                          <span>Im Editor & KI öffnen</span>
                        </button>
                        <button
                          onClick={() =>
                            downloadPdf(
                              compressedResult.bytes,
                              workingName.replace(/\.pdf$/i, '') + '_komprimiert.pdf'
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                        >
                          <Download size={14} />
                          <span>Herunterladen</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. E-RECHNUNG (ZUGFeRD / XRechnung / Factur-X) */}
              {activeTool === 'einvoice' && workingBytes && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#1D1D1F]">
                          E-Rechnung Prüfer (ZUGFeRD / Factur-X / XRechnung)
                        </h3>
                        <p className="text-xs text-gray-500">
                          Liest eingebettete strukturierte XML-Rechnungsdaten direkt aus B2B-Rechnungs-PDFs oder XML-Dateien aus
                        </p>
                      </div>
                    </div>
                  </div>

                  {eInvoiceData && eInvoiceData.found ? (
                    <div className="space-y-4">
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>Gültige E-Rechnungs-XML erkannt: {eInvoiceData.standard}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {eInvoiceData.rawXml && (
                            <button
                              onClick={() => {
                                const blob = new Blob([eInvoiceData.rawXml!], { type: 'text/xml' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${eInvoiceData.invoiceNumber || 'erechnung'}.xml`;
                                a.click();
                              }}
                              className="px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100"
                            >
                              XML speichern
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const rows = [
                                'Feld;Wert',
                                `Rechnungsnummer;${eInvoiceData.invoiceNumber || ''}`,
                                `Datum;${eInvoiceData.issueDate || ''}`,
                                `Verkäufer;${eInvoiceData.sellerName || ''}`,
                                `USt-IdNr;${eInvoiceData.sellerVatId || ''}`,
                                `Käufer;${eInvoiceData.buyerName || ''}`,
                                `IBAN;${eInvoiceData.iban || ''}`,
                                `Netto;${eInvoiceData.netTotal || ''} ${eInvoiceData.currency || ''}`,
                                `Steuer;${eInvoiceData.taxTotal || ''} ${eInvoiceData.currency || ''}`,
                                `Brutto;${eInvoiceData.grandTotal || ''} ${eInvoiceData.currency || ''}`,
                                '',
                                'Position;Menge;Einzelpreis;Gesamt',
                                ...eInvoiceData.lineItems.map(
                                  (li) => `${li.name};${li.quantity};${li.netPrice};${li.total}`
                                ),
                              ].join('\n');
                              downloadCsvForExcel(
                                rows,
                                `ERechnung_${eInvoiceData.invoiceNumber || 'Export'}.csv`
                              );
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                          >
                            Als Excel/CSV
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <div className="text-[10px] text-gray-500 uppercase">Rechnungs-Nr.</div>
                          <div className="text-xs font-bold text-gray-900 mt-0.5">
                            {eInvoiceData.invoiceNumber || '—'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <div className="text-[10px] text-gray-500 uppercase">Rechnungsdatum</div>
                          <div className="text-xs font-bold text-gray-900 mt-0.5">
                            {eInvoiceData.issueDate || '—'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <div className="text-[10px] text-gray-500 uppercase">Aussteller</div>
                          <div className="text-xs font-bold text-gray-900 mt-0.5 truncate">
                            {eInvoiceData.sellerName || '—'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                          <div className="text-[10px] text-blue-700 uppercase font-bold">
                            Gesamtbetrag (Brutto)
                          </div>
                          <div className="text-sm font-extrabold text-[#0071E3] mt-0.5">
                            {eInvoiceData.grandTotal || '—'} {eInvoiceData.currency}
                          </div>
                        </div>
                      </div>

                      {eInvoiceData.lineItems.length > 0 && (
                        <div className="border border-gray-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                              <tr>
                                <th className="py-2 px-3">Bezeichnung</th>
                                <th className="py-2 px-3">Menge</th>
                                <th className="py-2 px-3">Einzelpreis</th>
                                <th className="py-2 px-3 text-right">Gesamt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {eInvoiceData.lineItems.map((li, i) => (
                                <tr key={i}>
                                  <td className="py-2 px-3 font-medium text-gray-800">{li.name}</td>
                                  <td className="py-2 px-3 text-gray-600">{li.quantity}</td>
                                  <td className="py-2 px-3 text-gray-600">{li.netPrice}</td>
                                  <td className="py-2 px-3 text-right font-semibold text-gray-900">
                                    {li.total}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                      <div className="font-bold flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span>Keine eingebettete ZUGFeRD / XRechnung XML-Struktur in diesem PDF gefunden</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed">
                        Dieses PDF ist eine klassische PDF-Rechnung ohne eingebetteten XML-Datensatz.
                        <strong> Tipp:</strong> Öffne das Dokument im Editor und klicke auf{' '}
                        <strong>Gemini KI → Daten & Excel</strong>, um Rechnungsdaten und Positionen trotzdem per KI für Excel auszulesen!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 4. DOCUMENT DIFF / COMPARE */}
              {activeTool === 'compare' && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <GitCompare size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1D1D1F]">
                        Vertrags- & Dokumentenvergleich (PDF-Diff)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Vergleiche zwei PDF-Versionen (z. B. Angebot v1 vs. v2) auf geänderte Preise, Klauseln und Textstellen
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Document A */}
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-gray-400">
                          Dokument A (Alt / Basis)
                        </div>
                        <div className="text-xs font-bold text-gray-800 mt-1 truncate">
                          {docAName || (workingBytes ? `${workingName} (Aktiv)` : 'Noch nicht gewählt')}
                        </div>
                      </div>
                      <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:border-[#0071E3] rounded-xl text-xs font-semibold cursor-pointer transition">
                        <Upload size={13} />
                        <span>Dokument A wählen</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setDocABytes(await f.arrayBuffer());
                              setDocAName(f.name);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Document B */}
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-gray-400">
                          Dokument B (Neu / Vergleich)
                        </div>
                        <div className="text-xs font-bold text-gray-800 mt-1 truncate">
                          {docBName || 'Bitte Vergleichs-PDF auswählen...'}
                        </div>
                      </div>
                      <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:border-[#0071E3] rounded-xl text-xs font-semibold cursor-pointer transition">
                        <Upload size={13} />
                        <span>Dokument B wählen</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setDocBBytes(await f.arrayBuffer());
                              setDocBName(f.name);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleRunCompare}
                      disabled={comparing || !(docABytes || workingBytes) || !docBBytes}
                      className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2"
                    >
                      {comparing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <GitCompare size={14} />
                      )}
                      <span>Lokalen Text-Vergleich starten</span>
                    </button>

                    <button
                      onClick={handleRunAiCompare}
                      disabled={
                        aiComparing ||
                        !(docABytes || workingBytes) ||
                        !docBBytes ||
                        !hasKiZugang()
                      }
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2"
                    >
                      {aiComparing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <span>KI-Vertrags- & Preisvergleich (Gemini)</span>
                    </button>
                  </div>

                  {aiCompareResult && (
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                      <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-indigo-600" />
                        <span>KI-Zusammenfassung der Vertrags- & Dokumentenänderungen</span>
                      </div>
                      <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed bg-white p-3.5 rounded-xl border border-indigo-100">
                        {aiCompareResult}
                      </div>
                    </div>
                  )}

                  {diffLines.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-700">
                        Zeilen-Abweichungen (Rot = entfernt in B, Grün = neu in B)
                      </div>
                      <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-2xl p-3 bg-gray-50 font-mono text-xs space-y-1">
                        {diffLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={`px-2.5 py-1 rounded ${
                              line.type === 'removed'
                                ? 'bg-red-100 text-red-900 line-through'
                                : line.type === 'added'
                                ? 'bg-emerald-100 text-emerald-950 font-semibold'
                                : 'text-gray-500'
                            }`}
                          >
                            {line.type === 'removed' ? '- ' : line.type === 'added' ? '+ ' : '  '}
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. IMAGES EXPORT & METADATA SANITIZER */}
              {activeTool === 'images_meta' && workingBytes && (
                <div className="space-y-6">
                  {/* Card A: PDF to Images */}
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center">
                          <ImageIcon size={20} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#1D1D1F]">
                            PDF-Seiten als Bilder (PNG / JPEG) exportieren
                          </h3>
                          <p className="text-xs text-gray-500">
                            Wandelt alle Seiten des PDFs in hochauflösende Grafiken für Präsentationen oder E-Mails um
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={imgFormat}
                          onChange={(e) => setImgFormat(e.target.value as any)}
                          className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold bg-white"
                        >
                          <option value="png">PNG (Verlustfrei)</option>
                          <option value="jpeg">JPEG (Kompakt)</option>
                        </select>
                        <button
                          onClick={handleExportImages}
                          disabled={imgExportLoading}
                          className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                        >
                          {imgExportLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                          <span>Seiten umwandeln</span>
                        </button>
                      </div>
                    </div>

                    {exportedImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {exportedImages.map((img) => (
                          <div
                            key={img.pageNumber}
                            className="p-2.5 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col items-center gap-2"
                          >
                            <img
                              src={img.dataUrl}
                              alt={`Seite ${img.pageNumber}`}
                              className="h-32 object-contain rounded shadow-sm bg-white"
                            />
                            <a
                              href={img.dataUrl}
                              download={img.fileName}
                              className="w-full py-1.5 bg-[#0071E3] text-white rounded-lg text-[11px] font-semibold text-center hover:bg-blue-600"
                            >
                              Seite {img.pageNumber} speichern
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card B: Metadata & Sanitizer */}
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#1D1D1F]">
                            PDF-Metadaten prüfen & Datenschutz-Bereinigung
                          </h3>
                          <p className="text-xs text-gray-500">
                            Versteckte Autorennamen, Programm-Infos und Eigenschaften vor dem Versand an Kunden bereinigen
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSaveMetadata(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
                      >
                        <Trash2 size={14} />
                        <span>Alle Metadaten löschen & speichern</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'title', label: 'Dokumenttitel' },
                        { key: 'author', label: 'Autor / Verfasser' },
                        { key: 'subject', label: 'Betreff' },
                        { key: 'keywords', label: 'Stichwörter' },
                        { key: 'creator', label: 'Ursprungsprogramm' },
                        { key: 'producer', label: 'PDF-Konverter' },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={(metadata as any)[field.key] || ''}
                            onChange={(e) =>
                              setMetadata({ ...metadata, [field.key]: e.target.value })
                            }
                            placeholder="Leer (keine Angabe)"
                            className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs"
                          />
                        </div>
                      ))}
                    </div>

                    {metaSavedMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                        {metaSavedMsg}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleSaveMetadata(false)}
                        className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-sm transition"
                      >
                        Metadaten übernehmen & PDF speichern
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
