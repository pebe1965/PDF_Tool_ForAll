import React from 'react';
import { FileEdit, FileStack, ShieldCheck, Sparkles, Settings, Wrench } from 'lucide-react';
import { APP_VERSION } from '../config';
import { UpdateNotification } from './UpdateNotification';

interface HeaderProps {
  activeTab: 'editor' | 'merge' | 'tools';
  onTabChange: (tab: 'editor' | 'merge' | 'tools') => void;
  onOpenAiAssistant?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenAiAssistant,
  onOpenSettings,
}) => {
  return (
    <header className="h-[68px] bg-white/80 backdrop-blur-md border-b border-[#D2D2D7]/60 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A5F5] text-white flex items-center justify-center shadow-md">
          <FileEdit size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-[#1D1D1F] tracking-tight">PDF Tool ForAll</h1>
            <span className="text-[10px] font-semibold bg-blue-100 text-[#0071E3] px-2 py-0.5 rounded-full uppercase tracking-wider">
              Business Suite
            </span>
          </div>
          <p className="text-xs text-[#86868B] hidden sm:block">
            Kostenlos • Ohne Cloud • 100% Datenschutz
          </p>
        </div>
      </div>

      {/* Main Mode Switcher Navigation */}
      <nav className="flex items-center bg-[#F5F5F7] p-1 rounded-2xl border border-[#E8E8ED]">
        <button
          onClick={() => onTabChange('editor')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'editor'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
        >
          <FileEdit size={16} />
          <span>Bearbeiten & Signieren</span>
        </button>

        <button
          onClick={() => onTabChange('merge')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'merge'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
        >
          <FileStack size={16} />
          <span>Zusammenführen & Sortieren</span>
        </button>

        <button
          onClick={() => onTabChange('tools')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'tools'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
        >
          <Wrench size={16} />
          <span>Werkzeuge & Business</span>
        </button>
      </nav>

      {/* Right: Updates, AI Assistant, Security & Version indicator */}
      <div className="flex items-center gap-2.5">
        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition hover:scale-105 active:scale-95"
            title="Dokument mit Gemini KI analysieren, Rechnungen nach Excel exportieren, übersetzen oder korrigieren"
          >
            <Sparkles size={14} className="animate-pulse" />
            <span>Gemini KI</span>
          </button>
        )}

        {/* Dynamic Update Notification from GitHub (Opens Settings Updates on click) */}
        <UpdateNotification onOpenSettingsUpdates={onOpenSettings} />

        {/* Settings & Updates button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 p-2 rounded-xl text-gray-600 hover:text-[#1D1D1F] hover:bg-gray-100 transition"
            title="Einstellungen & nach Updates suchen"
          >
            <Settings size={18} />
            <span className="hidden xl:inline text-xs font-semibold">Einstellungen</span>
          </button>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Lokal & Offline</span>
        </div>

        {onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            className="hidden sm:inline text-[11px] font-mono text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-black px-2 py-1 rounded-lg transition"
            title={`Version v${APP_VERSION} (Klicken für Updates & Einstellungen)`}
          >
            v{APP_VERSION}
          </button>
        ) : (
          <span className="hidden sm:inline text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
            v{APP_VERSION}
          </span>
        )}
      </div>
    </header>
  );
};
