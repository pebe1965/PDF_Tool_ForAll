import React from 'react';
import { Home, FileEdit, FileStack, ShieldCheck, Sparkles, Settings, Wrench } from 'lucide-react';
import { APP_VERSION } from '../config';
import { UpdateNotification } from './UpdateNotification';

export type AppTab = 'home' | 'editor' | 'merge' | 'tools';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasActiveDocument?: boolean;
  onOpenAiAssistant?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  hasActiveDocument = false,
  onOpenAiAssistant,
  onOpenSettings,
}) => {
  return (
    <header className="h-[68px] bg-white/80 backdrop-blur-md border-b border-[#D2D2D7]/60 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none gap-2">
      {/* Brand Logo & Name (Klickbar für Rückkehr zur Startseite) */}
      <button
        onClick={() => onTabChange('home')}
        className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 group text-left cursor-pointer focus:outline-none transition hover:opacity-90"
        title="Zur Startseite / Hauptmenü"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A5F5] text-white flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition">
          <FileEdit size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-bold text-base sm:text-lg text-[#1D1D1F] tracking-tight whitespace-nowrap group-hover:text-[#0071E3] transition">
              PDF Tool ForAll
            </h1>
            <span className="hidden xl:inline-block text-[10px] font-semibold bg-blue-100 text-[#0071E3] px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
              Business Suite
            </span>
          </div>
          <p className="text-xs text-[#86868B] hidden 2xl:block truncate">
            Kostenlos • Ohne Cloud • 100% Datenschutz
          </p>
        </div>
      </button>

      {/* Main Mode Switcher Navigation */}
      <nav className="flex items-center bg-[#F5F5F7] p-1 rounded-2xl border border-[#E8E8ED] flex-shrink-0">
        <button
          onClick={() => onTabChange('home')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'home'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
          title="Startseite & Übersicht"
        >
          <Home size={16} className="flex-shrink-0" />
          <span>Startseite</span>
        </button>

        <button
          onClick={() => onTabChange('editor')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
          title="Bearbeiten & Signieren"
        >
          <FileEdit size={16} className="flex-shrink-0" />
          <span className="flex items-center gap-1.5">
            <span>Bearbeiten<span className="hidden lg:inline"> & Signieren</span></span>
            {hasActiveDocument && (
              <span
                className="w-2 h-2 rounded-full bg-[#0071E3] inline-block animate-pulse"
                title="Dokument aktiv geöffnet"
              />
            )}
          </span>
        </button>

        <button
          onClick={() => onTabChange('merge')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'merge'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
          title="Zusammenführen & Sortieren"
        >
          <FileStack size={16} className="flex-shrink-0" />
          <span>Zusammenführen<span className="hidden lg:inline"> & Sortieren</span></span>
        </button>

        <button
          onClick={() => onTabChange('tools')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'tools'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
          title="Werkzeuge & Business"
        >
          <Wrench size={16} className="flex-shrink-0" />
          <span>Werkzeuge<span className="hidden lg:inline"> & Business</span></span>
        </button>
      </nav>

      {/* Right: Updates, AI Assistant, Security & Version indicator */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0"
            title="Dokument mit Gemini KI analysieren, Rechnungen nach Excel exportieren, übersetzen oder korrigieren"
          >
            <Sparkles size={14} className="animate-pulse flex-shrink-0" />
            <span><span className="hidden sm:inline">Gemini </span>KI</span>
          </button>
        )}

        {/* Dynamic Update Notification from GitHub (Opens Settings Updates on click) */}
        <UpdateNotification onOpenSettingsUpdates={onOpenSettings} />

        {/* Settings & Updates button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 p-2 rounded-xl text-gray-600 hover:text-[#1D1D1F] hover:bg-gray-100 transition flex-shrink-0"
            title="Einstellungen & nach Updates suchen"
          >
            <Settings size={18} />
            <span className="hidden 2xl:inline text-xs font-semibold">Einstellungen</span>
          </button>
        )}

        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 whitespace-nowrap flex-shrink-0">
          <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
          <span>Lokal & Offline</span>
        </div>

        {onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            className="hidden md:inline text-[11px] font-mono text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-black px-2 py-1 rounded-lg transition whitespace-nowrap flex-shrink-0"
            title={`Version v${APP_VERSION} (Klicken für Updates & Einstellungen)`}
          >
            v{APP_VERSION}
          </button>
        ) : (
          <span className="hidden md:inline text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0">
            v{APP_VERSION}
          </span>
        )}
      </div>
    </header>
  );
};
