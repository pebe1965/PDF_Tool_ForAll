import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  RefreshCw,
  Sparkles,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Cpu,
  Laptop,
  Check,
} from 'lucide-react';
import {
  APP_VERSION,
  GITHUB_REPO,
  APP_MARKETPLACE_URL,
  getZugangscode,
  setZugangscode,
  setEigenerSchluessel,
  istZugangscode,
  pruefeZugangscode,
  VerbindungsStatus,
} from '../config';
import { checkForGitHubUpdate, UpdateInfo } from '../lib/updateService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'updates' | 'ai' | 'about';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'updates',
}) => {
  const [activeTab, setActiveTab] = useState<'updates' | 'ai' | 'about'>(initialTab);

  // Update check states
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [selfUpdating, setSelfUpdating] = useState(false);
  const [selfUpdateMsg, setSelfUpdateMsg] = useState<string | null>(null);
  const [autoCheck, setAutoCheck] = useState<boolean>(() => {
    return localStorage.getItem('auto_check_updates') !== 'false';
  });

  // Gemini API Key states
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);

  // Zugangscode von NotionaryAtlas
  const [codeInput, setCodeInput] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<VerbindungsStatus | null>(null);
  const [codePrueft, setCodePrueft] = useState(false);
  const [zeigeEigenenSchluessel, setZeigeEigenenSchluessel] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Load custom API key if present
      const customKey = localStorage.getItem('gemini_custom_api_key') || '';
      setApiKeyInput(customKey);
      setHasCustomKey(!!customKey);
      setZeigeEigenenSchluessel(!!customKey);
      setApiKeySaved(false);
      setCodeInput(getZugangscode());
      setCodeStatus(null);
      setSelfUpdateMsg(null);

      // Perform update check if none exists yet
      if (!updateInfo) {
        handleCheckUpdates();
      }
    }
  }, [isOpen, initialTab]);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setSelfUpdateMsg(null);
    try {
      const info = await checkForGitHubUpdate();
      setUpdateInfo(info);
    } catch (_) {
      // Ignored
    } finally {
      setChecking(false);
    }
  };

  const handleSelfUpdate = async () => {
    setSelfUpdating(true);
    setSelfUpdateMsg(null);
    try {
      const res = await fetch('/api/self-update', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setSelfUpdateMsg(`✅ Update auf v${data.version} installiert! App wird neu geladen...`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSelfUpdateMsg(
          data?.error ||
            'Direkt-Update über den lokalen Server nicht verfügbar. Bitte lade unten das .dmg oder .zip Paket herunter.'
        );
      }
    } catch (_) {
      setSelfUpdateMsg(
        'Direkt-Update über den lokalen Server nicht verfügbar. Bitte lade unten das .dmg oder .zip Paket herunter.'
      );
    } finally {
      setSelfUpdating(false);
    }
  };

  const handleToggleAutoCheck = (enabled: boolean) => {
    setAutoCheck(enabled);
    localStorage.setItem('auto_check_updates', enabled ? 'true' : 'false');
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    setEigenerSchluessel(trimmed);
    setHasCustomKey(!!trimmed);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2500);
  };

  // Speichern und gleich prüfen — ein vertippter Code soll sofort auffallen,
  // nicht erst beim ersten Klick auf „Zusammenfassen".
  const handleSaveCode = async () => {
    const code = codeInput.trim();
    if (!code) {
      setZugangscode('');
      setCodeStatus(null);
      return;
    }
    if (!istZugangscode(code)) {
      setCodeStatus({ verbunden: false, fehler: 'Das ist kein Zugangscode von NotionaryAtlas (beginnt mit „na_“).' });
      return;
    }
    setZugangscode(code);
    setCodePrueft(true);
    setCodeStatus(await pruefeZugangscode(code));
    setCodePrueft(false);
  };

  const handleResetApiKey = () => {
    setEigenerSchluessel('');
    setApiKeyInput('');
    setHasCustomKey(false);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A5F5] text-white flex items-center justify-center shadow-sm">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">Einstellungen & Updates</h2>
              <p className="text-xs text-gray-500">PDF Tool ForAll • v{APP_VERSION}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-200 px-6 bg-white gap-2 pt-2">
          <button
            onClick={() => setActiveTab('updates')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'updates'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            <span>Updates & Version</span>
            {updateInfo?.updateAvailable && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'ai'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles size={14} />
            <span>Gemini KI</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'about'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Über die App</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: UPDATES & VERSION */}
          {activeTab === 'updates' && (
            <div className="space-y-4">
              {/* Current Version Card */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Installierte Version</div>
                  <div className="text-base font-bold text-[#1D1D1F] font-mono flex items-center gap-2 mt-0.5">
                    <span>v{APP_VERSION}</span>
                    <span className="text-[10px] font-sans font-medium px-2 py-0.5 bg-blue-100 text-[#0071E3] rounded-full">
                      Aktiv
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Repository: <span className="font-mono text-gray-600">{GITHUB_REPO}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckUpdates}
                  disabled={checking}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0071E3] hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                  <span>{checking ? 'Prüfe Releases...' : 'Nach Updates suchen'}</span>
                </button>
              </div>

              {/* Status Message */}
              {checking ? (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-900">
                  <RefreshCw size={15} className="animate-spin text-[#0071E3]" />
                  <span>Frage die neuesten GitHub Releases von <strong>{GITHUB_REPO}</strong> ab...</span>
                </div>
              ) : updateInfo ? (
                updateInfo.updateAvailable ? (
                  /* Update Available Alert */
                  <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl space-y-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                          ✨
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-emerald-950">
                            Neues Update verfügbar: v{updateInfo.latestVersion}
                          </h4>
                          <p className="text-xs text-emerald-700">
                            {updateInfo.releaseName || `Release v${updateInfo.latestVersion}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                        Neu
                      </span>
                    </div>

                    {/* Release Notes */}
                    {updateInfo.releaseNotes && (
                      <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-36 overflow-y-auto border border-emerald-200/60 shadow-inner">
                        {updateInfo.releaseNotes}
                      </div>
                    )}

                    {/* 1-Click Direct In-App Update */}
                    <div className="pt-1 space-y-2">
                      <button
                        onClick={handleSelfUpdate}
                        disabled={selfUpdating}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0071E3] hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition shadow-md"
                      >
                        <RefreshCw size={14} className={selfUpdating ? 'animate-spin' : ''} />
                        <span>
                          {selfUpdating
                            ? 'Lade Update von GitHub und installiere...'
                            : `⚡ Jetzt direkt im Tool auf v${updateInfo.latestVersion} updaten`}
                        </span>
                      </button>

                      {selfUpdateMsg && (
                        <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-200 text-xs text-gray-800 text-center font-medium">
                          {selfUpdateMsg}
                        </div>
                      )}
                    </div>

                    {/* Action Download Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                      {updateInfo.dmgUrl && (
                        <a
                          href={updateInfo.dmgUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                        >
                          <Download size={13} />
                          <span>macOS (.dmg) herunterladen</span>
                        </a>
                      )}
                      {updateInfo.zipUrl && (
                        <a
                          href={updateInfo.zipUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                        >
                          <Download size={13} />
                          <span>Windows (.zip) herunterladen</span>
                        </a>
                      )}
                    </div>

                    <div className="text-center">
                      <a
                        href={updateInfo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:underline font-medium"
                      >
                        <span>Auf GitHub Releases ansehen</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Up to date Card */
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Du verwendest die neueste Version (v{APP_VERSION})</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Es sind keine neueren Releases auf GitHub verfügbar. Zuletzt geprüft: {updateInfo.checkedAt} Uhr.
                      </p>
                    </div>
                  </div>
                )
              ) : null}

              {/* Automatic Update Check Option */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCheck}
                    onChange={(e) => handleToggleAutoCheck(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0071E3] focus:ring-[#0071E3]"
                  />
                  <span>Beim Start der App automatisch im Hintergrund nach Updates suchen</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: GEMINI KI CONFIGURATION */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-950">
                <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">KI über dein NotionaryAtlas-Konto</p>
                  <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                    Erstelle im Marketplace von NotionaryAtlas beim PDF Tool einen Zugangscode und füge ihn hier ein.
                    Abgerechnet wird über die KI-Credits deines Kontos – ein eigener Gemini-Schlüssel ist nicht nötig.
                  </p>
                  <a
                    href={APP_MARKETPLACE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:underline mt-1.5"
                  >
                    Zugangscode im Marketplace erstellen <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between text-xs p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-gray-600 font-medium">Aktive Verbindung:</span>
                <span
                  className={`font-semibold px-2.5 py-0.5 rounded-full text-[11px] ${
                    hasCustomKey
                      ? 'bg-purple-100 text-purple-800'
                      : istZugangscode(getZugangscode())
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {hasCustomKey
                    ? 'Eigener Gemini-Schlüssel'
                    : istZugangscode(getZugangscode())
                      ? 'NotionaryAtlas-Zugangscode'
                      : 'Nicht eingerichtet'}
                </span>
              </div>

              {/* Zugangscode */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Zugangscode:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCode ? 'text' : 'password'}
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="na_..."
                      className="w-full px-3.5 py-2.5 pr-10 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#0071E3] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title={showCode ? 'Code verbergen' : 'Code anzeigen'}
                    >
                      {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveCode}
                    disabled={codePrueft}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-60"
                  >
                    {codePrueft ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>Speichern & prüfen</span>
                  </button>
                </div>
                {codeStatus && (
                  codeStatus.verbunden ? (
                    <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                      <CheckCircle2 size={13} />
                      Verbunden{codeStatus.konto ? ` mit ${codeStatus.konto}` : ''}
                      {codeStatus.credits === null ? ' · KI unbegrenzt' : typeof codeStatus.credits === 'number' ? ` · ${codeStatus.credits} Credits übrig` : ''}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[11px] text-red-600">
                      <AlertCircle size={13} />
                      {codeStatus.fehler}
                    </p>
                  )
                )}
                <p className="text-[11px] text-gray-400">
                  Wird nur lokal auf diesem Gerät gespeichert. Im Marketplace kannst du den Code jederzeit widerrufen.
                </p>
              </div>

              {/* Eigener Schlüssel — optional */}
              <div className="pt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setZeigeEigenenSchluessel(!zeigeEigenenSchluessel)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-700 pt-3"
                >
                  <Key size={12} />
                  {zeigeEigenenSchluessel ? 'Eigenen Gemini-Schlüssel ausblenden' : 'Stattdessen eigenen Gemini-Schlüssel verwenden'}
                </button>
              </div>

              {zeigeEigenenSchluessel && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Eigener Gemini API-Key (hat Vorrang vor dem Zugangscode):
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-3.5 py-2.5 pr-10 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#0071E3] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title={showApiKey ? 'Key verbergen' : 'Key anzeigen'}
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Wird ausschließlich lokal in deinem Browser (`localStorage`) gespeichert und geht direkt an Google.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveApiKey}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                    >
                      {apiKeySaved ? <Check size={14} /> : <Key size={14} />}
                      <span>{apiKeySaved ? 'Gespeichert!' : 'Schlüssel speichern'}</span>
                    </button>

                    {hasCustomKey && (
                      <button
                        onClick={handleResetApiKey}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition"
                      >
                        Eigenen Schlüssel entfernen
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: ABOUT */}
          {activeTab === 'about' && (
            <div className="space-y-4 text-xs text-gray-600 leading-relaxed">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A5F5] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    📄
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1D1D1F]">PDF Tool ForAll</h4>
                    <p className="text-[11px] text-gray-500">Version v{APP_VERSION} • Open Source</p>
                  </div>
                </div>
                <p className="text-gray-700 pt-1">
                  Ein leistungsstarkes, komplett lokales Werkzeug zum Bearbeiten, Zusammenführen,
                  Signieren und KI-gestützten Übersetzen/Analysieren von PDF-Dokumenten.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-emerald-950">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-xs text-emerald-900">100 % Lokale Datenverarbeitung</h5>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Alle PDF-Bearbeitungen, Signaturen und Zusammenführungen finden ausschließlich lokal in deinem Browser / auf deinem Rechner statt. Keine Dokumentendaten verlassen jemals dein Gerät.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                <span className="text-gray-500">GitHub Repository:</span>
                <a
                  href={`https://github.com/${GITHUB_REPO}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0071E3] hover:underline flex items-center gap-1 font-mono font-medium"
                >
                  <span>{GITHUB_REPO}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#F5F5F7] border-t border-[#E8E8ED]">
          <span className="text-[11px] text-gray-400">
            PDF Tool ForAll • Kostenlos & Frei
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
