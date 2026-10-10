import React from 'react';
import { FileEdit, FileStack, ShieldCheck, Laptop, Tablet } from 'lucide-react';
import { APP_VERSION } from '../config';
import { UpdateNotification } from './UpdateNotification';

interface HeaderProps {
  activeTab: 'editor' | 'merge';
  onTabChange: (tab: 'editor' | 'merge') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
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
              Free & Open
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
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'merge'
              ? 'bg-white text-[#0071E3] shadow-sm'
              : 'text-[#86868B] hover:text-[#1D1D1F]'
          }`}
        >
          <FileStack size={16} />
          <span>Zusammenführen & Sortieren</span>
        </button>
      </nav>

      {/* Right: Updates, Security & Version indicator */}
      <div className="flex items-center gap-3">
        {/* Dynamic Update Notification from GitHub */}
        <UpdateNotification />

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Lokal & Offline</span>
        </div>

        <span className="hidden sm:inline text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
          v{APP_VERSION}
        </span>
      </div>
    </header>
  );
};
