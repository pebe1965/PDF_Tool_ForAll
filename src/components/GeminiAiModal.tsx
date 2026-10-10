import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  FileText,
  CheckCircle2,
  Globe,
  PenLine,
  MessageSquare,
  Copy,
  PlusCircle,
  FilePlus,
  Loader2,
  Key,
  Check,
  Send,
  AlertCircle,
  Settings,
} from 'lucide-react';
import {
  summarizeDocument,
  checkGrammarAndSpelling,
  translateDocument,
  rewriteText,
  generateNewText,
  askDocumentQuestion,
  ChatMessage,
} from '../lib/geminiService';
import { getActiveGeminiApiKey } from '../config';

interface GeminiAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: ArrayBuffer | null;
  currentPage: number;
  numPages: number;
  onInsertTextIntoPage: (text: string) => void;
  onInsertAsNewPage?: (text: string) => void;
}

type TabType = 'summary' | 'grammar' | 'translate' | 'rewrite' | 'chat';

export const GeminiAiModal: React.FC<GeminiAiModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  currentPage,
  numPages,
  onInsertTextIntoPage,
  onInsertAsNewPage,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Summary options
  const [summaryStyle, setSummaryStyle] = useState<'bullet' | 'short' | 'detailed'>('bullet');

  // Translation options
  const [targetLang, setTargetLang] = useState<string>('Englisch');

  // Rewrite / Generate options
  const [rewriteMode, setRewriteMode] = useState<'rewrite' | 'new'>('rewrite');
  const [rewriteTone, setRewriteTone] = useState<'professional' | 'simple' | 'polite' | 'concise' | 'contract'>('professional');
  const [customInputText, setCustomInputText] = useState<string>('');

  // Chat Q&A options
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');

  // Settings / Key config dialog
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState(localStorage.getItem('gemini_custom_api_key') || '');
  const [hasApiKey, setHasApiKey] = useState(!!getActiveGeminiApiKey());

  useEffect(() => {
    setHasApiKey(!!getActiveGeminiApiKey());
  }, [showKeySettings, isOpen]);

  if (!isOpen) return null;

  const targetPageNum = scope === 'current' ? currentPage : undefined;

  // 1. Run Summary
  const handleRunSummary = async () => {
    if (!pdfBytes) {
      setError('Bitte zuerst ein PDF-Dokument öffnen.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultText('');
    try {
      const res = await summarizeDocument(pdfBytes, targetPageNum, summaryStyle);
      setResultText(res);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Erstellen der Zusammenfassung.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Run Grammar / Spellcheck
  const handleRunGrammar = async () => {
    if (!pdfBytes) {
      setError('Bitte zuerst ein PDF-Dokument öffnen.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultText('');
    try {
      const res = await checkGrammarAndSpelling(pdfBytes, targetPageNum);
      setResultText(res);
    } catch (err: any) {
      setError(err?.message || 'Fehler bei der Rechtschreibprüfung.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Run Translation
  const handleRunTranslate = async () => {
    if (!pdfBytes) {
      setError('Bitte zuerst ein PDF-Dokument öffnen.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultText('');
    try {
      const res = await translateDocument(pdfBytes, targetLang, targetPageNum);
      setResultText(res);
    } catch (err: any) {
      setError(err?.message || 'Fehler bei der Übersetzung.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Run Rewrite or Generate
  const handleRunRewrite = async () => {
    setLoading(true);
    setError(null);
    setResultText('');
    try {
      let res = '';
      if (rewriteMode === 'new') {
        if (!customInputText.trim()) {
          throw new Error('Bitte gib eine Beschreibung für den neuen Text ein.');
        }
        res = await generateNewText(customInputText);
      } else {
        if (!customInputText.trim()) {
          throw new Error('Bitte gib den Text ein, der umformuliert werden soll.');
        }
        res = await rewriteText(customInputText, rewriteTone);
      }
      setResultText(res);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Generieren des Texts.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Send Chat Message
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || loading) return;

    if (!pdfBytes) {
      setError('Bitte zuerst ein PDF-Dokument laden, um Fragen zu stellen.');
      return;
    }

    const question = chatInput.trim();
    setChatInput('');
    setError(null);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const answer = await askDocumentQuestion(pdfBytes, question, targetPageNum);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: answer,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Beantworten der Frage.');
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save custom key
  const handleSaveCustomKey = () => {
    if (customKeyInput.trim()) {
      localStorage.setItem('gemini_custom_api_key', customKeyInput.trim());
    } else {
      localStorage.removeItem('gemini_custom_api_key');
    }
    setHasApiKey(!!getActiveGeminiApiKey());
    setShowKeySettings(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in">
      {/* Slide-over panel */}
      <div className="w-full max-w-xl sm:max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#8E2DE2] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1D1D1F]">Gemini KI-Assistent</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-800 rounded-full">
                  Flash 3.7
                </span>
              </div>
              <p className="text-xs text-gray-500">Intelligente Dokumenten-Analyse & Textgenerierung</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* API Key Status / Config */}
            <button
              onClick={() => setShowKeySettings(!showKeySettings)}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                hasApiKey
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 animate-pulse'
              }`}
              title="API-Schlüssel Einstellungen"
            >
              <Key size={14} />
              <span className="hidden sm:inline">{hasApiKey ? 'Aktiv' : 'Schlüssel nötig'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* API Key Settings Drawer (Collapsible) */}
        {showKeySettings && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-800 flex items-center gap-1.5">
                <Settings size={14} />
                Google Gemini API-Schlüssel
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#0071E3] hover:underline"
              >
                Kostenlosen Schlüssel holen ↗
              </a>
            </div>
            <p className="text-gray-500 mb-2.5 leading-relaxed">
              Dein Schlüssel wird sicher und ausschließlich lokal in deinem Browser gespeichert.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-[#0071E3] font-mono text-xs"
              />
              <button
                onClick={handleSaveCustomKey}
                className="px-4 py-2 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl font-semibold transition"
              >
                Speichern
              </button>
            </div>
          </div>
        )}

        {/* Missing API Key Warning if not configured */}
        {!hasApiKey && !showKeySettings && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>Es ist noch kein Gemini API-Schlüssel hinterlegt.</span>
            </div>
            <button
              onClick={() => setShowKeySettings(true)}
              className="font-bold underline hover:opacity-80"
            >
              Jetzt hinterlegen
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-white px-3 gap-1 overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'summary'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText size={15} />
            <span>Zusammenfassung</span>
          </button>

          <button
            onClick={() => setActiveTab('grammar')}
            className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'grammar'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <CheckCircle2 size={15} />
            <span>Korrekturlesen</span>
          </button>

          <button
            onClick={() => setActiveTab('translate')}
            className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'translate'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Globe size={15} />
            <span>Übersetzen</span>
          </button>

          <button
            onClick={() => setActiveTab('rewrite')}
            className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'rewrite'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <PenLine size={15} />
            <span>Umschreiben & Text</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'chat'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <MessageSquare size={15} />
            <span>PDF-Chat</span>
          </button>
        </div>

        {/* Scope Selector (Only for document analysis tabs) */}
        {activeTab !== 'rewrite' && (
          <div className="px-6 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Bereich für die Analyse:</span>
            <div className="flex bg-gray-200/80 p-0.5 rounded-lg font-medium">
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1 rounded-md transition ${
                  scope === 'all' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600'
                }`}
              >
                Ganzes Dokument ({numPages} Seiten)
              </button>
              <button
                onClick={() => setScope('current')}
                className={`px-3 py-1 rounded-md transition ${
                  scope === 'current' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600'
                }`}
              >
                Nur aktuelle Seite ({currentPage})
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ZUSAMMENFASSUNG */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Art der Zusammenfassung
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSummaryStyle('bullet')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      summaryStyle === 'bullet'
                        ? 'border-[#0071E3] bg-blue-50/40 text-[#0071E3] font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">Kernaussagen</div>
                    <div className="text-[10px] text-gray-500">Aufzählung & Action Items</div>
                  </button>

                  <button
                    onClick={() => setSummaryStyle('short')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      summaryStyle === 'short'
                        ? 'border-[#0071E3] bg-blue-50/40 text-[#0071E3] font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">Kompakt (TL;DR)</div>
                    <div className="text-[10px] text-gray-500">In 3-4 prägnanten Sätzen</div>
                  </button>

                  <button
                    onClick={() => setSummaryStyle('detailed')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      summaryStyle === 'detailed'
                        ? 'border-[#0071E3] bg-blue-50/40 text-[#0071E3] font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">Ausführlich</div>
                    <div className="text-[10px] text-gray-500">Strukturierte Komplettanalyse</div>
                  </button>
                </div>
              </div>

              <button
                onClick={handleRunSummary}
                disabled={loading || !hasApiKey}
                className="w-full py-3 bg-gradient-to-r from-[#0071E3] to-[#0077ED] hover:from-[#0077ED] hover:to-[#005bb5] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>Zusammenfassung generieren</span>
              </button>
            </div>
          )}

          {/* TAB 2: RECHTSCHREIBUNG & GRAMMATIK */}
          {activeTab === 'grammar' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                Gemini prüft den Text auf Rechtschreibung, Kommasetzung, Grammatik und Stil und liefert sowohl eine Liste aller Korrekturen als auch den bereinigten Gesamttext.
              </div>

              <button
                onClick={handleRunGrammar}
                disabled={loading || !hasApiKey}
                className="w-full py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Rechtschreibung & Grammatik prüfen</span>
              </button>
            </div>
          )}

          {/* TAB 3: ÜBERSETZUNG */}
          {activeTab === 'translate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Zielsprache auswählen
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['Englisch', 'Deutsch', 'Französisch', 'Spanisch', 'Italienisch', 'Niederländisch'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setTargetLang(lang)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                        targetLang === lang
                          ? 'border-[#0071E3] bg-blue-50 text-[#0071E3]'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRunTranslate}
                disabled={loading || !hasApiKey}
                className="w-full py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                <span>In {targetLang} übersetzen</span>
              </button>
            </div>
          )}

          {/* TAB 4: UMSCHREIBEN & TEXT ERSTELLEN */}
          {activeTab === 'rewrite' && (
            <div className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setRewriteMode('rewrite')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    rewriteMode === 'rewrite' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Bestehenden Text umschreiben
                </button>
                <button
                  onClick={() => setRewriteMode('new')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    rewriteMode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Neuen Text von Grund auf erstellen
                </button>
              </div>

              {rewriteMode === 'rewrite' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Gewünschter Tonfall
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'professional', label: 'Professionell' },
                        { id: 'polite', label: 'Höflich & Herzlich' },
                        { id: 'concise', label: 'Prägnant & Kurz' },
                        { id: 'simple', label: 'Einfache Sprache' },
                        { id: 'contract', label: 'Rechtssicher / Formal' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setRewriteTone(t.id as any)}
                          className={`p-2 rounded-xl border text-xs font-medium text-center transition ${
                            rewriteTone === t.id
                              ? 'border-[#0071E3] bg-blue-50 text-[#0071E3] font-semibold'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Text zum Umschreiben eingeben:
                    </label>
                    <textarea
                      value={customInputText}
                      onChange={(e) => setCustomInputText(e.target.value)}
                      placeholder="Füge hier den Text ein, den die KI für dich umformulieren soll..."
                      rows={4}
                      className="w-full p-3 bg-white border border-gray-300 rounded-2xl text-xs focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Was soll Gemini für dich verfassen?
                  </label>
                  <textarea
                    value={customInputText}
                    onChange={(e) => setCustomInputText(e.target.value)}
                    placeholder="Z. B. 'Schreibe ein formelles Kündigungsschreiben für einen Mietvertrag zum 31.12. mit Bitte um schriftliche Bestätigung'..."
                    rows={4}
                    className="w-full p-3 bg-white border border-gray-300 rounded-2xl text-xs focus:outline-none focus:border-[#0071E3]"
                  />
                </div>
              )}

              <button
                onClick={handleRunRewrite}
                disabled={loading || !hasApiKey || !customInputText.trim()}
                className="w-full py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{rewriteMode === 'new' ? 'Text generieren' : 'Jetzt umschreiben'}</span>
              </button>
            </div>
          )}

          {/* TAB 5: INTERAKTIVER CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[400px] border border-gray-200 rounded-2xl bg-gray-50 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <MessageSquare size={36} className="mb-2 text-gray-300" />
                    <p className="text-xs font-semibold text-gray-600">Stelle beliebige Fragen zum Dokument</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                      Z. B.: „Was sind die Kündigungsfristen?“, „Wer sind die Vertragsparteien?“ oder „Welche Beträge werden genannt?“
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-[#0071E3] text-white'
                            : 'bg-white text-gray-800 border border-gray-200/80 whitespace-pre-wrap'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.sender === 'ai' && (
                        <div className="flex gap-2 mt-1 px-1">
                          <button
                            onClick={() => handleCopyText(msg.text)}
                            className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-1"
                          >
                            <Copy size={10} /> Kopieren
                          </button>
                          <button
                            onClick={() => onInsertTextIntoPage(msg.text)}
                            className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-1"
                          >
                            <PlusCircle size={10} /> In PDF
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 italic p-2">
                    <Loader2 size={14} className="animate-spin text-[#0071E3]" />
                    <span>Gemini denkt nach...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChatMessage} className="p-2.5 bg-white border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Frage zum Dokument eingeben..."
                  disabled={loading || !hasApiKey}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || loading || !hasApiKey}
                  className="w-9 h-9 rounded-xl bg-[#0071E3] hover:bg-blue-600 text-white flex items-center justify-center transition disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Presentation Box (For Summary, Grammar, Translate, Rewrite) */}
          {activeTab !== 'chat' && resultText && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={13} className="text-purple-600" />
                  Ergebnis von Gemini
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyText(resultText)}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                  </button>

                  <button
                    onClick={() => onInsertTextIntoPage(resultText)}
                    className="flex items-center gap-1 text-xs text-white bg-[#0071E3] hover:bg-blue-600 px-3 py-1 rounded-lg transition shadow-sm font-semibold"
                    title="Fügt den Text als Textfeld auf der aktuellen PDF-Seite ein"
                  >
                    <PlusCircle size={13} />
                    <span>In PDF einfügen</span>
                  </button>

                  {onInsertAsNewPage && (
                    <button
                      onClick={() => onInsertAsNewPage(resultText)}
                      className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition font-semibold"
                      title="Hängt eine neue Seite ans PDF an und platziert diesen Text"
                    >
                      <FilePlus size={13} />
                      <span>Als neue Seite</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed shadow-inner max-h-96 overflow-y-auto">
                {resultText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
